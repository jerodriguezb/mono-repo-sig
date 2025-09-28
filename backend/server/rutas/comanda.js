// rutas/comanda.js — Refactor completo para esquema con array «items»
// ---------------------------------------------------------------------------
// Compatible con Node.js v22.17.1 y Mongoose v8.16.5

const express = require('express');
const mongoose = require('mongoose');
const Comanda = require('../modelos/comanda');
const Cliente = require('../modelos/cliente');
const Ruta = require('../modelos/ruta');
const Usuario = require('../modelos/usuario');
const Camion = require('../modelos/camion');
const Producserv = require('../modelos/producserv');
const Stock = require('../modelos/stock');
const Tipomovimiento = require('../modelos/tipomovimiento');
const Counter = require('../modelos/counter');
const {
  verificaToken,
  verificaAdmin_role,
  verificaCam_role,
  verificaAdminCam_role,
  verificaAdminPrev_role,
} = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const toNumber = (v, def) => Number(v ?? def);

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

/**
 * Conjunto de poblados comunes a la mayoría de endpoints.
 */
const commonPopulate = [
  'codcli',
  { path: 'items.lista' },
  {
    path: 'items.codprod',
    populate: [
      { path: 'marca' },
      { path: 'unidaddemedida' },
    ],
  },
  'codestado',
  'camion',
  { path: 'usuario', select: 'role nombres apellidos' },
  { path: 'camionero', select: 'role nombres apellidos' },
];

const logisticaPopulate = [
  {
    path: 'codcli',
    populate: [
      { path: 'ruta' },
      { path: 'localidad', populate: { path: 'provincia' } },
    ],
  },
  { path: 'items.lista' },
  {
    path: 'items.codprod',
    populate: [
      { path: 'marca' },
      { path: 'unidaddemedida' },
    ],
  },
  { path: 'codestado' },
  { path: 'camion' },
  { path: 'usuario', select: 'nombres apellidos role email' },
  { path: 'camionero', select: 'nombres apellidos role email' },
];

const collatorEs = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

const computePrecioTotal = (items) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const cantidad = Number(item?.cantidad) || 0;
    const monto = Number(item?.monto) || 0;
    return sum + cantidad * monto;
  }, 0);
};

const getUserFullName = (user) => `${user?.nombres ?? ''} ${user?.apellidos ?? ''}`.trim();

const getRutaFromComanda = (comanda) =>
  comanda?.codcli?.ruta?.ruta ?? comanda?.camion?.ruta ?? '';

const localSortComparators = {
  codcli: (a, b) =>
    collatorEs.compare(a?.codcli?.razonsocial ?? '', b?.codcli?.razonsocial ?? ''),
  ruta: (a, b) => collatorEs.compare(getRutaFromComanda(a), getRutaFromComanda(b)),
  camionero: (a, b) =>
    collatorEs.compare(getUserFullName(a?.camionero), getUserFullName(b?.camionero)),
  usuario: (a, b) =>
    collatorEs.compare(getUserFullName(a?.usuario), getUserFullName(b?.usuario)),
  precioTotal: (a, b) => computePrecioTotal(a?.items) - computePrecioTotal(b?.items),
};

const createLocalComparator = (field, direction) => {
  const baseComparator = localSortComparators[field];
  if (!baseComparator) return null;
  return (a, b) => {
    const primary = baseComparator(a, b);
    if (primary !== 0) {
      return direction === 1 ? primary : -primary;
    }
    const fechaA = a?.fecha ? new Date(a.fecha).getTime() : 0;
    const fechaB = b?.fecha ? new Date(b.fecha).getTime() : 0;
    if (fechaA !== fechaB) return fechaB - fechaA;
    const nroA = a?.nrodecomanda ?? 0;
    const nroB = b?.nrodecomanda ?? 0;
    return nroB - nroA;
  };
};

