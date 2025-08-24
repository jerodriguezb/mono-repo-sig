// rutas/tipoiva.js — CRUD de Tipos de IVA
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Tipoiva = require('../modelos/tipoiva');
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
// 1. LISTAR TIPOS DE IVA --------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/iva', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 50 } = req.query;
  const query = { activo: true };

  const iva = await Tipoiva.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 50))
    .sort('iva')
    .lean()
    .exec();

  const cantidad = await Tipoiva.countDocuments(query);
  res.json({ ok: true, iva, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. OBTENER IVA POR ID ---------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/iva/:id', asyncHandler(async (req, res) => {
  const ivaDoc = await Tipoiva.findById(req.params.id).lean().exec();
  if (!ivaDoc) return res.status(404).json({ ok: false, err: { message: 'IVA no encontrada' } });
  res.json({ ok: true, iva: ivaDoc });
}));

// -----------------------------------------------------------------------------
// 3. CREAR IVA ------------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/iva', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const ivaDoc = new Tipoiva({ codigoiva: body.codigoiva, iva: body.iva, activo: body.activo });
  const ivaDB = await ivaDoc.save();
  res.json({ ok: true, iva: ivaDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR IVA -------------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/iva/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const ivaDB = await Tipoiva.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).exec();
  if (!ivaDB) return res.status(404).json({ ok: false, err: { message: 'IVA no encontrada' } });
  res.json({ ok: true, iva: ivaDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) ---------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/iva/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const ivaBorrado = await Tipoiva.findByIdAndUpdate(req.params.id, { activo: false }, { new: true }).exec();
  if (!ivaBorrado) return res.status(404).json({ ok: false, err: { message: 'IVA no encontrada' } });
  res.json({ ok: true, iva: ivaBorrado });
}));

// -----------------------------------------------------------------------------
module.exports = router;
