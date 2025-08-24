// rutas/proveedor.js — CRUD de Proveedores
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Proveedor = require('../modelos/proveedor');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
const toNumber = (v, d) => Number(v ?? d);

// Populate común
const proveedorPopulate = [
  { path: 'localidad', populate: { path: 'provincia' } },
  'condicioniva',
];

// -----------------------------------------------------------------------------
// 1. LISTAR PROVEEDORES ---------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/proveedores', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 500 } = req.query;
  const query = { activo: true };

  const proveedores = await Proveedor.find(query)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 500))
    .sort('razonsocial')
    .populate(proveedorPopulate)
    .lean()
    .exec();

  const cantidad = await Proveedor.countDocuments(query);
  res.json({ ok: true, proveedores, cantidad });
}));

// -----------------------------------------------------------------------------
// 2. OBTENER PROVEEDOR POR ID ---------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/proveedores/:id', asyncHandler(async (req, res) => {
  const prov = await Proveedor.findById(req.params.id).populate(proveedorPopulate).lean().exec();
  if (!prov) return res.status(404).json({ ok: false, err: { message: 'Proveedor no encontrado' } });
  res.json({ ok: true, proveedor: prov });
}));

// -----------------------------------------------------------------------------
// 3. CREAR PROVEEDOR ------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/proveedores', /* [verificaToken, verificaAdmin_role], */ asyncHandler(async (req, res) => {
  const body = req.body;
  const proveedor = new Proveedor({
    codprov: body.codprov,
    razonsocial: body.razonsocial,
    domicilio: body.domicilio,
    telefono: body.telefono,
    cuit: body.cuit,
    email: body.email,
    localidad: body.localidad,
    condicioniva: body.condicioniva,
    activo: body.activo,
  });
  const provDB = await proveedor.save();
  res.json({ ok: true, proveedor: provDB });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR PROVEEDOR -------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/proveedores/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const provDB = await Proveedor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate(proveedorPopulate)
    .exec();
  if (!provDB) return res.status(404).json({ ok: false, err: { message: 'Proveedor no encontrado' } });
  res.json({ ok: true, proveedor: provDB });
}));

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT DELETE) --------------------------------------------------
// -----------------------------------------------------------------------------
router.delete('/proveedores/:id', [verificaToken, verificaAdmin_role], asyncHandler(async (req, res) => {
  const provBorrado = await Proveedor.findByIdAndUpdate(req.params.id, { activo: false }, { new: true })
    .populate(proveedorPopulate)
    .exec();
  if (!provBorrado) return res.status(404).json({ ok: false, err: { message: 'Proveedor no encontrado' } });
  res.json({ ok: true, proveedor: provBorrado });
}));

// -----------------------------------------------------------------------------
module.exports = router;

