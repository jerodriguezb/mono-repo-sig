const express = require('express');
const Permission = require('../modelos/permissions');
const {
  verificaToken,
  verificaAdmin_role,
  ROLE_VALUES,
} = require('../middlewares/autenticacion');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const SCREENS = [
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

const SCREEN_SET = new Set(SCREENS.map((s) => s.path));

router.get(
  '/roles',
  [verificaToken, verificaAdmin_role],
  (req, res) => {
    res.json({ ok: true, roles: ROLE_VALUES });
  }
);

router.get(
  '/screens',
  [verificaToken, verificaAdmin_role],
  (req, res) => {
    res.json({ ok: true, screens: SCREENS });
  }
);

router.get(
  '/permissions',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (req, res) => {
    const docs = await Permission.find({}).lean().exec();
    const permissions = {};

    docs.forEach(({ role, screens }) => {
      if (!role) return;
      permissions[role] = Array.isArray(screens)
        ? screens.filter((screen) => SCREEN_SET.has(screen))
        : [];
    });

    res.json({ ok: true, permissions });
  })
);

router.put(
  '/permissions',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (req, res) => {
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
      return res.status(400).json({
        ok: false,
        err: { message: 'El payload "permissions" debe ser un objeto' },
      });
    }

    const updates = ROLE_VALUES.map((role) => {
      const raw = permissions[role];
      const normalized = Array.isArray(raw)
        ? raw.filter((screen) => SCREEN_SET.has(screen))
        : [];

      return Permission.findOneAndUpdate(
        { role },
        { role, screens: normalized },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).exec();
    });

    await Promise.all(updates);

    res.json({ ok: true });
  })
);

module.exports = router;
module.exports.SCREENS = SCREENS;
