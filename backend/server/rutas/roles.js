// rutas/roles.js — Listado de roles disponibles
// -----------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Usuario = require('../modelos/usuario');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get(
  '/roles',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (_req, res) => {
    const enumValues = Usuario.schema.path('role').enumValues || [];
    const roles = Array.from(new Set(enumValues)).sort();
    res.json({ ok: true, roles });
  }),
);

module.exports = router;
