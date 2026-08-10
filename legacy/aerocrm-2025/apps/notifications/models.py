from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name=_("Получатель"),
        on_delete=models.CASCADE, related_name='notifications', db_index=True
    )
    LEVEL_CHOICES = [
        ('INFO', 'Info'), ('WARNING', 'Warning'), ('ERROR', 'Error'), ('SUCCESS', 'Success')
    ]
    level = models.CharField(
        _("Уровень"), max_length=20, choices=LEVEL_CHOICES, default='INFO'
    )
    title = models.CharField(_("Заголовок"), max_length=255)
    message = models.TextField(_("Текст уведомления"))
    created_at = models.DateTimeField(_("Дата создания"), default=timezone.now, db_index=True)
    is_read = models.BooleanField(_("Прочитано?"), default=False, db_index=True)
    read_at = models.DateTimeField(_("Дата прочтения"), null=True, blank=True)

    content_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, null=True, blank=True,
        verbose_name=_("Тип связанного объекта")
    )
    object_id = models.PositiveIntegerField(null=True, blank=True, verbose_name=_("ID связанного объекта"))
    related_object = GenericForeignKey('content_type', 'object_id')

    class Meta:
        verbose_name = _("Уведомление")
        verbose_name_plural = _("Уведомления")
        ordering = ['-created_at']

    def __str__(self):
        read_status = "Прочитано" if self.is_read else "Не прочитано"
        return f"Для {self.recipient.email}: {self.title} ({read_status})"


