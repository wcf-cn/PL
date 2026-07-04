from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.views.static import serve
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('apps.core.urls')),
]
if settings.FRONTEND_DIST.exists():
    urlpatterns += [
        re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': str(settings.FRONTEND_DIST / 'assets')}),
        re_path(r'^(?!api/|admin/|assets/).*$', TemplateView.as_view(template_name='index.html')),
    ]
