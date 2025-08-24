// rutas/provincia.js — CRUD de Provincias
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Provincia = require('../modelos/provincia');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
const toNumber = (v, d) => Number(v ?? d);

// -----------------------------------------------------------------------------
// 1. LISTAR PROVINCIAS ----------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/provincias', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 50 } = req.query;
  const query = { activo: true };

  const provincias = await Provincia.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 50))
    .sort('provincia')
    .lean()
    .exec();

  const cantidad = await Provincia.countDocuments(query);
  res.json({ ok: true, provincias, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. OBTENER PROVINCIA POR ID ---------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/provincias/:id', asyncHandler(async (req, res) => {
  const provincia = await Provincia.findById(req.params.id).lean().exec();
  if (!provincia) return res.status(404).json({ ok: false, err: { message: 'Provincia no encontrada' } });
  res.json({ ok: true, provincia });
}));

// -----------------------------------------------------------------------------
// 3. CREAR PROVINCIA ------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/provincias', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const provincia = new Provincia({ codigoprovincia: body.codigoprovincia, provincia: body.provincia, activo: body.activo });
  const provinciaDB = await provincia.save();
  res.json({ ok: true, provincia: provinciaDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR PROVINCIA -------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/provincias/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const provinciaDB = await Provincia.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).exec();
  if (!provinciaDB) return res.status(404).json({ ok: false, err: { message: 'Provincia no encontrada' } });
  res.json({ ok: true, provincia: provinciaDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) ---------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/provincias/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const provinciaBorrada = await Provincia.findByIdAndUpdate(req.params.id, { activo: false }, { new: true }).exec();
  if (!provinciaBorrada) return res.status(404).json({ ok: false, err: { message: 'Provincia no encontrada' } });
  res.json({ ok: true, provincia: provinciaBorrada });
}));

// -----------------------------------------------------------------------------
module.exports = router;
