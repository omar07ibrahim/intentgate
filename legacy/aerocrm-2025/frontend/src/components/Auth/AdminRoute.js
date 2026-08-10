import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import LoadingSpinner from '../Common/LoadingSpinner';

const AdminRoute = ({ children }) => {
  const { isAuthenticated, isStaff, status } = useSelector((state) => state.auth);
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isStaff) {
    // Redirect to a "Not Authorized" page or dashboard
    return <Navigate to="/" state={{ message: "Недостаточно прав доступа." }} replace />;
  }

  // If children are provided (like a wrapper component), render them.
  // Otherwise, render the Outlet for nested routes.
  return children ? children : <Outlet />;
};

export default AdminRoute;



