// rutas/comanda.js — Refactor completo para esquema con array «items»
// ---------------------------------------------------------------------------
// Compatible con Node.js v22.17.1 y Mongoose v8.16.5

const express = require('express');
const Comanda = require('../modelos/comanda');
const Producserv = require('../modelos/producserv');
const Stock = require('../modelos/stock');
const Tipomovimiento = require('../modelos/tipomovimiento');
const Counter = require('../modelos/counter');
const { verificaToken, verificaAdmin_role, ROLES } = require('../middlewares/autenticacion');

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
  { path: 'operarioAsignado', select: 'role nombres apellidos' },
  { path: 'preparacion.responsable', select: 'role nombres apellidos' },
  { path: 'controlCarga.inspector', select: 'role nombres apellidos' },
  { path: 'usuarioLogistica', select: 'role nombres apellidos' },
  { path: 'usuarioDespacho', select: 'role nombres apellidos' },
  { path: 'historial.usuario', select: 'role nombres apellidos' },
  { path: 'entregas.usuario', select: 'role nombres apellidos' },
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

      if (Object.prototype.hasOwnProperty.call(body, 'estadoPreparacion')) {
        comanda.estadoPreparacion = body.estadoPreparacion;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'operarioAsignado')) {
        comanda.operarioAsignado = body.operarioAsignado;
      }
      if (body.preparacion) {
        comanda.preparacion = body.preparacion;
      }
      if (body.controlCarga) {
        comanda.controlCarga = body.controlCarga;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'motivoLogistica')) {
        comanda.motivoLogistica = body.motivoLogistica;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'usuarioLogistica')) {
        comanda.usuarioLogistica = body.usuarioLogistica;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'salidaDeposito')) {
        comanda.salidaDeposito = body.salidaDeposito;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'usuarioDespacho')) {
        comanda.usuarioDespacho = body.usuarioDespacho;
      }
      if (Array.isArray(body.entregas)) {
        comanda.entregas = body.entregas;
      }

      if (Array.isArray(body.historial) && body.historial.length) {
        comanda.historial = body.historial;
      } else if (body.usuario) {
        comanda.historial = [
          {
            accion: 'Comanda creada',
            usuario: body.usuario,
            motivo: body.motivoCreacion || null,
            fecha: body.fecha || new Date(),
          },
        ];
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
  const role = req.usuario?.role;
  const usuarioId = req.usuario?._id;
  const allowedRoles = [ROLES.ADMIN, ROLES.CAMION, ROLES.USER_ROLE];
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ ok: false, err: { message: 'Permiso denegado' } });
  }

  const isAdmin = role === ROLES.ADMIN;
  const isDeposito = isAdmin || role === ROLES.USER_ROLE;
  const isChofer = role === ROLES.CAMION;
  const now = new Date();
  const body = req.body || {};

  const ensure = (condition, status, message) => {
    if (!condition) {
      const err = new Error(message);
      err.status = status;
      throw err;
    }
  };

  const session = await Comanda.startSession();
  let updatedId = null;

  try {
    await session.withTransaction(async () => {
      const comanda = await Comanda.findById(req.params.id).session(session);
      ensure(comanda, 404, 'Comanda no encontrada');

      const historialEntries = [];
      const estadoAnterior = comanda.estadoPreparacion;

      if (Object.prototype.hasOwnProperty.call(body, 'estadoPreparacion')) {
        ensure(isDeposito || isAdmin, 403, 'Sin permisos para cambiar el estado de preparación');

        const nuevoEstado = body.estadoPreparacion;
        const ESTADOS_VALIDOS = ['A Preparar', 'En Curso', 'Lista para carga'];
        ensure(ESTADOS_VALIDOS.includes(nuevoEstado), 400, 'Estado de preparación inválido');

        if (estadoAnterior === 'En Curso' && nuevoEstado === 'Lista para carga') {
          const checklistOk =
            (body.preparacion?.checklistDepositoConfirmado ?? comanda.preparacion?.checklistDepositoConfirmado) &&
            (body.preparacion?.verificacionBultos ?? comanda.preparacion?.verificacionBultos);
          ensure(checklistOk, 400, 'Completa el checklist de preparación antes de marcar la comanda como lista para carga');
          if (comanda.operarioAsignado && !isAdmin) {
            ensure(String(comanda.operarioAsignado) === String(usuarioId), 403, 'Solo el operario asignado puede finalizar la preparación');
          }
        }

        if (estadoAnterior !== nuevoEstado) {
          comanda.estadoPreparacion = nuevoEstado;
          historialEntries.push({
            accion: `Cambio de estado de preparación → ${nuevoEstado}`,
            usuario: usuarioId,
            motivo: body.motivoPreparacion || body.motivo || null,
            fecha: now,
          });
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, 'operarioAsignado')) {
        ensure(isDeposito || isAdmin, 403, 'Sin permisos para asignar operarios');
        comanda.operarioAsignado = body.operarioAsignado || null;
        historialEntries.push({
          accion: body.operarioAsignado ? 'Operario asignado' : 'Operario removido',
          usuario: usuarioId,
          motivo: body.motivoPreparacion || body.motivo || null,
          fecha: now,
        });
      }

      if (body.preparacion) {
        ensure(isDeposito || isAdmin, 403, 'Sin permisos para actualizar la preparación');
        comanda.preparacion = {
          ...(comanda.preparacion ? comanda.preparacion.toObject ? comanda.preparacion.toObject() : comanda.preparacion : {}),
          ...body.preparacion,
        };
        historialEntries.push({
          accion: 'Checklist de preparación actualizado',
          usuario: usuarioId,
          motivo: body.preparacion.incidencias || body.motivoPreparacion || null,
          fecha: now,
        });
      }

      if (body.controlCarga) {
        ensure(isDeposito || isAdmin, 403, 'Sin permisos para registrar el control de carga');
        ensure(comanda.estadoPreparacion === 'Lista para carga', 400, 'La comanda debe estar lista para carga antes de registrar el control');
        const checklistCarga = body.controlCarga.checklistDepositoConfirmado === true || comanda.controlCarga?.checklistDepositoConfirmado === true;
        ensure(checklistCarga, 400, 'Confirmá el checklist del depósito antes de continuar');
        comanda.controlCarga = {
          ...(comanda.controlCarga ? comanda.controlCarga.toObject ? comanda.controlCarga.toObject() : comanda.controlCarga : {}),
          ...body.controlCarga,
        };
        historialEntries.push({
          accion: 'Control de carga registrado',
          usuario: usuarioId,
          motivo: body.controlCarga.anotaciones || body.motivoLogistica || null,
          fecha: now,
        });
      }

      if (Object.prototype.hasOwnProperty.call(body, 'motivoLogistica') || Object.prototype.hasOwnProperty.call(body, 'usuarioLogistica')) {
        ensure(isDeposito || isAdmin, 403, 'Sin permisos para gestionar logística');
        if (Object.prototype.hasOwnProperty.call(body, 'motivoLogistica')) {
          comanda.motivoLogistica = body.motivoLogistica || null;
        }
        if (Object.prototype.hasOwnProperty.call(body, 'usuarioLogistica')) {
          comanda.usuarioLogistica = body.usuarioLogistica || null;
        }
        historialEntries.push({
          accion: 'Asignación logística actualizada',
          usuario: usuarioId,
          motivo: body.motivoLogistica || null,
          fecha: now,
        });
      }

      if (Object.prototype.hasOwnProperty.call(body, 'camion') || Object.prototype.hasOwnProperty.call(body, 'camionero') || Object.prototype.hasOwnProperty.call(body, 'fechadeentrega')) {
        ensure(isDeposito || isAdmin, 403, 'Sin permisos para asignar camiones');
        ensure(comanda.estadoPreparacion === 'Lista para carga', 400, 'Solo se pueden asignar camiones a comandas listas para carga');
        if (Object.prototype.hasOwnProperty.call(body, 'camion')) comanda.camion = body.camion || null;
        if (Object.prototype.hasOwnProperty.call(body, 'camionero')) comanda.camionero = body.camionero || null;
        if (Object.prototype.hasOwnProperty.call(body, 'fechadeentrega')) comanda.fechadeentrega = body.fechadeentrega || null;
        historialEntries.push({
          accion: 'Camión asignado',
          usuario: usuarioId,
          motivo: body.motivoLogistica || null,
          fecha: now,
        });
      }

      if (Object.prototype.hasOwnProperty.call(body, 'salidaDeposito') || Object.prototype.hasOwnProperty.call(body, 'usuarioDespacho')) {
        ensure(isDeposito || isAdmin, 403, 'Sin permisos para registrar el despacho');
        if (body.salidaDeposito) comanda.salidaDeposito = body.salidaDeposito;
        if (Object.prototype.hasOwnProperty.call(body, 'usuarioDespacho')) comanda.usuarioDespacho = body.usuarioDespacho || null;
        historialEntries.push({
          accion: 'Despacho registrado',
          usuario: usuarioId,
          motivo: body.motivoDespacho || body.motivoLogistica || null,
          fecha: now,
        });
      }

      if (Array.isArray(body.entregas)) {
        ensure(isChofer || isAdmin, 403, 'Solo choferes pueden actualizar las entregas');
        const entregasNormalizadas = body.entregas.map((ent) => ({
          ...ent,
          usuario: ent.usuario || usuarioId,
          fecha: ent.fecha || now,
        }));
        comanda.entregas = entregasNormalizadas;
        historialEntries.push({
          accion: 'Entregas actualizadas',
          usuario: usuarioId,
          motivo: body.motivoEntrega || null,
          fecha: now,
        });
      }

      if (body.nuevaEntrega) {
        ensure(isChofer || isAdmin, 403, 'Solo choferes pueden registrar entregas');
        comanda.entregas = Array.isArray(comanda.entregas) ? comanda.entregas : [];
        comanda.entregas.push({
          ...body.nuevaEntrega,
          usuario: body.nuevaEntrega.usuario || usuarioId,
          fecha: body.nuevaEntrega.fecha || now,
        });
        historialEntries.push({
          accion: 'Entrega registrada',
          usuario: usuarioId,
          motivo: body.nuevaEntrega.motivo || null,
          fecha: now,
        });
      }

      const camposGenerales = ['codestado', 'activo'];
      camposGenerales.forEach((campo) => {
        if (Object.prototype.hasOwnProperty.call(body, campo)) {
          ensure(isAdmin, 403, 'Sin permisos para actualizar campos administrativos');
          comanda[campo] = body[campo];
        }
      });

      if (body.historialEntry) {
        const entries = Array.isArray(body.historialEntry) ? body.historialEntry : [body.historialEntry];
        entries.forEach((entry) => {
          if (!entry?.accion) return;
          historialEntries.push({
            accion: entry.accion,
            usuario: usuarioId,
            motivo: entry.motivo || null,
            fecha: now,
          });
        });
      }

      if (historialEntries.length) {
        comanda.historial = Array.isArray(comanda.historial) ? comanda.historial : [];
        historialEntries.forEach((h) => comanda.historial.push(h));
      }

      await comanda.save({ session, validateModifiedOnly: false });
      updatedId = comanda._id;
    });
  } catch (error) {
    if (error && error.status) {
      return res.status(error.status).json({ ok: false, err: { message: error.message } });
    }
    throw error;
  } finally {
    session.endSession();
  }

  if (!updatedId) {
    return res.status(500).json({ ok: false, err: { message: 'No se pudo actualizar la comanda' } });
  }

  const comandaActualizada = await Comanda.findById(updatedId).populate(commonPopulate).lean().exec();
  res.json({ ok: true, comanda: comandaActualizada });
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

