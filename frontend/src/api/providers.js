import api from './axios.js';

export function fetchProviders(params = {}) {
  return api.get('/proveedores', { params });
}
