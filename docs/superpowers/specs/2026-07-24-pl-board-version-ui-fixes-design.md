# PL 看板 — 版本/依赖 UI 补齐设计

> 状态:已与用户确认,待生成实施计划
> 日期:2026-07-24
> 范围:补齐 Wave 2/3 漏掉的 UI 录入入口 + 1 个产能小瑕疵

## 1. 背景

测试发现:**版本管理(Wave 2)和依赖关系(Wave 3)的后端 API 完全正常,但前端没有录入 UI**——版本页只读、需求表单既无版本字段也无依赖字段。用户从 App 内无法创建版本、无法把需求关联到版本、无法设置需求间依赖,只能走 Django admin / API。

产能页还有 1 个已知小瑕疵:"本周负载"按"今天是否落在 planned 区间"计算,今天若不在任何排期内则显示 0%。

## 2. 目标(YAGNI 边界)

补齐 3 个 UI 录入入口 + 1 个产能修正,让版本/依赖功能从 UI 完整可用。不做:版本详情独立页、需求跨版本、依赖的复杂可视化(连线/拓扑)。

## 3. 修复项

### 3.1 Versions 页加 CRUD(创建/编辑/删除版本)

- 页头「+ 新建版本」按钮 → 复用 Board 的 Dialog + 表单模式。
- 表单字段:版本名(必填)、联调日 / 封板日 / 转测日 / 发布日(4 个 date input,可空)、备注(textarea)。
- 编辑:版本卡上加「编辑」按钮 → 同一 Dialog 回填;「删除」按钮 → confirm 后 `api.versions.remove`。
- 提交后刷新列表;`current_phase` 由后端返回自动显示。

### 3.2 需求表单加「目标版本」`<Select>`

- Board 创建/编辑表单,在「模块」附近加一个「目标版本」Select:选项来自 `api.versions.list()`(已在 state),加一个"无版本"空选项。
- 表单 state 加 `version: number | null`;`startEdit` 回填 `item.version`;提交 payload 带 `version`。

### 3.3 需求表单加「被阻塞于」多选

- Board 表单加「被阻塞于」多选控件:选项为**除自身外**的所有需求(标题),已选中的高亮。
- 实现:用现有 `dropdown-menu` 组件的 checkbox 项;若该组件无 checkbox 项,退化为内联可点 toggle 列表(用 Button/Badge)。实施时读 `components/ui/dropdown-menu.tsx` 决定。
- 表单 state 加 `blockedBy: number[]`;`startEdit` 回填 `item.blocked_by`;提交 payload 带 `blocked_by` 数组(空数组也提交,以支持清空)。

### 3.4 产能「本周负载」改本周命中

- 当前:`todayLoad` 只算"今天落在 [planned_start, planned_end] 内"的需求 → 今天没排期就 0%。
- 改为:算"本周(周一~周日)与 planned 区间有重叠"的需求,每周贡献 = 日速率 × 5(与峰值周口径一致)。今天不在任何区间也能反映本周负载。
- 仅改 `Capacity.tsx` 的 `todayLoad` 计算;峰值周、未排期、利用率分母(×0.7)不变。

## 4. 测试

- 后端无改动(已验证 API 正常),只动前端。
- 前端:vitest 组件测试(版本 CRUD 渲染/提交、表单含版本+依赖字段、产能本周命中)+ tsc。
- 手动冒烟:建版本 → 关联需求 → 看板筛选该版本有数据;设依赖 → 卡片显🔒;产能今天无排期但本周有排期时不再显示 0%。

## 5. 非目标

- 版本详情页、版本间需求迁移、版本状态机(沿用 Wave 2 YAGNI)。
- 依赖关系图/关键路径(沿用 Wave 3 YAGNI)。
