from rest_framework import serializers
from django.utils import timezone
from .models import LeaveType, LeaveRecord
from apps.users.serializers import UserSummarySerializer

class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ['id', 'name', 'is_vacation', 'is_paid']

class LeaveRecordSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    leave_type = LeaveTypeSerializer(read_only=True)
    leave_type_id = serializers.PrimaryKeyRelatedField(
        queryset=LeaveType.objects.all(), source='leave_type', write_only=True
    )
    approved_by = UserSummarySerializer(read_only=True)
    duration_days = serializers.IntegerField(read_only=True)
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRecord
        fields = [
            'id', 'user', 'leave_type', 'leave_type_id', 'start_date', 'end_date',
            'status', 'reason', 'requested_at', 'approved_by', 'processed_at', 'duration_days',
            'can_cancel'
        ]
        read_only_fields = ('user', 'status', 'requested_at', 'approved_by', 'processed_at', 'duration_days', 'can_cancel')

    def get_can_cancel(self, obj):
        request = self.context.get('request')
        if not request: return False
        user = request.user
        # User can cancel their own requested or approved leaves (if not started?)
        # Admin can cancel any leave?
        if obj.status in ['REQUESTED', 'APPROVED'] and obj.start_date > timezone.now().date():
             if obj.user == user:
                  return True
             if user.is_staff:
                  return True
        return False


    def validate(self, attrs):
        # Get start/end date from input or instance
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))

        # Determine the user context (for checking overlaps)
        request = self.context.get('request')
        user = request.user if not self.instance else self.instance.user

        if not start or not end:
            if not self.instance: # Required on create
                 raise serializers.ValidationError("Необходимо указать даты начала и окончания.")
            # If updating, allow partial without both dates if they exist on instance
            elif not (self.instance.start_date and self.instance.end_date):
                 raise serializers.ValidationError("Необходимо указать даты начала и окончания.")

        if start and end:
            if start > end:
                raise serializers.ValidationError({"end_date": "Дата окончания не может быть раньше даты начала."})

            # Check for overlaps
            overlapping = LeaveRecord.objects.filter(
                user=user,
                start_date__lte=end,
                end_date__gte=start,
                status__in=['REQUESTED', 'APPROVED'] # Only check against active/pending leaves
            )
            if self.instance: # Exclude self if updating
                overlapping = overlapping.exclude(pk=self.instance.pk)

            if overlapping.exists():
                 raise serializers.ValidationError("Даты отсутствия пересекаются с существующей одобренной или запрошенной записью.")

        return attrs

    def create(self, validated_data):
        request = self.context['request']
        validated_data['user'] = request.user
        validated_data['status'] = 'REQUESTED'
        validated_data['requested_at'] = timezone.now()
        return super().create(validated_data)

class LeaveRecordManageSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['APPROVED', 'REJECTED', 'CANCELLED'])
    reason = serializers.CharField(required=False, allow_blank=True, help_text="Причина отклонения или отмены")

    def update(self, instance, validated_data):
         request = self.context['request']
         new_status = validated_data['status']
         current_status = instance.status
         user = request.user

         if not user.is_staff and new_status != 'CANCELLED':
             raise serializers.ValidationError("Только администраторы могут одобрять или отклонять запросы.")

         if current_status == 'REQUESTED' and new_status in ['APPROVED', 'REJECTED']:
             instance.status = new_status
             instance.approved_by = user
             instance.processed_at = timezone.now()
             instance.reason = validated_data.get('reason', instance.reason)
             instance.save()
         elif current_status in ['REQUESTED', 'APPROVED'] and new_status == 'CANCELLED':
             if instance.start_date <= timezone.now().date():
                  raise serializers.ValidationError("Невозможно отменить уже начатое или прошедшее отсутствие.")
             # Check permissions for cancellation
             if not (instance.user == user or user.is_staff):
                  raise serializers.ValidationError("У вас нет прав для отмены этой записи.")

             instance.status = 'CANCELLED'
             instance.approved_by = user # Log who cancelled
             instance.processed_at = timezone.now()
             instance.reason = validated_data.get('reason', instance.reason)
             instance.save()
         else:
              raise serializers.ValidationError(f"Недопустимый переход статуса из '{current_status}' в '{new_status}'.")

         return instance


