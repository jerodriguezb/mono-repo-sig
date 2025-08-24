// rutas/invoice.js — EndPoints de facturación basados en Comanda
// ---------------------------------------------------------------------------
// Compatible con Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const Comanda = require('../modelos/comanda');
const { verificaToken, verificaAdmin_role } = require('../middlewares/autenticacion');

const router = express.Router();

// --------------------------------------------------------
// Utils
// --------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
const toNumber = (v, def) => Number(v ?? def);

// Poblados mínimos para mostrar factura
const invoicePopulate = [
  'codcli',
  { path: 'items.codprod', populate: [{ path: 'marca' }, { path: 'unidaddemedida' }] },
  'items.lista',
];

// --------------------------------------------------------
// 1. LISTAR FACTURAS (Comandas activas)  -----------------
// --------------------------------------------------------
router.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    const { desde = 0, limite = 500 } = req.query;

    const comandas = await Comanda.find({ activo: true })
      .skip(toNumber(desde, 0))
      .limit(toNumber(limite, 500))
      .sort('nrodecomanda')
      .populate(invoicePopulate)
      .lean()
      .exec();

    const cantidad = await Comanda.countDocuments({ activo: true });

    res.json({ ok: true, comandas, cantidad });
  })
);

// --------------------------------------------------------
// 2. OBTENER FACTURA POR N° DE COMANDA -------------------
// --------------------------------------------------------
router.get(
  '/invoices/:id',
  asyncHandler(async (req, res) => {
    const nro = Number(req.params.id);
    if (Number.isNaN(nro)) return res.status(400).json({ ok: false, err: { message: 'Parámetro inválido' } });

    const comanda = await Comanda.findOne({ nrodecomanda: nro, activo: true })
      .populate(invoicePopulate)
      .lean()
      .exec();

    if (!comanda) return res.status(404).json({ ok: false, err: { message: 'Comanda no encontrada' } });

    res.json({ ok: true, comanda });
  })
);

module.exports = router;

