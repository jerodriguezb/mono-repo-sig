const express = require('express');
const Permission = require('../modelos/permission');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

const ROLES = ['ADMIN_ROLE', 'USER_ROLE', 'USER_CAM', 'USER_PREV'];
const AVAILABLE_SCREENS = [
  '/clients',
  '/users',
  '/products',
  '/documents',
  '/comandas',
  '/ordenes',
  '/historial-comandas',
  '/permissions',
  '/distribucion',
  '/logistics',
  '/precios',
];

const SCREEN_SET = new Set(AVAILABLE_SCREENS);

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const orderScreens = (screens = []) =>
  AVAILABLE_SCREENS.filter((screen) => screens.includes(screen));

const sanitizeScreens = (screens = [], role) => {
  if (role === 'ADMIN_ROLE') {
    return [...AVAILABLE_SCREENS];
  }

  if (!Array.isArray(screens)) return [];

  const unique = [...new Set(screens.filter((screen) => SCREEN_SET.has(screen)))];
  return orderScreens(unique);
};

const buildPayload = (docs = []) => {
  const map = new Map(docs.map((doc) => [doc.role, doc.screens || []]));

  return ROLES.map((role) => ({
    role,
    screens:
      role === 'ADMIN_ROLE'
        ? [...AVAILABLE_SCREENS]
        : orderScreens(map.get(role) || []),
  }));
};

router.get(
  '/permissions',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (_req, res) => {
    const docs = await Permission.find({ role: { $in: ROLES } }).lean().exec();
    const permissions = buildPayload(docs);
    res.json({ ok: true, permissions });
  }),
);

router.put(
  '/permissions',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (req, res) => {
    const { permissions } = req.body || {};

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ ok: false, err: { message: 'Permisos inválidos' } });
    }

    for (const item of permissions) {
      if (!item || typeof item !== 'object') {
        return res.status(400).json({ ok: false, err: { message: 'Formato inválido' } });
      }

      const { role, screens } = item;

      if (!ROLES.includes(role)) {
        return res.status(400).json({ ok: false, err: { message: `Rol desconocido: ${role}` } });
      }

      const normalizedScreens = sanitizeScreens(screens, role);

      await Permission.findOneAndUpdate(
        { role },
        { role, screens: normalizedScreens },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ).exec();
    }

    // Para roles que no llegaron en el payload, mantenemos lo existente
    const docs = await Permission.find({ role: { $in: ROLES } }).lean().exec();
    const permissionsResponse = buildPayload(docs);

    res.json({ ok: true, permissions: permissionsResponse });
  }),
);

module.exports = router;
