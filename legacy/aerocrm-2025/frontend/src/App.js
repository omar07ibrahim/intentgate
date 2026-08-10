import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { checkAuth } from './store/slices/authSlice';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import GeneralDocsPage from './pages/GeneralDocsPage';
import DocDetailPage from './pages/DocDetailPage';
import PersonalDocsPage from './pages/PersonalDocsPage';
import LeaveRequestPage from './pages/LeaveRequestPage';
import LeaveListPage from './pages/LeaveListPage';
import NotificationsPage from './pages/NotificationsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminRolesPage from './pages/admin/AdminRolesPage';
import AdminDocTypesPage from './pages/admin/AdminDocTypesPage';
import AdminUploadDocPage from './pages/admin/AdminUploadDocPage';
import AdminLeaveMgmtPage from './pages/admin/AdminLeaveMgmtPage';
import AdminAuditLogPage from './pages/admin/AdminAuditLogPage';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AdminRoute from './components/Auth/AdminRoute';
import NotFoundPage from './pages/NotFoundPage';
import LoadingSpinner from './components/Common/LoadingSpinner';

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, user, status } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  if (status === 'loading') {
      return <LoadingSpinner />;
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="documents/general" element={<GeneralDocsPage />} />
        <Route path="documents/general/:id" element={<DocDetailPage />} />
        <Route path="documents/personal" element={<PersonalDocsPage />} />
        <Route path="leaves/request" element={<LeaveRequestPage />} />
        <Route path="leaves/history" element={<LeaveListPage />} />
        <Route path="notifications" element={<NotificationsPage />} />

        {/* Admin Routes */}
        <Route path="admin" element={<AdminRoute><></></AdminRoute>}> {/* Wrapper for admin layout? */}
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="roles" element={<AdminRolesPage />} />
            <Route path="document-types" element={<AdminDocTypesPage />} />
            <Route path="documents/upload" element={<AdminUploadDocPage />} />
            <Route path="leaves/manage" element={<AdminLeaveMgmtPage />} />
            <Route path="audit-log" element={<AdminAuditLogPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;



