import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authService from '../../services/authService';
import { jwtDecode } from 'jwt-decode'; // Correct import

const initialState = {
  user: null,
  token: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  isAuthenticated: false,
  isStaff: false,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

// Async thunk for login
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await authService.login(credentials);
      localStorage.setItem('accessToken', data.access);
      localStorage.setItem('refreshToken', data.refresh);
      return data;
    } catch (error) {
      const message = error.response?.data?.detail || error.message || 'Ошибка входа';
      return rejectWithValue(message);
    }
  }
);

// Async thunk to check initial auth state or refresh token
export const checkAuth = createAsyncThunk(
    'auth/checkAuth',
    async (_, { getState, dispatch, rejectWithValue }) => {
        const { refreshToken } = getState().auth;
        if (!refreshToken) {
            return rejectWithValue('Нет refresh токена');
        }
        try {
             const data = await authService.refreshToken(refreshToken);
             localStorage.setItem('accessToken', data.access);
             // Optionally update refresh token if rotation is enabled
             if (data.refresh) {
                  localStorage.setItem('refreshToken', data.refresh);
             }
             const decoded = jwtDecode(data.access);
             const user = await authService.getCurrentUser(data.access); // Fetch user data
             return { token: data.access, refreshToken: data.refresh || refreshToken, user };
        } catch (error) {
             dispatch(logoutUser()); // Logout if refresh fails
             return rejectWithValue('Сессия истекла или недействительна');
        }
    }
);

// Async thunk for logout (optional, can be simple reducer too)
export const logoutUser = createAsyncThunk(
    'auth/logoutUser',
    async (_, { rejectWithValue }) => {
        try {
            // await authService.logout(); // Call backend logout if implemented
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            return true;
        } catch (error) {
            return rejectWithValue('Ошибка выхода');
        }
    }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetAuthStatus: (state) => {
      state.status = 'idle';
      state.error = null;
    },
    // Manual logout action if not using thunk
    // logout: (state) => {
    //   localStorage.removeItem('accessToken');
    //   localStorage.removeItem('refreshToken');
    //   state.user = null;
    //   state.token = null;
    //   state.refreshToken = null;
    //   state.isAuthenticated = false;
    //   state.isStaff = false;
    //   state.status = 'idle';
    //   state.error = null;
    // }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.access;
        state.refreshToken = action.payload.refresh;
        state.isAuthenticated = true;
        try {
             const decoded = jwtDecode(action.payload.access);
             // Fetch user data separately or assume basic info from token
             // For now, just set isAuthenticated, user data fetched by checkAuth or profile fetch
             // state.isStaff = decoded.is_staff || false; // Assuming is_staff is in token
             state.error = null;
        } catch (e) {
             state.error = 'Неверный формат токена';
             state.isAuthenticated = false;
        }
        // User data will be fetched via checkAuth or Profile page
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.isAuthenticated = false;
      })
      // Check Auth / Refresh
       .addCase(checkAuth.pending, (state) => {
         state.status = 'loading';
       })
       .addCase(checkAuth.fulfilled, (state, action) => {
          state.status = 'succeeded';
          state.token = action.payload.token;
          state.refreshToken = action.payload.refreshToken;
          state.user = action.payload.user; // User data is fetched
          state.isAuthenticated = true;
          state.isStaff = action.payload.user?.is_staff || false;
          state.error = null;
       })
       .addCase(checkAuth.rejected, (state, action) => {
          state.status = 'failed';
          state.error = action.payload;
          state.user = null;
          state.token = null;
          state.refreshToken = null;
          state.isAuthenticated = false;
          state.isStaff = false;
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
       })
       // Logout
        .addCase(logoutUser.fulfilled, (state) => {
             state.user = null;
             state.token = null;
             state.refreshToken = null;
             state.isAuthenticated = false;
             state.isStaff = false;
             state.status = 'idle';
             state.error = null;
        });
  },
});

export const { resetAuthStatus } = authSlice.actions;

export default authSlice.reducer;



