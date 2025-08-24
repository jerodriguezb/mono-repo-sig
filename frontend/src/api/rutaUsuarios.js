// src/api/rutaUsuarios.js
import api from './axios';

// 🔐 Login
export const postLogin = async (datos) => {
  try {
    const resp = await api.post('/login', datos); // Envía como JSON por defecto
    return {
      data: resp.data,
      loading: false,
    };
  } catch (error) {
    return {
      data: error.response?.data || { error: 'Error desconocido' },
      loading: false,
    };
  }
};

// 📄 Traer todos los usuarios
export const getUsuarios = async () => {
  try {
    const resp = await api.get('/usuarios');
    return resp.data;
  } catch (error) {
    return {
      data: error.response?.data || { error: 'Error desconocido' },
      loading: false,
    };
  }
};

// 📌 Traer un usuario por ID
export const getUsuarioId = async (id) => {
  try {
    const resp = await api.get(`/usuarios/${id}`);
    return resp.data;
  } catch (error) {
    return {
      data: error.response?.data || { error: 'Error desconocido' },
      loading: false,
    };
  }
};
