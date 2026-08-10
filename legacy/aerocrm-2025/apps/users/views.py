from rest_framework import viewsets, generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Role
from .serializers import (
    RoleSerializer, UserDetailSerializer, UserCreateSerializer,
    ProfileSerializer, ChangePasswordSerializer
)
from .permissions import IsAdminUser, IsAdminOrReadOnly, IsSelfOrAdmin

User = get_user_model()

class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('role').all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role', 'department', 'shift', 'is_active', 'is_staff']
    search_fields = ['first_name', 'last_name', 'patronymic', 'email', 'employee_id', 'position']
    ordering_fields = ['last_name', 'first_name', 'email', 'hire_date', 'role__name', 'department']
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserDetailSerializer

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsSelfOrAdmin()]
        return super().get_permissions()

    def perform_create(self, serializer):
        if not self.request.user.is_staff:
             self.permission_denied(self.request, message="Только администраторы могут создавать пользователей.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.is_superuser:
             return Response({"detail": "Запрещено деактивировать суперпользователя."}, status=status.HTTP_403_FORBIDDEN)
        instance.is_active = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdminUser])
    def activate(self, request, pk=None):
        user = self.get_object()
        if user.is_superuser:
            return Response({"detail": "Статус суперпользователя нельзя изменить."}, status=status.HTTP_403_FORBIDDEN)
        user.is_active = True
        user.save()
        serializer = self.get_serializer(user)
        return Response(serializer.data)

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self):
        return self.request.user

    def put(self, request, *args, **kwargs):
        return self.http_method_not_allowed(request, *args, **kwargs)

class ChangePasswordView(generics.UpdateAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        self.object = self.get_object()
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response({"detail": "Пароль успешно изменен."}, status=status.HTTP_200_OK)


