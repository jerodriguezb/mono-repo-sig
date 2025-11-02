// rutas/producserv.js — CRUD de Productos y Servicios (soft-delete)
const express = require('express');
const Producserv = require('../modelos/producserv');
const Rubro = require('../modelos/rubro');
const Marca = require('../modelos/marca');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toNumber = (v, d) => Number(v ?? d);
const escapeRegExp = (value) => value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
const producPopulate = ['rubro', 'marca', 'unidaddemedida'];

/** LISTAR (por defecto, sólo activos) */
router.get('/producservs', asyncHandler(async (req, res) => {

  const {
    desde = 0,
    limite = 10,
    searchField,
    searchValue,
    operator,
    search,
    sortField,
    sortOrder,
  } = req.query;

  // Limita la cantidad de resultados para preservar el rendimiento
  const limit = Math.min(toNumber(limite, 10), 50); // tope por consulta

  const conditions = [];

  // Búsqueda general por descripción o código
  if (search) {
    const regex = new RegExp(search, 'i');
    conditions.push({
      $or: [
        { descripcion: { $regex: regex } },
        { codprod: search },
      ],
    });
  }

  // Filtro específico (desde la grilla MUI)
  if (searchField && searchValue) {
    const op = operator || 'contains';
    let expr;
    if (searchField === 'stkactual') {
      const num = Number(searchValue);
      if (op === '>') expr = { stkactual: { $gt: num } };
      else if (op === '<') expr = { stkactual: { $lt: num } };
      else expr = { stkactual: num };
    } else if (searchField === 'rubroNombre' || searchField === 'marcaNombre') {
      const Model = searchField === 'rubroNombre' ? Rubro : Marca;
      const field = searchField === 'rubroNombre' ? 'rubro' : 'marca';
      let nameQuery;
      if (op === 'equals') nameQuery = { [field]: searchValue };
      else if (op === 'startsWith')
        nameQuery = { [field]: { $regex: `^${searchValue}`, $options: 'i' } };
      else
        nameQuery = { [field]: { $regex: searchValue, $options: 'i' } };
      const docs = await Model.find(nameQuery).select('_id').lean();
      const ids = docs.map(d => d._id);
      expr = { [field]: { $in: ids } };
    } else {
      if (op === 'equals') expr = { [searchField]: searchValue };
      else if (op === 'startsWith')
        expr = { [searchField]: { $regex: `^${searchValue}`, $options: 'i' } };
      else
        expr = { [searchField]: { $regex: searchValue, $options: 'i' } };
    }
    conditions.push(expr);
  }

  const q = conditions.length ? { $and: conditions } : {};

  // Validación y opciones de ordenamiento
  const allowedSortFields = [
    'descripcion',
    'codprod',
    'stkactual',
    'rubroNombre',
    'marcaNombre',
    'unidaddemedidaNombre',
    'unidadNombre',
    'tipo',
    'iva',
    'activo',
  ];
  const sortOpt = {};
  const appendSort = (field, direction) => {
    if (!(field in sortOpt)) {
      sortOpt[field] = direction;
    }
  };

  if (allowedSortFields.includes(sortField)) {
    appendSort(sortField, sortOrder === 'desc' ? -1 : 1);
  }

  [
    ['tieneStockPositivo', -1],
    ['stkactual', -1],
    ['descripcion', 1],
  ].forEach(([field, direction]) => appendSort(field, direction));

  const pipeline = [
    { $match: q },
    { $lookup: { from: 'rubros', localField: 'rubro', foreignField: '_id', as: 'rubro' } },
    { $unwind: { path: '$rubro', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'marcas', localField: 'marca', foreignField: '_id', as: 'marca' } },
    { $unwind: { path: '$marca', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'unidaddemedidas',
        localField: 'unidaddemedida',
        foreignField: '_id',
        as: 'unidaddemedida',
      },
    },
    { $unwind: { path: '$unidaddemedida', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        rubroNombre: '$rubro.rubro',
        marcaNombre: '$marca.marca',
        unidaddemedidaNombre: '$unidaddemedida.unidaddemedida',
        unidadNombre: '$unidaddemedida.unidaddemedida',
        tieneStockPositivo: { $cond: [{ $gt: ['$stkactual', 0] }, 1, 0] },
      },
    },
    { $sort: sortOpt },
    { $unset: 'tieneStockPositivo' },
    { $skip: toNumber(desde, 0) },
    { $limit: limit },
  ];

  const producservs = await Producserv.aggregate(pipeline).exec();

  const cantidad = await Producserv.countDocuments(q);
  res.json({ ok: true, producservs, cantidad });
}));

