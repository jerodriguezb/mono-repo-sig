import api from './axios';

export const fetchPermissions = async () => {
  const response = await api.get('/permissions');
  return response.data;
};

export const savePermissions = async (permissions) => {
  const response = await api.put('/permissions', { permissions });
  return response.data;
};