// -----------------------------------------------------------------------------
// 1. LISTAR TODAS LAS COMANDAS --------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/comandas', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 500 } = req.query;
  const comandas = await Comanda.find()
    // .skip(toNumber(desde, 0))
    // .limit(toNumber(limite, 500))
    .sort('nrodecomanda')
    .populate(commonPopulate)
    .lean()
    .exec();
  const cantidad = await Comanda.countDocuments({ activo: true });
  res.json({ ok: true, comandas, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. COMANDAS ACTIVAS -----------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/comandasactivas', asyncHandler(async (req, res) => {
  const { limite = 700 } = req.query;
  const query = { activo: true };
  const comandas = await Comanda.find(query)
    .limit(toNumber(limite, 700))
    .sort({ nrodecomanda: -1 })
    .populate(commonPopulate)
    .lean()
    .exec();
  const cantidad = await Comanda.countDocuments(query);
  res.json({ ok: true, comandas, cantidad });
}));

// -----------------------------------------------------------------------------
// 2.a. COMANDAS PARA LOGÍSTICA -------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/comandas/logistica', [verificaToken, verificaAdminCam_role], asyncHandler(async (req, res) => {
  const page = Math.max(toNumber(req.query.page, 1), 1);
  const requestedLimit = Math.max(toNumber(req.query.limit, 20), 1);
  const limit = Math.min(requestedLimit, 20); // Siempre máximo 20 por página
  const skip = (page - 1) * limit;

  const {
    fechaDesde,
    fechaHasta,
    cliente,
    producto,
    ruta,
    camionero,
    estado,
    usuario,
    nrocomanda,
    puntoDistribucion,
    sortField,
    sortOrder,
  } = req.query;

  const filters = [{ activo: true }];

  const from = parseDate(fechaDesde);
  const to = parseDate(fechaHasta);
  if (from || to) {
    const rango = {};
    if (from) rango.$gte = from;
    if (to) {
      // Ajusta al final del día para incluir registros completos
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      rango.$lte = end;
    }
    filters.push({ fecha: rango });
  }

  if (nrocomanda) {
    const nro = Number(nrocomanda);
    if (!Number.isNaN(nro)) filters.push({ nrodecomanda: nro });
  }

  if (cliente) {
    if (!isValidObjectId(cliente)) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, comandas: [] });
    }
    filters.push({ codcli: cliente });
  }

  if (producto) {
    if (!isValidObjectId(producto)) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, comandas: [] });
    }
    filters.push({ 'items.codprod': producto });
  }

  if (camionero) {
    if (!isValidObjectId(camionero)) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, comandas: [] });
    }
    filters.push({ camionero });
  }

  if (estado) {
    if (!isValidObjectId(estado)) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, comandas: [] });
    }
    filters.push({ codestado: estado });
  }

  if (usuario) {
    if (!isValidObjectId(usuario)) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, comandas: [] });
    }
    filters.push({ usuario });
  }
  if (puntoDistribucion) {
    filters.push({ puntoDistribucion: { $regex: new RegExp(puntoDistribucion, 'i') } });
  }

  if (ruta) {
    if (!isValidObjectId(ruta)) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, comandas: [] });
    }
    const clientes = await Cliente.find({ ruta }).select('_id').lean().exec();
    const ids = clientes.map((c) => c._id);
    if (!ids.length) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, comandas: [] });
    }
    filters.push({ codcli: { $in: ids } });
  }

  const query = filters.length === 1 ? filters[0] : { $and: filters };

  const allowedSortFields = new Set([
    'nrodecomanda',
    'fecha',
    'codestado',
    'puntoDistribucion',
    'codcli',
    'precioTotal',
    'camionero',
    'usuario',
    'ruta',
  ]);

  const computedSortFields = new Set(['codcli', 'precioTotal', 'camionero', 'usuario', 'ruta']);

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const defaultSort = { fecha: -1, nrodecomanda: -1 };
  const sortIsAllowed = sortField && allowedSortFields.has(sortField);
  const sortCriteria = sortIsAllowed ? { [sortField]: sortDirection } : defaultSort;

  const clienteCollectionName = Cliente.collection.collectionName;
  const rutaCollectionName = Ruta.collection.collectionName;
  const usuarioCollectionName = Usuario.collection.collectionName;
  const camionCollectionName = Camion.collection.collectionName;

  const totalPromise = Comanda.countDocuments(query);

  let comandas;
  let sortWarning;

  if (sortIsAllowed && computedSortFields.has(sortField)) {
    try {
      const pipeline = [{ $match: query }];

      if (sortField === 'precioTotal') {
        pipeline.push({
          $addFields: {
            precioTotal: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: {
                    $multiply: [
                      { $ifNull: ['$$item.cantidad', 0] },
                      { $ifNull: ['$$item.monto', 0] },
                    ],
                  },
                },
              },
            },
          },
        });
      }

      if (sortField === 'codcli' || sortField === 'ruta') {
        pipeline.push(
          {
            $lookup: {
              from: clienteCollectionName,
              localField: 'codcli',
              foreignField: '_id',
              as: 'cliente',
              pipeline: [
                {
                  $lookup: {
                    from: rutaCollectionName,
                    localField: 'ruta',
                    foreignField: '_id',
                    as: 'ruta',
                  },
                },
                { $unwind: { path: '$ruta', preserveNullAndEmptyArrays: true } },
              ],
            },
          },
          { $unwind: { path: '$cliente', preserveNullAndEmptyArrays: true } },
        );

        const addFieldsStage = {};
        if (sortField === 'codcli') {
          addFieldsStage.clienteNombre = { $ifNull: ['$cliente.razonsocial', ''] };
        }
        if (sortField === 'ruta') {
          pipeline.push(
            {
              $lookup: {
                from: camionCollectionName,
                localField: 'camion',
                foreignField: '_id',
                as: 'camionDoc',
              },
            },
            { $unwind: { path: '$camionDoc', preserveNullAndEmptyArrays: true } },
          );
          addFieldsStage.rutaNombre = {
            $ifNull: [
              { $ifNull: ['$cliente.ruta.ruta', '$camionDoc.ruta'] },
              '',
            ],
          };
        }
        if (Object.keys(addFieldsStage).length) {
          pipeline.push({ $addFields: addFieldsStage });
        }
      }

      if (sortField === 'camionero') {
        pipeline.push(
          {
            $lookup: {
              from: usuarioCollectionName,
              localField: 'camionero',
              foreignField: '_id',
              as: 'camioneroDoc',
            },
          },
          { $unwind: { path: '$camioneroDoc', preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              camioneroNombre: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ['$camioneroDoc.nombres', ''] },
                      ' ',
                      { $ifNull: ['$camioneroDoc.apellidos', ''] },
                    ],
                  },
                },
              },
            },
          },
        );
      }

      if (sortField === 'usuario') {
        pipeline.push(
          {
            $lookup: {
              from: usuarioCollectionName,
              localField: 'usuario',
              foreignField: '_id',
              as: 'usuarioDoc',
            },
          },
          { $unwind: { path: '$usuarioDoc', preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              usuarioNombre: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ['$usuarioDoc.nombres', ''] },
                      ' ',
                      { $ifNull: ['$usuarioDoc.apellidos', ''] },
                    ],
                  },
                },
              },
            },
          },
        );
      }

      const sortFieldMapping = {
        codcli: 'clienteNombre',
        precioTotal: 'precioTotal',
        camionero: 'camioneroNombre',
        usuario: 'usuarioNombre',
        ruta: 'rutaNombre',
      };

      const mappedField = sortFieldMapping[sortField];
      if (!mappedField) {
        throw new Error(`Campo de ordenamiento no soportado: ${sortField}`);
      }
      pipeline.push(
        { $sort: { [mappedField]: sortDirection, fecha: -1, nrodecomanda: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { _id: 1 } },
      );

      let aggregateQuery = Comanda.aggregate(pipeline);
      if (['codcli', 'ruta', 'camionero', 'usuario'].includes(sortField)) {
        aggregateQuery = aggregateQuery.collation({ locale: 'es', strength: 1 });
      }

      const aggregationResult = await aggregateQuery.exec();
      const ids = aggregationResult.map((doc) => doc._id);

      if (ids.length) {
        const docs = await Comanda.find({ _id: { $in: ids } })
          .populate(logisticaPopulate)
          .lean()
          .exec();

        const docsMap = new Map(docs.map((doc) => [String(doc._id), doc]));
        comandas = ids.map((id) => docsMap.get(String(id))).filter(Boolean);
      } else {
        comandas = [];
      }
    } catch (error) {
      const allDocs = await Comanda.find(query)
        .populate(logisticaPopulate)
        .lean()
        .exec();

      const localComparator = createLocalComparator(sortField, sortDirection);
      if (localComparator) {
        allDocs.sort(localComparator);
        comandas = allDocs.slice(skip, skip + limit);
        sortWarning = `Orden aplicado localmente para ${sortField}.`;
      } else {
        comandas = allDocs.slice(skip, skip + limit);
        sortWarning = `No se pudo ordenar por ${sortField}; se utilizó el orden predeterminado.`;
      }
    }
  } else {
    comandas = await Comanda.find(query)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit)
      .populate(logisticaPopulate)
      .lean()
      .exec();
  }

  const total = await totalPromise;
  const totalPages = Math.ceil(total / limit) || 0;

  const response = { ok: true, page, limit, total, totalPages, comandas };
  if (sortWarning) response.sortWarning = sortWarning;

  res.json(response);
}));

