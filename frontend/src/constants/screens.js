// src/constants/screens.js
// -----------------------------------------------------------------------------
// Listado centralizado de pantallas disponibles en el dashboard.

export const screens = [
  { label: 'Clientes', path: '/clients' },
  { label: 'Usuarios', path: '/users' },
  { label: 'Productos', path: '/products' },
  { label: 'Documentos', path: '/documents' },
  { label: 'Comandas', path: '/comandas' },
  { label: 'Ordenes', path: '/ordenes' },
  { label: 'Historial', path: '/historial-comandas' },
  { label: 'Permisos', path: '/permissions' },
  { label: 'Distribución', path: '/distribucion' },
  { label: 'Logística', path: '/logistics' },
  { label: 'Precios', path: '/precios' },
];

export const screenPaths = screens.map((screen) => screen.path);
