from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeaveTypeViewSet, LeaveRecordViewSet

router = DefaultRouter()
router.register(r'types', LeaveTypeViewSet, basename='leave-type')
router.register(r'', LeaveRecordViewSet, basename='leave-record')

urlpatterns = [
    path('', include(router.urls)),
]


