import apiClient from './api';

const getLeaveTypes = async () => {
  const response = await apiClient.get('/leaves/types/');
  return response.data; // Expect list or paginated list
};

const getLeaveRecords = async (params = {}) => {
  // params for filtering: user_id (admin), status, date ranges etc.
  const response = await apiClient.get('/leaves/', { params });
  return response.data; // Expect pagination: { count, next, previous, results }
};

const getLeaveCalendar = async (params = {}) => {
     // params: year, month, user_id (admin), department etc.
     const response = await apiClient.get('/leaves/calendar/', { params });
     return response.data; // Expect a list of approved LeaveRecordSerializer data for the period
};


const requestLeave = async (leaveData) => {
  // leaveData: { leave_type_id, start_date, end_date, reason (optional) }
  const response = await apiClient.post('/leaves/', leaveData);
  return response.data;
};

const cancelLeaveRequest = async (id) => {
    // Only allowed for 'REQUESTED' or 'APPROVED' (before start date) by owner or admin
    const response = await apiClient.post(`/leaves/${id}/cancel/`); // Assuming POST for cancel action
    return response.data;
};

// Admin only
const manageLeaveStatus = async (id, data) => {
    // data: { status: 'APPROVED' | 'REJECTED', reason (optional) }
    const response = await apiClient.patch(`/leaves/${id}/manage-status/`, data);
    return response.data;
};

// Admin only
const approveLeave = async (id) => {
     const response = await apiClient.post(`/leaves/${id}/approve/`);
     return response.data;
};

// Admin only
const rejectLeave = async (id, reason = '') => {
     const response = await apiClient.post(`/leaves/${id}/reject/`, { reason });
     return response.data;
};

const leaveService = {
  getLeaveTypes,
  getLeaveRecords,
  getLeaveCalendar,
  requestLeave,
  cancelLeaveRequest,
  manageLeaveStatus,
  approveLeave,
  rejectLeave,
};

export default leaveService;



