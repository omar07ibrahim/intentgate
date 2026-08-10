from rest_framework import serializers
from .models import AuditLog
from apps.users.serializers import UserSummarySerializer

class AuditLogSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    target_object_info = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'timestamp', 'user', 'action', 'ip_address', 'user_agent',
            'description', 'target_object_info'
        ]
        read_only_fields = fields

    def get_target_object_info(self, obj):
         if obj.content_type and obj.object_id:
              target_str = str(obj.target_object) if obj.target_object else f"ID: {obj.object_id}"
              return {
                  'type': obj.content_type.model,
                  'id': obj.object_id,
                  'str': target_str
              }
         return None


