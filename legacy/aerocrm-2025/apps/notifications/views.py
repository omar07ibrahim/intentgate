from rest_framework import viewsets, permissions, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Notification
from .serializers import NotificationSerializer

class NotificationViewSet(mixins.ListModelMixin,
                          mixins.RetrieveModelMixin,
                          mixins.DestroyModelMixin, # Allow user to delete their notifications
                          viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        is_read_param = self.request.query_params.get('read')
        queryset = Notification.objects.filter(recipient=user).select_related('recipient', 'content_type').order_by('-created_at')
        if is_read_param is not None:
             is_read = is_read_param.lower() == 'true'
             queryset = queryset.filter(is_read=is_read)
        return queryset

    def perform_destroy(self, instance):
         if instance.recipient != self.request.user:
              self.permission_denied(self.request, message="Вы можете удалять только свои уведомления.")
         instance.delete()


    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_as_read(self, request, pk=None):
        notification = self.get_object()
        if notification.recipient != request.user:
            return Response({"detail": "Недостаточно прав."}, status=403)
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=['is_read', 'read_at'])
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_as_read(self, request):
        count = self.get_queryset().filter(is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({'detail': f'{count} уведомлений отмечено как прочитанные.'})

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
         count = self.get_queryset().filter(is_read=False).count()
         return Response({'unread_count': count})


