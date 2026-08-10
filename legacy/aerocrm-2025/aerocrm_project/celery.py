import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aerocrm_project.settings')

app = Celery('aerocrm_project')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'send-expiry-warnings-daily': {
        'task': 'apps.notifications.tasks.send_personal_doc_expiry_warnings',
        'schedule': crontab(hour=8, minute=0),
    },
    'send-acknowledgment-reminders-daily': {
        'task': 'apps.notifications.tasks.send_acknowledgment_reminders',
        'schedule': crontab(hour=9, minute=0),
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')


