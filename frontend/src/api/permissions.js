import api from './axios';

export const fetchPermissions = async () => {
  const { data } = await api.get('/permissions');
  return data;
};

export const updatePermissions = async (permissions) => {
  const { data } = await api.put('/permissions', { permissions });
  return data;
};
