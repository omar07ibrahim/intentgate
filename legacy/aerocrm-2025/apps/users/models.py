from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils.translation import gettext_lazy as _
from django.db.models.signals import post_save
from django.dispatch import receiver

class Role(models.Model):
    name = models.CharField(_("Название роли"), max_length=100, unique=True)
    description = models.TextField(_("Описание роли"), blank=True)

    class Meta:
        verbose_name = _("Роль")
        verbose_name_plural = _("Роли")
        ordering = ['name']

    def __str__(self):
        return self.name

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError(_('Пользователь должен иметь адрес электронной почты'))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Суперпользователь должен иметь is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Суперпользователь должен иметь is_superuser=True.'))

        admin_role, created = Role.objects.get_or_create(name=_('Администратор'))
        extra_fields.setdefault('role', admin_role)
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    username = None
    email = models.EmailField(_('Адрес электронной почты'), unique=True)
    first_name = models.CharField(_('Имя'), max_length=150, blank=True)
    last_name = models.CharField(_('Фамилия'), max_length=150, blank=True)
    patronymic = models.CharField(_('Отчество'), max_length=150, blank=True)
    role = models.ForeignKey(
        Role, verbose_name=_("Роль"), on_delete=models.SET_NULL,
        null=True, blank=True, related_name='users'
    )
    profile_picture = models.ImageField(
        _("Фото профиля"), upload_to='profile_pics/', null=True, blank=True
    )
    hire_date = models.DateField(_("Дата приема на работу"), null=True, blank=True)
    phone_number = models.CharField(_("Номер телефона"), max_length=25, blank=True)
    employee_id = models.CharField(
        _("Табельный номер"), max_length=50, blank=True, null=True, unique=True, db_index=True
    )
    position = models.CharField(_("Должность"), max_length=150, blank=True)
    department = models.CharField(_("Подразделение/Филиал"), max_length=150, blank=True)
    shift = models.CharField(_("Смена"), max_length=50, blank=True, null=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = UserManager()

    class Meta:
        verbose_name = _("Сотрудник")
        verbose_name_plural = _("Сотрудники")
        ordering = ['last_name', 'first_name']

    def get_full_name(self):
        full_name = f"{self.last_name or ''} {self.first_name or ''} {self.patronymic or ''}".strip()
        return full_name or self.email

    def get_short_name(self):
        return self.first_name or self.email.split('@')[0]

    def __str__(self):
        return self.get_full_name()