// -----------------------------------------------------------------------------
// 3. COMANDAS PARA PREVENTISTA --------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/comandasprev', asyncHandler(async (_req, res) => {
  const query = { activo: true };
  const comandas = await Comanda.find(query)
    .sort({ nrodecomanda: -1 })
    .populate(commonPopulate)
    .lean()
    .exec();
  const cantidad = await Comanda.countDocuments(query);
  res.json({ ok: true, comandas, cantidad });
}));

// -----------------------------------------------------------------------------
// 4. COMANDAS "A PREPARAR" -----------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/comandasapreparar', asyncHandler(async (_req, res) => {
  const ESTADO_A_PREPARAR = '62200265c811f41820d8bda9';
  const query = { activo: true, codestado: ESTADO_A_PREPARAR };
  const comandas = await Comanda.find(query)
    .sort('nrodecomanda')
    .populate(commonPopulate)
    .lean()
    .exec();
  const cantidad = await Comanda.countDocuments(query);
  res.json({ ok: true, comandas, cantidad });
}));

// -----------------------------------------------------------------------------
// 5. COMANDAS PREPARADAS --------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/comandaspreparadas', asyncHandler(async (req, res) => {
  const { limite = 1000 } = req.query;
  const ESTADOS = ['622002eac811f41820d8bdab', '6231174f962c72253b6fb6bd'];
  const query = { activo: true, codestado: { $in: ESTADOS } };
  const comandas = await Comanda.find(query)
    .limit(toNumber(limite, 1000))
    .sort('nrodecomanda')
    .populate(commonPopulate)
    .lean()
    .exec();
  const cantidad = await Comanda.countDocuments(query);
  res.json({ ok: true, comandas, cantidad });
}));

