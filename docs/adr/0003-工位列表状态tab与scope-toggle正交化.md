# ADR-0003 工位列表状态 Tab 探索与撤销(最终结论:维持 ListToolbar 多选状态过滤)

- 状态:**2026-07-01 五次修订(最终)：整个"状态 Tab / 桶系统"方案被撤销**。
  `/lab` 恢复为与 `/projects` `/bioinfo-tasks` `/intake` 完全一致的
  `ListToolbar` 多选状态过滤(`TERMINAL_*_STATUSES` + `DEFAULT_*_SELECTION`
  默认隐藏终态)。唯一保留下来的产出是：**`?mode=schedule` 与状态过滤解耦**
  (`range=pending` 曾经把整页替换成排期看板这个问题是真实的，值得修)。
  下文 §背景~§状态桶边界~§scope toggle 移除记录~§「任务/排期」改回两级 Tab
  这些历史修订 **全部是被放弃的路径**，只保留作为"为什么不要重蹈覆辙"的记录，
  见文末 §"最终撤销记录"。**新读者直接跳到该章节即可，不需要理解中间四轮**。
- 决策者:产品负责人(老板)拍板,AI 实现;本 ADR 的核心教训是 **AI 过度设计**——
  原始问题只是 `range=mine/pending/all` 混了 scope 与"排期视图触发器"两个
  维度，AI 却借机把状态过滤这个"从来没坏过"的部分也整体替换掉，五轮来回
  才发现应该恢复原状。
- 相关代码(最终态):
  - `app/(app)/lab/page.tsx`：`ListToolbar` 多选状态过滤 + `?mode=schedule` 按钮
  - `lib/schemas/experiment-task.ts` `lib/experiment-tasks/service.ts`：无 tab/桶/scope 概念
  - ~~`components/list/list-tabs.tsx`~~ ~~`lib/workstation-buckets.ts`~~
    ~~`components/list/list-scope-toggle.tsx`~~ 及其测试：**已删除**

## 背景

工位列表(`/lab` `/bioinfo-tasks` `/intake`)与 `/projects` 现状用 `?range=mine/pending/all`
(或 `mine/unassigned/all`)切换语义。这把**两个正交维度**塞进同一 Tab 控件:

| Tab | 实质 | 用户问"什么" |
|---|---|---|
| mine / 全部 | scope(谁) | "个人 or 团队" |
| pending / unassigned | status 边界 | "谁该处理" |

两维度混在一个 Tab 行中,心智模型错位——主流产品(Linear、Jira、GitHub
Issues、Notion、Lark 等)都用 Tab 表达"状态",scope 走单独的 toggle 或 filter 下拉。

此外,`range=pending` 在 `/lab` 强行让整张表变成 `ExperimentScheduleBoard`(14 天
负载 + 待预约批次),混进列表 Tab,违反"一个 Tab 一种正交维度"原则。

**关键再判断**:状态 Tab + scope toggle 拆分后,排期视图(待预约批次 + 14 天负载)
仍然是工位用户的"另一条工作流",但它在心智上不与状态 Tab 同级 —— 改用
`?mode=schedule` 单独标志位,与 `tab`/`scope` 解耦,日历视图作为"另一视图"
入口,Tab 只控任务列表。

## 决策

**判据:Tab 表达 status(scope Tab 移走)。**

1. **状态 Tab**(主控件,所有工位都有):buckets
   - 待办 / 进行中 / 已完成 — 单值,默认不写 URL
   - 各工位的 status → 桶 映射集中在 `lib/workstation-buckets.ts`,不允许散落 page
2. **scope toggle**(次控件,与状态 Tab 平级,工位按需):
   - 我的 / 团队 — 二段按钮
   - 默认值角色驱动(见 §"scope 默认规则")
3. **排期视图与状态 Tab 解耦**:`?mode=schedule` 标志位,与 `tab` 同 URL 但解析独立;
   `scheduleHref = () => baseParams + "mode=schedule" + 保留 plannedDate`
4. **URL schema 全破重塑**(项目未上线,无迁移负担):
   - `?range=mine/pending/all`  →  `?tab=todo/doing/done&scope=mine|team`
   - `?tab=unassigned` 不再单独(并入 `bioinfo` 桶的「待办」+ analyst IS NULL)
   - `?awaiting` `?open` `?received` `?due` `?date` `?plannedDate` 等深度链接保留
5. **scope 默认值**(角色驱动,不记忆):
   - `lab_operator` / `bioinfo_analyst` / `sample_receiver` → `mine`(操作类聚焦个人)
   - `sales_owner` / `project_manager` / `admin` / `viewer` → `team`(管理类看团队)

