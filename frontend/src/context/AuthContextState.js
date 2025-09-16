import { createContext, useContext } from 'react';

export const AUTH_STATE_TEMPLATE = {
  token: null,
  userId: null,
  userName: '',
};

export const AuthContext = createContext({
  ...AUTH_STATE_TEMPLATE,
  login: () => {},
  logout: () => {},
  refreshAuth: () => {},
});

export const useAuth = () => useContext(AuthContext);
