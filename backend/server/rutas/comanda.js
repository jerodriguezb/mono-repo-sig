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

const parseObjectId = (value) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
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
  { path: 'usuarioAsignado', select: 'role nombres apellidos' },
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
// 2.a. COMANDAS PARA LOGÍSTICA CON FILTROS -------------------------------------
// -----------------------------------------------------------------------------
router.get('/comandas/logistica', asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = 20; // fijo según requerimiento
  const skip = (page - 1) * limit;

  const filters = { activo: true };

  const {
    fechaDesde,
    fechaHasta,
    cliente,
    producto,
    ruta,
    camionero,
    estado,
    usuario,
    puntoDistribucion,
  } = req.query;

  if (fechaDesde || fechaHasta) {
    const rango = {};
    if (fechaDesde) {
      const fecha = new Date(fechaDesde);
      if (!Number.isNaN(fecha.valueOf())) rango.$gte = fecha;
    }
    if (fechaHasta) {
      const fecha = new Date(fechaHasta);
      if (!Number.isNaN(fecha.valueOf())) rango.$lte = fecha;
    }
    if (Object.keys(rango).length) filters.fecha = rango;
  }

  if (producto) {
    const prodId = parseObjectId(producto);
    if (prodId) filters['items.codprod'] = prodId;
  }

  if (camionero) {
    const camioneroId = parseObjectId(camionero);
    if (camioneroId) filters.camionero = camioneroId;
  }

  if (estado) {
    const estadoId = parseObjectId(estado);
    if (estadoId) filters.codestado = estadoId;
  }

  if (usuario) {
    const usuarioId = parseObjectId(usuario);
    if (usuarioId) filters.usuario = usuarioId;
  }

  if (puntoDistribucion) {
    filters.puntoDistribucion = { $regex: puntoDistribucion, $options: 'i' };
  }

  let clienteSet = null;

  if (cliente) {
    const clienteId = parseObjectId(cliente);
    if (clienteId) {
      clienteSet = new Set([clienteId.toString()]);
    }
  }

  if (ruta) {
    const rutaId = parseObjectId(ruta);
    if (rutaId) {
      const clientes = await Cliente.find({ ruta: rutaId, activo: true })
        .select('_id')
        .lean()
        .exec();
      const routeIds = clientes.map((c) => c._id.toString());
      if (clienteSet) {
        const interseccion = routeIds.filter((id) => clienteSet.has(id));
        clienteSet = new Set(interseccion);
      } else {
        clienteSet = new Set(routeIds);
      }
    }
  }

  if (clienteSet) {
    if (clienteSet.size === 0) {
      return res.json({ ok: true, page, limit, total: 0, totalPages: 0, data: [] });
    }
    const ids = Array.from(clienteSet).map((id) => new mongoose.Types.ObjectId(id));
    filters.codcli = ids.length === 1 ? ids[0] : { $in: ids };
  }

  const [total, comandas] = await Promise.all([
    Comanda.countDocuments(filters),
    Comanda.find(filters)
      .sort({ fecha: -1, nrodecomanda: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
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
        'codestado',
        'camion',
        { path: 'usuario', select: 'role nombres apellidos' },
        { path: 'camionero', select: 'role nombres apellidos' },
        { path: 'usuarioAsignado', select: 'role nombres apellidos' },
      ])
      .lean()
      .exec(),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({ ok: true, page, limit, total, totalPages, data: comandas });
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
// 10.a ACTUALIZACIÓN MASIVA PARA LOGÍSTICA -------------------------------------
// -----------------------------------------------------------------------------
router.put('/comandas/logistica/bulk', [verificaToken, verificaAdminCam_role], asyncHandler(async (req, res) => {
  const { ids, codestado, camionero, usuarioAsignado, puntoDistribucion } = req.body ?? {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ ok: false, err: { message: 'Debe indicar las comandas a actualizar' } });
  }

  const objectIds = ids
    .map((id) => parseObjectId(id))
    .filter(Boolean);

  if (!objectIds.length) {
    return res.status(400).json({ ok: false, err: { message: 'Identificadores inválidos' } });
  }

  const update = {};

  const estadoId = parseObjectId(codestado);
  if (estadoId) update.codestado = estadoId;

  const camioneroId = parseObjectId(camionero);
  if (camioneroId) {
    update.camionero = camioneroId;
    update.usuarioAsignado = camioneroId;
  }

  const usuarioAsignadoId = parseObjectId(usuarioAsignado);
  if (usuarioAsignadoId) update.usuarioAsignado = usuarioAsignadoId;

  if (typeof puntoDistribucion === 'string') {
    update.puntoDistribucion = puntoDistribucion.trim();
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ ok: false, err: { message: 'No se enviaron cambios para aplicar' } });
  }

  const result = await Comanda.updateMany(
    { _id: { $in: objectIds } },
    { $set: update },
    { multi: true },
  ).exec();

  const refreshed = await Comanda.find({ _id: { $in: objectIds } })
    .populate(commonPopulate)
    .lean()
    .exec();

  res.json({ ok: true, modificadas: result.modifiedCount ?? 0, comandas: refreshed });
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

