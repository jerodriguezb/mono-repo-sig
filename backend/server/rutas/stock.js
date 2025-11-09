// rutas/stock.js — CRUD de movimientos de Stock
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const {
  Types: { ObjectId },
} = require('mongoose');
const Stock = require('../modelos/stock');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
const sanitizeLimit = (value, fallback = 500, max = 1000) => {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};
const STOCK_LIST_INDEX = { activo: 1, fecha: -1, codprod: 1 };

const encodeCursor = (doc) => {
  if (!doc || !doc.fecha || !doc._id) return null;
  const fecha = doc.fecha instanceof Date ? doc.fecha : new Date(doc.fecha);
  if (Number.isNaN(fecha.getTime())) return null;
  const payload = `${fecha.toISOString()}|${doc._id.toString()}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
};

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [fechaStr, id] = decoded.split('|');
    if (!fechaStr || !id) return null;
    const fecha = new Date(fechaStr);
    if (Number.isNaN(fecha.getTime())) return null;
    const trimmedId = id.trim();
    if (!ObjectId.isValid(trimmedId)) return null;
    return { fecha, id: new ObjectId(trimmedId) };
  } catch (error) {
    return null;
  }
};

const buildCursorQuery = (cursor) => {
  if (!cursor) return {};
  return {
    $or: [
      { fecha: { $lt: cursor.fecha } },
      { fecha: cursor.fecha, _id: { $lt: cursor.id } },
    ],
  };
};

const stockPopulate = [
  'codprod',
  'movimiento',
  { path: 'usuario', select: 'nombres apellidos role' },
];

// -----------------------------------------------------------------------------
// 1. LISTAR MOVIMIENTOS DE STOCK ------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/stocks', asyncHandler(async (req, res) => {
  const { limite, cursor: cursorRaw } = req.query;
  const limit = sanitizeLimit(limite);
  const cursor = decodeCursor(cursorRaw);

  if (cursorRaw && !cursor) {
    return res.status(400).json({ ok: false, err: { message: 'Cursor inválido' } });
  }

  const baseQuery = { activo: true };
  const mongoQuery = cursor ? { ...baseQuery, ...buildCursorQuery(cursor) } : baseQuery;
  const sort = { fecha: -1, _id: -1 };

  let queryBuilder = Stock.find(mongoQuery)
    .sort(sort)
    .limit(limit + 1)
    .populate(stockPopulate)
    .lean();

  if (process.env.NODE_ENV === 'staging') {
    queryBuilder = queryBuilder.hint(STOCK_LIST_INDEX);
  }

  const docs = await queryBuilder.exec();
  const hasMore = docs.length > limit;
  const stocks = hasMore ? docs.slice(0, limit) : docs;
  let nextCursor = null;

  if (hasMore && stocks.length) {
    const lastDoc = stocks[stocks.length - 1];
    nextCursor = encodeCursor(lastDoc);
  }

  const cantidad = await Stock.countDocuments(baseQuery);

  res.json({ ok: true, stocks, cantidad, hasMore, nextCursor, limite: limit });
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
