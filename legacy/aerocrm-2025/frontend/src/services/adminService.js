import apiClient from './api';

// --- Users ---
const getUsers = async (params = {}) => {
    const response = await apiClient.get('/users/', { params });
    return response.data;
};

const createUser = async (userData) => {
    const response = await apiClient.post('/users/', userData);
    return response.data;
};

const getUserDetail = async (id) => {
    const response = await apiClient.get(`/users/${id}/`);
    return response.data;
};

const updateUser = async (id, userData) => {
     // Use FormData if profile_picture might be included
    const formData = new FormData();
    let useFormData = false;
     Object.keys(userData).forEach(key => {
         if (key === 'profile_picture' && userData[key] instanceof File) {
              formData.append(key, userData[key]);
              useFormData = true;
         } else if (key === 'profile_picture' && userData[key] === null) {
              formData.append(key, ''); // Send empty to clear
              useFormData = true;
         }
         else if (userData[key] !== null && userData[key] !== undefined) {
              formData.append(key, userData[key]); // FormData handles non-files too
         }
     });

     const config = useFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
     const dataToSend = useFormData ? formData : userData;

    const response = await apiClient.patch(`/users/${id}/`, dataToSend, config);
    return response.data;
};

const activateUser = async (id) => {
     const response = await apiClient.post(`/users/${id}/activate/`);
     return response.data;
};

const deactivateUser = async (id) => {
     // Deactivation is done via DELETE method in the viewset
     const response = await apiClient.delete(`/users/${id}/`);
     return response.data; // 204 No Content
};


// --- Roles ---
const getRoles = async (params = {}) => {
    const response = await apiClient.get('/users/roles/', { params });
    return response.data;
};

const createRole = async (roleData) => {
    const response = await apiClient.post('/users/roles/', roleData);
    return response.data;
};

const updateRole = async (id, roleData) => {
    const response = await apiClient.patch(`/users/roles/${id}/`, roleData);
    return response.data;
};

const deleteRole = async (id) => {
    const response = await apiClient.delete(`/users/roles/${id}/`);
    return response.data;
};

// --- Audit Log ---
const getAuditLogs = async (params = {}) => {
    const response = await apiClient.get('/audit/', { params });
    return response.data;
};


const adminService = {
  getUsers,
  createUser,
  getUserDetail,
  updateUser,
  activateUser,
  deactivateUser,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getAuditLogs,
};

export default adminService;



