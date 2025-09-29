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

const parseGroupBy = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((field) => typeof field === 'string' && field.trim()).map((field) => field.trim());
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((field) => typeof field === 'string' && field.trim()).map((field) => field.trim());
      }
    } catch (error) {
      // Ignored — fallback to comma split
    }
    return value
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean);
  }
  return [];
};

const allowedGroupFields = new Set(['nrodecomanda', 'cliente', 'ruta', 'producto', 'rubro', 'camion']);

const formatGroupKeyValue = (raw) => {
  if (raw === null || typeof raw === 'undefined') return '—';
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length ? trimmed : '—';
  }
  return String(raw);
};

const reduceProductEntries = (orders = []) => {
  const map = new Map();
  for (const order of orders) {
    const items = Array.isArray(order?.items) ? order.items : [];
    for (const item of items) {
      const descripcion = typeof item?.codprod?.descripcion === 'string' ? item.codprod.descripcion.trim() : '';
      const presentacion = typeof item?.codprod?.presentacion === 'string' ? item.codprod.presentacion.trim() : '';
      const label = [descripcion, presentacion].filter(Boolean).join(' ').trim();
      if (!label) continue;
      const cantidad = Number(item?.cantidad ?? 0);
      const current = map.get(label) ?? 0;
      map.set(label, current + (Number.isFinite(cantidad) ? cantidad : 0));
    }
  }
  const products = Array.from(map.entries()).map(([label, quantity]) => ({
    label,
    quantity,
  }));
  const resumen = products.length
    ? products
        .map(({ label, quantity }) => `${label} (${Number.isFinite(quantity) ? Math.round(quantity) : 0})`)
        .join(' - ')
    : '—';
  return { products, resumen };
};

