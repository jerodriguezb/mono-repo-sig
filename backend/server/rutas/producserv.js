// rutas/producserv.js — CRUD de Productos y Servicios (soft-delete)
const express = require('express');
const Producserv = require('../modelos/producserv');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toNumber = (v, d) => Number(v ?? d);
const producPopulate = ['rubro', 'marca', 'unidaddemedida'];

/** LISTAR (por defecto, sólo activos) */
router.get('/producservs', asyncHandler(async (req, res) => {
  const { desde = 0, limite = 500, search } = req.query;

  // Filtro de búsqueda por código o descripción (case-insensitive)
  const q = search
    ? {
        $or: [
          { codprod: { $regex: search, $options: 'i' } },
          { descripcion: { $regex: search, $options: 'i' } },
        ],
      }
    : {};

  const producservs = await Producserv.find(q)
    .skip(toNumber(desde, 0))
    .limit(toNumber(limite, 500))
    .sort('descripcion')
    .populate(producPopulate)
    .lean()
    .exec();

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


