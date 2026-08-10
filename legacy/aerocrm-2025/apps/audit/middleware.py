from .models import AuditLog
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
import json
import logging

logger = logging.getLogger(__name__)

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

class AuditLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.sensitive_paths = ['/api/v1/auth/token/', '/api/v1/auth/token/refresh/']
        self.loggable_methods = ['POST', 'PUT', 'PATCH', 'DELETE']

    def __call__(self, request):
        response = self.get_response(request)
        self._log_request(request, response)
        return response

    def _should_log(self, request, response):
        # Log only API requests, exclude audit logs itself, exclude sensitive paths on success
        if not request.path.startswith('/api/v1/') or request.path.startswith('/api/v1/audit/'):
            return False
        # Log failures on sensitive paths
        if request.path in self.sensitive_paths and 200 <= response.status_code < 300:
             return False # Don't log successful token requests
        # Log specified methods or failures
        if request.method in self.loggable_methods or response.status_code >= 400:
             return True
        # Log specific GET actions if needed (e.g., acknowledge)
        if request.method == 'POST' and ('/acknowledge' in request.path or '/ack-expiry' in request.path):
             return True

        return False


    def _log_request(self, request, response):
        if not self._should_log(request, response):
            return

        user = request.user if request.user.is_authenticated else None
        action = f"{request.method} {request.path}"
        status_code = response.status_code
        description = f"Status: {status_code}"
        content_type = None
        object_id = None
        target_model_name = None

        # Try to get model/pk from view kwargs
        try:
            view = getattr(response, 'renderer_context', {}).get('view')
            if view:
                pk = view.kwargs.get('pk') or view.kwargs.get('id')
                if hasattr(view, 'queryset') and view.queryset is not None:
                    model = view.queryset.model
                    target_model_name = model.__name__
                    content_type = ContentType.objects.get_for_model(model)
                    if pk:
                        object_id = str(pk) # Use CharField for object_id
                elif hasattr(view, 'model') and view.model is not None: # For generic views
                     model = view.model
                     target_model_name = model.__name__
                     content_type = ContentType.objects.get_for_model(model)
                     if pk:
                         object_id = str(pk)

        except Exception as e:
             logger.warning(f"AuditLogMiddleware: Error getting target object info from view: {e}")


        # Enhance description based on response/request context
        if hasattr(response, 'data') and isinstance(response.data, dict):
            # If successful creation/update, try to get ID if not already found
            if object_id is None and status_code in [200, 201] and 'id' in response.data:
                object_id = str(response.data['id'])
                if target_model_name:
                     description += f". Target: {target_model_name} ID={object_id}"

            # Log validation errors
            if status_code >= 400:
                 error_detail = response.data.get('detail', response.data)
                 try:
                     error_str = json.dumps(error_detail, ensure_ascii=False)
                 except TypeError:
                      error_str = str(error_detail)

                 description += f". Error: {error_str[:500]}"+(error_str[500:] and '..')

        # Specific action descriptions
        if request.method == 'POST' and status_code == 201:
            action_detail = "Create"
        elif request.method in ['PUT', 'PATCH'] and status_code == 200:
            action_detail = "Update"
        elif request.method == 'DELETE' and status_code == 204:
            action_detail = "Delete"
        elif request.path.endswith('/acknowledge/') and status_code == 200:
            action_detail = "Acknowledge Document"
        elif request.path.endswith('/ack-expiry-notification/') and status_code == 200:
            action_detail = "Acknowledge Expiry Notification"
        elif request.path.endswith('/login/') or request.path.endswith('/token/'):
            action_detail = "Login Attempt"
            if status_code == 200: action_detail = "Login Success"
        elif request.path.endswith('/logout/'): # Assuming you have a logout endpoint
            action_detail = "Logout"
        else:
             action_detail = None

        if action_detail:
             action = f"{action_detail}: {target_model_name}" if target_model_name else action_detail
             if object_id: action += f" ID={object_id}"


        try:
            AuditLog.objects.create(
                user=user,
                action=action[:255],
                timestamp=timezone.now(),
                ip_address=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:1000],
                description=description[:1000],
                content_type=content_type,
                object_id=object_id
            )
        except Exception as e:
             logger.error(f"AuditLogMiddleware: Failed to create audit log: {e}")



