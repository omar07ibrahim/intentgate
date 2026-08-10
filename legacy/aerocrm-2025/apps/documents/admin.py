from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from .models import DocumentType, Document, DocumentAssignment, PersonalDocument
from django.utils.translation import gettext_lazy as _

@admin.register(DocumentType)
class DocumentTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_personal', 'requires_acknowledgment', 'expiry_tracking_days', 'created_at')
    list_filter = ('is_personal', 'requires_acknowledgment')
    search_fields = ('name', 'description')

class DocumentAssignmentInline(admin.TabularInline):
    model = DocumentAssignment
    extra = 0
    readonly_fields = ('user', 'assigned_at', 'acknowledged_at', 'is_acknowledged')
    autocomplete_fields = ['user']
    verbose_name = _("Статус ознакомления")
    verbose_name_plural = _("Статусы ознакомления")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'document_type', 'created_by', 'created_at', 'acknowledgment_deadline')
    list_filter = ('document_type', 'created_by', 'assignee_roles')
    search_fields = ('title', 'document_type__name', 'created_by__email')
    filter_horizontal = ('assignee_roles',) # Assignees are managed through inline
    readonly_fields = ('created_at', 'updated_at', 'created_by')
    autocomplete_fields = ['created_by']
    inlines = [DocumentAssignmentInline]
    fieldsets = (
        (None, {'fields': ('title', 'document_type', 'document_file', 'acknowledgment_deadline')}),
        (_('Назначение Ролям'), {'fields': ('assignee_roles',)}),
        (_('Информация'), {'fields': ('created_by', 'created_at', 'updated_at')}),
    )

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(PersonalDocument)
class PersonalDocumentAdmin(admin.ModelAdmin):
    list_display = ('user', 'document_type', 'document_number', 'issue_date', 'expiry_date', 'is_expired', 'uploaded_at', 'uploaded_by')
    list_filter = ('document_type', 'user__department', ('expiry_date', admin.DateFieldListFilter))
    search_fields = ('user__email', 'user__last_name', 'user__first_name', 'document_type__name', 'document_number')
    autocomplete_fields = ['user', 'uploaded_by', 'document_type']
    readonly_fields = ('uploaded_at', 'uploaded_by')
    list_select_related = ('user', 'document_type', 'uploaded_by')
    date_hierarchy = 'expiry_date'

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser or request.user.is_staff:
             return qs
        return qs.filter(user=request.user)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser or request.user.is_staff:
             return True
        if obj and obj.user == request.user:
             return True
        return False


