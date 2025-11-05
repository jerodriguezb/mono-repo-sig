import api from './axios';

export const fetchRoles = async () => {
  const { data } = await api.get('/roles');
  return data;
};

export const fetchScreens = async () => {
  const { data } = await api.get('/screens');
  return data;
};

export const fetchPermissions = async () => {
  const { data } = await api.get('/permissions');
  return data;
};

export const updatePermissions = async (permissions) => {
  const { data } = await api.put('/permissions', { permissions });
  return data;
};
