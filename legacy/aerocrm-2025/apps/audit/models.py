from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

class AuditLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name=_("Пользователь"),
        on_delete=models.SET_NULL, null=True, blank=True, db_index=True
    )
    action = models.CharField(_("Действие"), max_length=255, db_index=True)
    timestamp = models.DateTimeField(_("Время"), default=timezone.now, db_index=True)
    ip_address = models.GenericIPAddressField(_("IP адрес"), null=True, blank=True)
    user_agent = models.TextField(_("User Agent"), blank=True)
    description = models.TextField(_("Описание/Детали"), blank=True)

    content_type = models.ForeignKey(
        ContentType, on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name=_("Тип связанного объекта")
    )
    object_id = models.CharField(max_length=255, null=True, blank=True, verbose_name=_("ID связанного объекта")) # Use CharField for flexibility if PK isn't int
    target_object = GenericForeignKey('content_type', 'object_id')

    class Meta:
        verbose_name = _("Запись аудита")
        verbose_name_plural = _("Журнал аудита")
        ordering = ['-timestamp']

    def __str__(self):
        user_str = self.user.email if self.user else "Система/Аноним"
        ts_str = self.timestamp.strftime('%Y-%m-%d %H:%M:%S') if self.timestamp else "N/A"
        return f"{ts_str} - {user_str} - {self.action}"