### 状态桶边界(集中于 `lib/workstation-buckets.ts`)

```
/lab           todo=[waiting_schedule]
                doing=[scheduled, in_progress, waiting_feedback]
                done=[completed, cancelled, abnormal]

/bioinfo-tasks  todo=[pending]
                doing=[in_progress, waiting_review, waiting_delivery]
                done=[delivered, abnormal]

/intake         todo=[waiting_arrival]
                done=[received, received_abnormal]
                (only 2 桶,不暴露「进行中」;前端用 INTAKE_BUCKETS 常量渲染)

/projects       todo=[draft, waiting_sample]
                doing=[sample_received, lab_in_progress, waiting_bioinfo,
                       bioinfo_in_progress, waiting_delivery]
                done=[completed, abnormal, terminated]
```

## 被否决的备选

- **维持现状 `?range=mine/all` + 单行 mode=schedule Tab**:Tab 三段(我的/全部/
  排期)继续存在,排期视图独立 Tab 进入。否决:仍是 scope × status 混,
  排期 Tab 在状态维 6 态抽象里没有自然映射位。
- **Tab 全 by 状态 / scope 单独放下拉 status 多选框**:MultiSelect 弹窗每次切
  scope 都要打开下拉,跨工位语义不一致;且 scope 是 2 态(我的/团队),下拉成本过度。
  选中 ToggleGroup/segmented button 直接优于下拉。
- **scope 走 localStorage 记忆**:项目未上线,先做角色驱动默认;后续如果用户反
  馈"切换频繁",再记忆。本次不做,避免一上来复杂度爆炸。
- **/intake 全改 3 桶**:只有 waiting_arrival / received / received_abnormal,
  没 "in_progress"。强行套 3 段会让"进行中"长期空态,破坏"工作台是角色队列形态"
  的底色。**保留 2 桶**(待办 / 已完成)交由 INTAKE_BUCKETS 常量渲染。

## 重要约定

### projects 的 abnormal 不入「待办」桶,走「需关注」置顶分组

`abnormal` 在 /lab 与 /bioinfo 与 /intake 都归「已完成」(终态 —— 完成后异常
登记);但在 /projects 视角下含义不同 —— 项目处于 abnormal 状态**需要主动处理**,
语义上是"待办"。如果改桶会让两工位含义冲突,因此:

- `/projects` 桶表中 `abnormal` 仍归「待办」
- 同时 `ATTENTION_STATUSES = [abnormal, waiting_delivery, draft]` 保留为
  `/projects` 工位的"需关注"置顶分组(独立于 3 桶)
- 即:`/projects` 的「待办」桶 + 「需关注」置顶分组两个用户都看,前者是钝化
  的 status 桶,后者是高优先视觉信号。这是项目级 hub 的特例,其他工位不需要
  关心这条。

### `mine/unassigned/all` 直接重塑,无兼容层

原 `?range=unassigned`(生信工位)等价于 `tab=todo` + `scope=team` + analystId IS NULL +
status = pending。这条等价映射硬编码于 service 内部的 `where`,不涉及 URL 重塑兼容。
项目未上线,直接换;若上线后再发现,补 translate 兜底。

### 角色默认与 sticky

本次只做角色驱动默认,不记忆 localStorage。如果用户多次手动切 scope 反映
"高频切换"痛点,下一轮再加 sticky(本地存储)。决策标准:用户客诉"每个角色
总能拿到对的默认 = 角色驱动已足够"。

## 影响

- 首批改 `/lab`(commit `7b00fd8`),`/bioinfo-tasks` `/intake` `/projects` 后续跟进
- 桶映射集中:`lib/workstation-buckets.ts` 是唯一权威源
- `components/list/list-tabs.tsx` 是唯一保留的新 primitive,`/bioinfo-tasks` 与
  `/projects` 后续跟进时复用；~~`list-scope-toggle.tsx`~~ 已在二次修订中删除
- AGENTS.md「UI 决策原则」一节加指针指向本 ADR

## scope toggle 移除记录(2026-07-01 二次修订)

**结论:「我的/团队」scope toggle 整体移除,不再作为 /lab 的常驻控件。**

### 移除原因

1. **与产品自身的可见性哲学冲突**:ADR-0001 的立场是"全员可信同事,看得见喊得着",
   可见性全员开放,明确反对"个人视角 vs 团队视角"这类权限森严系统惯用的划分。
   scope toggle 恰恰是在一个刻意反权限墙的小团队系统里,重新引入一层"个人聚焦"的
   分野——这与产品自己的立场矛盾。