// -----------------------------------------------------------------------------
// 6. HISTORIAL DE COMANDAS --------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/comandas/historial', asyncHandler(async (req, res) => {
  const page = Math.max(toNumber(req.query.page, 1), 1);
  const pageSize = Math.max(toNumber(req.query.pageSize, 10), 1);
  const skip = (page - 1) * pageSize;

  const [total, comandas] = await Promise.all([
    Comanda.countDocuments(),
    Comanda.find()
      .sort({ nrodecomanda: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate([
        'codcli',
        'codestado',
        { path: 'items.lista' },
        {
          path: 'items.codprod',
          populate: [
            { path: 'marca' },
            { path: 'unidaddemedida' },
          ],
        },
      ])
      .lean()
      .exec(),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const data = comandas.map(c => {
    const total = Array.isArray(c.items)
      ? c.items.reduce((sum, item) => {
          const cantidad = Number(item.cantidad) || 0;
          const monto = Number(item.monto) || 0;
          return sum + cantidad * monto;
        }, 0)
      : 0;
    return { ...c, total };
  });

  res.json({ ok: true, page, pageSize, total, totalPages, data });
}));

// -----------------------------------------------------------------------------
// 7. COMANDA POR ID -------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/comandas/:id', asyncHandler(async (req, res) => {
  const comanda = await Comanda.findById(req.params.id).populate(commonPopulate).lean().exec();
  if (!comanda) return res.status(404).json({ ok: false, err: { message: 'Comanda no encontrada' } });
  res.json({ ok: true, comanda });
}));

// -----------------------------------------------------------------------------
// 8. FILTRAR POR RANGO DE FECHAS ------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/comandasnro', asyncHandler(async (req, res) => {
  const { fechaDesde, fechaHasta } = req.query;
  const query = { activo: true, fecha: { $gte: fechaDesde, $lte: fechaHasta } };
  const comandas = await Comanda.find(query)
    .sort({ nrodecomanda: -1 })
    .populate(commonPopulate)
    .lean()
    .exec();
  res.json({ ok: true, comandas });
}));

