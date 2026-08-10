import apiClient from './api';
import { jwtDecode } from 'jwt-decode'; // Correct import

const login = async (credentials) => {
  const response = await apiClient.post('/auth/token/', credentials);
  return response.data; // { access: '...', refresh: '...' }
};

const refreshToken = async (refresh) => {
   const response = await apiClient.post('/auth/token/refresh/', { refresh });
   return response.data; // { access: '...', refresh: '...' (optional) }
};

const getCurrentUser = async (token) => {
     if (!token) return null;
     // Optionally verify token first (if backend endpoint exists)
     // const verifyResponse = await apiClient.post('/auth/token/verify/', { token });
     // if (verifyResponse.status !== 200) throw new Error("Token invalid");

     // Decode token to get user ID (assuming user_id claim exists)
     // const decoded = jwtDecode(token);
     // const userId = decoded.user_id;

     // Fetch full user profile from the /users/profile/ endpoint
     const response = await apiClient.get('/users/profile/', {
         headers: { Authorization: `Bearer ${token}` } // Ensure header is set for this request too
     });
     return response.data;
};


const updateProfile = async (profileData) => {
    const formData = new FormData();

    Object.keys(profileData).forEach(key => {
         // Handle file separately
         if (key === 'profile_picture' && profileData[key] instanceof File) {
             formData.append(key, profileData[key]);
         } else if (profile_picture === null && key === 'profile_picture') {
             formData.append(key, ''); // Send empty string to clear picture if needed by backend
         }
         // Append other non-file data
         else if (key !== 'profile_picture' && profileData[key] !== null && profileData[key] !== undefined) {
             formData.append(key, profileData[key]);
         }
    });

    // Use PATCH request with FormData
    const response = await apiClient.patch('/users/profile/', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};


const changePassword = async (passwordData) => {
    const response = await apiClient.put('/users/profile/change-password/', passwordData);
    return response.data;
};


// Add logout if backend has an endpoint (e.g., for blacklisting refresh token)
// const logout = async (refreshToken) => {
//     if (!refreshToken) return;
//     try {
//         await apiClient.post('/auth/logout/', { refresh: refreshToken }); // Adjust endpoint if needed
//     } catch (error) {
//         console.error("Backend logout failed:", error);
//         // Proceed with frontend logout anyway
//     }
// };


const authService = {
  login,
  refreshToken,
  getCurrentUser,
  updateProfile,
  changePassword,
  // logout,
};

export default authService;



