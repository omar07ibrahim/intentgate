from rest_framework import viewsets, permissions, mixins
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.users.permissions import IsAdminUser

class AuditLogViewSet(mixins.ListModelMixin,
                      mixins.RetrieveModelMixin,
                      viewsets.GenericViewSet):
    queryset = AuditLog.objects.select_related('user', 'content_type').all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'user': ['exact'],
        'action': ['exact', 'icontains'],
        'timestamp': ['date', 'date__gte', 'date__lte'],
        'ip_address': ['exact'],
        'content_type': ['exact'],
        'object_id': ['exact'],
    }
    search_fields = ['user__email', 'action', 'description', 'ip_address', 'object_id']
    ordering_fields = ['timestamp', 'user__email', 'action']
    ordering = ['-timestamp']


