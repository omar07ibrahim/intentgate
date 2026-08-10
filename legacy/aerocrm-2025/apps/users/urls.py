from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoleViewSet, UserViewSet, ProfileView, ChangePasswordView

router = DefaultRouter()
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'', UserViewSet, basename='user')

urlpatterns = [
    path('profile/', ProfileView.as_view(), name='user-profile'),
    path('profile/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('', include(router.urls)),
]


