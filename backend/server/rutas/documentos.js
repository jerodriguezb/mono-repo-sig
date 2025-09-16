// rutas/documentos.js — CRUD de documentos de inventario
// -----------------------------------------------------------------------------
// Implementa la API REST solicitada para gestionar remitos, notas de recepción
// y ajustes de inventario con numeración autoincremental.

const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment-timezone');

const Documento = require('../modelos/documento');
const Proveedor = require('../modelos/proveedor');
const Producserv = require('../modelos/producserv');
const { verificaToken } = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Utilidades ------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const toNumber = (value, defaultValue = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
};

const { DOCUMENT_TYPES = {}, TIMEZONE } = Documento;
const DOCUMENT_CODES = Object.values(DOCUMENT_TYPES);
const DEFAULT_TIMEZONE = TIMEZONE || 'America/Argentina/Buenos_Aires';

const normalizeTipo = (valor) => {
  if (!valor) return null;
  const raw = String(valor).trim().toUpperCase();
  if (DOCUMENT_TYPES[raw]) return DOCUMENT_TYPES[raw];
  if (DOCUMENT_CODES.includes(raw)) return raw;
  if (raw.startsWith('REM')) return DOCUMENT_TYPES.R;
  if (raw.startsWith('NR')) return DOCUMENT_TYPES.NR;
  if (raw.startsWith('AJ')) return DOCUMENT_TYPES.AJ;
  return null;
};

const parseFecha = (valor) => {
  if (!valor) return null;
  const fecha = moment.tz(valor, DEFAULT_TIMEZONE);
  return fecha.isValid() ? fecha.toDate() : null;
};

const populateDocumento = [
  { path: 'proveedor' },
  { path: 'usuario', select: 'nombres apellidos email role' },
  { path: 'items.producto', select: 'codprod descripcion iva stkactual' },
];

const ensureProveedor = async (proveedorId) => {
  if (!mongoose.isValidObjectId(proveedorId)) return false;
  return !!(await Proveedor.exists({ _id: proveedorId }));
};

const ensureProductos = async (items) => {
  const ids = items.map((item) => String(item.producto));
  const productos = await Producserv.find({ _id: { $in: ids } }, { codprod: 1 }).lean().exec();
  const encontrados = new Map(productos.map((prod) => [String(prod._id), prod]));
  const faltantes = ids.filter((id) => !encontrados.has(id));
  if (faltantes.length) {
    const error = new Error('Existen productos inexistentes en la lista de ítems');
    error.status = 400;
    error.details = { faltantes };
    throw error;
  }
  return encontrados;
};

const sanitizeItems = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('Debe cargar al menos un ítem de producto');
    error.status = 400;
    throw error;
  }

  const normalizados = items.map((item, index) => {
    const cantidad = Number(item?.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      const error = new Error(`La cantidad del ítem #${index + 1} debe ser un número positivo`);
      error.status = 400;
      throw error;
    }

    const productoId = item?.producto || item?._id;
    if (!mongoose.isValidObjectId(productoId)) {
      const error = new Error(`El producto del ítem #${index + 1} es inválido`);
      error.status = 400;
      throw error;
    }

    const codprod = item?.codprod;
    if (!codprod || !String(codprod).trim()) {
      const error = new Error(`Debe indicar el código del producto en el ítem #${index + 1}`);
      error.status = 400;
      throw error;
    }

    return {
      cantidad,
      producto: productoId,
      codprod: String(codprod).trim(),
    };
  });

  const productos = await ensureProductos(normalizados);
  return normalizados.map((item) => ({
    ...item,
    codprod: item.codprod || productos.get(String(item.producto))?.codprod,
  }));
};

const buildErrorResponse = (res, error) => {
  const status = error.status || 500;
  const message = error.message || 'Error interno del servidor';
  const payload = { ok: false, err: { message } };
  if (error.details) payload.err.details = error.details;
  return res.status(status).json(payload);
};

