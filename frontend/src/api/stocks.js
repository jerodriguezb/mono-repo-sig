import api from './axios';

export const fetchStockMovements = async (params = {}) => {
  const response = await api.get('/stocks', { params });
  return response.data;
};

export const fetchMovementTypes = async (params = {}) => {
  const response = await api.get('/tipomovimientos', { params });
  return response.data;
};

export const lookupProducts = async (term, { limit = 20 } = {}) => {
  const response = await api.get('/producservs/lookup', {
    params: { q: term, limit },
  });
  return response.data;
};

export const lookupUsers = async (term, { limit = 20 } = {}) => {
  const response = await api.get('/usuarios/lookup', {
    params: { term, limit },
  });
  return response.data;
};
