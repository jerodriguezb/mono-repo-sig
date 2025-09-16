import api from './axios';

export const createDocumento = async (payload) => {
  const response = await api.post('/documentos', payload);
  return response.data;
};

export const listarDocumentos = async (params = {}) => {
  const response = await api.get('/documentos', { params });
  return response.data;
};

