from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from django.utils import timezone

class LeaveType(models.Model):
    name = models.CharField(_("Название типа отсутствия"), max_length=100, unique=True)
    is_vacation = models.BooleanField(_("Является отпуском?"), default=False)
    is_paid = models.BooleanField(_("Оплачиваемый?"), default=True)

    class Meta:
        verbose_name = _("Тип отсутствия")
        verbose_name_plural = _("Типы отсутствий")
        ordering = ['name']

    def __str__(self):
        return self.name

class LeaveRecord(models.Model):
    STATUS_CHOICES = [
        ('REQUESTED', _('Запрошено')),
        ('APPROVED', _('Одобрено')),
        ('REJECTED', _('Отклонено')),
        ('CANCELLED', _('Отменено')),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name=_("Сотрудник"),
        on_delete=models.CASCADE, related_name='leave_records'
    )
    leave_type = models.ForeignKey(
        LeaveType, verbose_name=_("Тип отсутствия"), on_delete=models.PROTECT
    )
    start_date = models.DateField(_("Дата начала"))
    end_date = models.DateField(_("Дата окончания"))
    status = models.CharField(
        _("Статус"), max_length=20, choices=STATUS_CHOICES, default='REQUESTED', db_index=True
    )
    reason = models.TextField(_("Причина/Комментарий"), blank=True)
    requested_at = models.DateTimeField(_("Дата запроса"), default=timezone.now)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name=_("Кем одобрено/отклонено"),
        on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_leaves'
    )
    processed_at = models.DateTimeField(_("Дата обработки"), null=True, blank=True)

    class Meta:
        verbose_name = _("Запись об отсутствии")
        verbose_name_plural = _("Записи об отсутствиях")
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.leave_type.name} ({self.start_date} - {self.end_date})"

    def clean(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError(_("Дата начала не может быть позже даты окончания."))

        if self.user and self.start_date and self.end_date:
            overlapping_leaves = LeaveRecord.objects.filter(
                user=self.user,
                start_date__lte=self.end_date,
                end_date__gte=self.start_date,
                status__in=['REQUESTED', 'APPROVED']
            ).exclude(pk=self.pk)

            if overlapping_leaves.exists():
                raise ValidationError(_("Даты отсутствия пересекаются с существующей одобренной или запрошенной записью."))

    def save(self, *args, **kwargs):
        self.clean()
        if self.status in ['APPROVED', 'REJECTED', 'CANCELLED'] and not self.processed_at:
             self.processed_at = timezone.now()
        super().save(*args, **kwargs)

    @property
    def duration_days(self):
         if self.start_date and self.end_date:
              return (self.end_date - self.start_date).days + 1
         return 0


