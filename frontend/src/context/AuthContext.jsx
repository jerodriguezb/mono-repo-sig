import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEYS = {
  token: 'token',
  userId: 'id',
  user: 'usuario',
};

const parseStoredUser = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEYS.token));
  const [userId, setUserId] = useState(() => localStorage.getItem(STORAGE_KEYS.userId));
  const [user, setUser] = useState(() => parseStoredUser(localStorage.getItem(STORAGE_KEYS.user)));

  const setSession = useCallback((sessionData = {}) => {
    const { token: nextToken, userId: nextUserId, user: nextUser } = sessionData;

    setToken((prevToken) => {
      const resolvedToken = nextToken !== undefined ? nextToken : prevToken;
      if (resolvedToken === undefined || resolvedToken === null) {
        localStorage.removeItem(STORAGE_KEYS.token);
        return null;
      }
      const normalizedToken = String(resolvedToken);
      localStorage.setItem(STORAGE_KEYS.token, normalizedToken);
      return normalizedToken;
    });

    setUserId((prevUserId) => {
      const resolvedUserId = nextUserId !== undefined ? nextUserId : prevUserId;
      if (resolvedUserId === undefined || resolvedUserId === null) {
        localStorage.removeItem(STORAGE_KEYS.userId);
        return null;
      }
      const normalizedUserId = String(resolvedUserId);
      localStorage.setItem(STORAGE_KEYS.userId, normalizedUserId);
      return normalizedUserId;
    });

    setUser((prevUser) => {
      const resolvedUser = nextUser !== undefined ? nextUser : prevUser;
      if (resolvedUser === undefined || resolvedUser === null) {
        localStorage.removeItem(STORAGE_KEYS.user);
        return null;
      }
      const serializedUser = typeof resolvedUser === 'string'
        ? resolvedUser
        : JSON.stringify(resolvedUser);
      localStorage.setItem(STORAGE_KEYS.user, serializedUser);
      return resolvedUser;
    });
  }, []);

  const clearSession = useCallback(() => {
    setSession({ token: null, userId: null, user: null });
  }, [setSession]);

  useEffect(() => {
    const syncFromStorage = () => {
      setToken(localStorage.getItem(STORAGE_KEYS.token));
      setUserId(localStorage.getItem(STORAGE_KEYS.userId));
      setUser(parseStoredUser(localStorage.getItem(STORAGE_KEYS.user)));
    };

    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const value = useMemo(() => ({
    token,
    userId,
    user,
    setSession,
    clearSession,
  }), [token, userId, user, setSession, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}