// -----------------------------------------------------------------------------
// Rutas -----------------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post(
  '/documentos',
  [verificaToken],
  asyncHandler(async (req, res) => {
    try {
      const body = req.body || {};

      const tipo = normalizeTipo(body.tipo || body.tipoDocumento || body.clase);
      if (!tipo) {
        return res
          .status(400)
          .json({ ok: false, err: { message: 'Tipo de documento inválido. Valores permitidos: R, NR, AJ.' } });
      }

      const proveedorId = body.proveedor;
      if (!(await ensureProveedor(proveedorId))) {
        return res.status(400).json({ ok: false, err: { message: 'El proveedor indicado no existe' } });
      }

      const fechaRemito = parseFecha(body.fechaRemito);
      if (!fechaRemito) {
        return res.status(400).json({ ok: false, err: { message: 'La fecha del documento es inválida' } });
      }

      if (!req.usuario?._id) {
        return res.status(401).json({ ok: false, err: { message: 'Usuario no autenticado' } });
      }

      const items = await sanitizeItems(body.items);

      const documento = new Documento({
        tipo,
        proveedor: proveedorId,
        fechaRemito,
        usuario: req.usuario._id,
        items,
      });

      const documentoDB = await documento.save();
      await documentoDB.populate(populateDocumento);

      res.status(201).json({ ok: true, documento: documentoDB });
    } catch (error) {
      buildErrorResponse(res, error);
    }
  })
);

router.get(
  '/documentos',
  [verificaToken],
  asyncHandler(async (req, res) => {
    const { desde = 0, limite = 20, tipo, proveedor } = req.query;

    const filtro = {};
    if (tipo) {
      const normalizado = normalizeTipo(tipo);
      if (!normalizado) {
        return res
          .status(400)
          .json({ ok: false, err: { message: 'Tipo de documento inválido. Valores permitidos: R, NR, AJ.' } });
      }
      filtro.tipo = normalizado;
    }

    if (proveedor) {
      if (!mongoose.isValidObjectId(proveedor)) {
        return res.status(400).json({ ok: false, err: { message: 'Proveedor inválido' } });
      }
      filtro.proveedor = proveedor;
    }

    const [documentos, cantidad] = await Promise.all([
      Documento.find(filtro)
        .sort({ fechaCreacion: -1 })
        .skip(toNumber(desde, 0))
        .limit(Math.max(toNumber(limite, 20), 0))
        .populate(populateDocumento)
        .lean()
        .exec(),
      Documento.countDocuments(filtro),
    ]);

    res.json({ ok: true, documentos, cantidad });
  })
);

router.get(
  '/documentos/:id',
  [verificaToken],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, err: { message: 'Identificador inválido' } });
    }

    const documento = await Documento.findById(id).populate(populateDocumento).lean().exec();
    if (!documento) {
      return res.status(404).json({ ok: false, err: { message: 'Documento no encontrado' } });
    }

    res.json({ ok: true, documento });
  })
);

router.put(
  '/documentos/:id',
  [verificaToken],
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ ok: false, err: { message: 'Identificador inválido' } });
      }

      const documento = await Documento.findById(id);
      if (!documento) {
        return res.status(404).json({ ok: false, err: { message: 'Documento no encontrado' } });
      }

      const body = req.body || {};

      if (body.tipo && normalizeTipo(body.tipo) !== documento.tipo) {
        return res.status(400).json({ ok: false, err: { message: 'No es posible modificar el tipo del documento' } });
      }

      if (body.proveedor && String(body.proveedor) !== String(documento.proveedor)) {
        if (!(await ensureProveedor(body.proveedor))) {
          return res.status(400).json({ ok: false, err: { message: 'El proveedor indicado no existe' } });
        }
        documento.proveedor = body.proveedor;
      }

      if (body.fechaRemito) {
        const fecha = parseFecha(body.fechaRemito);
        if (!fecha) {
          return res.status(400).json({ ok: false, err: { message: 'La fecha del documento es inválida' } });
        }
        documento.fechaRemito = fecha;
      }

      if (Array.isArray(body.items)) {
        const items = await sanitizeItems(body.items);
        documento.items = items;
      }

      const actualizado = await documento.save();
      await actualizado.populate(populateDocumento);

      res.json({ ok: true, documento: actualizado });
    } catch (error) {
      buildErrorResponse(res, error);
    }
  })
);

module.exports = router;
