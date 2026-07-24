# PL 看板工具 — 优化路线图设计文档

> 状态: 已与用户确认设计, 待逐 Wave 选择实施
> 日期: 2026-07-24
> 范围: 个人自用(纯单人) PL 看板工具的优化与新增功能**路线图**
> 约束: 纯单人自用 → 严守 YAGNI, 砍掉一切协作向功能

## 1. 背景与目标

本工具是 PL 个人自用的"需求开发 + 人力产能"管理 Web 应用(Django+DRF+SQLite 后端, React+TS+Vite 前端)。已具备: 任务看板(7 状态拖拽)、排期表、甘特图、产能热力表、燃尽图、里程碑、父子需求、成员管理、AI 对话 agent、每人每日工时快照。

本次由四位"专家视角"(PL 工作流 / 人力产能 / 数据模型审计 / 竞品对标)并行分析, 目标:
1. 找出**优化点**(现有功能的问题与改进)
2. 找出**该新增的功能**(服务"观察排期/进展/风险/人力、新需求排期、派活"核心诉求)
3. 暴露 PL **未意识到的盲区**

产出为**分波路线图**, 每波是一个独立可交付的切片, 后续逐波选择实施时单独走 brainstorming → writing-plans。**本轮不直接进入实施计划。**

## 2. 分析结论(综合)

### 2.1 核心诊断

- **记录/展示层已过剩**——组合比很多 10 人团队的 Jira 配置还全。
- **缺"决策层"**——工具只会摆数据, 风险预警、估时反哺、依赖连锁全靠 PL 脑补。
- **现有数字在骗你**——多处计算 bug 让产能/燃尽系统性失真。
- **"移除 Sprint"是半截子工程**——前端去掉了, 后端 Sprint 模型/视图/字段/AI 动作全残留。

### 2.2 A. 数据在骗你(正确性 bug, 应最先修)

| # | 问题 | 后果 | 证据 |
|---|---|---|---|
| A1 | 父子需求工时 double-count: 汇总把父与子的 est_effort 全加 | 产能/燃尽系统性**虚高** | `views.py:158-159`、`capacity.py:12-15`、`Capacity.tsx:24`、`Burndown.tsx:22-24,80` |
| A2 | 燃尽 actual 算所有在途(含未排期), ideal 只算有日期的 | 口径不一致, **几乎对所有人都误报落后** | `Burndown.tsx:26,78-85` |
| A3 | 快照 `get_or_create` 周末不开 App 就漏天; 同日多次访问不刷新; 生产库 MemberDailySnapshot=0 行 | 实际线画不出/断点, 功能像坏了 | `views.py:160` |
| A4 | progress 是假的: `calcProgress=actual/est*100` 循环定义 | 非独立信号, 误导 | `types.ts:87`、`Board.tsx:42,151` |
| A5 | 产能两套算法: 后端 `capacity_view`(sprint, 已孤儿) vs 前端 `Capacity.tsx`(日历日, 实际在用); 后端每次访问还往死表写 | 维护两套, 语义漂移 | `views.py:44-128`、`Capacity.tsx` |

### 2.3 B. 决策层缺失(高 ROI 新功能)

- **风险驾驶舱 / Focus 页**: 一打开就看到 超期·将至·blocked·本周超载·版本风险
- **估时偏差报表**: est vs actual, 按人/模块聚合(反哺估时直觉)
- **横向依赖 blocked_by**: 卡片角标"被 X 阻塞"(轻版, 不上 CPM 算法)
- **看板筛选条 + 风险角标**: 原设计写了筛选器, 从未实现

### 2.4 C. 工程清理

- **Sprint 死代码大扫除**: `Sprint` 模型 / `assigned_sprint` / `capacity_view` / `burndown_view` / `capacity.py` / `BurndownSnapshot` / AI 的 `create_sprint` 全残留(约 -350 行)。每次录需求还看到废弃字段。

### 2.5 D. 盲区(PL 可能没想到)

