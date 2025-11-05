import api from './axios';

export const fetchRoles = () => api.get('/roles');
export const fetchScreens = () => api.get('/screens');
export const fetchPermissions = () => api.get('/permissions');
export const updatePermissions = (permissions) =>
  api.put('/permissions', { permissions });

export default {
  fetchRoles,
  fetchScreens,
  fetchPermissions,
  updatePermissions,
};
