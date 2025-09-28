// rutas/comanda.js — Refactor completo para esquema con array «items»
// ---------------------------------------------------------------------------
// Compatible con Node.js v22.17.1 y Mongoose v8.16.5

const express = require('express');
const mongoose = require('mongoose');
const Comanda = require('../modelos/comanda');
const Cliente = require('../modelos/cliente');
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
    'cliente',
    'precioTotal',
    'ruta',
    'camionero',
    'usuario',
  ]);

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const isValidSortField = sortField && allowedSortFields.has(sortField);

  const buildItemsTotalExpression = () => ({
    $sum: {
      $map: {
        input: { $ifNull: ['$items', []] },
        as: 'item',
        in: {
          $multiply: [
            {
              $convert: {
                input: '$$item.cantidad',
                to: 'double',
                onNull: 0,
                onError: 0,
              },
            },
            {
              $convert: {
                input: '$$item.monto',
                to: 'double',
                onNull: 0,
                onError: 0,
              },
            },
          ],
        },
      },
    },
  });

  const buildSortPipeline = (field) => {
    switch (field) {
      case 'nrodecomanda':
        return [{ $sort: { nrodecomanda: sortDirection, fecha: -1, _id: sortDirection } }];
      case 'fecha':
        return [{ $sort: { fecha: sortDirection, nrodecomanda: sortDirection, _id: sortDirection } }];
      case 'codestado':
        return [{ $sort: { codestado: sortDirection, fecha: -1, nrodecomanda: -1, _id: sortDirection } }];
      case 'puntoDistribucion':
        return [{ $sort: { puntoDistribucion: sortDirection, fecha: -1, nrodecomanda: -1, _id: sortDirection } }];
      case 'cliente':
        return [
          {
            $lookup: {
              from: 'clientes',
              localField: 'codcli',
              foreignField: '_id',
              as: '__clienteSort',
            },
          },
          { $unwind: { path: '$__clienteSort', preserveNullAndEmptyArrays: true } },
          {
            $sort: {
              '__clienteSort.razonsocial': sortDirection,
              fecha: -1,
              nrodecomanda: -1,
              _id: sortDirection,
            },
          },
          { $set: { __clienteSort: '$$REMOVE' } },
        ];
      case 'precioTotal':
        return [
          {
            $addFields: {
              __precioTotalSort: {
                $let: {
                  vars: {
                    existing: {
                      $convert: {
                        input: '$precioTotal',
                        to: 'double',
                        onNull: null,
                        onError: null,
                      },
                    },
                  },
                  in: {
                    $ifNull: ['$$existing', buildItemsTotalExpression()],
                  },
                },
              },
            },
          },
          {
            $sort: {
              __precioTotalSort: sortDirection,
              fecha: -1,
              nrodecomanda: -1,
              _id: sortDirection,
            },
          },
          { $set: { __precioTotalSort: '$$REMOVE' } },
        ];
      case 'ruta':
        return [
          {
            $lookup: {
              from: 'clientes',
              localField: 'codcli',
              foreignField: '_id',
              as: '__clienteSort',
            },
          },
          { $unwind: { path: '$__clienteSort', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'rutas',
              localField: '__clienteSort.ruta',
              foreignField: '_id',
              as: '__rutaSort',
            },
          },
          { $unwind: { path: '$__rutaSort', preserveNullAndEmptyArrays: true } },
          {
            $sort: {
              '__rutaSort.ruta': sortDirection,
              fecha: -1,
              nrodecomanda: -1,
              _id: sortDirection,
            },
          },
          { $set: { __clienteSort: '$$REMOVE', __rutaSort: '$$REMOVE' } },
        ];
      case 'camionero':
        return [
          {
            $lookup: {
              from: 'usuarios',
              localField: 'camionero',
              foreignField: '_id',
              as: '__camioneroSort',
            },
          },
          { $unwind: { path: '$__camioneroSort', preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              __camioneroNombre: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ['$__camioneroSort.apellidos', ''] },
                      ' ',
                      { $ifNull: ['$__camioneroSort.nombres', ''] },
                    ],
                  },
                },
              },
            },
          },
          {
            $sort: {
              __camioneroNombre: sortDirection,
              fecha: -1,
              nrodecomanda: -1,
              _id: sortDirection,
            },
          },
          { $set: { __camioneroSort: '$$REMOVE', __camioneroNombre: '$$REMOVE' } },
        ];
      case 'usuario':
        return [
          {
            $lookup: {
              from: 'usuarios',
              localField: 'usuario',
              foreignField: '_id',
              as: '__usuarioSort',
            },
          },
          { $unwind: { path: '$__usuarioSort', preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              __usuarioNombre: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ['$__usuarioSort.apellidos', ''] },
                      ' ',
                      { $ifNull: ['$__usuarioSort.nombres', ''] },
                    ],
                  },
                },
              },
            },
          },
          {
            $sort: {
              __usuarioNombre: sortDirection,
              fecha: -1,
              nrodecomanda: -1,
              _id: sortDirection,
            },
          },
          { $set: { __usuarioSort: '$$REMOVE', __usuarioNombre: '$$REMOVE' } },
        ];
      default:
        return [{ $sort: { fecha: -1, nrodecomanda: -1, _id: -1 } }];
    }
  };

  const logisticsPopulate = [
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

  const sortPipeline = buildSortPipeline(isValidSortField ? sortField : null);
  const pipeline = [{ $match: query }, ...sortPipeline, { $skip: skip }, { $limit: limit }];

  const aggregation = Comanda.aggregate(pipeline).collation({
    locale: 'es',
    strength: 1,
    caseLevel: false,
    numericOrdering: true,
  });

  const [total, rawComandas] = await Promise.all([
    Comanda.countDocuments(query),
    aggregation.exec(),
  ]);

  const comandas = await Comanda.populate(rawComandas, logisticsPopulate);

  const totalPages = Math.ceil(total / limit) || 0;

  res.json({ ok: true, page, limit, total, totalPages, comandas });
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

