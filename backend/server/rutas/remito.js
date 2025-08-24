// rutas/remito.js — CRUD de Remitos de compra
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Remito = require('../modelos/remito');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
const toNumber = (v, d) => Number(v ?? d);

const remitoPopulate = [
  { path: 'codprov', populate: { path: 'localidad' } },
  'codprod',
];

// -----------------------------------------------------------------------------
// 1. LISTAR REMITOS -------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/remitos', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 500 } = req.query;
  const query = { activo: true };

  const remitos = await Remito.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 500))
    .sort('nroderemito')
    .populate(remitoPopulate)
    .lean()
    .exec();

  const cantidad = await Remito.countDocuments(query);
  res.json({ ok: true, remitos, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. OBTENER REMITO POR ID ------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/remitos/:id', asyncHandler(async (req, res) => {
  const remito = await Remito.findById(req.params.id).populate(remitoPopulate).lean().exec();
  if (!remito) return res.status(404).json({ ok: false, err: { message: 'Remito no encontrado' } });
  res.json({ ok: true, remito });
}));

// -----------------------------------------------------------------------------
// 3. CREAR REMITO ---------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/remitos', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const remito = new Remito({
    nroderemito: body.nroderemito,
    fecha: body.fecha,
    codprov: body.codprov,
    codprod: body.codprod,
    cantidad: body.cantidad,
    activo: body.activo,
  });
  const remitoDB = await remito.save();
  res.json({ ok: true, remito: remitoDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR REMITO ----------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/remitos/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const remitoDB = await Remito.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate(remitoPopulate)
    .exec();
  if (!remitoDB) return res.status(404).json({ ok: false, err: { message: 'Remito no encontrado' } });
  res.json({ ok: true, remito: remitoDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/remitos/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const remitoBorrado = await Remito.findByIdAndUpdate(req.params.id, { activo: false }, { new: true })
    .populate(remitoPopulate)
    .exec();
  if (!remitoBorrado) return res.status(404).json({ ok: false, err: { message: 'Remito no encontrado' } });
  res.json({ ok: true, remito: remitoBorrado });
}));

// -----------------------------------------------------------------------------
module.exports = router;

