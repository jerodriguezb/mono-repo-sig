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
const sanitizeOffset = (value) => {
  const parsed = Number.parseInt(value ?? 0, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
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

const parseObjectId = (value) => {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (!ObjectId.isValid(trimmed)) return undefined;
  return new ObjectId(trimmed);
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
};

// -----------------------------------------------------------------------------
// 1. LISTAR MOVIMIENTOS DE STOCK ------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/stocks', asyncHandler(async (req, res) => {
  const {
    limite,
    cursor: cursorRaw,
    desde: desdeRaw,
    producto,
    movimiento,
    usuario,
    nrodecomanda,
    fechaDesde,
    fechaHasta,
  } = req.query;
  const limit = sanitizeLimit(limite);
  const cursor = decodeCursor(cursorRaw);

  if (cursorRaw && !cursor) {
    return res.status(400).json({ ok: false, err: { message: 'Cursor inválido' } });
  }

  const baseQuery = { activo: true };

  const productId = parseObjectId(producto);
  if (productId === undefined) {
    return res.status(400).json({ ok: false, err: { message: 'Producto inválido' } });
  }
  if (productId) baseQuery.codprod = productId;

  const movimientoId = parseObjectId(movimiento);
  if (movimientoId === undefined) {
    return res.status(400).json({ ok: false, err: { message: 'Tipo de movimiento inválido' } });
  }
  if (movimientoId) baseQuery.movimiento = movimientoId;

  const usuarioId = parseObjectId(usuario);
  if (usuarioId === undefined) {
    return res.status(400).json({ ok: false, err: { message: 'Usuario inválido' } });
  }
  if (usuarioId) baseQuery.usuario = usuarioId;

  if (nrodecomanda !== undefined && nrodecomanda !== null && nrodecomanda !== '') {
    const parsedOrder = Number.parseInt(nrodecomanda, 10);
    if (!Number.isFinite(parsedOrder)) {
      return res.status(400).json({ ok: false, err: { message: 'Número de comanda inválido' } });
    }
    baseQuery.nrodecomanda = parsedOrder;
  }

  const fromDate = parseDate(fechaDesde);
  if (fromDate === undefined) {
    return res.status(400).json({ ok: false, err: { message: 'Fecha desde inválida' } });
  }
  const toDate = parseDate(fechaHasta);
  if (toDate === undefined) {
    return res.status(400).json({ ok: false, err: { message: 'Fecha hasta inválida' } });
  }

  if (fromDate || toDate) {
    const fechaQuery = {};
    if (fromDate) {
      fromDate.setHours(0, 0, 0, 0);
      fechaQuery.$gte = fromDate;
    }
    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
      if (fromDate && toDate < fromDate) {
        return res.status(400).json({ ok: false, err: { message: 'El rango de fechas es inválido' } });
      }
      fechaQuery.$lte = toDate;
    }
    baseQuery.fecha = fechaQuery;
  }

  const offset = sanitizeOffset(desdeRaw);
  const sort = { fecha: -1, _id: -1 };

  const applyCommonOptions = (query) => {
    let builder = query.sort(sort).populate(stockPopulate).lean();
    if (process.env.NODE_ENV === 'staging') {
      builder = builder.hint(STOCK_LIST_INDEX);
    }
    return builder;
  };

  const cantidad = await Stock.countDocuments(baseQuery);
  let stocks = [];
  let hasMore = false;
  let nextCursor = null;

  if (cursor) {
    const mongoQuery = { ...baseQuery, ...buildCursorQuery(cursor) };
    const docs = await applyCommonOptions(Stock.find(mongoQuery).limit(limit + 1)).exec();
    hasMore = docs.length > limit;
    stocks = hasMore ? docs.slice(0, limit) : docs;
    if (hasMore && stocks.length) {
      nextCursor = encodeCursor(stocks[stocks.length - 1]);
    }
  } else {
    const docs = await applyCommonOptions(Stock.find(baseQuery).skip(offset).limit(limit)).exec();
    stocks = docs;
    hasMore = offset + stocks.length < cantidad;
  }

  res.json({
    ok: true,
    stocks,
    cantidad,
    hasMore,
    nextCursor,
    limite: limit,
    ...(cursor ? {} : { desde: offset }),
  });
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
