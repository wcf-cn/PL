from rest_framework.authentication import SessionAuthentication


class NoCSRFSessionAuthentication(SessionAuthentication):
    """Session 认证但不强制 CSRF。

    场景:个人单用户本地工具,经 Tailscale 网络隔离,SPA 同源访问。
    CSRF 保护(防跨站伪造)对此场景冗余,且会让 SPA 的 POST/PATCH
    (创建需求、拖拽改状态)因无 token 而 403。

    若未来改为多用户或公网暴露:把 settings 的 DEFAULT_AUTHENTICATION_CLASSES
    换回 'rest_framework.authentication.SessionAuthentication',并在前端
    实现 csrftoken cookie → X-CSRFToken header 流程。
    """

    def enforce_csrf(self, request):
        pass
