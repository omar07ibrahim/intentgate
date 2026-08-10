# scripts/create_superuser.py
from django.contrib.auth import get_user_model
from django.core.management import call_command

User = get_user_model()

def run():
    if not User.objects.filter(username='admin').exists():
        print("Создаю суперпользователя...")
        User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='admin123'
        )
        print("✅ Суперпользователь создан.")
