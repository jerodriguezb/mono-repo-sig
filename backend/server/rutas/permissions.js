// rutas/permissions.js — Gestor de permisos por rol
// -----------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Permission = require('../modelos/permissions');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const sanitizeScreens = (screens = []) => {
  if (!Array.isArray(screens)) return [];
  const set = new Set();
  screens.forEach((screen) => {
    if (typeof screen === 'string' && screen.trim()) set.add(screen.trim());
  });
  return Array.from(set);
};

// -----------------------------------------------------------------------------
// GET /permissions -------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/permissions',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (_req, res) => {
    const docs = await Permission.find().lean().exec();
    const permissions = Object.fromEntries(
      docs.map((doc) => [doc.role, sanitizeScreens(doc.screens)]),
    );
    res.json({ ok: true, permissions });
  }),
);

// -----------------------------------------------------------------------------
// PUT /permissions -------------------------------------------------------------
// -----------------------------------------------------------------------------
router.put(
  '/permissions',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (req, res) => {
    const payload = req.body?.permissions ?? req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ ok: false, err: { message: 'Estructura inválida' } });
    }

    const entries = Object.entries(payload);
    const updatedEntries = [];

    for (const [role, screens] of entries) {
      const sanitized = sanitizeScreens(screens);
      const doc = await Permission.findOneAndUpdate(
        { role },
        { role, screens: sanitized },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      )
        .lean()
        .exec();

      updatedEntries.push([doc.role, sanitizeScreens(doc.screens)]);
    }

    const permissions = Object.fromEntries(updatedEntries);
    res.json({ ok: true, permissions });
  }),
);

// -----------------------------------------------------------------------------
module.exports = router;