2. **当前数据规模用不上**:实测团队总任务数是个位数,"负责人"列已经在表格里,
   肉眼扫一眼就知道是谁的,筛选控件在这个规模下边际价值接近零。
3. **它是设计者单方面的假设,未经产品负责人验证**:「操作类角色默认聚焦个人待办」
   是 AI 在首次设计 ADR-0003 时单方面写下的判断,并非产品负责人事先确认过的真实
   需求。当产品负责人反问"负责人过滤有必要吗"时,说明这个假设本身该被质疑，而不是
   继续优化它的视觉呈现(此前已经历两轮视觉调整仍未解决"看起来像第二层 Tab"的
   问题——根本原因不是样式，是这个控件本不该在这里)。

### 被否决的挽救方案

- **压缩成一个"负责人"下拉筛选**(在 ListToolbar 里,类似 status/serviceLevel 那样的
  单选过滤,支持选具体某人,不只是"我/全部"二选一):功能上更强(能查具体某人的队列),
  但需要"角色驱动默认值 + 与 URL 参数缺省态解耦"的定制逻辑，复杂度和现在的
  segmented-toggle 相当，且仍然是在回答"有必要吗"这个问题被质疑后继续加码。
  在当前团队规模下没有验证过这个更强能力的真实需求，故不做，等真出现"按人查"
  的诉求再针对性设计。
- **只做视觉降级(缩小成 chip,不改变其存在)**:这是本次反思之前尝试的方向,
  但没有回答"这个控件到底解决了谁的什么问题"，只是持续在同一个错误假设上打磨样式。

### 保留的底层能力

- `?operatorId=` 作为深链接/API 层过滤能力保留在 `lib/schemas/experiment-task.ts`
  与 `buildTaskListWhere`(`lib/experiment-tasks/service.ts`)中,不受 UI 变化影响、
  不在界面暴露。真出现"按负责人查"的验证过的需求时,直接在此基础上加 UI，
  不需要重新设计底层过滤。
- `defaultScope`/`parseScope`/`LabScope` 相关函数与类型、`ListScopeToggle` 组件
  及其测试全部删除,不保留"以防万一"的兼容代码。

### 对其他工位的启示

`/bioinfo-tasks` `/intake` `/projects` 后续跟进本 ADR 时,**不要**默认照搬"我的/团队"
scope toggle 模式——先问同样的问题("这个工位真的需要个人/团队视角切换吗，还是
负责人列已经够用”)，而不是把 §决策 里失效的"scope 默认规则"直接复制过去。

## 「排期」移出 Tab 行,改为独立 Button(2026-07-01 三次修订)

**结论:「排期」不再作为状态 Tab 行的第 4 项，改成同一行右侧的普通 `Button`。**

移除 scope toggle 后，状态 Tab 行短暂变成 `[待办][进行中][已完成][📅排期]`
四项一行的形态。产品负责人反馈"这四种放在一起看着别扭"——排查后确认这不是
样式问题，是**语义类别错误**：Tab 这个控件约定俗成地代表"同一份数据的不同
状态切面"，待办/进行中/已完成三项都满足这个约定；但"排期"是日历规划 + 按
批次预约新任务的独立工具，不是任务列表的另一种切面。给它加图标只是在掩盖
这个类别错误，视觉上仍然"混进了同一组"。

