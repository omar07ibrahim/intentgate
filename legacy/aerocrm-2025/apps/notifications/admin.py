from django.contrib import admin
from .models import Notification
from django.utils.translation import gettext_lazy as _

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'level', 'title', 'is_read', 'created_at', 'get_related_object_link')
    list_filter = ('level', 'is_read', ('created_at', admin.DateFieldListFilter))
    search_fields = ('recipient__email', 'recipient__last_name', 'title', 'message')
    readonly_fields = ('created_at', 'read_at', 'content_type', 'object_id', 'related_object', 'recipient', 'level', 'title', 'message')
    list_select_related = ('recipient', 'content_type')
    autocomplete_fields = ['recipient']

    def get_related_object_link(self, obj):
        from django.urls import reverse
        from django.utils.html import format_html
        if obj.related_object:
            try:
                 app_label = obj.content_type.app_label
                 model_name = obj.content_type.model
                 admin_url = reverse(f'admin:{app_label}_{model_name}_change', args=[obj.object_id])
                 return format_html('<a href="{}">{}</a>', admin_url, obj.related_object)
            except Exception:
                 return str(obj.related_object)
        return "-"
    get_related_object_link.short_description = _("Связанный объект")

    def has_add_permission(self, request):
        return False # Notifications should be created by the system

    def has_change_permission(self, request, obj=None):
        return False # Read-only in admin

    def has_delete_permission(self, request, obj=None):
         return request.user.is_superuser # Allow superuser to cleanup maybe


