import api from './axios';

export const fetchDocumentos = (params = {}) =>
  api.get('/documentos', { params });

export const createDocumento = (payload) =>
  api.post('/documentos', payload);

export const fetchProveedores = (params = {}) =>
  api.get('/proveedores', {
    params: { limite: 500, ...params },
  });

export const fetchProductos = (params = {}) =>
  api.get('/producservs', {
    params: { limite: 100, ...params },
  });

export const updateProductoStock = (id, payload) =>
  api.put(`/producservs/${id}`, payload);
