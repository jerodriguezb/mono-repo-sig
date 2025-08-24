// rutas/lista.js — CRUD de Listas de precios
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Lista = require('../modelos/lista');
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
// 1. LISTAR LISTAS -------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/listas', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 500 } = req.query;
  const query = { activo: true };

  const listas = await Lista.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 500))
    .sort('lista')
    .lean()
    .exec();

  const cantidad = await Lista.countDocuments(query);
  res.json({ ok: true, listas, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. LISTA POR ID --------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/listas/:id', asyncHandler(async (req, res) => {
  const lista = await Lista.findById(req.params.id).lean().exec();
  if (!lista) return res.status(404).json({ ok: false, err: { message: 'Lista no encontrada' } });
  res.json({ ok: true, lista });
}));

// -----------------------------------------------------------------------------
// 3. CREAR LISTA ---------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/listas', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const lista = new Lista({ codlista: body.codlista, lista: body.lista, activo: body.activo });
  const listaDB = await lista.save();
  res.json({ ok: true, lista: listaDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR LISTA ----------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/listas/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const listaDB = await Lista.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).exec();
  if (!listaDB) return res.status(404).json({ ok: false, err: { message: 'Lista no encontrada' } });
  res.json({ ok: true, lista: listaDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/listas/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const listaBorrada = await Lista.findByIdAndUpdate(req.params.id, { activo: false }, { new: true }).exec();
  if (!listaBorrada) return res.status(404).json({ ok: false, err: { message: 'Lista no encontrada' } });
  res.json({ ok: true, lista: listaBorrada });
}));

// -----------------------------------------------------------------------------
module.exports = router;
