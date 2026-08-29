import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../App';

/**
 * ProtectedRoute
 * Wraps <Outlet> with authentication + optional role check.
 *
 * Usage in App.js:
 *   <Route element={<ProtectedRoute />}>               ← any logged-in user
 *   <Route element={<ProtectedRoute requiredRole="admin" />}>  ← admin only
 *
 * Renders null (blank screen) while the app is restoring auth state from
 * localStorage on first load.  This prevents the race condition where
 * user===null for one render cycle — before useEffect runs — which would
 * otherwise redirect every authenticated user to /login on page refresh.
 */
function ProtectedRoute({ requiredRole }) {
  const { user, initializing } = useAuth();

  // Still reading localStorage — don't redirect yet
  if (initializing) return null;

  // Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but wrong role → redirect to their own dashboard
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
