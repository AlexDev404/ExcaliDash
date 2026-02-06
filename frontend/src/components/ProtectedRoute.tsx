import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, authEnabled, bootstrapRequired } = useAuth();

  if (loading || authEnabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // Single-user mode: auth disabled -> allow access.
  if (!authEnabled) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    // If auth is enabled but no admin exists yet, force bootstrap registration.
    if (bootstrapRequired) {
      return <Navigate to="/register" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
