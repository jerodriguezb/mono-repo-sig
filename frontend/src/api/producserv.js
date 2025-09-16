import api from './axios';

export const searchProductos = async ({ search, limite = 20 } = {}) => {
  const params = { limite };
  if (search) params.search = search;
  const response = await api.get('/producservs', { params });
  return response.data;
};

export const updateProductoStock = async (id, payload) => {
  const response = await api.put(`/producservs/${id}`, payload);
  return response.data;
};

