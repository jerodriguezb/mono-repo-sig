// rutas/localidad.js — CRUD de Localidades
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Localidad = require('../modelos/localidad');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
const toNumber = (v, d) => Number(v ?? d);

// Populate básico: mostrar provincia ligada.
const localidadPopulate = { path: 'provincia' };

// -----------------------------------------------------------------------------
// 1. LISTAR LOCALIDADES ---------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/localidades', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 50 } = req.query;
  const query = { activo: true };

  const localidades = await Localidad.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 50))
    .sort('localidad')
    .populate(localidadPopulate)
    .lean()
    .exec();

  const cantidad = await Localidad.countDocuments(query);
  res.json({ ok: true, localidades, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. OBTENER LOCALIDAD POR ID ---------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/localidades/:id', asyncHandler(async (req, res) => {
  const localidad = await Localidad.findById(req.params.id)
    .populate(localidadPopulate)
    .lean()
    .exec();

  if (!localidad) return res.status(404).json({ ok: false, err: { message: 'Localidad no encontrada' } });
  res.json({ ok: true, localidad });
}));

// -----------------------------------------------------------------------------
// 3. CREAR LOCALIDAD ------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/localidades', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const localidad = new Localidad({
    localidad: body.localidad,
    codigopostal: body.codigopostal,
    provincia: body.provincia,
    activo: body.activo,
  });
  const localidadDB = await localidad.save();
  res.json({ ok: true, localidad: localidadDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR LOCALIDAD -------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/localidades/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const localidadDB = await Localidad.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate(localidadPopulate).exec();

  if (!localidadDB) return res.status(404).json({ ok: false, err: { message: 'Localidad no encontrada' } });
  res.json({ ok: true, localidad: localidadDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/localidades/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const localidadBorrada = await Localidad.findByIdAndUpdate(req.params.id, { activo: false }, { new: true })
    .populate(localidadPopulate)
    .exec();

  if (!localidadBorrada) return res.status(404).json({ ok: false, err: { message: 'Localidad no encontrada' } });
  res.json({ ok: true, localidad: localidadBorrada });
}));

// -----------------------------------------------------------------------------
module.exports = router;
