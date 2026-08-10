from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Role
from django.utils.translation import gettext_lazy as _

User = get_user_model()

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description']

class UserSummarySerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'profile_picture', 'profile_picture_url', 'position']
        read_only_fields = ['profile_picture_url']

    def get_profile_picture_url(self, obj):
        request = self.context.get('request')
        if obj.profile_picture and request:
            return request.build_absolute_uri(obj.profile_picture.url)
        return None

class UserDetailSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', write_only=True, allow_null=True, required=False
    )
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'patronymic', 'full_name',
            'role', 'role_id', 'profile_picture', 'profile_picture_url', 'hire_date', 'phone_number',
            'employee_id', 'position', 'department', 'shift',
            'is_active', 'is_staff', 'last_login', 'date_joined'
        ]
        read_only_fields = ('last_login', 'date_joined', 'is_superuser', 'profile_picture_url')
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
            'profile_picture': {'write_only': True, 'required': False, 'allow_null': True}
        }

    def get_profile_picture_url(self, obj):
        request = self.context.get('request')
        if obj.profile_picture and request:
            return request.build_absolute_uri(obj.profile_picture.url)
        return None

    def update(self, instance, validated_data):
        role_id_data = validated_data.pop('role_id', None) # Check if role_id was passed
        if 'role' in validated_data and role_id_data is None: # if role_id was not passed, but source='role' picked it up
            validated_data.pop('role') # remove the role object if only role_id should be used

        if role_id_data is not None:
            instance.role = role_id_data

        password = validated_data.pop('password', None)
        if password:
            validate_password(password, instance)
            instance.set_password(password)

        # Handle profile picture separately if it's in validated_data
        profile_picture = validated_data.pop('profile_picture', None)
        if profile_picture is not None: # Allow clearing the picture
            instance.profile_picture = profile_picture

        return super().update(instance, validated_data)

class UserCreateSerializer(serializers.ModelSerializer):
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', write_only=True, allow_null=True, required=False
    )
    password = serializers.CharField(style={'input_type': 'password'}, write_only=True, required=True)
    password2 = serializers.CharField(style={'input_type': 'password'}, write_only=True, required=True)
    role = RoleSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'password', 'password2',
            'first_name', 'last_name', 'patronymic', 'role_id', 'role',
            'hire_date', 'phone_number', 'employee_id', 'position', 'department', 'shift',
            'is_active', 'is_staff'
        ]
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({"password": "Пароли не совпадают."})
        validate_password(attrs['password'])
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class ProfileSerializer(UserDetailSerializer):
    class Meta(UserDetailSerializer.Meta):
        read_only_fields = UserDetailSerializer.Meta.read_only_fields + (
            'role', 'role_id', 'is_active', 'is_staff', 'employee_id',
            'hire_date', 'position', 'department', 'shift'
        )

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True, write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Старый пароль введен неверно.")
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({"new_password": "Новые пароли не совпадают."})
        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


