from django.db.models.signals import m2m_changed, post_save
from django.dispatch import receiver
from django.conf import settings
from .models import Document, DocumentAssignment, PersonalDocument
from apps.notifications.tasks import create_notification

User = settings.AUTH_USER_MODEL

@receiver(m2m_changed, sender=Document.assignee_roles.through)
def handle_role_assignment(sender, instance, action, pk_set, **kwargs):
    if action == "post_add":
        users_in_roles = User.objects.filter(role_id__in=pk_set, is_active=True)
        assignments = []
        notifications = []
        for user in users_in_roles:
            assignment, created = DocumentAssignment.objects.get_or_create(document=instance, user=user)
            if created:
                 assignments.append(assignment)
                 create_notification(
                    user=user,
                    level='INFO',
                    title=f"Новый документ для ознакомления: {instance.title}",
                    message=f"Вам назначен новый документ '{instance.title}'. Требуется ознакомление.",
                    related_object=instance
                 )
        # Bulk create handled by the task/view usually, but direct creation is possible here too

    elif action == "post_remove":
        # Remove assignments only if user is not assigned directly or via another role
        users_in_removed_roles = User.objects.filter(role_id__in=pk_set)
        current_roles = instance.assignee_roles.all()
        direct_assignees = instance.assignees.all()

        for user in users_in_removed_roles:
            if user not in direct_assignees and not user.role in current_roles:
                DocumentAssignment.objects.filter(document=instance, user=user).delete()


# Signal might be redundant if assignment creation happens in serializer/view
# Keeping it simple for now, handle assignment logic primarily in views/serializers



