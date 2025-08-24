// rutas/rubro.js — CRUD de Rubros (categorías de productos)
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Rubro = require('../modelos/rubro');
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
// 1. LISTAR RUBROS --------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/rubros', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 500 } = req.query;
  const query = { activo: true };

  const rubros = await Rubro.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 500))
    .sort('rubro')
    .lean()
    .exec();

  const cantidad = await Rubro.countDocuments(query);
  res.json({ ok: true, rubros, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. OBTENER RUBRO POR ID -------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/rubros/:id', asyncHandler(async (req, res) => {
  const rubro = await Rubro.findById(req.params.id).lean().exec();
  if (!rubro) return res.status(404).json({ ok: false, err: { message: 'Rubro no encontrado' } });
  res.json({ ok: true, rubro });
}));

// -----------------------------------------------------------------------------
// 3. CREAR RUBRO ---------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/rubros', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const rubro = new Rubro({ codrubro: body.codrubro, rubro: body.rubro, activo: body.activo });
  const rubroDB = await rubro.save();
  res.json({ ok: true, rubro: rubroDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR RUBRO ----------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/rubros/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const rubroDB = await Rubro.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).exec();
  if (!rubroDB) return res.status(404).json({ ok: false, err: { message: 'Rubro no encontrado' } });
  res.json({ ok: true, rubro: rubroDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/rubros/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const rubroBorrado = await Rubro.findByIdAndUpdate(req.params.id, { activo: false }, { new: true }).exec();
  if (!rubroBorrado) return res.status(404).json({ ok: false, err: { message: 'Rubro no encontrado' } });
  res.json({ ok: true, rubro: rubroBorrado });
}));

// -----------------------------------------------------------------------------
module.exports = router;

