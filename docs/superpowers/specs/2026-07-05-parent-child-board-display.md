# 父子需求看板展示 — 设计文档

> 状态:设计中,待实现
> 日期:2026-07-05

## 1. 概述

看板只显示顶层需求(parent=null)为卡片;有子任务的父卡片可**内嵌展开**看子任务。子任务不单独占列卡片,减少看板杂乱。

## 2. 看板过滤

- 列只渲染 `items.filter(r => !r.parent)`(顶层需求)
- 父卡片内部渲染 `items.filter(r => r.parent === parent.id)`(该父的子任务)

## 3. 父卡片交互

- 父卡片正常显示(标题/优先级/负责人/工时/进度)
- 如果有子任务:显示 Badge「子 N」+ 可点击的展开/折叠按钮(▼/▶)
- 展开后:子任务内嵌缩进显示在父卡片下方(↳ + type Badge + 标题 + 双击编辑)
- 折叠后:隐藏子任务

## 4. 子任务卡片样式

- 缩进(`pl-4 border-l-2`)
- 更小(`text-xs`)+ 浅色背景(`bg-muted/30`)
- 显示:type Badge + 标题 + 状态
- 双击子任务 → 打开编辑 Dialog(同现有)

## 5. 拖拽

- 子任务不拖拽(MVP,子任务跟随父的状态)
- 父卡片可拖拽(拖父改状态)

## 6. 后端

- `RequirementSerializer` 加 `children_count`(annotate 或 property):返回子任务数
- 或前端从 items 里自己算(`items.filter(r => r.parent === parent.id).length`)

MVP 选前端算(不传 extra 字段)。

## 7. 选择模式 / 批量删除

- 选择模式下,父卡片可选;子任务跟随父(选父 = 含子)
- 或子任务也可单独选(MVP:只选父)

## 8. 改动范围

纯前端(Board.tsx 的 Column + RequirementCard 渲染逻辑),后端不改。

## 9. 非目标(YAGNI)

- 子任务独立拖拽(跟随父)
- 子任务多级嵌套(只 1 层)
- 后端 children_count 字段(前端算)
