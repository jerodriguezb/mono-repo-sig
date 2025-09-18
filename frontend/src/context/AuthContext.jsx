import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { AuthContext, AUTH_STATE_TEMPLATE } from './AuthContextState.js';

const readAuthFromStorage = () => {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('id');
  const storedName = localStorage.getItem('usuario');
  let userName = '';

  if (storedName) {
    try {
      userName = JSON.parse(storedName);
    } catch {
      userName = storedName;
    }
  }

  return {
    token: token || null,
    userId: userId || null,
    userName: userName || '',
  };
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(() => ({
    ...AUTH_STATE_TEMPLATE,
    ...readAuthFromStorage(),
  }));

  const login = useCallback(({ token, user }) => {
    if (token) localStorage.setItem('token', token);
    if (user?._id) localStorage.setItem('id', user._id);
    if (user?.nombres) localStorage.setItem('usuario', JSON.stringify(user.nombres));

    setAuthState({
      token: token || null,
      userId: user?._id || null,
      userName: user?.nombres || '',
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('id');
    localStorage.removeItem('usuario');
    setAuthState({ ...AUTH_STATE_TEMPLATE });
  }, []);

  const refreshAuth = useCallback(() => {
    setAuthState({
      ...AUTH_STATE_TEMPLATE,
      ...readAuthFromStorage(),
    });
  }, []);

  const value = useMemo(() => ({
    ...authState,
    login,
    logout,
    refreshAuth,
  }), [authState, login, logout, refreshAuth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
