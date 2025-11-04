import api from './axios';

export const fetchPermissions = () => api.get('/permissions');

export const updatePermissions = (permissions) =>
  api.put('/permissions', permissions);

export default {
  fetchPermissions,
  updatePermissions,
};
