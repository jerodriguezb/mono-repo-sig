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
const parseObjectId = (value) => {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && ObjectId.isValid(value.trim())) {
    return new ObjectId(value.trim());
  }
  return null;
};

const parseDateAtStartOfDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const parseDateAtEndOfDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const buildFilterQuery = ({
  producto,
  movimiento,
  usuario,
  nrodecomanda,
  fechaDesde,
  fechaHasta,
}) => {
  const query = {};

  const productoId = parseObjectId(producto);
  if (productoId) query.codprod = productoId;

  const movimientoId = parseObjectId(movimiento);
  if (movimientoId) query.movimiento = movimientoId;

  const usuarioId = parseObjectId(usuario);
  if (usuarioId) query.usuario = usuarioId;

  if (nrodecomanda !== undefined && nrodecomanda !== null && nrodecomanda !== '') {
    const parsed = Number.parseInt(nrodecomanda, 10);
    if (Number.isFinite(parsed)) query.nrodecomanda = parsed;
  }

  const fechaInicio = parseDateAtStartOfDay(fechaDesde);
  const fechaFin = parseDateAtEndOfDay(fechaHasta);
  if (fechaInicio || fechaFin) {
    query.fecha = {};
    if (fechaInicio) query.fecha.$gte = fechaInicio;
    if (fechaFin) query.fecha.$lte = fechaFin;
  }

  return query;
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
  const {
    limite,
    cursor: cursorRaw,
    desde,
    producto,
    movimiento,
    usuario,
    nrodecomanda,
    fechaDesde,
    fechaHasta,
  } = req.query;

  const limit = sanitizeLimit(limite, 50, 500);
  const offsetCandidate = Number.parseInt(desde ?? 0, 10);
  const skip = Number.isFinite(offsetCandidate) && offsetCandidate > 0 ? offsetCandidate : 0;
  const cursor = decodeCursor(cursorRaw);

  if (cursorRaw && !cursor) {
    return res.status(400).json({ ok: false, err: { message: 'Cursor inválido' } });
  }

  const filters = buildFilterQuery({
    producto,
    movimiento,
    usuario,
    nrodecomanda,
    fechaDesde,
    fechaHasta,
  });

  const baseQuery = { activo: true, ...filters };
  const sort = { fecha: -1, _id: -1 };

  const countPromise = Stock.countDocuments(baseQuery);
  let docs = [];
  let hasMore = false;
  let nextCursor = null;
  let totalCount = null;

  if (cursor) {
    const cursorQuery = { ...baseQuery, ...buildCursorQuery(cursor) };
    let queryBuilder = Stock.find(cursorQuery)
      .sort(sort)
      .limit(limit + 1)
      .populate(stockPopulate)
      .lean();

    if (process.env.NODE_ENV === 'staging') {
      queryBuilder = queryBuilder.hint(STOCK_LIST_INDEX);
    }

    const results = await queryBuilder.exec();
    hasMore = results.length > limit;
    docs = hasMore ? results.slice(0, limit) : results;
  } else {
    let queryBuilder = Stock.find(baseQuery)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate(stockPopulate)
      .lean();

    if (process.env.NODE_ENV === 'staging') {
      queryBuilder = queryBuilder.hint(STOCK_LIST_INDEX);
    }

    docs = await queryBuilder.exec();
    totalCount = await countPromise;
    hasMore = skip + docs.length < totalCount;
  }

  if (docs.length && hasMore) {
    nextCursor = encodeCursor(docs[docs.length - 1]);
  }

  const cantidad = totalCount ?? (await countPromise);

  res.json({ ok: true, stocks: docs, cantidad, hasMore, nextCursor, limite: limit, desde: skip });
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
