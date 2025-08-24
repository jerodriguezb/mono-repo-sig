// rutas/marca.js — CRUD de Marcas
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Marca = require('../modelos/marca');
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
// 1. LISTAR MARCAS --------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/marcas', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 500 } = req.query;
  const query = { activo: true };

  const marcas = await Marca.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 500))
    .sort('marca')
    .lean()
    .exec();

  const cantidad = await Marca.countDocuments(query);
  res.json({ ok: true, marcas, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. MARCA POR ID --------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/marcas/:id', asyncHandler(async (req, res) => {
  const marca = await Marca.findById(req.params.id).lean().exec();
  if (!marca) return res.status(404).json({ ok: false, err: { message: 'Marca no encontrada' } });
  res.json({ ok: true, marca });
}));

// -----------------------------------------------------------------------------
// 3. CREAR MARCA ---------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/marcas', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const marca = new Marca({ codmarca: body.codmarca, marca: body.marca, activo: body.activo });
  const marcaDB = await marca.save();
  res.json({ ok: true, marca: marcaDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR MARCA ----------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/marcas/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const marcaDB = await Marca.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).exec();
  if (!marcaDB) return res.status(404).json({ ok: false, err: { message: 'Marca no encontrada' } });
  res.json({ ok: true, marca: marcaDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/marcas/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const marcaBorrada = await Marca.findByIdAndUpdate(req.params.id, { activo: false }, { new: true }).exec();
  if (!marcaBorrada) return res.status(404).json({ ok: false, err: { message: 'Marca no encontrada' } });
  res.json({ ok: true, marca: marcaBorrada });
}));

// -----------------------------------------------------------------------------
module.exports = router;