// -----------------------------------------------------------------------------
// 9. COMANDAS PARA INFORMES -----------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/comandasinformes', asyncHandler(async (req, res) => {
  const { fechaDesde, fechaHasta, limite = 1000 } = req.query;
  const comandas = await Comanda.find({ activo: true, fecha: { $gte: fechaDesde, $lte: fechaHasta } })
    .limit(toNumber(limite, 1000))
    .sort({ nrodecomanda: -1 })
    .populate(commonPopulate)
    .lean()
    .exec();
  res.json({ ok: true, comandas });
}));

// -----------------------------------------------------------------------------
// 10. CREAR COMANDA --------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/comandas',  asyncHandler(async (req, res) => {
  const body = req.body;
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ ok: false, err: { message: 'La comanda debe incluir al menos un ítem' } });
  }
  const faltantes = [];
  for (const item of body.items) {
    const prod = await Producserv.findById(item.codprod).select('descripcion stkactual').lean().exec();
    if (!prod || prod.stkactual - item.cantidad < 0) {
      faltantes.push({
        codprod: item.codprod,
        descripcion: prod ? prod.descripcion : 'Producto no encontrado',
        stkactual: prod ? prod.stkactual : 0,
        solicitado: item.cantidad,
      });
    }
  }
  if (faltantes.length) {
    return res.status(400).json({
      ok: false,
      err: { message: 'Stock insuficiente para algunos productos', productos: faltantes },
    });
  }
  const tipomovVenta = await Tipomovimiento.findOne({ codmov: 2 }).exec();
  if (!tipomovVenta) {
    return res.status(500).json({ ok: false, err: { message: 'Tipo de movimiento VENTA no encontrado' } });
  }

  const session = await Comanda.startSession();
  let comandaDB;
  try {
    await session.withTransaction(async () => {

      const counter = await Counter.findOneAndUpdate(
        {},
        { $inc: { nrodecomanda: 1 } },
        { new: true, upsert: true, session }
      );
      const comanda = new Comanda({
        nrodecomanda: counter.nrodecomanda,

        codcli: body.codcli,
        fecha: body.fecha,
        codestado: body.codestado,
        camion: body.camion,
        fechadeentrega: body.fechadeentrega,
        usuario: body.usuario,
        camionero: body.camionero,
        puntoDistribucion: body.puntoDistribucion,
        activo: body.activo,
        items: body.items,
      });
      comandaDB = await comanda.save({ session });
      for (const item of body.items) {
        await Producserv.updateOne(
          { _id: item.codprod },
          { $inc: { stkactual: -item.cantidad } },
          { session }
        );
      }
      for (const item of body.items) {
        const movStock = new Stock({
          nrodecomanda: comandaDB.nrodecomanda,
          codprod: item.codprod,
          movimiento: tipomovVenta._id,
          cantidad: item.cantidad,
          fecha: body.fecha,
          usuario: body.usuario,
        });
        await movStock.save({ session });
      }
    });
    return res.json({ ok: true, comanda: comandaDB });
  } finally {
    session.endSession();
  }
}));

// -----------------------------------------------------------------------------
// 11. ACTUALIZAR COMANDA --------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/comandas/:id', [verificaToken, verificaAdminCam_role], asyncHandler(async (req, res) => {
  const comandaDB = await Comanda.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
    context: 'query',
  }).populate(commonPopulate).exec();
  if (!comandaDB) return res.status(404).json({ ok: false, err: { message: 'Comanda no encontrada' } });
  res.json({ ok: true, comanda: comandaDB });
}));

// -----------------------------------------------------------------------------
// 12. DESACTIVAR (SOFT‑DELETE) COMANDA -----------------------------------------
// -----------------------------------------------------------------------------
router.delete('/comandas/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const comandaBorrada = await Comanda.findByIdAndUpdate(req.params.id, { activo: false }, { new: true })
    .populate(commonPopulate)
    .exec();
  if (!comandaBorrada) return res.status(404).json({ ok: false, err: { message: 'Comanda no encontrada' } });
  res.json({ ok: true, comanda: comandaBorrada });
}));

// -----------------------------------------------------------------------------
// EXPORTACIÓN ------------------------------------------------------------------
// -----------------------------------------------------------------------------
module.exports = router;

