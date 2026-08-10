from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django.utils import timezone
from datetime import date

from .models import LeaveType, LeaveRecord
from .serializers import LeaveTypeSerializer, LeaveRecordSerializer, LeaveRecordManageSerializer
from apps.users.permissions import IsAdminUser, IsSelfOrAdmin

class LeaveTypeViewSet(viewsets.ModelViewSet):
    queryset = LeaveType.objects.all()
    serializer_class = LeaveTypeSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

class LeaveRecordViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = {
        'user': ['exact'],
        'leave_type': ['exact'],
        'status': ['exact', 'in'],
        'start_date': ['exact', 'gte', 'lte'],
        'end_date': ['exact', 'gte', 'lte'],
    }
    search_fields = ['user__first_name', 'user__last_name', 'user__email', 'reason']
    ordering_fields = ['start_date', 'end_date', 'requested_at', 'status', 'user__last_name']
    ordering = ['-start_date']

    def get_queryset(self):
        user = self.request.user
        queryset = LeaveRecord.objects.select_related('user', 'leave_type', 'approved_by')

        if not user.is_staff:
            queryset = queryset.filter(user=user)

        # Calendar specific filtering by month/year or date range
        year_param = self.request.query_params.get('year')
        month_param = self.request.query_params.get('month')
        start_date_param = self.request.query_params.get('start_date_gte')
        end_date_param = self.request.query_params.get('end_date_lte')

        if self.action == 'calendar_view' or (start_date_param and end_date_param):
            start_date = date.min
            end_date = date.max
            try:
                if year_param and month_param:
                    year = int(year_param)
                    month = int(month_param)
                    start_date = date(year, month, 1)
                    next_month = month + 1 if month < 12 else 1
                    next_year = year if month < 12 else year + 1
                    end_date = date(next_year, next_month, 1) - timezone.timedelta(days=1)
                elif start_date_param and end_date_param:
                    start_date = date.fromisoformat(start_date_param)
                    end_date = date.fromisoformat(end_date_param)

                queryset = queryset.filter(
                    start_date__lte=end_date,
                    end_date__gte=start_date,
                    status='APPROVED' # Usually calendar shows approved leaves
                )
            except (ValueError, TypeError):
                 pass # Ignore invalid date parameters

        return queryset

    def get_permissions(self):
        # User can only update/delete their own REQUESTED leaves
        if self.action in ['update', 'partial_update']:
             return [permissions.IsAuthenticated(), IsSelfOrAdmin()] # Permission class needs to check status too
        elif self.action == 'destroy':
             return [permissions.IsAuthenticated(), IsSelfOrAdmin()] # Permission class needs to check status too
        elif self.action in ['manage_status', 'approve', 'reject']:
             return [permissions.IsAuthenticated(), IsAdminUser()]
        elif self.action == 'cancel':
             # Allow self or admin to cancel
             return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # Serializer sets user and status
        serializer.save()

    def perform_update(self, serializer):
         instance = serializer.instance
         if instance.user != self.request.user and not self.request.user.is_staff:
              self.permission_denied(self.request, message="Недостаточно прав для изменения этой записи.")
         if instance.status != 'REQUESTED':
              raise serializers.ValidationError("Редактировать можно только записи со статусом 'Запрошено'.")
         serializer.save()


    def perform_destroy(self, instance):
        if instance.user != self.request.user and not self.request.user.is_staff:
             self.permission_denied(self.request, message="Недостаточно прав для удаления этой записи.")
        if instance.status != 'REQUESTED':
             raise serializers.ValidationError("Удалять можно только записи со статусом 'Запрошено'.")
        instance.delete()


    @action(detail=True, methods=['patch'], serializer_class=LeaveRecordManageSerializer, url_path='manage-status')
    def manage_status(self, request, pk=None):
         instance = self.get_object()
         # Permissions are checked by get_permissions based on action name
         serializer = self.get_serializer(instance, data=request.data, partial=True)
         serializer.is_valid(raise_exception=True)
         updated_instance = serializer.save()
         output_serializer = LeaveRecordSerializer(updated_instance, context=self.get_serializer_context())
         return Response(output_serializer.data)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
         # Reuse manage_status logic for cleaner code
         request.data.update({'status': 'APPROVED'})
         return self.manage_status(request._request, pk=pk) # Pass the underlying HttpRequest

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
         request.data.update({'status': 'REJECTED'})
         return self.manage_status(request._request, pk=pk)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
         instance = self.get_object() # Permission checked in get_permissions for 'cancel'
         serializer = LeaveRecordManageSerializer(instance, data={'status': 'CANCELLED'}, partial=True, context={'request': request})
         serializer.is_valid(raise_exception=True)
         updated_instance = serializer.save()
         output_serializer = LeaveRecordSerializer(updated_instance, context=self.get_serializer_context())
         return Response(output_serializer.data)

    @action(detail=False, methods=['get'], url_path='calendar')
    def calendar_view(self, request):
         # Queryset is already filtered for approved leaves and date range in get_queryset
         queryset = self.filter_queryset(self.get_queryset())
         serializer = self.get_serializer(queryset, many=True)
         return Response(serializer.data)