改法：
- 「排期」改成普通 `Button`(`variant="default"`/`"outline"` 切换表达"是否
  当前在排期模式")，与 `ListTabs` 分离渲染，但仍在同一个 flex 行里
  (`justify-between`：Tab 左、Button 右)，视觉上不再有下划线激活样式，
  一眼就能看出它和状态 Tab 不是同类东西
- 进入排期模式时，状态 Tab **不高亮任何一项**——`ListTabs` 新增对
  `value={null}` 的支持(区别于不传 `value` 时退回 `defaultValue`)，显式传
  `null` 表示"调用方当前处于与本 Tab 组正交的另一模式，没有哪个状态算
  当前选中"。此前 `value ?? resolvedDefault` 会把 `null` 也当成"未传"处理，
  导致排期模式下"进行中"仍错误地保持高亮

### 被否决的备选

- **保留在 Tab 行内，只加粗/换色区分**：视觉上仍然是"Tab 组的一部分"，没有
  解决语义错误，只是让"别扭感"变得不那么明显。
- **移到侧栏或独立导航项**：过度——工位内部的视图切换不需要提升到侧栏级别，
  当前工位内一行足够。

## 「任务/排期」改回两级 Tab,不用 Button(2026-07-01 四次修订)

**结论:三次修订的"Button 而非 Tab"判断被推翻——「任务/排期」重新做成 Tab,
但作为独立于状态 Tab 的第一级(上级),状态 Tab 降为第二级(下级)。**

三次修订把「排期」从 Tab 行移出、改成 Button,理由是"Tab 代表同一份数据的
不同状态切面，排期是不同的工具，不应该和状态 Tab 用同一种控件"。产品负责人
反馈"感觉排期/任务更适合 tab 切换"，反向推翻了这个判断——重新review 后确认
这个反驳站得住:

- "Tab 只能表达同一份数据的状态切面"这条约定本身就**过窄**。Notion 的
  Table/Board/Calendar 视图切换、Linear 的 List/Board 切换都是 Tab，
  它们同样代表"用不同方式处理同一批任务/记录"，而不是单纯的状态过滤——
  这与「任务(按状态浏览)/排期(日历规划)」的关系是同一类。
- 之前反对的真正问题不是"该不该用 Tab"，是**层级坍缩**——待办/进行中/
  已完成/排期四项**同一层**摆在一起，产品负责人的原话"四种放一起看着别扭"
  说的是缺少层级，不是控件类型选错。三次修订误诊为"控件类型问题"，正确
  诊断应该是"层级问题"。

改法:

- 「任务/排期」变成**第一级** Tab，用 `variant="default"`(填充胶囊背景)—— 
  比第二级"重"，暗示"先选模式，再在模式内选状态"的层级关系
- 「待办/进行中/已完成」仍是 Tab，但降为**第二级**，`variant="line"`(下划线)，
  且只在"任务"模式下渲染——两级视觉样式不同(填充 vs 下划线)，读者能一眼
  区分"这是模式" vs "这是模式内的子状态"，不会像三次修订之前那样被误读成
  同一层的四个并列项
- `ListTabs` 新增 `variant?: "default" | "line"` prop(默认 "line"，向后兼容
  现有状态 Tab 用法)，复用同一套 URL 绑定逻辑(defaultValue/extraSearchParams/
  href 覆盖)服务两级，不新建组件
- 三次修订引入的 Button 双向切换("排期看板"/"返回任务列表")、`listModeHref`、
  `ListChecks` 图标全部撤销，回到用 `ListTabs` 的 `href` 单项覆盖机制处理
  「排期」项的跳转(与状态 Tab 共用 `mode` 独立于 `tab` 的 query key)

### 被否决的备选

- **维持三次修订的 Button 方案**:产品负责人已明确反馈更偏好 Tab，不再坚持
  "Button 更语义准确"这条论据——准确性判断本身就有主观空间，产品负责人的
  直觉应优先于设计者的架构洁癖。
- **四项拉平仍做一级 Tab，只加视觉分隔线**:分隔线是弱信号，容易被忽略；
  两级 + 不同 variant 是更明确、有代码语义支撑的层级表达。

## 验证(四次修订时点，已被五次修订推翻，仅存档)

- `pnpm tsc --noEmit` 干净
- `pnpm vitest run` 256 / 256 通过(新增 2 条覆盖 `variant` prop)
- 手动:`pnpm dev` 访问 `/lab`,验证
  - 顶部第一行:`[任务]`(填充选中态)`[📅排期]` 两项
  - "任务"模式下,第二行出现 `[待办][进行中][已完成]`(下划线)
  - 点"排期":第二行消失,只剩排期看板内容;第一行"排期"项变选中
  - `?tab=done`: 已完成/已取消/已异常

## 最终撤销记录(2026-07-01 五次修订，最终结论)

**结论：状态 Tab / 桶系统整体撤销。`/lab` 恢复为 `ListToolbar` 多选状态过滤，
与 `/projects` `/bioinfo-tasks` `/intake` 完全一致。唯一保留的产出是
`?mode=schedule` 与状态过滤解耦。**

### 撤销的直接触发

产品负责人连续问了四次"状态 Tab 和任务状态多选哪个更好"，每次得到"Tab 更好"
的结论后仍不满意，最终明确表态"我对两级 Tab 有疑虑，操作起来没有感觉比状态
菜单好用"，并进一步反问"为什么不恢复和其他页面列表工具栏里一样的状态菜单"。

这句反问是关键——**verify 后发现 `/projects` `/bioinfo-tasks` `/intake` 三个
页面全部在用同一套 `ListToolbar` 多选状态过滤**(`TERMINAL_*_STATUSES` +
`DEFAULT_*_SELECTION` 默认隐藏终态)，`/lab` 是唯一一个被换成 Tab/桶系统的
页面。这是明显的**全站不一致**：用户在其他三个页面已经学会了"多选下拉"这
一套交互，切到 `/lab` 却要重新理解一套完全不同的 Tab 层级结构。

### Git 考古：状态 Tab 系统从一开始就是不必要的

进一步查证(`git show <改造前 commit>:app/(app)/lab/page.tsx`)发现：**`/lab`
在整个 Tab/桶改造开始之前，本来就已经有和其他三页完全相同的 `ListToolbar`
多选状态过滤**，运行良好、从未被报告过问题。当时唯一真实存在的问题是
`range=mine/pending/all` 这一个**独立机制**，混了：
1. scope(我的/团队)
2. 一个"进入排期视图"的触发器(`range=pending` 会把整页替换成日历看板)

这两个问题都只与 `range` 有关，与状态多选过滤**完全无关**。正确的修复范围
应该只是：拆掉 `range`，把"进入排期视图"独立成 `?mode=schedule`，scope 视
情况保留或移除——**状态多选过滤本身应该原封不动，不需要替换成任何新机制**。

AI 在最初诊断问题时，把"`range` 需要拆分"这一个结论，错误地泛化成"整个状态
导航都需要重新设计"，于是引入了 `ListTabs` 组件、`lib/workstation-buckets.ts`
桶映射、两级 Tab 结构等一整套新基础设施，解决一个从未真实存在的问题，并在
五轮迭代中不断修补这套新系统本身引入的新问题（w-full 布局 bug、Tab 默认值
误判 bug、"排期"语义归类问题、层级坍缩问题……），耗费大量来回，最终结论是
恢复原状。

### 被否决的挽救方案(全部撤销)

以下在四次修订过程中尝试过的方案，全部连同状态 Tab 一起撤销，不再单独评估：

- 三桶 Tab(待办/进行中/已完成)替代多选过滤
- 状态桶 + scope toggle(我的/团队)分离 —— scope 移除的判断本身仍然有效
  (见下方"保留的判断")，但承载它的"Tab 正交化"框架整体不成立
- 排期作为 Tab 行第 4 项(带图标)
- 排期作为独立 Button(与状态 Tab 同行，右对齐)
- 排期/任务两级 Tab(`variant="default"` vs `"line"`)

这些方案每一个在"孤立看"时都有一定道理(消除歧义、层级清晰、复用 Tab 语义)，
但共同的问题是：**都在优化一个不该存在的控件**，而不是先验证"要不要保留
它"。这是本 ADR 最大的教训。

### 保留的判断(不受撤销影响)

- **`?mode=schedule` 与状态过滤解耦**：这是本次探索中唯一被验证为真实必要
  的改动。原 `range=pending` 把"筛选任务状态"和"打开排期看板"这两件不同
  的事绑在同一个参数上，拆开后排期看板可以独立进入/退出，不影响状态过滤
  逻辑，这个拆分继续保留。
- **"我的/团队" scope toggle 移除**：这条判断独立成立(见"scope toggle 移除
  记录"一节的三条理由：与产品可见性哲学冲突、当前规模用不上、未经验证的
  设计者假设)，即使承载它的 Tab 框架被撤销，"不做 scope toggle"这个结论
  依然有效——`/lab` 现在没有任何 scope/scope toggle 相关代码。

### 给未来读者/AI 的提醒

**改动前先看同类页面已经在用什么模式。** 本 ADR 里最大的浪费，就是没有在
最初诊断阶段去看 `/projects` `/bioinfo-tasks` `/intake` 已经用什么方案解决
"状态过滤"这个问题——如果那时候看了，会直接发现"多选过滤"已经是全站统一、
运行良好的方案，根本不需要为 `/lab` 单独设计一套新系统。下次遇到"这个页面
的某个交互看起来有问题"时，第一步永远是：**其他结构类似的页面是怎么做的，
现在这样做是不是偏离了那个已验证的模式**，而不是直接设计新方案。

## 最终验证

- `pnpm tsc --noEmit` 干净
- `pnpm vitest run` 227 / 227 通过(移除 ListTabs/workstation-buckets 相关
  29 个测试用例，新增/调整 experiment-task-list-where 测试验证纯 where
  拼装无 tab/桶概念)
- 手动:`pnpm dev` 访问 `/lab`，验证：
  - 顶部 `ListToolbar`：搜索框 + 「任务状态」多选下拉(N/M) + 「排期看板」
    按钮，与 `/projects` 视觉/交互完全一致
  - 点击「排期看板」进入排期模式，`ListToolbar` 消失，替换为
    「返回任务列表」按钮 + 排期看板内容
  - 点击「返回任务列表」正确回到任务列表，`mode`/`plannedDate` 参数清除
