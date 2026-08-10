import apiClient from './api';

const getNotifications = async (params = {}) => {
  // params: read=true/false
  const response = await apiClient.get('/notifications/', { params });
  return response.data; // Expect pagination: { count, next, previous, results }
};

const getUnreadCount = async () => {
  const response = await apiClient.get('/notifications/unread-count/');
  return response.data; // Expect { unread_count: number }
};

const markAsRead = async (id) => {
  const response = await apiClient.post(`/notifications/${id}/mark-read/`);
  return response.data; // Returns the updated notification
};

const markAllAsRead = async () => {
  const response = await apiClient.post('/notifications/mark-all-read/');
  return response.data; // Expect { detail: '...' }
};

const deleteNotification = async (id) => {
     const response = await apiClient.delete(`/notifications/${id}/`);
     return response.data; // Usually empty on 204 No Content
};

const notificationService = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};

export default notificationService;



