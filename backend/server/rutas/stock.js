// rutas/stock.js — CRUD de movimientos de Stock
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Stock = require('../modelos/stock');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
const toNumber = (v, d) => Number(v ?? d);

const stockPopulate = [
  'codprod',
  'movimiento',
  { path: 'usuario', select: 'nombres apellidos role' },
];

// -----------------------------------------------------------------------------
// 1. LISTAR MOVIMIENTOS DE STOCK ------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/stocks', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 500 } = req.query;
  const query = { activo: true };

  const stocks = await Stock.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 500))
    .sort('-fecha')
    .populate(stockPopulate)
    .lean()
    .exec();

  const cantidad = await Stock.countDocuments(query);
  res.json({ ok: true, stocks, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. OBTENER MOVIMIENTO POR ID --------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/stocks/:id', asyncHandler(async (req, res) => {
  const stock = await Stock.findById(req.params.id).populate(stockPopulate).lean().exec();
  if (!stock) return res.status(404).json({ ok: false, err: { message: 'Movimiento de stock no encontrado' } });
  res.json({ ok: true, stock });
}));

// -----------------------------------------------------------------------------
// 3. CREAR MOVIMIENTO DE STOCK --------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/stocks', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const stock = new Stock({
    codprod: body.codprod,
    nrodecomanda: body.nrodecomanda,
    movimiento: body.movimiento,
    cantidad: body.cantidad,
    fecha: body.fecha,
    activo: body.activo,
    usuario: body.usuario,
  });
  const stockDB = await stock.save();
  res.json({ ok: true, stock: stockDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR MOVIMIENTO ------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/stocks/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const stockDB = await Stock.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate(stockPopulate)
    .exec();
  if (!stockDB) return res.status(404).json({ ok: false, err: { message: 'Movimiento de stock no encontrado' } });
  res.json({ ok: true, stock: stockDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/stocks/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const stockBorrado = await Stock.findByIdAndUpdate(req.params.id, { activo: false }, { new: true })
    .populate(stockPopulate)
    .exec();
  if (!stockBorrado) return res.status(404).json({ ok: false, err: { message: 'Movimiento de stock no encontrado' } });
  res.json({ ok: true, stock: stockBorrado });
}));

// -----------------------------------------------------------------------------
module.exports = router;
