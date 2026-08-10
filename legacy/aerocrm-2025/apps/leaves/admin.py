from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from .models import LeaveType, LeaveRecord
from django.utils.translation import gettext_lazy as _

@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_vacation', 'is_paid')

@admin.register(LeaveRecord)
class LeaveRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'leave_type', 'start_date', 'end_date', 'duration_days', 'status', 'requested_at', 'approved_by')
    list_filter = ('status', 'leave_type', 'user__department', ('start_date', admin.DateFieldListFilter))
    search_fields = ('user__email', 'user__last_name', 'user__first_name', 'reason')
    autocomplete_fields = ['user', 'approved_by', 'leave_type']
    readonly_fields = ('requested_at', 'processed_at', 'duration_days')
    list_select_related = ('user', 'leave_type', 'approved_by')
    date_hierarchy = 'start_date'
    actions = ['approve_leaves', 'reject_leaves']

    fieldsets = (
        (None, {'fields': ('user', 'leave_type', 'start_date', 'end_date', 'reason')}),
        (_('Статус'), {'fields': ('status', 'approved_by', 'processed_at')}),
        (_('Информация'), {'fields': ('requested_at',)}),
    )


    def approve_leaves(self, request, queryset):
        count = queryset.filter(status='REQUESTED').update(status='APPROVED', approved_by=request.user, processed_at=timezone.now())
        self.message_user(request, f'{count} записей успешно одобрено.')
    approve_leaves.short_description = _("Одобрить выбранные запросы")

    def reject_leaves(self, request, queryset):
        count = queryset.filter(status='REQUESTED').update(status='REJECTED', approved_by=request.user, processed_at=timezone.now())
        self.message_user(request, f'{count} записей успешно отклонено.')
    reject_leaves.short_description = _("Отклонить выбранные запросы")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser or request.user.is_staff:
             return qs
        return qs.filter(user=request.user)

    def has_change_permission(self, request, obj=None):
        # Allow admin to change status
        if request.user.is_superuser or request.user.is_staff:
             return True
        # Allow user to change only if status is REQUESTED (maybe for cancellation?) - handled in API
        if obj and obj.user == request.user and obj.status == 'REQUESTED':
             return True
        return False

    def has_delete_permission(self, request, obj=None):
         # Allow admin to delete
         if request.user.is_superuser or request.user.is_staff:
             return True
         # Allow user to delete only if status is REQUESTED
         if obj and obj.user == request.user and obj.status == 'REQUESTED':
              return True
         return False



