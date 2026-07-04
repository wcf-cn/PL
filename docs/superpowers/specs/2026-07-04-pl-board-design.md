# PL 看板工具 — 设计文档

> 状态:已与用户确认设计,待生成实现计划
> 日期:2026-07-04

## 1. 概述

PL 个人自用的**需求开发 + 人力产能**管理 Web 应用。

- **用户**:单个 PL(自己用),不涉及团队协作、不需要多人权限/通知
- **设备**:Windows 10(主操作)+ iPhone(随时记录/查看)
- **核心诉求**:① 快速记录;② 任务进度看板;③ **人力产能看板(产能型,精确)**;④ 完全定制
- **动机**:现成工具(钉钉/飞书等)不顺手,要完全按自己的思路定制

## 2. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 后端 | Django + DRF + SQLite | SQLite 单文件,数据本地零配置;Django admin 做批量管理 |
| 前端 | React + TypeScript + Vite | SPA |
| 拖拽 | @dnd-kit | 看板卡片拖拽改状态 |
| 日历 | FullCalendar(或 react-big-calendar) | 需求按日期成条目 |
| UI | 倾向 shadcn/ui(定制友好),备选 AntD | 待实现时定 |
| 外网访问 | Tailscale | Win10 + iPhone 组网,不暴露公网 |
| 认证 | Django session,单用户密码 | Tailscale 之外的第二道防线 |

## 3. 架构

- **生产部署**:Django 单进程提供 REST API,并托管 React 构建后的静态文件(部署最简,一个进程跑起来)
- **开发模式**:Vite dev server(前端)+ Django(后端 API),配 CORS
- **外网**:Tailscale 组网,iPhone 浏览器访问 Win10 的虚拟 IP;数据仍在 Win10 本地
- **登录**:单用户 session 登录(一个密码),防止 Tailscale 网络内其他设备误访问

## 4. 数据模型

### 4.1 Member(成员)

| 字段 | 类型 | 说明 |
|---|---|---|
| name | CharField | 姓名 |
| week_capacity | FloatField | 周容量,默认 40(单位:人时 h) |
| modules | 文本/多选 | 负责模块(用于单点风险识别) |
| active | BooleanField | 是否在职(false 则排除出产能计算) |
| created_at / updated_at | DateTime | 审计 |

### 4.2 Sprint(迭代)

| 字段 | 类型 | 说明 |
|---|---|---|
| name | CharField | 如 "2026-W27" |
| start_date | DateField | 开始日 |
| end_date | DateField | 结束日 |
| weeks | FloatField(派生) | (end - start) / 7,用于容量计算 |
| is_active | BooleanField | 当前迭代 |

### 4.3 Requirement(需求)★核心

| 字段 | 类型 | 说明 |
|---|---|---|
| title | CharField | 需求标题 |
| status | ChoiceField | 待评审 / 排期中 / 开发中 / 测试中 / 已上线 / 已阻塞 / 暂停 |
| priority | ChoiceField | P0 / P1 / P2 |
| assignee | FK Member | 负责人(单选;多人协作在 note) |
| module | 多选/文本 | 后端 / 前端 / 数据 / 测试 … |
| progress | IntegerField | 0–100(%) |
| est_effort | FloatField | 预计工时(人时 h) |
| actual_effort | FloatField | 实际工时(人时 h) |
| assigned_sprint | FK Sprint(nullable) | 产能按 Sprint 聚合的依据 |
| planned_start | DateField(nullable) | 日历视图 + 按周分摊的依据 |
| planned_end | DateField(nullable) | 同上 |
| note | TextField | 备注 |
| created_at / updated_at | DateTime | 审计 |

### 4.4 状态流转

7 状态:**待评审 → 排期中 → 开发中 → 测试中 → 已上线**;**已阻塞**、**暂停**可从"开发中/测试中"进入,恢复时回到原状态。

