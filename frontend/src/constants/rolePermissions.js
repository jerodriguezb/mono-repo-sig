// src/constants/rolePermissions.js
// -----------------------------------------------------------------------------
// Centraliza la definición de pantallas disponibles en la app y los accesos por
// rol. Esta configuración se utiliza tanto para mostrar el menú lateral como
// para validar el enrutado y construir la pantalla de Permisos.
// -----------------------------------------------------------------------------

export const APP_SCREEN_DEFINITIONS = [
  { path: '/clients', label: 'Clientes' },
  { path: '/users', label: 'Usuarios' },
  { path: '/products', label: 'Productos' },
  { path: '/documents', label: 'Documentos' },
  { path: '/comandas', label: 'Comandas' },
  { path: '/ordenes', label: 'Órdenes' },
  { path: '/historial-comandas', label: 'Historial de Comandas' },
  { path: '/permissions', label: 'Permisos' },
  { path: '/distribucion', label: 'Distribución' },
  { path: '/logistics', label: 'Logística' },
  { path: '/precios', label: 'Precios' },
];

export const PATH_LABELS = APP_SCREEN_DEFINITIONS.reduce((acc, screen) => {
  acc[screen.path] = screen.label;
  return acc;
}, {});

const ALL_PATHS = APP_SCREEN_DEFINITIONS.map((screen) => screen.path);

export const ROLE_CONFIG = {
  SUPER_ADMIN: {
    label: 'Super Administrador',
    description: 'Posee todos los permisos, roles y acceso total a las pantallas del sistema.',
    allow: 'all',
  },
  ADMIN_ROLE: {
    label: 'Administrador',
    description: 'Acceso completo al sistema salvo a la pantalla de permisos.',
    allow: 'all',
    deny: ['/permissions'],
  },
  USER_ROLE: {
    label: 'Usuario',
    description: 'Sin accesos definidos por el momento.',
    allow: [],
  },
  USER_CAM: {
    label: 'Usuario Cámara',
    description: 'Puede operar únicamente en la pantalla de distribución.',
    allow: ['/distribucion'],
  },
  USER_PREV: {
    label: 'Usuario Preventa',
    description: 'Acceso limitado a las pantallas de comanda y clientes.',
    allow: ['/comandas', '/clients'],
  },
};

const normalizePath = (path) => {
  if (!path) return '/';
  let normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
};

const matchesPath = (basePath, candidatePath) => {
  const base = normalizePath(basePath);
  const candidate = normalizePath(candidatePath);

  if (base === '/') {
    return candidate === '/';
  }

  return candidate === base || candidate.startsWith(`${base}/`);
};

export const getAllowedPathsForRole = (role) => {
  const config = ROLE_CONFIG[role];
  if (!config) return [];

  if (config.allow === 'all') {
    const denied = config.deny ?? [];
    return ALL_PATHS.filter((path) => !denied.some((denyPath) => matchesPath(denyPath, path)));
  }

  return config.allow;
};

export const isPathAllowed = (role, path) => {
  const config = ROLE_CONFIG[role];
  if (!config) return false;

  if (config.allow === 'all') {
    const denied = config.deny ?? [];
    return !denied.some((denyPath) => matchesPath(denyPath, path));
  }

  return config.allow.some((allowedPath) => matchesPath(allowedPath, path));
};

export const getFallbackPath = (role) => {
  const config = ROLE_CONFIG[role];
  if (!config) return '/no-access';

  if (config.allow === 'all') {
    const denied = config.deny ?? [];
    const fallback = ALL_PATHS.find((path) => !denied.some((denyPath) => matchesPath(denyPath, path)));
    return fallback ?? '/no-access';
  }

  return config.allow[0] ?? '/no-access';
};
