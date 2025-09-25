// rutas/usuario.js — CRUD de Usuarios y Autorizaciones
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const bcrypt = require('bcrypt');
const { pick } = require('underscore');
const Usuario = require('../modelos/usuario');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
const toNumber = (v, d) => Number(v ?? d);

// -----------------------------------------------------------------------------
// 1. LISTAR USUARIOS ------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/usuarios', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const { desde = 0, limite = 500 } = req.query;
  const query = { activo: true };

  const usuarios = await Usuario.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 500))
    .lean()
    .exec();

  const cantidad = await Usuario.countDocuments(query);
  res.json({ ok: true, usuarios, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. OBTENER USUARIO POR ID -----------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/usuarios/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const usuario = await Usuario.findById(req.params.id).lean().exec();
  if (!usuario) return res.status(404).json({ ok: false, err: { message: 'Usuario no encontrado' } });
  res.json({ ok: true, usuario });
}));

// -----------------------------------------------------------------------------
// 3. CREAR USUARIO --------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/usuarios', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const hashed = await bcrypt.hash(body.password, 10);

  const usuario = new Usuario({
    nombres: body.nombres,
    apellidos: body.apellidos,
    dni: body.dni,
    email: body.email,
    avatar: body.avatar,
    password: hashed,
    role: body.role,
    activo: true,
  });

  const usuarioDB = await usuario.save();
  res.json({ ok: true, usuario: usuarioDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR USUARIO ---------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/usuarios/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const allowed = ['nombres', 'apellidos', 'dni', 'email', 'avatar', 'role', 'password'];
  const body = pick(req.body, allowed);

  // Si viene password, encripta
  if (body.password) {
    body.password = await bcrypt.hash(body.password, 10);
  }

  const usuarioDB = await Usuario.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).exec();
  if (!usuarioDB) return res.status(404).json({ ok: false, err: { message: 'Usuario no encontrado' } });
  res.json({ ok: true, usuario: usuarioDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/usuarios/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const usuarioBorrado = await Usuario.findByIdAndUpdate(req.params.id, { activo: false }, { new: true }).exec();
  if (!usuarioBorrado) return res.status(404).json({ ok: false, err: { message: 'Usuario no encontrado' } });
  res.json({ ok: true, usuario: usuarioBorrado });
}));

// -----------------------------------------------------------------------------
// 6. LISTAR CAMIONEROS PARA LOGÍSTICA ------------------------------------------
// -----------------------------------------------------------------------------
router.get('/usuarios/camioneros', asyncHandler(async (req, res) => {
  const { term = '', limit = 20 } = req.query;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 20);
  const regex = term ? new RegExp(term, 'i') : null;

  const query = { activo: true, role: 'USER_CAM' };
  if (regex) {
    query.$or = [
      { nombres: { $regex: regex } },
      { apellidos: { $regex: regex } },
      { email: { $regex: regex } },
    ];
  }

  const usuarios = await Usuario.find(query)
    .sort({ nombres: 1, apellidos: 1 })
    .limit(safeLimit)
    .select('nombres apellidos email role')
    .lean()
    .exec();

  res.json({ ok: true, usuarios });
}));

// -----------------------------------------------------------------------------
module.exports = router;