约束放宽:个人自用,允许任意状态转换(不强制状态机),靠拖拽自由切换。**产能计算排除**:已上线、暂停。

## 5. 核心视图与功能

1. **任务进度看板** — 7 列(按状态),卡片显示 标题/优先级色标/负责人/进度/工时;拖拽改状态(@dnd-kit);筛选:Sprint·负责人·模块·优先级
2. **产能热力表**(人力负载·核心) — 行=Sprint,列=成员,格子=利用率%(颜色:绿<80% / 黄 80–100% / 红>100% 超载);点格子展开该人该 Sprint 的需求列表;按利用率排序找超载的人
3. **日历视图** — 需求按 planned_start/end 成条目(FullCalendar),按人筛选看时间冲突
4. **单点风险视图** — 按 module 分组,`distinct 负责人 = 1` 标红(某模块只 1 人会),提示安排备份
5. **需求录入** — 完整字段表单;手机端精简录入(标题+状态+优先级+负责人+Sprint,其余回 PC 补)
6. **Django admin** — 批量编辑需求/成员/Sprint、导入导出
7. **手机端 PWA** — manifest 可"添加到主屏",精简表单 + 浏览器原生语音输入(SpeechRecognition,iOS Safari 部分支持,降级为纯文本)

## 6. 产能计算逻辑(产能型核心)

- **Sprint 容量** = `Member.week_capacity`(默认 40h)× `Sprint.weeks`
- **Sprint 占用** = 该成员在该 Sprint 所有"在途"需求(status ∉ {已上线, 暂停})的 `est_effort` SUM
- **利用率** = 占用 / 容量 → >100% 超载预警,排序找最超载的人
- **周维度分摊**(日历/按周视图):需求 `planned_start..planned_end` 跨越的周,`est_effort` 匀分到每周;某周占用 = 该周所有分摊之和 vs 该成员周容量
- **单点风险** = 按 module 分组,活跃成员中 `distinct assignee = 1` → 标红提示备份
- **工时单位**统一人时(h);显示层可选切"人天"(÷8)

## 7. 分阶段交付(B + 产能型工期紧,MVP 先行)

- **阶段 1 MVP(约第 1 周)**:Member/Requirement/Sprint 模型 + 迁移 + Django admin + 任务看板(7 列拖拽)+ 基础产能热力表(按 Sprint,利用率颜色)+ 单用户登录 → 跑通"录入 → 看板 → 产能表"
- **阶段 2(约第 2 周)**:日历视图 + 单点风险视图 + 筛选器 + 手机 PWA + Tailscale 外网 + 语音/简化录入
- **阶段 3(后续)**:按周分摊产能、超载预警、估时偏差报表(实际 vs 预计)、数据导出备份

## 8. 错误处理与测试

- **校验**:API/表单校验工时非负、日期合法(end ≥ start)、Sprint 日期不重叠(可选)
- **并发**:个人自用并发低,编辑冲突用简单 `updated_at` last-modified 检查
- **测试**(关键):
  - 产能计算函数单测(Sprint 利用率、按周分摊、单点风险)— **核心逻辑必须有测试**
  - Django model/DRF view 单测(pytest-django)
  - 前端关键组件测试(看板拖拽、产能表渲染)

## 9. 非目标(YAGNI — 明确不做)

- 多用户协作 / 角色权限(个人自用)
- 需求关联代码 / PR / issue(阶段 3 以后再说)
- 自动通知 / 邮件 / 钉钉推送
- 一个需求多负责人(单 assignee,多人在 note)
- 原生移动 app(PWA 够)
- 复杂审批流 / 工作流引擎
- 估时自动预测 / AI 排期

## 10. 未决项(实现时定)

- UI 库:shadcn/ui(定制友好,倾向)vs AntD(开箱快)
- 日历库:FullCalendar vs react-big-calendar
- 语音录入:iOS Safari 对 SpeechRecognition 支持有限,降级策略
- Tailscale 具体配置步骤(阶段 2)
