# PL 看板 v2 路线图 — 效能度量 / 通知 / 工具优化 / 扩展实体 设计

> 状态:已与用户确认设计,待逐子项目生成实施计划
> 日期:2026-07-24
> 范围:12 项缺失/优化 + 自动通知推送。分 4 个子项目实施。

## 1. 背景

三轮竞品调研 + 详细测试后,Wave 0-5 与 4 个 UI 修复已完成(后端无 bug,全栈绿)。本设计覆盖剩余的全部缺口,分 4 个独立子项目,每个单独 spec→plan→implement。

## 2. 子项目 C — 小工具 + 优化(先做)

| # | 设计 |
|---|---|
| **#4 派活负载提示** | 看板需求表单「负责人」下拉旁实时显示该成员在途负载/利用率(复用 Capacity 的 leaves+`week_capacity×0.7` 逻辑,内联计算);超载者名字标红。纯前端。 |
| **#6 CSV 导出** | 后端 `GET /api/export/requirements.csv`(Django `HttpResponse` + `csv` 模块),导出全量需求(标题/状态/优先级/负责人/模块/版本/工时/进度/日期)。DRF IsAuthenticated。 |
| **#7 需求搜索** | 看板顶部加文本搜索框,按 `title` 模糊(不区分大小写)过滤,与现有筛选 AND 组合。纯前端。 |
| **#11 产能本周精确** | 「本周负载」从"日速率×5"改成"按本周(周一~周日)与 planned 区间的**实际重叠工作日**精确累加"。改 `Capacity.tsx`。 |
| **#12 Gantt 节点视觉** | 版本节点竖线 label 带版本名(避免多版本日期重叠混淆);确认贯穿整条时间轴。 |

## 3. 子项目 A — 效能度量(核心缺口)

### 3.1 基础:状态变更事件日志(新模型)
```python
class RequirementStatusChange(models.Model):
    requirement = ForeignKey(Requirement, on_delete=CASCADE, related_name='status_changes')
    from_status = CharField(max_length=20)
    to_status = CharField(max_length=20)
    changed_at = DateTimeField(auto_now_add=True)
    class Meta: ordering = ['changed_at']
```
- 在 `Requirement.save()` 已有的 status 变更检测处(Wave 4 已 fetch old status)同时创建一条记录。复用那次查询,不额外查库。
- **一个模型喂三个图**(cycle time / throughput / CFD)。
- 存量需求无历史:CFD/throughput 从本功能上线后开始积累;cycle time 对存量 done 需求用 `created_at`/`last_status_change_at` 近似回填。

### 3.2 四个产出 + 效能页
| # | 设计 |
|---|---|
| **#1 吞吐量趋势** | 每周 done 数 = `to_status='done'` 事件按 ISO 周聚合 → 折线(recharts)。 |
| **#2 周期时间分布** | 每个 done 需求:`in_progress→done`(取最近一次)事件时间差,小时/天 → 散点图 + 中位线。 |
| **#3 WIP 告警** | 看板列头显示该状态在途数;超过可配置阈值(`board_wip_limits` 前端常量,如 `in_progress:5`)整列标红。 |
| **#5 累积流量图 CFD** | 从事件日志按日重建各状态累计数量 → 堆叠面积图。 |

新「效能」导航页(`/performance`,NAV「效能」):吞吐量折线 + 周期时间散点 + CFD 面积 + 当周 WIP 摘要。后端聚合端点 `GET /api/metrics/flow/`(返回 throughput/cycletime/cfd 三组数据)。

## 4. 子项目 B — 自动通知/推送(新子系统)

### 4.1 渠道(关键决策:个人微信 via 推送服务)
- **可配置 webhook(默认)**:走 **Server酱**(sct.ftqq.com)或 PushPlus → 推到**个人微信**。微信官方无个人号 webhook,用第三方推送服务是标准做法。代码侧就是一次 POST。
- **邮件(可选)**:SMTP,`.env` 配 `EMAIL_HOST`/`EMAIL_USER`/`EMAIL_PASS`/`NOTIFY_EMAIL_TO`。
- 配置走 `.env`:`NOTIFY_WEBHOOK_URL`(Server酱 sendkey URL)、`NOTIFY_EMAIL_TO`(留空则不发邮件)。
- 浏览器推送**不做**(Tailscale HTTP,service worker 需 HTTPS)。

### 4.2 触发与调度
- **每日风险摘要**(唯一触发):每天 09:00,聚合 超期/将至(2天内)/被阻塞/版本风险(3天内封板转测)/超载成员 → 一条 markdown digest。
- 复用 Focus 页的风险计算逻辑(抽到共享函数,Focus 页与摘要共用)。
- Django management command `daily_digest`:算风险 → POST 到 webhook(Server酱 `{title, desp}` 格式)+ 发邮件(若配)。
- 调度:cron `7 9 * * *`(与 `backup_db` 同机制;Win10 任务计划)。README 加配置说明。

### 4.3 YAGNI
不做:实时推送(状态变更即推)、多用户订阅、IM 双向回复、多渠道模板系统。

## 5. 子项目 D — 扩展实体(最后)

| # | 设计 |
|---|---|
| **#8 Bug 跟踪** | Requirement 加 `kind` choice(`feature`/`bug`,默认 `feature`);看板卡片角标(bug 🐛);看板筛选加 kind。**不**做独立 Bug 实体。 |
| **#9 工时时间条目** | 新模型 `TimeEntry(requirement FK, member FK, hours Float, date Date, note)`;需求编辑弹窗加"工时记录"区(列表 + 添加);`actual_effort` 改为 `sum(TimeEntry.hours)` 的**派生只读**字段(序列化时计算)。migration 时用存量 `actual_effort` 生成一条初始 TimeEntry 回填,避免数据丢失。 |
| **#10 Roadmap 视图** | 新「路线图」页(`/roadmap`,NAV「路线」):版本沿横向时间轴排列(用 Version 的联调/封板/转测/发布 4 日期画区间条),多版本一览。复用 Gantt 时间轴思路。 |

## 6. 数据模型新增汇总
- `RequirementStatusChange`(子项目 A)— 事件日志
- `TimeEntry`(子项目 D)— 工时条目
- `Requirement` 加字段:`kind`(子项目 D)
- 配置:`.env` 加 `NOTIFY_WEBHOOK_URL`/`NOTIFY_EMAIL_TO`/邮件 SMTP(子项目 B)

## 7. 实施顺序
**C(1 周期)→ A(2 周期:事件日志基础 + 效能页)→ B(1 周期)→ D(1-2 周期)**。每个子项目独立 spec→plan→implement,沿用 subagent 驱动 + 双阶段审查。

## 8. 非目标(YAGNI,本轮不做)
多负责人 · 单点风险视图 · 产能预测/重型 what-if · 技能矩阵 · portfolio 项目集 · 代码/PR 集成 · AI 自动排期 · 规则引擎 · 复杂报表构建器 · DORA 代码指标 · 实时推送 · 多用户订阅 · 浏览器推送。
