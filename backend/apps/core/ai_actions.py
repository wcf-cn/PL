from .models import Member, Sprint, Requirement

def _find_requirement(match):
    if "id" in match:
        return Requirement.objects.filter(id=match["id"]).first()
    if "title" in match:
        return Requirement.objects.filter(title__icontains=match["title"]).first()
    return None

def _resolve_member(name_or_id):
    if name_or_id is None:
        return None
    if isinstance(name_or_id, int):
        return Member.objects.filter(id=name_or_id).first()
    return Member.objects.filter(name=name_or_id).first()

def _resolve_sprint(name_or_id):
    if name_or_id is None:
        return None
    if isinstance(name_or_id, int):
        return Sprint.objects.filter(id=name_or_id).first()
    return Sprint.objects.filter(name=name_or_id).first()

def execute_action(action):
    """执行一个 AI 建议的操作。返回 {success, message, affected}。"""
    try:
        atype = action.get("type")
        if atype == "update_requirement":
            r = _find_requirement(action.get("match", {}))
            if not r:
                return {"success": False, "message": f"找不到需求「{action.get('match', {}).get('title', '')}」"}
            fields = action.get("fields", {})
            if "status" in fields: r.status = fields["status"]
            if "priority" in fields: r.priority = fields["priority"]
            if "module" in fields: r.module = fields["module"]
            if "est_effort" in fields: r.est_effort = fields["est_effort"]
            if "progress" in fields: r.progress = fields["progress"]
            if "assignee" in fields:
                m = _resolve_member(fields["assignee"])
                if m: r.assignee = m
            if "assigned_sprint" in fields:
                s = _resolve_sprint(fields["assigned_sprint"])
                if s: r.assigned_sprint = s
            r.save()
            return {"success": True, "message": f"已更新「{r.title}」", "affected": {"id": r.id, "title": r.title}}

        elif atype == "create_requirement":
            params = action.get("params", {})
            r = Requirement(title=params.get("title", "未命名"), status=params.get("status", "backlog"), priority=params.get("priority", "P1"))
            if params.get("assignee"):
                m = _resolve_member(params["assignee"])
                if m: r.assignee = m
            if params.get("assigned_sprint"):
                s = _resolve_sprint(params["assigned_sprint"])
                if s: r.assigned_sprint = s
            if params.get("est_effort"): r.est_effort = params["est_effort"]
            if params.get("module"): r.module = params["module"]
            r.save()
            return {"success": True, "message": f"已创建「{r.title}」", "affected": {"id": r.id, "title": r.title}}

        elif atype == "delete_requirement":
            r = _find_requirement(action.get("match", {}))
            if not r:
                return {"success": False, "message": f"找不到需求「{action.get('match', {}).get('title', '')}」"}
            title = r.title
            r.delete()
            return {"success": True, "message": f"已删除「{title}」", "affected": {"title": title}}

        elif atype == "update_member":
            match = action.get("match", {})
            m = _resolve_member(match.get("name") or match.get("id"))
            if not m:
                return {"success": False, "message": f"找不到成员「{match}」"}
            fields = action.get("fields", {})
            if "week_capacity" in fields: m.week_capacity = fields["week_capacity"]
            if "modules" in fields: m.modules = fields["modules"]
            if "active" in fields: m.active = fields["active"]
            m.save()
            return {"success": True, "message": f"已更新成员「{m.name}」", "affected": {"id": m.id, "name": m.name}}

        elif atype == "update_sprint":
            match = action.get("match", {})
            s = _resolve_sprint(match.get("name") or match.get("id"))
            if not s:
                return {"success": False, "message": f"找不到迭代「{match}」"}
            fields = action.get("fields", {})
            if "name" in fields: s.name = fields["name"]
            if "start_date" in fields: s.start_date = fields["start_date"]
            if "end_date" in fields: s.end_date = fields["end_date"]
            if "is_active" in fields: s.is_active = fields["is_active"]
            s.save()
            return {"success": True, "message": f"已更新迭代「{s.name}」", "affected": {"id": s.id, "name": s.name}}

        else:
            return {"success": False, "message": f"不支持的操作类型: {atype}"}
    except Exception as e:
        return {"success": False, "message": f"执行失败: {str(e)}"}
