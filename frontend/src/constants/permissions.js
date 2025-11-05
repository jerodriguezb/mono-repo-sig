// src/constants/permissions.js
// Centraliza la definición de pantallas disponibles y los permisos por rol.

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super administrador',
  ADMIN_ROLE: 'Administrador',
  USER_ROLE: 'Usuario estándar',
  USER_CAM: 'Usuario Camión',
  USER_PREV: 'Usuario Preventista',
};

export const SCREEN_DEFINITIONS = {
  '/clients': 'Clientes',
  '/users': 'Usuarios',
  '/products': 'Productos',
  '/documents': 'Documentos',
  '/comandas': 'Comandas',
  '/ordenes': 'Órdenes',
  '/historial-comandas': 'Historial de comandas',
  '/permissions': 'Permisos',
  '/distribucion': 'Distribución',
  '/logistics': 'Logística',
  '/precios': 'Precios',
};

const ALL_SCREENS = Object.keys(SCREEN_DEFINITIONS);

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ALL_SCREENS,
  ADMIN_ROLE: ALL_SCREENS.filter((path) => path !== '/permissions'),
  USER_ROLE: [],
  USER_CAM: ['/distribucion'],
  USER_PREV: ['/comandas', '/clients'],
};

export const getScreensForRole = (role) => ROLE_PERMISSIONS[role] ?? [];

export const mapPathsToLabels = (paths) =>
  paths.map((path) => ({ path, label: SCREEN_DEFINITIONS[path] || path }));

