// rutas/comanda.js — Refactor completo para esquema con array «items»
// ---------------------------------------------------------------------------
// Compatible con Node.js v22.17.1 y Mongoose v8.16.5

const express = require('express');
const Comanda = require('../modelos/comanda');
const Producserv = require('../modelos/producserv');
const Stock = require('../modelos/stock');
const Tipomovimiento = require('../modelos/tipomovimiento');
const Counter = require('../modelos/counter');
const {
  verificaToken,
  verificaAdmin_role,
  ROLES,
} = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const toNumber = (v, def) => Number(v ?? def);

/**
 * Conjunto de poblados comunes a la mayoría de endpoints.
 */
const commonPopulate = [
  {
    path: 'codcli',
    populate: [
      { path: 'ruta' },
      { path: 'localidad' },
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
  { path: 'operarioAsignado', select: 'nombres apellidos role' },
  { path: 'preparacion.responsable', select: 'nombres apellidos role' },
  { path: 'controlCarga.inspector', select: 'nombres apellidos role' },
  { path: 'usuarioLogistica', select: 'nombres apellidos role' },
  { path: 'historial.usuario', select: 'nombres apellidos role' },
  { path: 'entregas.usuario', select: 'nombres apellidos role' },
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
      if (body.estadoPreparacion) comanda.estadoPreparacion = body.estadoPreparacion;
      if (body.operarioAsignado) comanda.operarioAsignado = body.operarioAsignado;
      if (body.preparacion) comanda.preparacion = body.preparacion;
      if (body.controlCarga) comanda.controlCarga = body.controlCarga;
      if (body.motivoLogistica) comanda.motivoLogistica = body.motivoLogistica;
      if (body.usuarioLogistica) comanda.usuarioLogistica = body.usuarioLogistica;
      if (Array.isArray(body.entregas)) comanda.entregas = body.entregas;
      if (Array.isArray(body.historial) && body.historial.length)
        comanda.historial = body.historial;
      if (body.usuario) {
        comanda.historial.push({
          accion: 'Comanda creada',
          usuario: body.usuario,
          motivo: body.motivoHistorial || undefined,
        });
      }
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
router.put('/comandas/:id', verificaToken, asyncHandler(async (req, res) => {
  const { role, _id: usuarioId } = req.usuario || {};
  const body = { ...req.body };
  const motivoHistorial = body.motivoHistorial;
  delete body.motivoHistorial;

  const estadoPreparacionPayload = body.estadoPreparacion;
  delete body.estadoPreparacion;

  const preparacionPayload = body.preparacion;
  delete body.preparacion;

  const operarioAsignadoPayload = body.operarioAsignado;
  delete body.operarioAsignado;

  const controlCargaPayload = body.controlCarga;
  delete body.controlCarga;

  const usuarioLogisticaPayload = body.usuarioLogistica;
  delete body.usuarioLogistica;

  const motivoLogisticaPayload = body.motivoLogistica;
  delete body.motivoLogistica;

  const entregaNuevaPayload = body.entregaNueva;
  delete body.entregaNueva;

  let entregasPayload = undefined;
  if (Array.isArray(body.entregas)) {
    entregasPayload = body.entregas;
    delete body.entregas;
  }

  const historialEntries = [];
  const comanda = await Comanda.findById(req.params.id).exec();
  if (!comanda) return res.status(404).json({ ok: false, err: { message: 'Comanda no encontrada' } });

  const isAdmin = role === ROLES.ADMIN;
  const isPreventista = role === ROLES.PREV;
  const isChofer = role === ROLES.CAMION;

  const puedeGestionDeposito = isAdmin || isChofer;
  const puedeGestionGeneral = isAdmin || isPreventista;
  const puedeGestionLogistica = isAdmin || isChofer;
  const puedeGestionEntregas = isAdmin || isChofer;

  if (operarioAsignadoPayload !== undefined) {
    if (!puedeGestionDeposito) {
      return res.status(403).json({ ok: false, err: { message: 'Sin permisos para asignar operario' } });
    }
    const prevOperario = comanda.operarioAsignado ? String(comanda.operarioAsignado) : null;
    const nextOperario = operarioAsignadoPayload ? String(operarioAsignadoPayload) : null;
    comanda.operarioAsignado = operarioAsignadoPayload || null;
    if (prevOperario !== nextOperario) {
      historialEntries.push({
        accion: prevOperario ? 'Operario reasignado' : 'Operario asignado',
        usuario: usuarioId,
        motivo: motivoHistorial,
      });
    }
  }

  if (preparacionPayload) {
    if (!puedeGestionDeposito) {
      return res.status(403).json({ ok: false, err: { message: 'Sin permisos para actualizar preparación' } });
    }
    const currentPrep = comanda.preparacion && typeof comanda.preparacion.toObject === 'function'
      ? comanda.preparacion.toObject()
      : { ...comanda.preparacion };
    const merged = { ...currentPrep };
    for (const [key, value] of Object.entries(preparacionPayload)) {
      if (value !== undefined) merged[key] = value;
    }
    comanda.preparacion = merged;
  }

  if (estadoPreparacionPayload) {
    if (!['A Preparar', 'En Curso', 'Lista para carga'].includes(estadoPreparacionPayload)) {
      return res.status(400).json({ ok: false, err: { message: 'Estado de preparación inválido' } });
    }
    if (!puedeGestionDeposito) {
      return res.status(403).json({ ok: false, err: { message: 'Sin permisos para actualizar estado de preparación' } });
    }
    const prevEstado = comanda.estadoPreparacion || 'A Preparar';
    if (prevEstado !== estadoPreparacionPayload) {
      const inicioPrep = preparacionPayload?.inicio || comanda.preparacion?.inicio;
      const finPrep = preparacionPayload?.fin || comanda.preparacion?.fin;
      if (estadoPreparacionPayload === 'En Curso' && !inicioPrep) {
        return res.status(400).json({
          ok: false,
          err: { message: 'Debe registrar la hora de inicio antes de marcar En Curso' },
        });
      }
      if (estadoPreparacionPayload === 'Lista para carga') {
        if (!finPrep) {
          return res.status(400).json({
            ok: false,
            err: { message: 'Debe registrar la hora de fin antes de marcar Lista para carga' },
          });
        }
        const operario = operarioAsignadoPayload || comanda.operarioAsignado;
        if (!operario) {
          return res.status(400).json({
            ok: false,
            err: { message: 'Debe asignar un operario antes de finalizar la preparación' },
          });
        }
      }
      historialEntries.push({
        accion: `Estado preparación: ${prevEstado} → ${estadoPreparacionPayload}`,
        usuario: usuarioId,
        motivo: motivoHistorial,
      });
      comanda.estadoPreparacion = estadoPreparacionPayload;
    }
  }

  if (controlCargaPayload) {
    if (!puedeGestionDeposito) {
      return res.status(403).json({ ok: false, err: { message: 'Sin permisos para registrar control de carga' } });
    }
    const estadoObjetivo = estadoPreparacionPayload || comanda.estadoPreparacion;
    if (estadoObjetivo !== 'Lista para carga') {
      return res.status(400).json({
        ok: false,
        err: { message: 'El control de carga sólo puede registrarse cuando la comanda está Lista para carga' },
      });
    }
    const currentControl = comanda.controlCarga && typeof comanda.controlCarga.toObject === 'function'
      ? comanda.controlCarga.toObject()
      : { ...comanda.controlCarga };
    comanda.controlCarga = { ...currentControl, ...controlCargaPayload };
    historialEntries.push({
      accion: 'Control de carga registrado',
      usuario: usuarioId,
      motivo: controlCargaPayload.anotaciones || motivoHistorial,
    });
  }

  if (usuarioLogisticaPayload !== undefined || motivoLogisticaPayload !== undefined) {
    if (!puedeGestionLogistica) {
      return res.status(403).json({ ok: false, err: { message: 'Sin permisos para actualizar logística' } });
    }
    if (usuarioLogisticaPayload !== undefined) comanda.usuarioLogistica = usuarioLogisticaPayload || null;
    if (motivoLogisticaPayload !== undefined) comanda.motivoLogistica = motivoLogisticaPayload || null;
    historialEntries.push({
      accion: 'Asignación logística actualizada',
      usuario: usuarioId,
      motivo: motivoLogisticaPayload || motivoHistorial,
    });
  }

  if (body.camion !== undefined) {
    if (!puedeGestionLogistica) {
      return res.status(403).json({ ok: false, err: { message: 'Sin permisos para asignar camión' } });
    }
    comanda.camion = body.camion || null;
    delete body.camion;
    historialEntries.push({
      accion: 'Camión asignado',
      usuario: usuarioId,
      motivo: motivoHistorial,
    });
  }

  if (Array.isArray(entregasPayload)) {
    if (!puedeGestionEntregas) {
      return res.status(403).json({ ok: false, err: { message: 'Sin permisos para actualizar entregas' } });
    }
    comanda.entregas = entregasPayload;
    historialEntries.push({
      accion: `Entregas actualizadas (${entregasPayload.length})`,
      usuario: usuarioId,
      motivo: motivoHistorial,
    });
  }

  if (entregaNuevaPayload) {
    if (!puedeGestionEntregas) {
      return res.status(403).json({ ok: false, err: { message: 'Sin permisos para cargar entregas' } });
    }
    if (!Array.isArray(comanda.entregas)) {
      comanda.entregas = [];
    }
    comanda.entregas.push({
      ...entregaNuevaPayload,
      usuario: entregaNuevaPayload.usuario || usuarioId,
    });
    historialEntries.push({
      accion: `Entrega ${entregaNuevaPayload.estado || 'registrada'}`,
      usuario: usuarioId,
      motivo: entregaNuevaPayload.motivo || motivoHistorial,
    });
  }

  const allowedGeneralFields = ['codcli', 'fecha', 'codestado', 'fechadeentrega', 'usuario', 'camionero', 'activo', 'items'];
  const generalUpdates = Object.keys(body).filter((key) => allowedGeneralFields.includes(key));
  if (generalUpdates.length) {
    if (!puedeGestionGeneral) {
      return res.status(403).json({ ok: false, err: { message: 'Sin permisos para modificar la comanda' } });
    }
    for (const key of generalUpdates) {
      comanda[key] = body[key];
    }
  }

  if (historialEntries.length) {
    if (!Array.isArray(comanda.historial)) {
      comanda.historial = [];
    }
    comanda.historial.push(...historialEntries);
  }

  const saved = await comanda.save();
  const comandaDB = await saved.populate(commonPopulate);
  res.json({ ok: true, comanda: comandaDB });
}));

// -----------------------------------------------------------------------------
// 12. DESACTIVAR (SOFT‑DELETE) COMANDA -----------------------------------------
// -----------------------------------------------------------------------------
router.delete('/comandas/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const historialEntry = {
    accion: 'Comanda desactivada',
    usuario: req.usuario?._id,
    fecha: new Date(),
  };
  const comandaBorrada = await Comanda.findByIdAndUpdate(
    req.params.id,
    { $set: { activo: false }, $push: { historial: historialEntry } },
    { new: true }
  )
    .populate(commonPopulate)
    .exec();
  if (!comandaBorrada) return res.status(404).json({ ok: false, err: { message: 'Comanda no encontrada' } });
  res.json({ ok: true, comanda: comandaBorrada });
}));

// -----------------------------------------------------------------------------
// EXPORTACIÓN ------------------------------------------------------------------
// -----------------------------------------------------------------------------
module.exports = router;