1. **数据没备份** 🔴: SQLite 单文件, 硬盘坏/重装就全没。一行 cron 即可。
2. **done 可随便拖, 无"完成定义"**: 长期记不清某需求测没测就上线。
3. **无状态变更历史**: 回答不了"卡几天了""上月完成几条"。
4. **AI 助手半瞎**: 只喂 members/sprints, 没喂在途需求/产能/风险 → 答不准。
5. **单 assignee 让协作者负载隐形**: 帮别人的人显示很闲, 被误派新活。
6. **名义产能陷阱**: `week_capacity=40` 不扣休假/会议 → 红色超载告警永远触发不到。

## 3. 版本管理设计(新增)

版本接棒被废弃的 Sprint, 成为需求分组单位; 其 4 个时间点天然喂给风险驾驶舱。

### 3.1 模型 `Version`

| 字段 | 类型 | 说明 |
|---|---|---|
| name | CharField | 版本号/名, 如 `v2.1`、`2026-07迭代` |
| integration_date | DateField(null) | 联调日 |
| freeze_date | DateField(null) | 封板日 |
| test_date | DateField(null) | 转测日 |
| release_date | DateField(null) | 发布日 |
| note | TextField(blank) | 备注 |
| created_at / updated_at | DateTime | 审计 |

- 4 个阶段日期用**固定字段**(流程固定为这 4 步; 将来要加如"灰度"再加字段)。均可空。
- **当前阶段**用 `@property` 从日期与今天派生(不单独存, 避免与日期打架)。

### 3.2 关联

- `Requirement` 增加 `version = FK(Version, null, on_delete=SET_NULL)`——一个需求只归属一个目标版本(多版本 YAGNI)。

### 3.3 视图(首版)

- **版本列表页**: 每行一个版本, 显示 4 个日期 + 进度(各状态计数 / 已上线% / 剩余工时 rollup) + 当前阶段色标。
- **Gantt 标版本节点**: 4 条竖线分别标 联调/封板/转测/发布。
- 点版本 → 看板按 `version` 筛选(不单独做详情页, YAGNI)。

### 3.4 版本风险规则(Wave 3 Focus 页消费)

- 封板日 ≤3 天 且 有需求未到"测试中" → 红
- 转测日 ≤3 天 且 有需求仍在"开发中" → 红
- 发布日已过 且 有需求未"已上线" → 超期

## 4. 排序策略

采用**地基优先(混合)**: Wave 1 先把数字修对 + 清死代码, 之后每波叠加一层价值。**不采用"价值优先"**——风险清单和估时报表建在骗你的数字上, 本身就不准。

依赖关系: Wave 1 → Wave 2/3/4(决策层依赖正确数字与父子 rollup); Wave 2 → Wave 3(风险页用版本日期); Wave 1 的 Sprint 清理与 Wave 2 协调(Version 接棒 Sprint 的分组角色)。

## 5. 路线图分波

### Wave 0 — 备份(立即, 5 分钟) 🔴
- SQLite 自动备份: cron `cp db.sqlite3 备份/db-$(date).sqlite3` 或 Django management command + Win10 任务计划。
- 单点风险最高、成本最低, 独立于路线图, 应立即做。

