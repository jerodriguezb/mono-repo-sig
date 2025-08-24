// rutas/precio.js — CRUD de Precios de productos por lista
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Precio = require('../modelos/precio');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
const toNumber = (v, d) => Number(v ?? d);

// Populate básico para referencias
const precioPopulate = ['codproducto', 'lista'];

// -----------------------------------------------------------------------------
// 1. LISTAR PRECIOS -------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/precios', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 500 } = req.query;
  const query = { activo: true };

  const precios = await Precio.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 500))
    .sort('fecha')
    .populate(precioPopulate)
    .lean()
    .exec();

  const cantidad = await Precio.countDocuments(query);
  res.json({ ok: true, precios, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. PRECIO POR ID -------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/precios/:id', asyncHandler(async (req, res) => {
  const precio = await Precio.findById(req.params.id).populate(precioPopulate).lean().exec();
  if (!precio) return res.status(404).json({ ok: false, err: { message: 'Precio no encontrado' } });
  res.json({ ok: true, precio });
}));

// -----------------------------------------------------------------------------
// 3. CREAR PRECIO --------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/precios', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const precio = new Precio({
    codproducto: body.codproducto,
    lista: body.lista,
    precionetocompra: body.precionetocompra,
    ivacompra: body.ivacompra,
    preciototalcompra: body.preciototalcompra,
    precionetoventa: body.precionetoventa,
    ivaventa: body.ivaventa,
    preciototalventa: body.preciototalventa,
    activo: body.activo,
  });
  const precioDB = await precio.save();
  res.json({ ok: true, precio: precioDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR PRECIO ----------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/precios/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const precioDB = await Precio.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate(precioPopulate)
    .exec();
  if (!precioDB) return res.status(404).json({ ok: false, err: { message: 'Precio no encontrado' } });
  res.json({ ok: true, precio: precioDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/precios/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const precioBorrado = await Precio.findByIdAndUpdate(req.params.id, { activo: false }, { new: true })
    .populate(precioPopulate)
    .exec();
  if (!precioBorrado) return res.status(404).json({ ok: false, err: { message: 'Precio no encontrado' } });
  res.json({ ok: true, precio: precioBorrado });
}));

// -----------------------------------------------------------------------------
module.exports = router;

