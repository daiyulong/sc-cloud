# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目状态

**当前为实现中阶段**：Next.js 16 + Prisma + NextAuth + shadcn/ui 项目骨架已建立，已完成登录、主布局、工作台、用户管理、项目、样本、实验任务（含质控）、生信分析模块（API/UI/状态动作），并完成 UI 交互模型重构（行内动作 + 侧滑详情 + 深链全页，见下方设计决策）。经验库已确立为**业务视图**并完成 M1（产出指标录入 `recordRunMetrics` + 字段，见下方决策）；M2 的**统计图表已实现**（`/experiences` 经验库页，Recharts：KPI + 完成趋势 + 物种/组织分布 + 捕获细胞数按物种，按 scope 统计；图表不上工作台，工作台保持队列），**相似检索未做**。交付模块已实现为**聚焦项目队列页**（`/delivery`，复用项目动作/侧滑/字段，无独立实体，见 §6.3 与下方设计决策）。导航栏中「历史导入」当前仍为死链（路由未建），落地前可按需先放占位页。

- 需求唯一权威来源：`docs/单细胞云平台-完善版需求规格说明书.md`。动手前先读相关章节；本文件只做导航和补充设计意图，不重复规格细节。
- 需求评审结论（2026-06，已据此修订规格）：`docs/需求评审报告-2026-06.md`，记录 81 条审核发现的修订决策与老板拍板的业务口径。
- 样例/导入数据：`data/拜谱单细胞实验预约.xlsx`（→ 项目/样本/实验任务/反馈，第一期初始化导入的真实数据源与字段映射依据）。`data/单细胞项目经验.xlsx` **已放弃导入**（见下方经验库决策），仅作历史字段对照参考。
- 常用命令：`npm run lint`、`npm run test:run`、`npm run build`、`npm run db:push`、`npm run db:seed`。

## 一句话目标

面向单细胞实验服务业务的**项目管理与交付跟踪平台**，覆盖「销售建项目 → 项目经理确认 → 收样 → 实验+质控 → 生信分析 → 交付关闭」全链路。第一期目标是替代现有 Excel 管理方式，跑通核心闭环。

## 技术栈（已选定）

Next.js 16 App Router + TypeScript + React 19，API 用 Route Handlers；PostgreSQL + Prisma；NextAuth.js v5（Credentials + Prisma Adapter + bcryptjs）；Tailwind CSS 4 + shadcn/ui + Radix；TanStack Table、Recharts、FullCalendar；Zod 校验；`xlsx`/`exceljs`；Vitest + Testing Library + Playwright；Docker 部署。详见规格第 11 节。

**参考代码库**：`/Users/huangzhibo/workitems/14.med/pd-web`（同一技术栈的真实项目）。仅参考技术栈，UI/UX要自己设计。
shadcn的使用要参考它的skills，组件要用命令行安装，避免重复造轮子。

## 核心架构（big picture）

业务实体（规格第 9 节给出完整 Prisma 表）：`users` → `projects` → `samples` → `experiment_tasks` → `qc_records` / `bioinfo_tasks`，外加 `operation_logs`（审计）、`import_logs`（导入批次）。**无 `experience_records` 表**——经验数据并入 `experiment_tasks`（见下方经验库决策）。每个核心实体都有自己的状态枚举（规格第 7 节）。

**流程管理 = 状态机 + 动作 API，不是工作流引擎**，这是全系统最关键的架构约定：

1. 用户**不直接改 `status` 字段**，而是调用语义化动作 API（确认项目 / 接收样本 / 设置排期 / 开始实验 / 录入质控 / 提交反馈 / 创建生信任务 / 确认交付 / 标记/恢复/终止异常等）。动作与状态转移表见规格第 5.1、4.1 节。**项目（父实体）的中间状态更不由任何直接动作设置**，而由子实体（样本/任务/生信任务）动作在同一事务内**聚合驱动**（如项目下实验任务全部完成 → 按 `service_level` 进入「待生信」或「待交付」），规则见规格 §7.1——别顺手在某个动作里手动给项目设终态。
2. 每个动作内部按顺序校验：当前状态 → 角色权限 → 必填字段，再执行转移。
3. **跨表更新必须包在同一个 Prisma transaction 里**（如「接收样本」同时改 sample 和 project 状态）。
4. **所有关键动作写 `operation_logs`**（entity_type / action / operator / before/after JSON）；项目详情页时间线由操作日志 + 业务记录汇总而成。

