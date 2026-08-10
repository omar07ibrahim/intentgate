import apiClient from './api';

// --- General Documents ---

const getGeneralDocuments = async (params = {}) => {
  const response = await apiClient.get('/documents/', { params });
  return response.data; // Expect pagination: { count, next, previous, results }
};

const getGeneralDocumentDetail = async (id) => {
  const response = await apiClient.get(`/documents/${id}/`);
  return response.data;
};

const acknowledgeDocument = async (id) => {
  const response = await apiClient.post(`/documents/${id}/acknowledge/`);
  return response.data; // Returns updated assignment data
};

// Admin only
const uploadGeneralDocument = async (formData) => {
   // formData should contain: title, document_type (ID), document_file, assignee_ids (list), assignee_role_ids (list), acknowledgment_deadline (optional date string)
   const response = await apiClient.post('/documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
   });
   return response.data;
};

// Admin only
const deleteGeneralDocument = async (id) => {
    const response = await apiClient.delete(`/documents/${id}/`);
    return response.data; // Usually empty on 204 No Content
};

// Admin only
const getDocumentAcknowledgments = async (id) => {
     const response = await apiClient.get(`/documents/${id}/acknowledgments/`);
     return response.data; // List of DocumentAssignmentSerializer data
};


// --- Personal Documents ---

const getPersonalDocuments = async (params = {}) => {
    // params might include user_id for admins
    const response = await apiClient.get('/documents/personal/', { params });
    return response.data; // Expect pagination: { count, next, previous, results }
};

const getPersonalDocumentDetail = async (id) => {
    const response = await apiClient.get(`/documents/personal/${id}/`);
    return response.data;
};

const uploadPersonalDocument = async (formData) => {
    // formData should contain: document_type_id, expiry_date, uploaded_file (optional), document_number (optional), issue_date (optional), notes (optional)
    // For admin: user_id (optional)
    const response = await apiClient.post('/documents/personal/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

const updatePersonalDocument = async (id, formData) => {
     // formData can contain subset of fields: document_number, issue_date, expiry_date, notes, uploaded_file
    const response = await apiClient.patch(`/documents/personal/${id}/`, formData, {
         headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

const deletePersonalDocument = async (id) => {
     const response = await apiClient.delete(`/documents/personal/${id}/`);
     return response.data; // Usually empty on 204 No Content
};

// --- Document Types ---

const getDocumentTypes = async (params = {}) => {
    const response = await apiClient.get('/documents/types/', { params });
    return response.data; // Expect pagination: { count, next, previous, results }
};

// Admin only
const createDocumentType = async (data) => {
    const response = await apiClient.post('/documents/types/', data);
    return response.data;
};

// Admin only
const updateDocumentType = async (id, data) => {
    const response = await apiClient.patch(`/documents/types/${id}/`, data);
    return response.data;
};

// Admin only
const deleteDocumentType = async (id) => {
    const response = await apiClient.delete(`/documents/types/${id}/`);
    return response.data;
};


const documentService = {
  getGeneralDocuments,
  getGeneralDocumentDetail,
  acknowledgeDocument,
  uploadGeneralDocument,
  deleteGeneralDocument,
  getDocumentAcknowledgments,
  getPersonalDocuments,
  getPersonalDocumentDetail,
  uploadPersonalDocument,
  updatePersonalDocument,
  deletePersonalDocument,
  getDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
};

export default documentService;


