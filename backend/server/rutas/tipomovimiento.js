// rutas/tipomovimiento.js — CRUD de Tipos de Movimiento de Stock
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Tipomovimiento = require('../modelos/tipomovimiento');
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
// 1. LISTAR TIPOS DE MOVIMIENTO -------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/tipomovimientos', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 500 } = req.query;
  const query = { activo: true };

  const tipomovimientos = await Tipomovimiento.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 500))
    .sort('movimiento')
    .lean()
    .exec();

  const cantidad = await Tipomovimiento.countDocuments(query);
  res.json({ ok: true, tipomovimientos, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. OBTENER POR ID ------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/tipomovimientos/:id', asyncHandler(async (req, res) => {
  const tipo = await Tipomovimiento.findById(req.params.id).lean().exec();
  if (!tipo) return res.status(404).json({ ok: false, err: { message: 'Tipo de movimiento no encontrado' } });
  res.json({ ok: true, tipomovimiento: tipo });
}));

// -----------------------------------------------------------------------------
// 3. CREAR ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/tipomovimientos', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const tipo = new Tipomovimiento({ codmov: body.codmov, movimiento: body.movimiento, factor: body.factor, activo: body.activo });
  const tipoDB = await tipo.save();
  res.json({ ok: true, tipomovimiento: tipoDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR ----------------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/tipomovimientos/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const tipoDB = await Tipomovimiento.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).exec();
  if (!tipoDB) return res.status(404).json({ ok: false, err: { message: 'Tipo de movimiento no encontrado' } });
  res.json({ ok: true, tipomovimiento: tipoDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/tipomovimientos/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const tipoBorrado = await Tipomovimiento.findByIdAndUpdate(req.params.id, { activo: false }, { new: true }).exec();
  if (!tipoBorrado) return res.status(404).json({ ok: false, err: { message: 'Tipo de movimiento no encontrado' } });
  res.json({ ok: true, tipomovimiento: tipoBorrado });
}));

// -----------------------------------------------------------------------------
module.exports = router;

