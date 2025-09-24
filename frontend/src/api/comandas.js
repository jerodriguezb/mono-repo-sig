import api from './axios';

export const getComandasAPreparar = async (params = {}) => {
  const { data } = await api.get('/comandasapreparar', { params });
  return data?.comandas || [];
};

export const getComandasActivas = async (params = {}) => {
  const { data } = await api.get('/comandasactivas', { params });
  return data?.comandas || [];
};

export const getComandas = async (params = {}) => {
  const { data } = await api.get('/comandas', { params });
  return data?.comandas || [];
};

export const updateComanda = async (id, payload) => {
  const { data } = await api.put(`/comandas/${id}`, payload);
  return data?.comanda;
};

export const getUsuarios = async () => {
  const { data } = await api.get('/usuarios');
  return data?.usuarios || [];
};

export const getCamiones = async () => {
  const { data } = await api.get('/camiones');
  return data?.camiones || [];
};
