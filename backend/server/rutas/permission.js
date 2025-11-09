const express = require('express');
const Permission = require('../modelos/permission');
const {
  verificaToken,
  verificaAdmin_role,
} = require('../middlewares/autenticacion');

const router = express.Router();

const AVAILABLE_SCREENS = [
  { label: 'Clientes', path: '/clients' },
  { label: 'Usuarios', path: '/users' },
  { label: 'Productos', path: '/products' },
  { label: 'Documentos', path: '/documents' },
  { label: 'Comandas', path: '/comandas' },
  { label: 'Órdenes', path: '/ordenes' },
  { label: 'Historial de Comandas', path: '/historial-comandas' },
  { label: 'Mov Auditoría', path: '/mov-auditoria' },
  { label: 'Permisos', path: '/permissions' },
  { label: 'Distribución', path: '/distribucion' },
  { label: 'Logística', path: '/logistics' },
  { label: 'Precios', path: '/precios' },
];

const KNOWN_ROLES = [
  'SUPER_ADMIN',
  'ADMIN_ROLE',
  'USER_ROLE',
  'USER_CAM',
  'USER_PREV',
];

const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN: AVAILABLE_SCREENS.map((screen) => screen.path),
  ADMIN_ROLE: AVAILABLE_SCREENS
    .filter((screen) => screen.path !== '/permissions')
    .map((screen) => screen.path),
  USER_ROLE: [],
  USER_CAM: ['/distribucion'],
  USER_PREV: ['/comandas', '/clients'],
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const VALID_PATHS = new Set(AVAILABLE_SCREENS.map((screen) => screen.path));
const sanitizeScreens = (screens = []) => {
  if (!Array.isArray(screens)) return [];
  const unique = new Set();
  screens.forEach((path) => {
    if (typeof path === 'string' && VALID_PATHS.has(path)) unique.add(path);
  });
  return Array.from(unique);
};

const mapDocsToMatrix = (docs = []) => {
  const matrix = {};
  docs.forEach(({ role, screens }) => {
    if (!role) return;
    const sanitized = sanitizeScreens(screens);
    const defaults = DEFAULT_PERMISSIONS[role] || [];
    matrix[role] = Array.from(new Set([...sanitized, ...defaults]));
  });

  KNOWN_ROLES.forEach((role) => {
    if (!matrix[role]) matrix[role] = [...(DEFAULT_PERMISSIONS[role] || [])];
  });

  return matrix;
};

const seedDefaultsIfNeeded = async () => {
  const count = await Permission.estimatedDocumentCount();
  if (count > 0) return;

  const docs = KNOWN_ROLES.map((role) => ({ role, screens: DEFAULT_PERMISSIONS[role] || [] }));
  await Permission.insertMany(docs);
};

const getMatrixFromDb = async () => {
  await seedDefaultsIfNeeded();
  const docs = await Permission.find({ role: { $in: KNOWN_ROLES } })
    .lean()
    .exec();
  return mapDocsToMatrix(docs);
};

router.get(
  '/permissions',
  [verificaToken],
  asyncHandler(async (req, res) => {
    const permissions = await getMatrixFromDb();
    res.json({ ok: true, permissions, screens: AVAILABLE_SCREENS });
  }),
);

router.put(
  '/permissions',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (req, res) => {
    const { permissions } = req.body || {};

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ ok: false, err: { message: 'Formato de permisos inválido' } });
    }

    const updates = [];
    const roles = new Set([...KNOWN_ROLES, ...Object.keys(permissions)]);

    roles.forEach((role) => {
      const screens = sanitizeScreens(permissions[role] || []);
      updates.push(
        Permission.findOneAndUpdate(
          { role },
          { role, screens },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        ).exec(),
      );
    });

    await Promise.all(updates);

    const matrix = await getMatrixFromDb();
    res.json({ ok: true, permissions: matrix, screens: AVAILABLE_SCREENS });
  }),
);

module.exports = router;
