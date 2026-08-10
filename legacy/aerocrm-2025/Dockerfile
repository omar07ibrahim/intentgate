# --------------------------------------------
# 1. Базовый образ
# --------------------------------------------
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # ↓ задайте свои значения в настройках Render
    DJANGO_SUPERUSER_USERNAME=admin \
    DJANGO_SUPERUSER_EMAIL=admin@example.com \
    DJANGO_SUPERUSER_PASSWORD=Admin123! \
    PORT=8000

# --------------------------------------------
# 2. Системные зависимости (минимум)
#    libpq‑dev + gcc нужны, если вы не
#    используете psycopg2‑binary.
# --------------------------------------------
RUN apt-get update \
    && apt-get install -y --no-install-recommends netcat-openbsd gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*


# --------------------------------------------
# 3. Установка python‑зависимостей
# --------------------------------------------
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --------------------------------------------
# 4. Копируем проект
# --------------------------------------------
COPY . .

# --------------------------------------------
# 5. Права на каталоги с медиа/статикой
# --------------------------------------------
RUN mkdir -p /app/media /app/static \
    && chown -R nobody:nogroup /app/media /app/static \
    && chmod -R 755 /app/media /app/static

USER nobody

EXPOSE ${PORT}

# --------------------------------------------
# 6. Entrypoint: миграции, суперюзер, gunicorn
# --------------------------------------------
CMD ["sh", "-c", "\
    python manage.py migrate --noinput && \
    python manage.py collectstatic --noinput && \
    python manage.py createsuperuser --noinput || true && \
    gunicorn aerocrm_project.wsgi:application --bind 0.0.0.0:${PORT} \
"]
