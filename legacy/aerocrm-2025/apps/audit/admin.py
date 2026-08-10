from django.contrib import admin
from .models import AuditLog
from django.utils.translation import gettext_lazy as _

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user_display', 'action', 'ip_address', 'get_target_object_link')
    list_filter = ('action', ('timestamp', admin.DateFieldListFilter), 'user__email', 'content_type')
    search_fields = ('user__email', 'action', 'ip_address', 'description', 'object_id')
    readonly_fields = [f.name for f in AuditLog._meta.fields]
    list_select_related = ('user', 'content_type')
    date_hierarchy = 'timestamp'

    def user_display(self, obj):
         return obj.user.email if obj.user else "Система/Аноним"
    user_display.short_description = _("Пользователь")
    user_display.admin_order_field = 'user'


    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser # Maybe allow superuser cleanup

    def get_target_object_link(self, obj):
        from django.urls import reverse
        from django.utils.html import format_html
        if obj.target_object:
            try:
                 app_label = obj.content_type.app_label
                 model_name = obj.content_type.model
                 admin_url = reverse(f'admin:{app_label}_{model_name}_change', args=[obj.object_id])
                 return format_html('<a href="{}">{} ({})</a>', admin_url, obj.target_object, obj.content_type.model)
            except Exception:
                 # Fallback if URL reversing fails or object deleted
                 return f"{str(obj.target_object)[:50]} ({obj.content_type.model} ID: {obj.object_id})"
        elif obj.content_type and obj.object_id:
             # If object deleted but we have info
             return f"({obj.content_type.model} ID: {obj.object_id})"
        return "-"
    get_target_object_link.short_description = _("Целевой объект")


