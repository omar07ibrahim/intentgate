from django.db import models
from django.conf import settings
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

class DocumentType(models.Model):
    name = models.CharField(_("Название типа"), max_length=255, unique=True)
    description = models.TextField(_("Описание"), blank=True)
    is_personal = models.BooleanField(
        _("Личный документ сотрудника?"), default=False,
        help_text=_("Например, удостоверение, сертификат, мед. справка")
    )
    requires_acknowledgment = models.BooleanField(
        _("Требует подтверждения ознакомления?"), default=True,
        help_text=_("Для общих документов, приказов, инструкций")
    )
    expiry_tracking_days = models.PositiveIntegerField(
        _("Дней до истечения для уведомления"), null=True, blank=True,
        help_text=_("Для личных документов: за сколько дней начать уведомлять")
    )
    created_at = models.DateTimeField(_("Дата создания"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Дата обновления"), auto_now=True)

    class Meta:
        verbose_name = _("Тип документа")
        verbose_name_plural = _("Типы документов")
        ordering = ['name']

    def __str__(self):
        return self.name

class Document(models.Model):
    document_type = models.ForeignKey(
        DocumentType, verbose_name=_("Тип документа"),
        on_delete=models.PROTECT, related_name='documents'
    )
    title = models.CharField(_("Заголовок/Название"), max_length=255)
    document_file = models.FileField(
        _("Файл документа"), upload_to='general_documents/%Y/%m/'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name=_("Кем загружен"),
        on_delete=models.SET_NULL, null=True, related_name='created_documents'
    )
    created_at = models.DateTimeField(_("Дата загрузки"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Дата обновления"), auto_now=True)
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, verbose_name=_("Назначен сотрудникам"),
        related_name='assigned_documents', blank=True,
        through='DocumentAssignment'
    )
    assignee_roles = models.ManyToManyField(
        'users.Role', verbose_name=_("Назначен ролям"),
        related_name='assigned_documents_by_role', blank=True
    )
    acknowledgment_deadline = models.DateTimeField(
        _("Срок подтверждения ознакомления"), null=True, blank=True
    )

    class Meta:
        verbose_name = _("Общий документ")
        verbose_name_plural = _("Общие документы")
        ordering = ['-created_at']

    def __str__(self):
        return self.title

class DocumentAssignment(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    assigned_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(
        _("Дата и время ознакомления"), null=True, blank=True
    )
    is_acknowledged = models.BooleanField(_("Ознакомлен"), default=False, db_index=True)

    class Meta:
        verbose_name = _("Назначение/Ознакомление")
        verbose_name_plural = _("Назначения/Ознакомления")
        unique_together = ('document', 'user')
        ordering = ['-assigned_at']

    def __str__(self):
        status = _("Ознакомлен") if self.is_acknowledged else _("Не ознакомлен")
        return f"{self.user} - {self.document.title} ({status})"

class PersonalDocument(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name=_("Сотрудник"),
        on_delete=models.CASCADE, related_name='personal_documents'
    )
    document_type = models.ForeignKey(
        DocumentType, verbose_name=_("Тип документа"),
        on_delete=models.PROTECT, related_name='personal_instances',
        limit_choices_to={'is_personal': True}
    )
    document_number = models.CharField(_("Номер документа"), max_length=100, blank=True)
    issue_date = models.DateField(_("Дата выдачи"), null=True, blank=True)
    expiry_date = models.DateField(_("Дата истечения срока"), db_index=True)
    uploaded_file = models.FileField(
        _("Скан-копия файла"), upload_to='personal_docs/%Y/%m/', null=True, blank=True
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name=_("Кем загружен"),
        on_delete=models.SET_NULL, null=True, related_name='uploaded_personal_docs'
    )
    uploaded_at = models.DateTimeField(_("Дата загрузки"), auto_now_add=True)
    notes = models.TextField(_("Примечания"), blank=True)
    is_expiry_notified = models.BooleanField(_("Уведомление об истечении отправлено"), default=False)

    class Meta:
        verbose_name = _("Личный документ")
        verbose_name_plural = _("Личные документы")
        ordering = ['user', 'expiry_date']
        unique_together = ('user', 'document_type')

    def __str__(self):
        return f"{self.document_type.name} ({self.user.get_full_name()})"

    @property
    def is_expired(self):
        return self.expiry_date < timezone.now().date()

    @property
    def days_until_expiry(self):
        if self.expiry_date >= timezone.now().date():
            return (self.expiry_date - timezone.now().date()).days
        return 0


