/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext({ user: null, setUser: () => {} });

const parseStoredUser = () => {
  try {
    const id = localStorage.getItem('id');
    const nombresRaw = localStorage.getItem('usuario');
    const nombres = nombresRaw ? JSON.parse(nombresRaw) : null;
    if (!id) return null;
    return { id, nombres };
  } catch (error) {
    console.error('Error leyendo usuario almacenado', error);
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => parseStoredUser());

  useEffect(() => {
    setUserState(parseStoredUser());
  }, []);

  const setUser = useCallback((nextUser) => {
    if (nextUser?.id) {
      localStorage.setItem('id', nextUser.id);
      localStorage.setItem('usuario', JSON.stringify(nextUser.nombres ?? ''));
    } else {
      localStorage.removeItem('id');
      localStorage.removeItem('usuario');
    }
    setUserState(nextUser ?? null);
  }, []);

  const value = useMemo(() => ({ user, setUser }), [user, setUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