权限第一期只做**角色级**（7 个角色，规格第 3 节权限矩阵），不做字段级权限和审批流。但**行级数据可见范围必做**：所有列表/详情/导出/统计查询按当前用户角色自动注入 Prisma `where`（销售只见自己负责、实验员只见相关任务的项目等），与用户筛选 AND 叠加，规则见规格 §3.3——这是贯穿数据层的安全横切约定，别漏。

## 设计决策 WHY（不可从代码反推，改动前先理解）

- **UI 交互模型 = 行内动作 + 侧滑详情 + 深链全页（2026-06 定，后续模块必须遵循）**：列表行尾直接放当前 status+角色下的语义动作（主动作按钮 + 破坏性动作收 `⋯` 溢出菜单，弹 Dialog 完成）；点编号软导航被 `app/(app)/@sheet` 拦截路由接住、在列表上开侧滑（URL 即 `/entity/[id]` 可分享）；同 URL 硬加载渲染全页详情（深链/外部入口用）。**浮层语义分工**：查看条目=右侧滑（DetailSheet），创建类聚焦任务=居中模态（FormModal，`/entity/new` 同样走拦截）——别混用。注意 `/entity/new` 与 `(.)entity/[id]` 的路由冲突靠静态拦截 `(.)entity/new` 压制（踩过：缺它时 new 被当成详情 id，开出空侧滑）。WHY：核心用户是**队列驱动**（收样员批量处理当日到样、实验员按排期干活），曾按传统 list→detail→action 实现过一版，每处理一条要 4 跳 + 丢列表上下文，被推翻重做。**禁止**给新模块回退到"动作只能进详情页做"的形态。实现范式参考 `partition*Actions`（包装规则层 `getAvailable*Actions` 的纯函数，可单测）+ `components/detail/` 共享件（ActionMenu/Dialog/Sheet/字段网格/时间线）；新建/编辑表单成功后必须**硬导航**到全页详情（软 push 会被拦截成 sheet 盖在表单上）。
- **UI 设计语言（同批确立）**：Vercel 式克制扁平——灰底白面（页面/侧边栏同为 ≈#fafafa 灰底，card/popover/输入控件白色表面靠明度差浮起，token 与取色依据见 `app/globals.css` 注释；新组件别用 `bg-background`/`bg-transparent` 当"白色"使）、边框预算每区域一层（内部用分隔线/浅色底/留白，禁止线框套线框）、卡片与控件无投影（浮层保留）、状态用彩点+文字（`components/status-dot.tsx`）、列表页 = 单行工具栏（搜索即时生效，控件白底）+ 白底圆角边框表格（行 flush 到容器边，2026-06 对 Vercel dashboard 实测取色后确立）+ 可操作空态。工作台是角色队列形态，每个指标全站只出现一次。做 UI 前先看 `.claude/skills/` 里的 `shadcn` 与 `web-design-guidelines`（组件必须 CLI 安装）；已装插件里的 `frontend-design` skill 面向营销页创意美学，与本项目方向相反，勿采纳。
- **动作落成显式 API，绝不做通用派发**：每个状态动作 = 一个语义化 route handler + 一个领域函数（如 `receiveSample()` / `scheduleTask()`），状态转移和校验内聚其中。**禁止**搞"一个 `POST /api/[entity]/[action]` 按字符串/枚举分发"的万能派发器。WHY：同领域的 protree（`/Users/huangzhibo/workitems/07.cloud/protree`，旧 Django LIMS 的去复杂化重写）头号痛点正是旧系统 `model+operation` 整数码硬编码派发——分支散落、`operation→status` 映射跨文件不一致；重写后收敛为"每实体一组显式领域方法 + 自持状态机"。本项目是绿地，从第一天就按重写后的形态做，别再走一遍派发弯路。protree 仅作**领域建模层**参考（实体切分见其 `backend/app/domain/<ctx>/{entities,service}.py`、领域设计 `docs/lims-domain-service-design.md` §1/§6 的"旧派发→新服务"映射表）；其架构机制层（Hatchet / Cloud-HPC / Casdoor / ISA 血缘 / AI agent / 财务签章）量级远超本项目，**一律不借鉴**。
- **审批/业务判定态与执行态正交**：质控结论（通过/低风险/不通过）、实验结果状态等**业务判定**不要塞进任务**执行状态**（待排期/进行中/已完成）的同一枚举。WHY：protree 旧系统把出/入库执行态混进审批状态，导致多套 review 编码互相打架。规格里这些本就是独立字段，保持分离。
- **同构实体可参数化复用、状态机各自独立**：实验任务/生信任务/样本的「列表+筛选+分页」等框架级同构可抽公共层；但各自的状态机和业务规则独立写，不抽万能状态机（框架级 DRY 复用、业务级允许重复）。
- **项目状态精简：删 `confirmed` 与 `delivered`（2026-06）**。确认项目（confirm）直接 `draft → waiting_sample`，确认交付（deliver）直接 `waiting_delivery → completed`（保留 `deliveredAt` + 生信级联）。WHY：原 `标记待到样`(markWaitingSample) 与 `完成项目`(completeProject) 都是**无数据变更、同角色、无独立队列的空状态翻转**，`confirmed`/`delivered` 是没有独立角色工作面的过渡态——一个状态值得留下当且仅当它①闸住独立人工动作/权限、②是某独立角色的可操作队列、③或为终态/独立统计口径。**对比保留项**：`sample_received`/`lab_in_progress`/`waiting_bioinfo`/`bioinfo_in_progress` 各对应一个独立角色的队列（交接可见性信号，删了等于重新弄断链路），由子实体动作聚合驱动、维护成本近零，必须留。**命名陷阱**：删的是**项目**枚举的 `delivered`；生信任务（`BioinfoTaskStatus`）的 `delivered` 是另一枚举、级联仍写它，保留。迁移：旧 `confirmed→waiting_sample`、`delivered→completed`（含 `statusBeforeAbnormal`）。
- **不是「预约平台」**：旧 Excel 的"预约"被重新建模为平台内的任务生成、排期、状态流转和交付闭环。看到"预约"二字不要退回到单表 CRUD 思路。
- **第一期明确不引入工作流引擎**：禁用 Hatchet / Temporal / Airflow / 独立 FastAPI / 自建低代码引擎。流程靠上面的状态机 + 动作 API + 事务 + 日志实现。验收标准第 15 条专门要求"不依赖 Hatchet 也能完成完整状态流转"。
- **角色命名已标准化**，导入/沟通时按此映射，别在系统里复活旧名：运营→`project_manager`、实验（时空部）→`lab_operator`（部门名进用户资料/任务字段，不做角色）、收样→`sample_receiver`、生信→`bioinfo_analyst`。独立审核岗（`qc_reviewer` 等）第一期不建。
- **第一期范围边界**见规格第 13 节（不做自动排期、库存、审批流、客户门户、通知、多租户等）。新增能力前先确认是否在第一期范围内——很多"自然想加"的功能是被显式排除的。
- **历史导入容错**：项目编号导入若无法保证唯一，保留原编号另生成内部 ID；样品编号必须唯一，重复时支持跳过/覆盖。

