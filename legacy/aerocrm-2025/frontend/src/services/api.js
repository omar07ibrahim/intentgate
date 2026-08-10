import axios from 'axios';
import { store } from '../store'; // Import store to access state
import { logoutUser } from '../store/slices/authSlice'; // Import logout action

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.token; // Get token from Redux store
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh or logout on 401
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const { dispatch } = store; // Get dispatch from store
    const { refreshToken } = store.getState().auth; // Get refresh token

    // Check if it's a 401 error, not from a refresh request itself, and we have a refresh token
    if (error.response?.status === 401 && !originalRequest._retry && refreshToken) {
      originalRequest._retry = true; // Mark request to prevent infinite retry loops

      try {
        console.log("Attempting token refresh...");
        const response = await axios.post(`${API_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });
        const newAccessToken = response.data.access;
        const newRefreshToken = response.data.refresh; // Handle potential refresh token rotation

        localStorage.setItem('accessToken', newAccessToken);
        if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
        }

        // Update token in subsequent requests
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

        // Update token in Redux store (optional but good practice)
        // This might require a dedicated action in authSlice
        // dispatch(tokenRefreshed({ token: newAccessToken, refreshToken: newRefreshToken }));

        console.log("Token refreshed successfully. Retrying original request...");
        return apiClient(originalRequest); // Retry the original request with the new token
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        // If refresh fails, logout the user
        dispatch(logoutUser());
        // Optionally redirect to login page
        // window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // For other errors, just reject
    return Promise.reject(error);
  }
);


export default apiClient;



