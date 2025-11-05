const express = require('express');
const Permission = require('../modelos/permissions');
const Usuario = require('../modelos/usuario');
const screens = require('../constants/screens');
const {
  verificaToken,
  verificaSuperAdmin_role,
} = require('../middlewares/autenticacion');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const ROLE_ORDER = ['SUPER_ADMIN', 'ADMIN_ROLE', 'USER_ROLE', 'USER_CAM', 'USER_PREV'];
const screenPaths = screens.map((screen) => screen.path);
const screenSet = new Set(screenPaths);

const buildDefaults = () => ({
  SUPER_ADMIN: [...screenPaths],
  ADMIN_ROLE: screenPaths.filter((path) => path !== '/permissions'),
  USER_ROLE: [],
  USER_CAM: screenSet.has('/distribucion') ? ['/distribucion'] : [],
  USER_PREV: ['/comandas', '/clients'].filter((path) => screenSet.has(path)),
});

const sanitizeScreens = (values) => {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((path) => screenSet.has(path))));
};

const orderPermissions = (permissions) => {
  const ordered = {};
  ROLE_ORDER.forEach((role) => {
    if (permissions[role]) ordered[role] = permissions[role];
  });
  Object.keys(permissions).forEach((role) => {
    if (!ordered[role]) ordered[role] = permissions[role];
  });
  return ordered;
};

const computeInitialPermissions = (role, doc, defaults) => {
  const hasRecord = Boolean(doc);
  const sanitized = sanitizeScreens(doc?.screens ?? []);

  switch (role) {
    case 'SUPER_ADMIN':
      return [...defaults.SUPER_ADMIN];
    case 'ADMIN_ROLE': {
      if (!hasRecord) return [...defaults.ADMIN_ROLE];
      return sanitized.filter((path) => path !== '/permissions');
    }
    case 'USER_CAM':
      return hasRecord ? sanitized : [...defaults.USER_CAM];
    case 'USER_PREV':
      return hasRecord ? sanitized : [...defaults.USER_PREV];
    case 'USER_ROLE':
      return sanitized;
    default:
      return sanitized;
  }
};

const computePersistedPermissions = (role, requested, defaults) => {
  const sanitized = sanitizeScreens(requested);

  switch (role) {
    case 'SUPER_ADMIN':
      return [...defaults.SUPER_ADMIN];
    case 'ADMIN_ROLE':
      return sanitized.filter((path) => path !== '/permissions');
    default:
      return sanitized;
  }
};

router.get(
  '/roles',
  [verificaToken, verificaSuperAdmin_role],
  asyncHandler(async (_req, res) => {
    const schemaRoles = Usuario.schema.path('role')?.enumValues ?? [];
    const roleSet = new Set([...schemaRoles, 'SUPER_ADMIN']);
    const roles = ROLE_ORDER.filter((role) => roleSet.has(role));
    res.json({ ok: true, roles });
  })
);

router.get(
  '/screens',
  [verificaToken, verificaSuperAdmin_role],
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, screens });
  })
);

router.get(
  '/permissions',
  [verificaToken, verificaSuperAdmin_role],
  asyncHandler(async (_req, res) => {
    const defaults = buildDefaults();
    const docs = await Permission.find().lean().exec();
    const permissions = {};

    docs.forEach((doc) => {
      permissions[doc.role] = computeInitialPermissions(doc.role, doc, defaults);
    });

    ROLE_ORDER.forEach((role) => {
      if (!permissions[role]) {
        permissions[role] = computeInitialPermissions(role, null, defaults);
      }
    });

    res.json({ ok: true, permissions: orderPermissions(permissions) });
  })
);

router.put(
  '/permissions',
  [verificaToken, verificaSuperAdmin_role],
  asyncHandler(async (req, res) => {
    const payload = req.body?.permissions;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ ok: false, err: { message: 'Formato de permisos inválido' } });
    }

    const defaults = buildDefaults();
    const existing = await Permission.find().lean().exec();
    const existingMap = new Map(existing.map((doc) => [doc.role, doc]));

    const rolesToProcess = new Set([...ROLE_ORDER, ...Object.keys(payload)]);
    const normalizedPermissions = {};

    for (const role of rolesToProcess) {
      const hasPayload = Object.prototype.hasOwnProperty.call(payload, role);
      const requested = hasPayload ? payload[role] : existingMap.get(role)?.screens ?? [];
      normalizedPermissions[role] = computePersistedPermissions(role, requested, defaults);
    }

    await Promise.all(
      Object.entries(normalizedPermissions).map(([role, screens]) =>
        Permission.findOneAndUpdate(
          { role },
          { role, screens },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        ).exec()
      )
    );

    res.json({ ok: true, permissions: orderPermissions(normalizedPermissions) });
  })
);

module.exports = router;