const buildGroupingPopulateStages = () => [
  {
    $lookup: {
      from: 'clientes',
      localField: 'codcli',
      foreignField: '_id',
      as: 'codcli',
    },
  },
  { $unwind: { path: '$codcli', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'rutas',
      localField: 'codcli.ruta',
      foreignField: '_id',
      as: '__rutaDoc',
    },
  },
  { $unwind: { path: '$__rutaDoc', preserveNullAndEmptyArrays: true } },
  {
    $set: {
      codcli: {
        $cond: [
          { $ifNull: ['$codcli', false] },
          {
            $mergeObjects: [
              '$codcli',
              {
                ruta: {
                  $cond: [
                    { $ifNull: ['$__rutaDoc', false] },
                    { _id: '$__rutaDoc._id', ruta: '$__rutaDoc.ruta' },
                    '$codcli.ruta',
                  ],
                },
              },
            ],
          },
          '$codcli',
        ],
      },
    },
  },
  { $unset: ['__rutaDoc'] },
  {
    $lookup: {
      from: 'camions',
      localField: 'camion',
      foreignField: '_id',
      as: 'camion',
    },
  },
  { $unwind: { path: '$camion', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'usuarios',
      localField: 'usuario',
      foreignField: '_id',
      as: 'usuario',
    },
  },
  { $unwind: { path: '$usuario', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'usuarios',
      localField: 'camionero',
      foreignField: '_id',
      as: 'camionero',
    },
  },
  { $unwind: { path: '$camionero', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'estados',
      localField: 'codestado',
      foreignField: '_id',
      as: 'codestado',
    },
  },
  { $unwind: { path: '$codestado', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'producservs',
      localField: 'items.codprod',
      foreignField: '_id',
      as: '__productos',
    },
  },
  {
    $lookup: {
      from: 'rubros',
      localField: '__productos.rubro',
      foreignField: '_id',
      as: '__rubros',
    },
  },
  {
    $addFields: {
      items: {
        $map: {
          input: { $ifNull: ['$items', []] },
          as: 'item',
          in: {
            cantidad: '$$item.cantidad',
            monto: '$$item.monto',
            cantidadentregada: '$$item.cantidadentregada',
            entregado: '$$item.entregado',
            lista: '$$item.lista',
            codprod: {
              $let: {
                vars: {
                  producto: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$__productos',
                          as: 'prod',
                          cond: { $eq: ['$$prod._id', '$$item.codprod'] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: {
                  $cond: [
                    { $ifNull: ['$$producto', false] },
                    {
                      _id: '$$producto._id',
                      descripcion: '$$producto.descripcion',
                      presentacion: '$$producto.presentacion',
                      rubro: {
                        $let: {
                          vars: {
                            rubro: {
                              $arrayElemAt: [
                                {
                                  $filter: {
                                    input: '$__rubros',
                                    as: 'rubro',
                                    cond: { $eq: ['$$rubro._id', '$$producto.rubro'] },
                                  },
                                },
                                0,
                              ],
                            },
                          },
                          in: {
                            $cond: [
                              { $ifNull: ['$$rubro', false] },
                              {
                                _id: '$$rubro._id',
                                descripcion: '$$rubro.descripcion',
                              },
                              null,
                            ],
                          },
                        },
                      },
                    },
                    null,
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  { $unset: ['__productos', '__rubros'] },
  {
    $addFields: {
      rutaNombre: {
        $cond: [
          {
            $gt: [
              { $strLenCP: { $ifNull: ['$codcli.ruta.ruta', ''] } },
              0,
            ],
          },
          '$codcli.ruta.ruta',
          { $ifNull: ['$camion.ruta', ''] },
        ],
      },
      totalCantidad: {
        $sum: {
          $map: {
            input: { $ifNull: ['$items', []] },
            as: 'item',
            in: {
              $convert: {
                input: '$$item.cantidad',
                to: 'double',
                onNull: 0,
                onError: 0,
              },
            },
          },
        },
      },
      rubroNombre: {
        $let: {
          vars: {
            firstRubro: {
              $first: {
                $filter: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  cond: {
                    $and: [
                      { $ifNull: ['$$item.codprod', false] },
                      {
                        $gt: [
                          { $strLenCP: { $ifNull: ['$$item.codprod.rubro.descripcion', ''] } },
                          0,
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
          in: {
            $ifNull: ['$$firstRubro.codprod.rubro.descripcion', ''],
          },
        },
      },
    },
  },
  {
    $addFields: {
      productoResumen: {
        $let: {
          vars: {
            entries: {
              $filter: {
                input: {
                  $map: {
                    input: { $ifNull: ['$items', []] },
                    as: 'item',
                    in: {
                      $cond: [
                        {
                          $and: [
                            { $ifNull: ['$$item.codprod', false] },
                            {
                              $gt: [
                                {
                                  $strLenCP: {
                                    $trim: {
                                      input: {
                                        $concat: [
                                          { $ifNull: ['$$item.codprod.descripcion', ''] },
                                          ' ',
                                          { $ifNull: ['$$item.codprod.presentacion', ''] },
                                        ],
                                      },
                                    },
                                  },
                                },
                                0,
                              ],
                            },
                          ],
                        },
                        {
                          $concat: [
                            {
                              $trim: {
                                input: {
                                  $concat: [
                                    { $ifNull: ['$$item.codprod.descripcion', ''] },
                                    ' ',
                                    { $ifNull: ['$$item.codprod.presentacion', ''] },
                                  ],
                                },
                              },
                            },
                            ' (',
                            {
                              $toString: {
                                $round: [
                                  {
                                    $convert: {
                                      input: '$$item.cantidad',
                                      to: 'double',
                                      onNull: 0,
                                      onError: 0,
                                    },
                                  },
                                  0,
                                ],
                              },
                            },
                            ')',
                          ],
                        },
                        null,
                      ],
                    },
                  },
                },
                as: 'entry',
                cond: { $ne: ['$$entry', null] },
              },
            },
          },
          in: {
            $cond: [
              { $gt: [{ $size: '$$entries' }, 0] },
              {
                $reduce: {
                  input: '$$entries',
                  initialValue: '',
                  in: {
                    $cond: [
                      { $eq: ['$$value', ''] },
                      '$$this',
                      { $concat: ['$$value', ' - ', '$$this'] },
                    ],
                  },
                },
              },
              '—',
            ],
          },
        },
      },
    },
  },
];

const buildGroupPipeline = (query, groupBy, sortPipeline) => {
  if (!groupBy.length) return [];
  const stages = [
    { $match: query },
    ...(Array.isArray(sortPipeline) ? sortPipeline : [{ $sort: { fecha: -1, nrodecomanda: -1, _id: -1 } }]),
    ...buildGroupingPopulateStages(),
    { $sort: { fecha: -1, nrodecomanda: -1, _id: -1 } },
  ];

  const groupId = {};
  for (const field of groupBy) {
    switch (field) {
      case 'nrodecomanda':
        groupId.nrodecomanda = '$nrodecomanda';
        break;
      case 'cliente':
        groupId.cliente = { $ifNull: ['$codcli.razonsocial', ''] };
        break;
      case 'ruta':
        groupId.ruta = { $ifNull: ['$rutaNombre', ''] };
        break;
      case 'producto':
        groupId.producto = { $ifNull: ['$productoResumen', ''] };
        break;
      case 'rubro':
        groupId.rubro = { $ifNull: ['$rubroNombre', ''] };
        break;
      case 'camion':
        groupId.camion = { $ifNull: ['$camion.camion', ''] };
        break;
      default:
        break;
    }
  }

  stages.push({
    $group: {
      _id: groupId,
      count: { $sum: 1 },
      totalCantidad: { $sum: { $ifNull: ['$totalCantidad', 0] } },
      orders: { $push: '$$ROOT' },
    },
  });

  if (groupBy.length) {
    const sortStage = {
      $sort: groupBy.reduce((acc, field) => {
        acc[`_id.${field}`] = 1;
        return acc;
      }, {}),
    };
    stages.push(sortStage);
  }

  return stages;
};

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
    groupBy: groupByRaw,
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
    const clienteId = new mongoose.Types.ObjectId(cliente);
    filters.push({ codcli: clienteId });
  }

  if (producto) {
    if (!isValidObjectId(producto)) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, comandas: [] });
    }
    const productoId = new mongoose.Types.ObjectId(producto);
    filters.push({ 'items.codprod': productoId });
  }

  if (camionero) {
    if (!isValidObjectId(camionero)) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, comandas: [] });
    }
    const camioneroId = new mongoose.Types.ObjectId(camionero);
    filters.push({ camionero: camioneroId });
  }

  if (estado) {
    if (!isValidObjectId(estado)) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, comandas: [] });
    }
    const estadoId = new mongoose.Types.ObjectId(estado);
    filters.push({ codestado: estadoId });
  }

  if (usuario) {
    if (!isValidObjectId(usuario)) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, comandas: [] });
    }
    const usuarioId = new mongoose.Types.ObjectId(usuario);
    filters.push({ usuario: usuarioId });
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

  const groupBy = Array.from(
    new Set(parseGroupBy(groupByRaw).filter((field) => allowedGroupFields.has(field))),
  );

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

  const groupingPipeline = groupBy.length ? buildGroupPipeline(query, groupBy, sortPipeline) : null;
  const groupingAggregation = groupingPipeline
    ? Comanda.aggregate(groupingPipeline).collation({
        locale: 'es',
        strength: 1,
        caseLevel: false,
        numericOrdering: true,
      })
    : null;

  const [total, rawComandas, groupedRaw] = await Promise.all([
    Comanda.countDocuments(query),
    aggregation.exec(),
    groupingAggregation ? groupingAggregation.exec() : Promise.resolve(null),
  ]);

  const comandas = await Comanda.populate(rawComandas, logisticsPopulate);

  const totalPages = Math.ceil(total / limit) || 0;
  let grouped = null;

  if (groupedRaw && Array.isArray(groupedRaw)) {
    const buckets = groupedRaw.map((bucket) => {
      const orders = Array.isArray(bucket?.orders) ? bucket.orders : [];
      const groupValues = {};
      for (const field of groupBy) {
        const rawValue = bucket?._id ? bucket._id[field] : null;
        groupValues[field] = formatGroupKeyValue(rawValue);
      }
      const { products, resumen } = reduceProductEntries(orders);
      const key = groupBy
        .map((field) => formatGroupKeyValue(bucket?._id ? bucket._id[field] : null))
        .join(' | ');

      return {
        key: key || (orders[0]?._id ? String(orders[0]._id) : ''),
        groupValues,
        count: bucket?.count ?? orders.length,
        totalCantidad: bucket?.totalCantidad ?? 0,
        productos: products,
        productosResumen: resumen,
        orders,
      };
    });

    grouped = {
      groupBy,
      buckets,
      totalOrders: buckets.reduce((acc, bucket) => acc + (bucket.orders?.length ?? 0), 0),
    };
  }

  res.json({ ok: true, page, limit, total, totalPages, comandas, grouped });
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

