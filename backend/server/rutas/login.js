// rutas/login.js — Autenticación de usuarios
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Usuario = require('../modelos/usuario');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helper para capturar errores async sin repetir try/catch
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// -----------------------------------------------------------------------------
// POST /login ------------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const usuarioDB = await Usuario.findOne({ email, activo: true }).exec();

  if (!usuarioDB)
    return res.status(400).json({ ok: false, err: { message: 'Usuario o contraseña incorrectos' } });

  const match = await bcrypt.compare(password, usuarioDB.password);
  if (!match)
    return res.status(400).json({ ok: false, err: { message: 'Usuario o contraseña incorrectos' } });

  // Firmar token (payload mínimo: id + role)
  const payload = { _id: usuarioDB._id, role: usuarioDB.role };
  const token = jwt.sign(payload, process.env.SEED, { expiresIn: process.env.EXPIRACION });

  res.json({ ok: true, usuario: usuarioDB, token });
}));

// -----------------------------------------------------------------------------
module.exports = router;

