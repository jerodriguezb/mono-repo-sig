// rutas/ruta.js — CRUD de Rutas de reparto
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Ruta = require('../modelos/ruta');
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
// 1. LISTAR RUTAS ---------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/rutas', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 150 } = req.query;
  const query = { activo: true };

  const rutas = await Ruta.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 150))
    .sort('ruta')
    .lean()
    .exec();

  const cantidad = await Ruta.countDocuments(query);
  res.json({ ok: true, rutas, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. OBTENER RUTA POR ID --------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/rutas/:id', asyncHandler(async (req, res) => {
  const ruta = await Ruta.findById(req.params.id).lean().exec();
  if (!ruta) return res.status(404).json({ ok: false, err: { message: 'Ruta no encontrada' } });
  res.json({ ok: true, ruta });
}));

// -----------------------------------------------------------------------------
// 3. CREAR RUTA -----------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/rutas', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const ruta = new Ruta({ ruta: body.ruta, activo: body.activo });
  const rutaDB = await ruta.save();
  res.json({ ok: true, ruta: rutaDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR RUTA ------------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/rutas/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const rutaDB = await Ruta.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).exec();
  if (!rutaDB) return res.status(404).json({ ok: false, err: { message: 'Ruta no encontrada' } });
  res.json({ ok: true, ruta: rutaDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/rutas/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const rutaBorrada = await Ruta.findByIdAndUpdate(req.params.id, { activo: false }, { new: true }).exec();
  if (!rutaBorrada) return res.status(404).json({ ok: false, err: { message: 'Ruta no encontrada' } });
  res.json({ ok: true, ruta: rutaBorrada });
}));

// -----------------------------------------------------------------------------
module.exports = router;
