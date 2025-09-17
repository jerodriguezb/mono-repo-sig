import api from './axios.js';

export function fetchProducts(params = {}) {
  return api.get('/producservs', { params });
}

export function updateProductStock(productId, payload) {
  return api.put(`/producservs/${productId}`, payload);
}
