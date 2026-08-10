from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include([
        path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
        path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
        path('users/', include('apps.users.urls')),
        path('documents/', include('apps.documents.urls')),
        path('leaves/', include('apps.leaves.urls')),
        path('notifications/', include('apps.notifications.urls')),
        path('audit/', include('apps.audit.urls')),
    ])),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

admin.site.site_header = "AeroCRM Панель Администратора"
admin.site.site_title = "AeroCRM Админ"
admin.site.index_title = "Управление системой AeroCRM"


