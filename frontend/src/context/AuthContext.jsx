import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

const AuthContext = createContext(undefined);

const STORAGE_KEYS = {
  token: 'token',
  userId: 'id',
  userName: 'usuario',
  userRaw: 'usuarioData',
};

const safeJSONParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return value;
  }
};

const normalizeUser = (rawUser, storedId, storedName) => {
  if (!rawUser && !storedId && !storedName) return null;

  const base = rawUser && typeof rawUser === 'object' ? rawUser : {};
  const nombres = base.nombres ?? base.name ?? storedName ?? '';
  const apellidos = base.apellidos ?? base.lastName ?? '';
  const id = base._id ?? base.id ?? storedId ?? null;

  if (!id && !nombres && !apellidos) return null;

  return {
    ...base,
    _id: id,
    id,
    nombres,
    apellidos,
  };
};

const readAuthFromStorage = () => {
  const token = localStorage.getItem(STORAGE_KEYS.token) || null;
  const storedId = localStorage.getItem(STORAGE_KEYS.userId) || null;
  const storedNameRaw = localStorage.getItem(STORAGE_KEYS.userName);
  const storedName = safeJSONParse(storedNameRaw) ?? storedNameRaw ?? '';
  const storedUser = safeJSONParse(localStorage.getItem(STORAGE_KEYS.userRaw));

  const user = normalizeUser(storedUser, storedId, storedName);

  return { token, user };
};

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() => readAuthFromStorage());

  const persistAuth = useCallback((nextToken, nextUser) => {
    if (nextToken) localStorage.setItem(STORAGE_KEYS.token, nextToken);
    else localStorage.removeItem(STORAGE_KEYS.token);

    if (nextUser?._id || nextUser?.id) {
      const id = nextUser._id ?? nextUser.id;
      localStorage.setItem(STORAGE_KEYS.userId, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.userId);
    }

    if (nextUser?.nombres) {
      localStorage.setItem(STORAGE_KEYS.userName, JSON.stringify(nextUser.nombres));
    } else {
      localStorage.removeItem(STORAGE_KEYS.userName);
    }

    if (nextUser) {
      localStorage.setItem(STORAGE_KEYS.userRaw, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.userRaw);
    }
  }, []);

  const setAuthUser = useCallback((token, user) => {
    const normalizedUser = normalizeUser(user, user?._id ?? user?.id ?? null, user?.nombres ?? null);
    persistAuth(token, normalizedUser);
    setAuthState({ token, user: normalizedUser });
  }, [persistAuth]);

  const refreshFromStorage = useCallback(() => {
    setAuthState(readAuthFromStorage());
  }, []);

  const logout = useCallback(() => {
    persistAuth(null, null);
    setAuthState({ token: null, user: null });
  }, [persistAuth]);

  const value = useMemo(() => ({
    token: authState.token,
    user: authState.user,
    userId: authState.user?._id ?? null,
    userName: authState.user?.nombres ?? '',
    isAuthenticated: Boolean(authState.token),
    setAuthUser,
    refreshFromStorage,
    logout,
  }), [authState, logout, refreshFromStorage, setAuthUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

