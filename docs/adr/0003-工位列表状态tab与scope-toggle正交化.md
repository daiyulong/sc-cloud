# ADR-0003 工位列表状态 Tab 与 scope toggle 正交化

- 状态:已采纳(2026-07-01);首批实现 `/lab`,后续跟进 `/bioinfo-tasks` `/intake` `/projects`；
  **2026-07-01 二次修订:移除 scope toggle(我的/团队),见 §"scope toggle 移除记录"**——
  下文 §决策/§状态桶边界 仍是有效设计,但"scope toggle"相关条目已被后续修订推翻,
  阅读时以 §移除记录为准
- 取代:工位列表中 `?range=mine/pending/all` 混了「scope(人)」与「status(走到哪步)」两个正交维度
- 决策者:产品负责人(老板)拍板,AI 实现
- 相关代码:
  - `components/list/list-tabs.tsx`(URL 绑定 primitive)
  - ~~`components/list/list-scope-toggle.tsx`~~(已删除,见移除记录)
  - `lib/workstation-buckets.ts`(status → 桶 集中映射)
  - `app/(app)/lab/page.tsx`(首批实现)
  - `lib/schemas/experiment-task.ts` `lib/experiment-tasks/service.ts`(schema + service 同步重塑)

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

## 验证

- `pnpm tsc --noEmit` 干净
- `pnpm vitest run` 252 / 252 通过
- 手动:`pnpm dev` 访问 `/lab`,验证
  - `?tab=todo`: 待排期任务(无 scope 参数,已移除)
  - `?tab=doing`: 进行中任务(默认 Tab)
  - `?mode=schedule`: 14 天负载 + 待预约批次
  - `?tab=done`: 已完成/已取消/已异常
  - 顶部只剩一行 Tab([待办][进行中][已完成][排期]),无第二行控件
