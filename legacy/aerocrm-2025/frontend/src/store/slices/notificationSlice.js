import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import notificationService from '../../services/notificationService';

const initialState = {
  notifications: [],
  unreadCount: 0,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await notificationService.getNotifications(params);
      return data; // Assuming API returns { results: [], count: number } or similar
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
    'notifications/fetchUnreadCount',
    async (_, { rejectWithValue }) => {
        try {
             const data = await notificationService.getUnreadCount();
             return data.unread_count;
        } catch (error) {
             return rejectWithValue(error.message);
        }
    }
);


export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      const data = await notificationService.markAsRead(id);
      dispatch(fetchUnreadCount()); // Refresh count after marking read
      return data; // Return the updated notification
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const data = await notificationService.markAllAsRead();
      dispatch(fetchUnreadCount()); // Refresh count
      // We need to refetch notifications to update their status in the list
      dispatch(fetchNotifications());
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);


const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
     resetNotificationStatus: (state) => {
         state.status = 'idle';
         state.error = null;
     }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // Assuming pagination structure like DRF default
        state.notifications = action.payload.results || action.payload; // Adjust if API structure differs
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Fetch Unread Count
       .addCase(fetchUnreadCount.fulfilled, (state, action) => {
          state.unreadCount = action.payload;
       })
      // Mark As Read
      .addCase(markAsRead.fulfilled, (state, action) => {
        // Find and update the specific notification in the list
        const index = state.notifications.findIndex(n => n.id === action.payload.id);
        if (index !== -1) {
          state.notifications[index] = action.payload;
        }
        // Unread count updated by fetchUnreadCount thunk called within markAsRead
      })
       // Mark All As Read
       .addCase(markAllAsRead.pending, (state) => {
          state.status = 'loading'; // Indicate loading while refetching
       })
       .addCase(markAllAsRead.fulfilled, (state) => {
           // state updated via fetchNotifications and fetchUnreadCount calls
            state.status = 'succeeded'; // Mark as succeeded after refetch completes
       })
        .addCase(markAllAsRead.rejected, (state, action) => {
            state.status = 'failed';
            state.error = action.payload;
        });
  },
});

export const { resetNotificationStatus } = notificationSlice.actions;

export default notificationSlice.reducer;


