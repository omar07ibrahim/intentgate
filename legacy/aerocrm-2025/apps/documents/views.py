from rest_framework import viewsets, permissions, status, mixins, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django.db.models import Q, Prefetch, OuterRef, Subquery, BooleanField, Case, When
from django.shortcuts import get_object_or_404

from .models import DocumentType, Document, DocumentAssignment, PersonalDocument
from .serializers import (
    DocumentTypeSerializer, DocumentListSerializer, DocumentDetailSerializer,
    DocumentCreateSerializer, DocumentAssignmentSerializer, PersonalDocumentSerializer
)
from apps.users.permissions import IsAdminUser, IsAdminOrReadOnly, IsSelfOrAdmin

class DocumentTypeViewSet(viewsets.ModelViewSet):
    queryset = DocumentType.objects.all()
    serializer_class = DocumentTypeSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

class DocumentViewSet(mixins.CreateModelMixin,
                      mixins.RetrieveModelMixin,
                      mixins.ListModelMixin,
                      mixins.DestroyModelMixin,
                      viewsets.GenericViewSet):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {'document_type': ['exact'], 'created_by': ['exact'], 'assignee_roles': ['exact']}
    search_fields = ['title', 'document_type__name']
    ordering_fields = ['created_at', 'title', 'acknowledgment_deadline']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user

        # Subquery to get the current user's assignment instance for prefetching
        user_assignment_subquery = DocumentAssignment.objects.filter(
            document=OuterRef('pk'),
            user=user
        )

        base_queryset = Document.objects.select_related(
            'document_type', 'created_by'
        ).prefetch_related(
            Prefetch('documentassignment_set', queryset=DocumentAssignment.objects.select_related('user'), to_attr='all_assignments'),
            Prefetch('documentassignment_set', queryset=user_assignment_subquery, to_attr='my_assignment_list')
        )

        if user.is_staff:
            queryset = base_queryset
        else:
            user_roles = user.role_id
            query = Q(documentassignment__user=user)
            if user_roles:
                query |= Q(assignee_roles=user_roles)
            queryset = base_queryset.filter(query).distinct()

        # Annotate with the assignment instance for easier access in serializer
        # Handle cases where my_assignment_list might be empty
        queryset = queryset.annotate(
             my_assignment_instance=Subquery(user_assignment_subquery.values('pk')[:1]),
             # Add annotation for filtering/sorting by acknowledged status
             is_acknowledged_by_me=Case(
                When(documentassignment__user=user, documentassignment__is_acknowledged=True, then=True),
                default=False,
                output_field=BooleanField()
             )
        )

        # Allow filtering by acknowledged status
        acknowledged_param = self.request.query_params.get('acknowledged')
        if acknowledged_param is not None:
             is_acknowledged = acknowledged_param.lower() == 'true'
             queryset = queryset.filter(documentassignment__user=user, documentassignment__is_acknowledged=is_acknowledged)


        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def get_serializer_class(self):
        if self.action == 'list':
            return DocumentListSerializer
        if self.action == 'retrieve':
            return DocumentDetailSerializer
        if self.action == 'create':
            return DocumentCreateSerializer
        return DocumentDetailSerializer

    def get_permissions(self):
        if self.action in ['create', 'destroy']:
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return super().get_permissions()

    @action(detail=True, methods=['post'], url_path='acknowledge')
    def acknowledge(self, request, pk=None):
        document = self.get_object()
        user = request.user
        try:
            # Use the prefetched list if available, otherwise query
            assignment = next((a for a in getattr(document, 'my_assignment_list', []) if a.user == user), None)
            if not assignment:
                 assignment = DocumentAssignment.objects.get(document=document, user=user)

            if not assignment.is_acknowledged:
                assignment.is_acknowledged = True
                assignment.acknowledged_at = timezone.now()
                assignment.save()
                return Response(DocumentAssignmentSerializer(assignment).data)
            else:
                return Response({"detail": "Вы уже подтвердили ознакомление."}, status=status.HTTP_400_BAD_REQUEST)
        except DocumentAssignment.DoesNotExist:
            # Check if user should have access via role
            user_roles = user.role_id
            if user_roles and document.assignee_roles.filter(pk=user_roles).exists():
                 # Create assignment on the fly if accessed via role and not yet assigned
                 assignment, created = DocumentAssignment.objects.get_or_create(document=document, user=user)
                 if created or not assignment.is_acknowledged:
                      assignment.is_acknowledged = True
                      assignment.acknowledged_at = timezone.now()
                      assignment.save()
                      return Response(DocumentAssignmentSerializer(assignment).data)
                 else:
                      return Response({"detail": "Вы уже подтвердили ознакомление."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                 return Response({"detail": "Документ не назначен вам."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsAdminUser], url_path='acknowledgments')
    def get_acknowledgments(self, request, pk=None):
         document = self.get_object()
         assignments = document.all_assignments # Use prefetched data
         serializer = DocumentAssignmentSerializer(assignments, many=True)
         return Response(serializer.data)


class PersonalDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = PersonalDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = {
        'document_type': ['exact'],
        'expiry_date': ['exact', 'lt', 'lte', 'gt', 'gte'],
        'user': ['exact'],
    }
    search_fields = ['document_number', 'notes', 'user__first_name', 'user__last_name', 'user__email']
    ordering_fields = ['expiry_date', 'document_type__name', 'user__last_name']
    ordering = ['expiry_date']

    def get_queryset(self):
        user = self.request.user
        queryset = PersonalDocument.objects.select_related('user', 'document_type', 'uploaded_by')

        if user.is_staff:
             user_filter = self.request.query_params.get('user_id')
             if user_filter:
                 return queryset.filter(user_id=user_filter)
             return queryset # Admin sees all if no specific user filter
        return queryset.filter(user=user) # Non-admin sees only their own

    def get_permissions(self):
        # Allow admin to create/update for other users if user_id is provided
        if self.action in ['create', 'update', 'partial_update']:
             if self.request.user.is_staff and self.request.data.get('user_id'):
                  return [permissions.IsAuthenticated(), IsAdminUser()]
        # Standard self or admin for modification/deletion
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsSelfOrAdmin()]
        # Prevent non-admin from listing other users' docs
        if self.action == 'list' and self.request.query_params.get('user_id') and not self.request.user.is_staff:
             self.permission_denied(self.request, message="Недостаточно прав для просмотра документов других пользователей.")
        return super().get_permissions()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    # perform_create and perform_update handled by serializer validation logic now

    @action(detail=True, methods=['post'], url_path='ack-expiry-notification')
    def acknowledge_expiry_notification(self, request, pk=None):
         doc = self.get_object()
         # Check if the user owns the document
         if doc.user != request.user:
              return Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)

         if not doc.is_expiry_notified: # Usually this is set by the task, but allow manual ack
             doc.is_expiry_notified = True # Treat manual ack as if notification was seen
             doc.save(update_fields=['is_expiry_notified'])
             return Response(self.get_serializer(doc).data)
         else:
             # If already notified (e.g. by task), just return current state or a confirmation
             return Response({"detail": "Уведомление уже обработано."}, status=status.HTTP_200_OK)



