// src/api/stocks.js
import api from './axios';

export const fetchStockMovements = async (params = {}) => {
  const response = await api.get('/stocks', { params });
  return response.data;
};

export const fetchMovementTypes = async () => {
  const response = await api.get('/tipomovimientos', { params: { limite: 200 } });
  return response.data;
};

export const lookupProducts = async (term) => {
  const response = await api.get('/producservs/lookup', {
    params: { q: term, limit: 20 },
  });
  return response.data;
};

export const lookupUsers = async (term) => {
  const response = await api.get('/usuarios/lookup', {
    params: { term, limite: 20 },
  });
  return response.data;
};
