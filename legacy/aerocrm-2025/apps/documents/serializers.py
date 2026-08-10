from rest_framework import serializers
from django.conf import settings
from django.utils import timezone
from .models import DocumentType, Document, DocumentAssignment, PersonalDocument
from apps.users.serializers import UserSummarySerializer

from django.contrib.auth import get_user_model

User = get_user_model()              # теперь это класс, у которого есть objects


class DocumentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentType
        fields = ['id', 'name', 'description', 'is_personal', 'requires_acknowledgment', 'expiry_tracking_days']

class DocumentAssignmentSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    class Meta:
        model = DocumentAssignment
        fields = ['id', 'user', 'assigned_at', 'acknowledged_at', 'is_acknowledged']

class DocumentListSerializer(serializers.ModelSerializer):
    document_type = DocumentTypeSerializer(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    my_assignment = serializers.SerializerMethodField()
    document_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'title', 'document_type', 'document_file', 'document_file_url',
            'created_by', 'created_at', 'acknowledgment_deadline', 'my_assignment'
        ]
        read_only_fields = ['document_file_url']

    def get_my_assignment(self, obj):
        user = self.context['request'].user
        assignment = getattr(obj, 'my_assignment_instance', None) # Use prefetched data if available
        if assignment:
            return DocumentAssignmentSerializer(assignment).data

        # Fallback if not prefetched (less efficient)
        try:
            assignment = obj.documentassignment_set.get(user=user)
            return DocumentAssignmentSerializer(assignment).data
        except DocumentAssignment.DoesNotExist:
            return None

    def get_document_file_url(self, obj):
        request = self.context.get('request')
        if obj.document_file and request:
             return request.build_absolute_uri(obj.document_file.url)
        return None


class DocumentDetailSerializer(DocumentListSerializer):
    assignees_summary = serializers.SerializerMethodField()
    acknowledgment_stats = serializers.SerializerMethodField()

    class Meta(DocumentListSerializer.Meta):
         fields = DocumentListSerializer.Meta.fields + ['assignees_summary', 'acknowledgment_stats']
         read_only_fields = DocumentListSerializer.Meta.read_only_fields + ['document_file']

    def get_assignees_summary(self, obj):
         assignments = obj.documentassignment_set.select_related('user').order_by('user__last_name')
         return DocumentAssignmentSerializer(assignments, many=True).data

    def get_acknowledgment_stats(self, obj):
         assignments = obj.documentassignment_set # Use prefetched if available
         total = assignments.count()
         acknowledged = assignments.filter(is_acknowledged=True).count()
         return {'total': total, 'acknowledged': acknowledged}

class DocumentCreateSerializer(serializers.ModelSerializer):
    assignee_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        many=True, write_only=True, required=False
    )
    assignee_role_ids = serializers.PrimaryKeyRelatedField(
        queryset='users.Role'.objects.all(),
        many=True, write_only=True, required=False
    )

    class Meta:
        model = Document
        fields = [
            'title', 'document_type', 'document_file',
            'assignee_ids', 'assignee_role_ids', 'acknowledgment_deadline'
        ]

    def create(self, validated_data):
        request = self.context['request']
        validated_data['created_by'] = request.user

        # Pop assignment fields before creating Document instance
        assignee_ids = validated_data.pop('assignee_ids', [])
        role_ids = validated_data.pop('assignee_role_ids', [])

        # Create the document first
        document = Document.objects.create(**validated_data)

        # Set roles (ManyToMany relation)
        if role_ids:
            document.assignee_roles.set(role_ids)

        # Determine target users
        users_directly_assigned = set(User.objects.filter(id__in=[user.id for user in assignee_ids]))
        users_from_roles = set(User.objects.filter(role__in=role_ids, is_active=True))
        all_target_users = users_directly_assigned.union(users_from_roles)

        # Create assignments efficiently
        assignments = [DocumentAssignment(document=document, user=user) for user in all_target_users]
        DocumentAssignment.objects.bulk_create(assignments, ignore_conflicts=True) # Ignore if assignment exists

        return document

class PersonalDocumentSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    document_type = DocumentTypeSerializer(read_only=True)
    document_type_id = serializers.PrimaryKeyRelatedField(
        queryset=DocumentType.objects.filter(is_personal=True),
        source='document_type', write_only=True
    )
    uploaded_by = UserSummarySerializer(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    days_until_expiry = serializers.IntegerField(read_only=True)
    uploaded_file = serializers.FileField(required=False, allow_null=True)
    uploaded_file_url = serializers.SerializerMethodField()

    class Meta:
        model = PersonalDocument
        fields = [
            'id', 'user', 'document_type', 'document_type_id', 'document_number',
            'issue_date', 'expiry_date', 'uploaded_file', 'uploaded_file_url',
            'uploaded_by', 'uploaded_at', 'notes', 'is_expired', 'days_until_expiry',
            'is_expiry_notified'
        ]
        read_only_fields = ('user', 'uploaded_by', 'uploaded_at', 'is_expired', 'days_until_expiry', 'uploaded_file_url', 'is_expiry_notified')
        extra_kwargs = {
            'uploaded_file': {'write_only': True},
        }

    def get_uploaded_file_url(self, obj):
        request = self.context.get('request')
        if obj.uploaded_file and request:
             return request.build_absolute_uri(obj.uploaded_file.url)
        return None

    def validate(self, attrs):
        # Determine the user context
        request = self.context.get('request')
        user = request.user
        target_user_id_str = request.data.get('user_id', None) if request.user.is_staff else None # Admin might specify user
        target_user = user # Default to self

        if target_user_id_str and request.user.is_staff:
             try:
                 target_user = User.objects.get(pk=int(target_user_id_str))
             except (User.DoesNotExist, ValueError):
                  raise serializers.ValidationError({"user_id": "Указанный пользователь не найден."})

        # Determine the document type
        doc_type = attrs.get('document_type') # This comes from document_type_id field
        if not doc_type and self.instance:
             doc_type = self.instance.document_type
        if not doc_type:
             raise serializers.ValidationError({"document_type_id": "Необходимо указать тип документа."})


        if not doc_type.is_personal:
            raise serializers.ValidationError({'document_type_id': "Этот тип документа не является личным."})

        # Check for duplicates only if creating or changing type/user
        is_creating = self.instance is None
        is_changing_key_fields = self.instance and (self.instance.user != target_user or self.instance.document_type != doc_type)

        if is_creating or is_changing_key_fields:
            if PersonalDocument.objects.filter(user=target_user, document_type=doc_type).exists():
                raise serializers.ValidationError("Такой личный документ у сотрудника уже существует.")

        attrs['user'] = target_user # Store the target user for create/update

        return attrs

    def create(self, validated_data):
         request = self.context['request']
         target_user = validated_data.pop('user') # Get target user from validation
         validated_data['user'] = target_user
         validated_data['uploaded_by'] = request.user
         return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context['request']
        validated_data.pop('user', None) # User cannot be changed on update via this serializer
        validated_data['uploaded_by'] = request.user # Log who last updated/uploaded file
        return super().update(instance, validated_data)
