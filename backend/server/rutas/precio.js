// rutas/precio.js — CRUD de Precios de productos por lista
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const mongoose = require('mongoose');
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
const escapeRegExp = (value = '') => String(value).replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
};

const parseNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');

  let normalized = trimmed.replace(/\s+/g, '');
  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return null;
};

const buildStringCondition = (path, operator, rawValue) => {
  if (operator === 'isEmpty') {
    return {
      $or: [
        { [path]: { $exists: false } },
        { [path]: null },
        { [path]: '' },
      ],
    };
  }

  if (operator === 'isNotEmpty') {
    return {
      [path]: { $nin: [null, ''] },
    };
  }

  if (Array.isArray(rawValue)) {
    const sanitized = rawValue
      .map((entry) => String(entry ?? '').trim())
      .filter((entry) => entry);
    if (!sanitized.length) return null;
    return {
      $or: sanitized.map((entry) => ({
        [path]: { $regex: `^${escapeRegExp(entry)}$`, $options: 'i' },
      })),
    };
  }

  const value = String(rawValue ?? '').trim();
  if (!value) return null;
  const escaped = escapeRegExp(value);

  if (operator === 'equals' || operator === '=' || operator === 'is') {
    return {
      [path]: { $regex: `^${escaped}$`, $options: 'i' },
    };
  }

  if (operator === 'startsWith') {
    return {
      [path]: { $regex: `^${escaped}`, $options: 'i' },
    };
  }

  if (operator === 'endsWith') {
    return {
      [path]: { $regex: `${escaped}$`, $options: 'i' },
    };
  }

  // default contains
  return {
    [path]: { $regex: escaped, $options: 'i' },
  };
};

const buildNumberCondition = (path, operator, rawValue) => {
  if (operator === 'isEmpty') {
    return {
      $or: [
        { [path]: { $exists: false } },
        { [path]: null },
      ],
    };
  }

  if (operator === 'isNotEmpty') {
    return {
      [path]: { $ne: null },
    };
  }

  const value = parseNumber(rawValue);
  if (value === null) return null;

  switch (operator) {
    case 'notEqual':
    case '!=':
      return { [path]: { $ne: value } };
    case '>':
    case 'greaterThan':
      return { [path]: { $gt: value } };
    case '>=':
    case 'greaterThanOrEqual':
      return { [path]: { $gte: value } };
    case '<':
    case 'lessThan':
      return { [path]: { $lt: value } };
    case '<=':
    case 'lessThanOrEqual':
      return { [path]: { $lte: value } };
    case 'equals':
    case '=':
    default:
      return { [path]: value };
  }
};

// Populate básico para referencias
const precioPopulate = ['codproducto', 'lista'];