/** BÚSQUEDA RÁPIDA PARA LOOKUP */
router.get('/producservs/lookup', asyncHandler(async (req, res) => {
  const rawTerm = typeof req.query.q === 'string' ? req.query.q : '';
  const term = rawTerm.trim();

  if (!term) {
    return res.status(400).json({ ok: false, err: { message: 'El parámetro q es obligatorio.' } });
  }

  if (term.length < 3) {
    return res.status(400).json({ ok: false, err: { message: 'Ingresá al menos 3 caracteres para buscar.' } });
  }

  const limitCandidate = toNumber(req.query.limit, 20);
  const safeLimit = Number.isFinite(limitCandidate) ? limitCandidate : 20;
  const limit = Math.min(Math.max(safeLimit, 1), 20);

  const escaped = escapeRegExp(term);
  const prefixRegex = new RegExp(`^${escaped}`, 'i');
  const containsRegex = new RegExp(escaped, 'i');

  const projection = { codprod: 1, descripcion: 1, stkactual: 1 };
  const seen = new Set();
  const results = [];

  const runQuery = async (field, regex, sortField) => {
    if (results.length >= limit) return;
    const docs = await Producserv.find({ activo: true, [field]: { $regex: regex } })
      .sort({ [sortField]: 1 })
      .limit(limit - results.length)
      .select(projection)
      .lean()
      .exec();

    docs.forEach((doc) => {
      const id = doc?._id?.toString();
      if (!id || seen.has(id)) return;
      seen.add(id);
      results.push(doc);
    });
  };

  await runQuery('codprod', prefixRegex, 'codprod');
  await runQuery('descripcion', prefixRegex, 'descripcion');

  if (results.length < limit) {
    await runQuery('codprod', containsRegex, 'codprod');
  }

  if (results.length < limit) {
    await runQuery('descripcion', containsRegex, 'descripcion');
  }

  res.json({ ok: true, producservs: results.slice(0, limit) });
}));

/** OBTENER POR ID */
router.get('/producservs/:id', asyncHandler(async (req, res) => {
  const prod = await Producserv.findById(req.params.id)
    .populate(producPopulate)
    .lean()
    .exec();

  if (!prod) return res.status(404).json({ ok: false, err: { message: 'Producto/Servicio no encontrado' } });
  res.json({ ok: true, producserv: prod });
}));

/** CREAR */
router.post('/producservs', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const b = req.body;
  const producserv = new Producserv({
    codprod: b.codprod,
    descripcion: b.descripcion,
    rubro: b.rubro ?? null,
    marca: b.marca ?? null,
    unidaddemedida: b.unidaddemedida ?? null,
    tipo: b.tipo ?? 'PRODUCTO',
    iva: b.iva ?? 21,
    stkactual: b.stkactual ?? 0,
    activo: b.activo ?? true,
  });
  const prodDB = await producserv.save();
  res.json({ ok: true, producserv: prodDB });
}));

/** ACTUALIZAR (permite reactivar con {activo:true}) */
router.put('/producservs/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const prodDB = await Producserv.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate(producPopulate).exec();

  if (!prodDB) return res.status(404).json({ ok: false, err: { message: 'Producto/Servicio no encontrado' } });
  res.json({ ok: true, producserv: prodDB });
}));

/** SOFT-DELETE (igual que clientes): activo -> false */
router.delete('/producservs/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const prodSoftDeleted = await Producserv.findByIdAndUpdate(
    req.params.id,
    { activo: false },
    { new: true }
  ).populate(producPopulate).exec();

  if (!prodSoftDeleted)
    return res.status(404).json({ ok: false, err: { message: 'Producto/Servicio no encontrado' } });

  res.json({ ok: true, producserv: prodSoftDeleted });
}));

module.exports = router;