### 关键业务建模决策（来自 2026-06 需求评审，不可从代码反推）

- **「项目」= 委托单（order_no）粒度，一个合同可对应多个项目**。WHY：预约表根本没有「项目编号」列，真实编号是 合同(BPC)⊃委托单(BP-G)⊃样品(YP) 三层；经验表的「项目编号」用的就是委托单号格式。按合同建项目会把多批次错并、且与经验数据对不齐。
- **交付分两条路径，由 `service_level` 驱动，不是单一线性流程**。WHY：老板确认「多数走生信分析后交付，少数只做到质控/建库即交付」，旧表 6 种服务里 4 种是非分析。`qc/library/run` 实验完成直接进待交付，`standard/advanced` 才经生信。**不做生信 ≠ 异常**，质控版正常交付不得走异常路径（否则污染异常统计）。
- **历史数据导入 = 走独立 `/api/import/*` 路径、直写终态、不经动作 API 的状态机校验**。WHY：旧表都是已完成记录，从 `draft` 用动作逐步重放走不通（且缺生信数据会卡住）。导入仍写 `operation_logs(action=import)`。规则见规格 §15。
- **跨字段日期一律按自然日（DATE 截断）比较**。WHY：真实数据普遍「当天收样当天做实验」，`received_at` 带时分，datetime 直比会 100% 误杀导入。
- **一次上机可含多样品**：MVP 用 `experiment_tasks.sample_id` 单值 + `loaded_sample_count` 跑通；终局改 `task_samples` 关联表。属「终局需要、实现可推后」，建模时留接口位。
- **编号上游给定、信息确定时点才录入（2026-06 定，不可从代码反推）**：项目编号(=委托单号，合并掉旧 `orderNo`)和样本编号(YP)都**由上游给定、系统不生成**。① 项目编号：销售建项目**不填**（草稿用内部 id、`projectNo` 可空显示"未编号草稿"），PM **确认时**录入并校验唯一——故"确认项目"是表单(`ProjectConfirmDialog`)不是直接按钮。② 样本：**一委托单一组样本**(`暂时一组`)——销售建项目时填 `样本编号 + 样本数量`，`createProject` 同事务**生成 1 条 `waiting_arrival` 样本**（物种/组织/实验类型/运输条件**改可空**、留到收样补）；**无独立「登记样本」创建入口**（删了 /samples 顶层 + 项目页两个按钮、删 `/samples/new` 路由）。③ 收样 = `receiveSample` 一张「登记接收」合并表单：补全样本信息 + 记录到样 → `received`，可订正数量。**被否决备选**：建项目即按 N 生成 N 条样本（YP 建项目时常未知、与"草稿无项目号"不对称、数量会变留空壳——见讨论）。**外部约束**：YP 形如 `YP20260504587`，规则不在我方手里 → 不造只存；导入沿用原号。终局随 `task_samples` 迁到逐样本粒度。
- **创建接缝 = 队列驱动，靠"行级 pool 例外 + awaiting 列表筛选 + 工作台卡"打通（2026-06）**：状态机能流转，但"子实体还没被创建、要人手动建"的接缝处，下一棒角色的工作面（子实体列表）里没有可显示的东西，导致他看不到该建什么。三处接缝：①项目→样本=自动生成（已消解）；②样本 received→建实验任务（S2）；③实验 completed→建生信任务（S3）。修法（纯读侧、零状态机）：列表加 `awaiting=task`/`awaiting=bioinfo` 筛选(其行均合格)→行内"建子实体"按钮深链 `?sampleId=`/`?experimentTaskId=` 预填表单；工作台卡指过去（顺带修了"待分析"原错指 `/projects?status=waiting_bioinfo`、`/samples?received=1` 原死参）。**关键坑（鸡生蛋）**：`buildSampleScope`/`buildExperimentTaskScope` 按"我相关"过滤，对"尚无子实体"的待建项恒假 → 实验员/分析员**看不到自己该建的队列**。故给二者 scope 并上对应 pool（实验员 += 待建任务样本池；分析员 += 待建生信任务池），与既有 `waiting_schedule`/`waiting_arrival` pool 同源。三处口径（scope/列表筛选/工作台计数）共用 `lib/auth/role-scope.ts` 的 `samplesAwaitingTaskWhere`/`tasksAwaitingBioinfoWhere` 一份 where 片段。执行接缝（实体已存在等下一动作）无需此处理，已被"可筛列表+行内动作"覆盖。
- **`experience_records.project_no` 实为委托单号、天然非唯一**，与 `projects.project_no`（唯一）同名异义；`experience_records.project_type` 与 `projects.project_type` 也同名异义。命名易混，引用前先确认是哪个。
- **脏数据原样保留、规范化清洗推后**（老板确认）：对导入的预约表，脏字段（组织部位混写如 肺/肺组织/肺穿刺、物种混入等）原样存、不解析、不强清洗。（注：此前同款原则原为经验表导入设的，已失效——经验表改为放弃导入，见下条。）
- **经验库 = 业务视图，不建独立表、不导入旧数据（2026-06 定，推翻规格原 `experience_records` 设计）**：经验数据就是业务表里的结构化实测指标——下机产出指标（悬液类型/测序量/捕获细胞数/基因中位数）新增在 `experiment_tasks`（上机结果维度，**不放 `bioinfo_tasks`**——那是分析流程实体，而这些描述「这次上机的质量」；**语义归属 ≠ 录入时点**：值由 cellranger 产出、主录入人是生信分析员），活率/结团率/浓度仍在 `qc_records`。录入 = 显式动作 `recordRunMetrics`（`POST /api/experiment-tasks/[id]/run-metrics`，前置 `completed`、不改状态、可订正、写操作日志），两入口覆盖两条交付路径：生信任务详情（分析员主录）+ 实验任务详情（`run` 类项目录测序量/订正）。「经验库」退化为查询视图（相似检索 + 工作台图表，属 M2 未实现）。**被否决备选**：①独立 `experience_records` 表（与业务数据双写/冗余）；②把旧经验数据 seed 成已完成项目（要伪造客户/服务等级/样品编号等 7+ 必填字段、且污染运营统计需给三表加 `source=legacy` 横切排除，性价比为负）。**外部约束**：旧 `单细胞项目经验.xlsx`（43 个 2025 委托单、101 行）与现有业务数据（预约表 2026 委托单 `BP-G2605*`）**委托单号零交集**、在系统内无宿主 → 放弃导入。**命名陷阱**：细胞/细胞核字段命名为 `suspensionType`（悬液类型）而非 `cellType`——领域里 cell type 指细胞类型注释（T/B/上皮…，空间转录组核心输出），须留给将来注释功能。**终局**：产出指标随 `task_samples` 迁到 task_sample 粒度（承接经验表「一行一捕获」）。
