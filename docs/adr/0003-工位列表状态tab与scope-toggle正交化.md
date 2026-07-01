# ADR-0003 工位列表状态 Tab 与 scope toggle 正交化

- 状态:已采纳(2026-07-01);首批实现 `/lab`,后续跟进 `/bioinfo-tasks` `/intake` `/projects`
- 取代:工位列表中 `?range=mine/pending/all` 混了「scope(人)」与「status(走到哪步)」两个正交维度
- 决策者:产品负责人(老板)拍板,AI 实现
- 相关代码:
  - `components/list/list-tabs.tsx`(URL 绑定 primitive)
  - `components/list/list-scope-toggle.tsx`(URL 绑定 primitive)
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
- 三个新 primitive 上提:`components/list/list-tabs.tsx` 与
  `components/list/list-scope-toggle.tsx` 在 `/bioinfo-tasks` 与 `/projects` 复用
- AGENTS.md「UI 决策原则」一节加指针指向本 ADR
- 新增 10 测试文件新增 25+ 用例覆盖:list-tabs(5)/list-scope-toggle(5)/
  workstation-buckets(15)/lab schema(4 新增)

## 验证

- `pnpm tsc --noEmit` 干净
- `pnpm vitest run` 249 / 249 通过
- 手动:`pnpm dev` 访问 `/lab`,验证
  - `?tab=todo&scope=mine`: 我与「待排期」任务
  - `?tab=doing&scope=team`: 团队「进行中」任务
  - `?mode=schedule`: 14 天负载 + 待预约批次
  - `?tab=done`: 已完成/已取消/已异常
  - 顶部 status 多选仍生效(与 tab 叠加 AND)