// -----------------------------------------------------------------------------
// 1. LISTAR PRECIOS -------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/precios', asyncHandler(async (req, res) => {
  const {
    desde = 0,
    limite = 500,
    sortField,
    sortOrder,
    codproducto,
    lista,
    search,
    filters: rawFilters,
  } = req.query;

  const rawSkip = toNumber(desde, 0);
  const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? rawSkip : 0;
  const rawLimit = toNumber(limite, 500);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 500;

  let parsedFilters = [];
  if (rawFilters) {
    try {
      const candidate = JSON.parse(rawFilters);
      if (Array.isArray(candidate)) parsedFilters = candidate;
    } catch (error) {
      // Ignorar filtros inválidos, pero dejar registro para debugging
      console.warn('Filtros de precios inválidos', error);
    }
  }

  const hasActivoFilter = parsedFilters.some((filter) => filter?.field === 'activo');

  const baseConditions = [];
  if (!hasActivoFilter) baseConditions.push({ activo: true });

  if (codproducto) {
    const codproductoId = toObjectId(codproducto);
    if (!codproductoId) {
      return res.json({ ok: true, precios: [], cantidad: 0 });
    }
    baseConditions.push({ codproducto: codproductoId });
  }

  if (lista) {
    const listaId = toObjectId(lista);
    if (!listaId) {
      return res.json({ ok: true, precios: [], cantidad: 0 });
    }
    baseConditions.push({ lista: listaId });
  }

  const numericFields = new Map([
    ['precionetocompra', 'precionetocompra'],
    ['ivacompra', 'ivacompra'],
    ['preciototalcompra', 'preciototalcompra'],
    ['precionetoventa', 'precionetoventa'],
    ['ivaventa', 'ivaventa'],
    ['preciototalventa', 'preciototalventa'],
  ]);

  const aggregatedConditions = [];

  parsedFilters.forEach((filter) => {
    if (!filter || typeof filter !== 'object') return;
    const { field, operator, value } = filter;
    if (value === undefined || value === null || value === '') {
      if (operator !== 'isEmpty' && operator !== 'isNotEmpty') return;
    }

    if (numericFields.has(field)) {
      const condition = buildNumberCondition(numericFields.get(field), operator, value);
      if (condition) baseConditions.push(condition);
      return;
    }

    if (field === 'activo') {
      if (operator === 'isEmpty') {
        aggregatedConditions.push({ $or: [
          { activo: { $exists: false } },
          { activo: null },
        ] });
        return;
      }

      if (operator === 'isNotEmpty') {
        baseConditions.push({ activo: { $ne: null } });
        return;
      }

      const boolValue = parseBoolean(value);
      if (boolValue === null) return;
      baseConditions.push({ activo: boolValue });
      return;
    }

    if (field === 'productoDescripcion') {
      const condition = buildStringCondition('codproducto.descripcion', operator, value);
      if (condition) aggregatedConditions.push(condition);
      return;
    }

    if (field === 'listaNombre') {
      const condition = buildStringCondition('lista.lista', operator, value);
      if (condition) aggregatedConditions.push(condition);
      return;
    }
  });

  const searchTerm = typeof search === 'string' ? search.trim() : '';
  if (searchTerm) {
    const escaped = escapeRegExp(searchTerm);
    aggregatedConditions.push({
      $or: [
        { 'codproducto.descripcion': { $regex: escaped, $options: 'i' } },
        { 'lista.lista': { $regex: escaped, $options: 'i' } },
      ],
    });
  }

  const initialMatch = baseConditions.length ? { $and: baseConditions } : {};

  const sortFieldMap = {
    productoDescripcion: 'codproducto.descripcion',
    listaNombre: 'lista.lista',
    precionetocompra: 'precionetocompra',
    ivacompra: 'ivacompra',
    preciototalcompra: 'preciototalcompra',
    precionetoventa: 'precionetoventa',
    ivaventa: 'ivaventa',
    preciototalventa: 'preciototalventa',
    activo: 'activo',
    fecha: 'fecha',
  };

  const sortKey = typeof sortField === 'string' ? sortFieldMap[sortField] : undefined;
  const sortPath = sortKey || 'fecha';
  const sortDir = sortOrder === 'desc' ? -1 : 1;

  const pipeline = [];
  if (Object.keys(initialMatch).length) {
    pipeline.push({ $match: initialMatch });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'producservs',
        localField: 'codproducto',
        foreignField: '_id',
        as: 'codproducto',
      },
    },
    { $unwind: { path: '$codproducto', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'listas',
        localField: 'lista',
        foreignField: '_id',
        as: 'lista',
      },
    },
    { $unwind: { path: '$lista', preserveNullAndEmptyArrays: true } },
  );

  if (aggregatedConditions.length) {
    pipeline.push({ $match: { $and: aggregatedConditions } });
  }

  pipeline.push(
    { $sort: { [sortPath]: sortDir, _id: 1 } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
        ],
        total: [
          { $count: 'count' },
        ],
      },
    },
    { $unwind: { path: '$total', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        precios: '$data',
        cantidad: { $ifNull: ['$total.count', 0] },
      },
    },
  );

  const [result = { precios: [], cantidad: 0 }] = await Precio.aggregate(pipeline)
    .collation({ locale: 'es', strength: 2 })
    .exec();

  const { precios = [], cantidad = 0 } = result;
  res.json({ ok: true, precios, cantidad });
}));

// -----------------------------------------------------------------------------
// 1.a VALIDAR DUPLICADOS -------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/precios/existe', asyncHandler(async (req, res) => {
  const { codproducto, lista, excluir } = req.query;

  if (!codproducto || !lista) {
    return res.status(400).json({
      ok: false,
      err: { message: 'Los parámetros codproducto y lista son obligatorios' },
    });
  }

  const conditions = { codproducto, lista };
  if (excluir) {
    conditions._id = { $ne: excluir };
  }

  const exists = await Precio.exists(conditions).exec();
  res.json({ ok: true, existe: Boolean(exists) });
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

  if (!body.codproducto || !body.lista) {
    return res.status(400).json({
      ok: false,
      err: { message: 'codproducto y lista son obligatorios' },
    });
  }

  const duplicate = await Precio.exists({ codproducto: body.codproducto, lista: body.lista }).exec();
  if (duplicate) {
    return res.status(409).json({
      ok: false,
      err: { message: 'Ya existe un precio para el producto y la lista seleccionados' },
    });
  }

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
  const { id } = req.params;
  const existing = await Precio.findById(id).lean().exec();

  if (!existing) {
    return res.status(404).json({ ok: false, err: { message: 'Precio no encontrado' } });
  }

  const targetCodproducto = req.body.codproducto ?? existing.codproducto;
  const targetLista = req.body.lista ?? existing.lista;

  const duplicate = await Precio.exists({
    _id: { $ne: id },
    codproducto: targetCodproducto,
    lista: targetLista,
  }).exec();

  if (duplicate) {
    return res.status(409).json({
      ok: false,
      err: { message: 'Ya existe un precio para el producto y la lista seleccionados' },
    });
  }

  const updatePayload = {
    ...req.body,
    codproducto: targetCodproducto,
    lista: targetLista,
  };

  const precioDB = await Precio.findByIdAndUpdate(id, updatePayload, { new: true, runValidators: true })
    .populate(precioPopulate)
    .exec();
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

