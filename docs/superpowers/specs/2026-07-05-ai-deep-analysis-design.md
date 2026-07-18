# AI 深度拆解 + 父子需求 — 设计文档

> 状态:设计中,待实现
> 日期:2026-07-05

## 1. 概述

AI 助手从"平铺拆需求"升级为"**引导式深度分析 + 父子任务**"。面对一个需求(如 AB 门人数统计漏检优化),AI 引导分析(问题→决策点→方案),产出 1 个父需求 + N 个子任务(带 type/analysis),导入看板后父子关联。

- 交互:多轮聊天(现有悬浮窗,不改架构)
- 产出:1 父 + N 子,子带 type(模型/逻辑/数据/测试/文档)+ analysis

## 2. 数据模型

### Requirement 加 parent 字段
- `parent`(self FK Requirement,on_delete CASCADE,nullable)
- 子任务 `parent=父需求`;父 `parent=null`
- migration
- serializer 加 `parent`(已 fields='__all__',自动)
- filter `?parent=<id>` 返回某父的子任务;`?parent=null` 返回顶层需求

### 看板行为
- 看板显示顶层需求(parent=null)+ 子任务(各自卡片)
- 父卡片:Badge 显示"子 N"
- 子卡片:标题前 `↳` + type 标签

## 3. AI prompt 升级

### 角色:PL 分析助手

分析框架(system prompt 指导):
1. **问题**:现象 + 根因方向
2. **决策点**:哪些要改(模型选型/逻辑优化/数据/测试/文档)
3. **多轮确认**:逐点给候选 + 取舍,用户拍板(history 自然多轮)
4. **产出**:分析充分后,1 父 + N 子

### JSON 格式(分析充分后末尾返回)
```json
{
  "parent": {"title": "AB门人数统计漏检优化"},
  "children": [
    {"title": "模型选型对比", "type": "模型", "analysis": "对比 YOLOv8/RT-DETR 小目标漏检率"},
    {"title": "优化计数逻辑", "type": "逻辑", "analysis": "加轨迹去重减少重叠漏检"},
    {"title": "补测试数据", "type": "数据", "analysis": "收集 AB门早晚高峰 200 张标注"}
  ]
}
```

### system prompt 模板
```
你是 PL(技术主管)的分析助手。用户描述一个问题/需求,你帮深度拆解。
现有团队成员:{members};迭代:{sprints};模块:{modules}。
分析框架:
1. 先理解问题(现象+根因方向)
2. 列出决策点(模型/算法/逻辑/数据/测试/前端/后端——哪些要改)
3. 每个决策点给 2-3 候选方案 + 取舍,问用户选哪个
4. 多轮确认后,产出 1 个父需求 + N 个子任务
子任务类型:模型/逻辑/数据/测试/文档/前端/后端/其他
产出格式(分析充分后在回复末尾):
```json
{"parent":{"title":"..."},"children":[{"title":"...","type":"模型","analysis":"..."}]}
```
不要急于产出,先分析、追问、确认。
```

## 4. ai.py 改动

- `build_system_prompt` 升级(分析框架 + 父子格式)
- `parse_drafts` 改:提取 `{parent, children}` 而非扁平数组
  ```python
  def parse_drafts(text):
      m = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
      if not m: return None
      try: return json.loads(m.group(1))
      except: return None
  ```
- 返回 `{reply, drafts}` 中 drafts = `{parent:{title}, children:[...]} | None`

## 5. 端点改动

`POST /api/ai/chat/` 返回不变 `{reply, drafts}`,drafts 结构从 `list` 改为 `{parent, children} | None`。

## 6. 前端改动

### types.ts
```typescript
export interface DraftResult {
  parent: { title: string }
  children: Array<{ title: string; type?: string; analysis?: string }>
}
```

### AssistantWidget
- `drafts` state 类型改 `DraftResult[]`(多次对话可产出多组父子)
- 草稿卡片:显示**父标题** + **子任务列表**(每子:type Badge + title + analysis)
- 导入按钮:先 `create` 父(拿 id)→ 逐个 `create` 子(`parent=父id`)

### 看板(Board.tsx)
- `RequirementCard`:
  - 父(parent=null 且有子):Badge "子 N"
  - 子(parent!=null):标题前 `↳` + type Badge(从 module 或 note 推断;MVP 在 title 前缀 `[模型]` 等)

## 7. 数据流

PL 输入 → POST /api/ai/chat/ → GLM(分析框架 prompt)→ 多轮追问 → 分析充分产 JSON {parent, children} → 前端草稿(父+子树)→ 导入(create 父 → children create parent=父id)→ 看板父子

## 8. 错误处理

- GLM 未产出 JSON(还在分析)→ drafts=null,只显示 reply
- JSON 解析失败 → drafts=null
- 导入父失败 → 不导子,报错
- 导入子部分失败 → 已导的保留,报错剩余

## 9. 测试

- ai.py:`parse_drafts` 提取 {parent,children};无 JSON 返回 None;坏 JSON 返回 None
- build_system_prompt 含分析框架关键词
- 端点 mock:返回 {reply, drafts:{parent,children}}
- 前端:AssistantWidget 渲染父+子树;导入 mock create

## 10. 非目标(YAGNI)

- 子任务的子任务(只 1 层父子)
- 父状态自动随子推进(手动)
- 依赖关系(depends_on 字段)——MVP 不做,MVP 子任务独立
- 流式回复
- 对话历史持久化

## 11. 改动文件

- 后端:`apps/core/models.py`(parent 字段)、`apps/core/ai.py`(prompt + parse)、`apps/core/views.py`(端点不改,只 drafts 结构变)
- 前端:`types.ts`、`components/AssistantWidget.tsx`、`pages/Board.tsx`(父子显示)
