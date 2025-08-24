// rutas/unidaddemedida.js — CRUD de Unidades de Medida
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Unidaddemedida = require('../modelos/unidaddemedida');
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
// 1. LISTAR UNIDADES -----------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/unidades', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 50 } = req.query;
  const query = { activo: true };

  const unidades = await Unidaddemedida.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 50))
    .sort('unidaddemedida')
    .lean()
    .exec();

  const cantidad = await Unidaddemedida.countDocuments(query);
  res.json({ ok: true, unidades, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. OBTENER UNIDAD POR ID ------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/unidades/:id', asyncHandler(async (req, res) => {
  const unidad = await Unidaddemedida.findById(req.params.id).lean().exec();
  if (!unidad) return res.status(404).json({ ok: false, err: { message: 'Unidad de medida no encontrada' } });
  res.json({ ok: true, unidad });
}));

// -----------------------------------------------------------------------------
// 3. CREAR UNIDAD ---------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/unidades', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const unidad = new Unidaddemedida({ codigomedida: body.codigomedida, unidaddemedida: body.unidaddemedida, activo: body.activo });
  const unidadDB = await unidad.save();
  res.json({ ok: true, unidad: unidadDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR UNIDAD ----------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/unidades/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const unidadDB = await Unidaddemedida.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).exec();
  if (!unidadDB) return res.status(404).json({ ok: false, err: { message: 'Unidad de medida no encontrada' } });
  res.json({ ok: true, unidad: unidadDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/unidades/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const unidadBorrada = await Unidaddemedida.findByIdAndUpdate(req.params.id, { activo: false }, { new: true }).exec();
  if (!unidadBorrada) return res.status(404).json({ ok: false, err: { message: 'Unidad de medida no encontrada' } });
  res.json({ ok: true, unidad: unidadBorrada });
}));

// -----------------------------------------------------------------------------
module.exports = router;

