from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)
    related_object_info = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'recipient_name', 'level', 'title', 'message',
            'created_at', 'is_read', 'read_at', 'related_object_info'
        ]
        read_only_fields = fields

    def get_related_object_info(self, obj):
         if obj.related_object:
             # Provide basic info: type and ID, maybe a string representation
             return {
                 'type': obj.content_type.model,
                 'id': obj.object_id,
                 'str': str(obj.related_object)
             }
         return None