### Wave 1 — 地基: 数字可信 + Sprint 大扫除(M-L)
- **A1** 父子 rollup: 汇总加 `.filter(parent__isnull=True)`(只算顶层, 子任务工时不入汇总避免 double); est_effort=0 的纯分解型父需求单独处理。`views.py:158-159`、`capacity.py:12-15`、`Capacity.tsx:24`、`Burndown.tsx:22-24,80`。**S**
- **A2** 燃尽同口径: actual 与 ideal 都只算 dated(有 planned_start/end)。`Burndown.tsx:26,78-85`。**S**
- **A3** 快照 `get_or_create`→`update_or_create`; 可选日终 management command + cron。`views.py:160`。**S**(+cron **M**)
- **A4** 把假的 progress 改成**独立手动信号**(0/25/50/75/100 五档, 与 actual_effort 解耦, 删除 `calcProgress=actual/est`)。`types.ts:87`、`Board.tsx:42,151`。**S**。(保留 progress 字段而非删除——Wave 4 的 done 定义需要它; 删除为备选)
- **A5** 删孤儿后端 `capacity_view`/`burndown_view`/`capacity.py`/`BurndownSnapshot` 模型 + 路由 + `api.ts` 对应函数。注意 `burndown_view` 有写副作用。`views.py:44-128`、`urls.py:11,16`、`api.ts:33-34`。**S-M**
- **C** Sprint 清理: `Sprint` 模型 / `Requirement.assigned_sprint` / `SprintViewSet` / `SprintSerializer` / `ai_actions.py` 的 create_sprint·update_sprint / `ai.py:47-72` prompt 的 sprint 段 / `admin.py` / `Board.tsx` 表单 / `types.ts`。含 1 个数据 migration(置 NULL + drop 表)。**M**
- **D6** 产能精度: 加 productivity 折算(全局常量或 `Member.weekly_overhead_pct` 默认 25%), 让红色超载阈值生效。`models.py:5`。**S-M**

### Wave 2 — 版本管理(M)
- 新 `Version` 模型 + `current_phase` 派生属性 + migration。
- `Requirement.version` FK + migration。
- serializer + viewset + url + admin 注册。
- 版本列表页(进度聚合: 各状态计数 / 已上线% / 剩余工时 rollup / 当前阶段色标)。
- Gantt 标 4 节点竖线; 看板按 version 筛选。

### Wave 3 — 风险可见性(M)
- 看板卡片风险角标: planned_end<今天且非 done → 红"超期 N 天"; planned_end≤2 天 → 黄"将至"。`Board.tsx:395-453`。**S**
- 看板筛选条: assignee / module / priority / 排除已上线。**S**
- Focus/风险驾驶舱页: 超期·将至·blocked·本周超载·版本风险(封板/转测临近)一屏汇总。**M**
- 横向依赖 `blocked_by`(自引用 M2M)+ 卡片"被 X 阻塞"角标; Gantt 连线可选。**M**

### Wave 4 — 估时反哺 + 流转历史(M)
- 估时偏差报表: est vs actual, 按人/模块聚合。`models.py:63-64` 字段已有。**S**
- 状态变更历史: `Requirement.last_status_change_at`(signal 更新), 回答"卡几天了"。**M**
- done 完成定义: `save()` 里 `status==done → progress=100`; `est_effort`/`actual_effort` 加 `MinValueValidator(0)`。**S**

### Wave 5 — AI 升级 + 收尾(S-M)
- 扩 AI system prompt: 喂在途需求摘要/产能/风险/版本。`ai.py:47-72`。**S**
- `single_point_risks`: 纯单人 → 倾向删除(`capacity.py:24` + 测试); 将来想看近免费可接回。**S**

## 6. 明确不做(YAGNI, 纯单人边界)

多负责人 · 单点风险视图(倾向删代码) · 产能预测(未来 N 周) · 技能矩阵/熟练度 · portfolio/多产品线 · 版本详情独立页 / 版本间需求迁移 / 版本状态机强约束 · velocity 跨周期 · 招聘/扩编/OKR/360 · 关键路径算法(CPM) · 自动通知/邮件/钉钉 · 代码/PR 集成 · 故事点 · 规则引擎 · 自定义仪表盘/报表构建器。

## 7. 非目标

- 多用户协作 / 角色权限(个人自用)。
- 需求关联代码/PR/issue。
- 自动通知推送。
- AI 自动排期(原设计已排除; 保留自然语言 CRUD 的 AI 助手即可)。

## 8. 后续

- 本轮止于路线图, **不进入实施计划**(用户明确)。
- 选择某 Wave 实施时, 该 Wave 单独走 brainstorming(若需细化) → writing-plans → 实现。
- 建议起点: Wave 0(立即) → Wave 1(地基)。
