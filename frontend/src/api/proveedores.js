import api from './axios';

export const fetchProveedores = async ({ limite = 500 } = {}) => {
  const response = await api.get('/proveedores', {
    params: { limite },
  });
  return response.data;
};

