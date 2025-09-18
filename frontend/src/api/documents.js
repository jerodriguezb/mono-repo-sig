import api from './axios.js';

export const DOCUMENT_TYPES = [
  { value: 'R', label: 'Remito' },
  { value: 'NR', label: 'Nota de Recepción' },
  { value: 'AJ', label: 'Ajuste de Inventario' },
];

export function fetchDocuments(params = {}) {
  return api.get('/documentos', { params });
}

export function createDocument(payload) {
  return api.post('/documentos', payload);
}
