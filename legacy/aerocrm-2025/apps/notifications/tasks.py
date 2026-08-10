from celery import shared_task
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from django.contrib.contenttypes.models import ContentType
import logging

logger = logging.getLogger(__name__)

try:
    from .models import Notification
    from apps.documents.models import PersonalDocument, DocumentAssignment
    from django.apps import apps
    User = apps.get_model(settings.AUTH_USER_MODEL, require_ready=False)
    ContentType.objects.get_for_model(User) # Ensure contenttype exists
except ImportError:
    logger.warning("Could not import models for notification tasks, might be during setup.")
except Exception as e:
     logger.error(f"Error getting ContentType for User in notification tasks: {e}")


def create_notification(user, level, title, message, related_object=None):
    content_type = None
    object_id = None
    if related_object:
        try:
            content_type = ContentType.objects.get_for_model(related_object.__class__)
            object_id = related_object.pk
        except Exception as e:
             logger.error(f"Could not get ContentType for {related_object}: {e}")

    try:
        Notification.objects.create(
            recipient=user,
            level=level,
            title=title,
            message=message,
            content_type=content_type,
            object_id=object_id
        )
    except Exception as e:
         logger.error(f"Failed to create notification for {user.email}: {e}")


@shared_task(name="send_personal_doc_expiry_warnings")
def send_personal_doc_expiry_warnings():
    today = timezone.now().date()
    notifications_sent = 0
    try:
        upcoming_expiry_docs = PersonalDocument.objects.select_related('user', 'document_type').filter(
            expiry_date__gt=today,
            is_expiry_notified=False
        ).only('id', 'user', 'document_type', 'expiry_date')

        for doc in upcoming_expiry_docs:
            days_left = (doc.expiry_date - today).days
            notify_days = doc.document_type.expiry_tracking_days

            if notify_days and days_left <= notify_days:
                level = 'WARNING' if days_left <= 7 else 'INFO'
                title = f"Срок документа '{doc.document_type.name}' скоро истекает!"
                message = f"Срок действия вашего документа '{doc.document_type.name}' ({doc.document_number or 'б/н'}) истекает {doc.expiry_date.strftime('%d.%m.%Y')} (осталось {days_left} дн.). Пожалуйста, позаботьтесь о продлении."
                create_notification(doc.user, level, title, message, doc)
                doc.is_expiry_notified = True
                notifications_sent += 1

        PersonalDocument.objects.bulk_update([doc for doc in upcoming_expiry_docs if doc.is_expiry_notified], ['is_expiry_notified'])

        expired_docs = PersonalDocument.objects.select_related('user', 'document_type').filter(
             expiry_date__lte=today,
             is_expiry_notified=False
        ).only('id', 'user', 'document_type', 'expiry_date')

        docs_to_update_expired = []
        for doc in expired_docs:
            title = f"Срок документа '{doc.document_type.name}' ИСТЁК!"
            message = f"Срок действия вашего документа '{doc.document_type.name}' ({doc.document_number or 'б/н'}) истек {doc.expiry_date.strftime('%d.%m.%Y')}. Необходимо срочно его продлить или обновить."
            create_notification(doc.user, 'ERROR', title, message, doc)
            doc.is_expiry_notified = True
            docs_to_update_expired.append(doc)
            notifications_sent += 1

        PersonalDocument.objects.bulk_update(docs_to_update_expired, ['is_expiry_notified'])
        logger.info(f"Task send_personal_doc_expiry_warnings: Sent {notifications_sent} notifications.")

    except Exception as e:
         logger.error(f"Error in send_personal_doc_expiry_warnings task: {e}", exc_info=True)
    return f"Отправлено уведомлений об истечении срока: {notifications_sent}"


@shared_task(name="send_acknowledgment_reminders")
def send_acknowledgment_reminders():
     now = timezone.now()
     reminders_sent = 0
     try:
         assignments_pending = DocumentAssignment.objects.filter(
             is_acknowledged=False,
             document__acknowledgment_deadline__isnull=False,
             document__acknowledgment_deadline__gt=now
         ).select_related('user', 'document')

         notifications_to_create = []
         for assignment in assignments_pending:
             deadline = assignment.document.acknowledgment_deadline
             time_left = deadline - now
             user = assignment.user

             # Avoid sending multiple reminders too close together - check last notification
             last_reminder = Notification.objects.filter(
                  recipient=user, content_type=ContentType.objects.get_for_model(Document),
                  object_id=assignment.document.pk, level__in=['INFO', 'WARNING']
             ).order_by('-created_at').first()

             should_send = False
             level = 'INFO'
             title = f"Напоминание: Ознакомьтесь с документом '{assignment.document.title}'"

             if time_left <= timedelta(days=1):
                 level = 'WARNING'
                 title = f"СРОЧНО: Ознакомьтесь с документом '{assignment.document.title}'"
                 message = f"Пожалуйста, подтвердите ознакомление с документом '{assignment.document.title}' до {deadline.strftime('%d.%m.%Y %H:%M')}. Осталось менее 24 часов."
                 if not last_reminder or (now - last_reminder.created_at > timedelta(hours=6)):
                     should_send = True
             elif time_left <= timedelta(days=3):
                 level = 'INFO'
                 message = f"Пожалуйста, подтвердите ознакомление с документом '{assignment.document.title}' до {deadline.strftime('%d.%m.%Y %H:%M')}."
                 if not last_reminder or (now - last_reminder.created_at > timedelta(days=1)):
                      should_send = True

             if should_send:
                  create_notification(user, level, title, message, assignment.document)
                  reminders_sent += 1

         logger.info(f"Task send_acknowledgment_reminders: Sent {reminders_sent} notifications.")

     except Exception as e:
         logger.error(f"Error in send_acknowledgment_reminders task: {e}", exc_info=True)
     return f"Отправлено напоминаний об ознакомлении: {reminders_sent}"



