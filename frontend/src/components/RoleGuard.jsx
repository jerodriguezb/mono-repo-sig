// src/components/RoleGuard.jsx
// -----------------------------------------------------------------------------
// Componente de orden superior que valida si el usuario autenticado puede
// acceder a una pantalla concreta según su rol actual. En caso contrario redirige
// a la ruta alternativa definida para dicho rol.
// -----------------------------------------------------------------------------

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getStoredUser } from '../utils/auth';
import { isPathAllowed, getFallbackPath } from '../constants/rolePermissions';

const RoleGuard = ({ children, requiredPath }) => {
  const location = useLocation();
  const user = getStoredUser();
  const role = user?.role ?? 'USER_ROLE';
  const pathToCheck = requiredPath ?? location.pathname;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isPathAllowed(role, pathToCheck)) {
    return children;
  }

  const fallback = getFallbackPath(role);
  return <Navigate to={fallback} replace />;
};

export default RoleGuard;
