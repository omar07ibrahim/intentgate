from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, Role
from django.utils.translation import gettext_lazy as _

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ('name',)

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Персональная информация'), {'fields': ('first_name', 'last_name', 'patronymic', 'profile_picture', 'phone_number')}),
        (_('Рабочая информация'), {'fields': ('role', 'employee_id', 'position', 'department', 'shift', 'hire_date')}),
        (_('Права доступа'), {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Важные даты'), {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password', 'password2', 'first_name', 'last_name', 'role'),
        }),
    )
    list_display = ('email', 'get_full_name', 'role', 'position', 'department', 'is_staff', 'is_active')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'role', 'department', 'shift')
    search_fields = ('email', 'first_name', 'last_name', 'patronymic', 'employee_id', 'position')
    ordering = ('last_name', 'first_name')
    filter_horizontal = ('groups', 'user_permissions',)
    readonly_fields = ('last_login', 'date_joined')
    exclude = ('username',)

    def get_full_name(self, obj):
        return obj.get_full_name()
    get_full_name.short_description = _('Полное имя')


