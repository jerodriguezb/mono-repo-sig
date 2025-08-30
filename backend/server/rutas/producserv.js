// rutas/producserv.js — CRUD de Productos y Servicios (soft-delete)
const express = require('express');
const Producserv = require('../modelos/producserv');
const Rubro = require('../modelos/rubro');
const Marca = require('../modelos/marca');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toNumber = (v, d) => Number(v ?? d);
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
  const sf = allowedSortFields.includes(sortField) ? sortField : 'descripcion';
  const sortOpt = { [sf]: sortOrder === 'desc' ? -1 : 1 };

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
      },
    },
    { $sort: sortOpt },
    { $skip: toNumber(desde, 0) },
    { $limit: limit },
  ];

  const producservs = await Producserv.aggregate(pipeline).exec();

  const cantidad = await Producserv.countDocuments(q);
  res.json({ ok: true, producservs, cantidad });
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


