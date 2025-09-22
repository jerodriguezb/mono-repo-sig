// rutas/documentos.js — CRUD de Remitos, Notas de Recepción y Ajustes
// ---------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const express = require('express');
const mongoose = require('mongoose');
const Documento = require('../modelos/documento');
const Proveedor = require('../modelos/proveedor');
const Producserv = require('../modelos/producserv');
const { verificaToken } = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
const toNumber = (value, def = 0) => Number(value ?? def);
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const normalizeText = (value) => value
  ? value
      .toString()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  : '';
const normalizeTipo = (tipo) => {
  const map = {
    R: 'R',
    REMITO: 'R',
    REMITOS: 'R',
    NR: 'NR',
    'NOTA DE RECEPCION': 'NR',
    'NOTA DE RECEPCION NR': 'NR',
    AJ: 'AJ',
    AJUSTE: 'AJ',
    'AJUSTE DE INVENTARIO': 'AJ',
    AJUSTES: 'AJ',
  };
  const normalized = normalizeText(tipo);
  return map[normalized] || null;
};
const normalizePrefijoInput = (prefijo) => {
  if (prefijo === undefined || prefijo === null || prefijo === '') return undefined;
  const cleaned = prefijo.toString().trim();
  if (!/^\d{1,4}$/.test(cleaned)) return null;
  return cleaned.padStart(4, '0');
};
const padSecuencia = (value) => String(value ?? 0).padStart(8, '0');
const normalizeRemitoNumber = (numero) => {
  if (numero === undefined || numero === null) return null;
  const trimmed = numero.toString().trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return padSecuencia(parsed);
};
const normalizeNotaRecepcionNumber = (numero, prefijo) => {
  if (numero === undefined || numero === null) return null;
  const trimmed = numero.toString().trim().toUpperCase();
  if (!trimmed) return null;
  const expectedPrefijo = prefijo || '0001';
  const pattern = new RegExp(`^${expectedPrefijo}NR\\d{8}$`);
  if (!pattern.test(trimmed)) return null;
  return trimmed;
};
const normalizeAjusteIncrementNumber = (numero, prefijo) => {
  if (numero === undefined || numero === null) return null;
  const trimmed = numero.toString().trim().toUpperCase();
  if (!trimmed) return null;
  const expectedPrefijo = prefijo || '0001';
  const pattern = new RegExp(`^${expectedPrefijo}AJ\\d{8}$`);
  if (!pattern.test(trimmed)) return null;
  return trimmed;
};
const isAjusteIncrementalOperacion = (operacion) => {
  if (operacion === undefined || operacion === null) return false;
  const normalized = normalizeText(operacion);
  if (!normalized) return false;
  const incrementalTokens = new Set([
    'INCREMENT',
    'INCREMENTO',
    'INCREMENTAR',
    'INCREASE',
    'SUMAR',
    'SUMA',
    'MAS',
    'MAS+',
    'AJ+',
    'AJUSTE+',
    'PLUS',
    'POSITIVE',
    'POS',
    '+',
    'ADD',
    'AGREGAR',
  ]);
  return incrementalTokens.has(normalized);
};
const AJUSTE_NEGATIVO_TOKENS = new Set([
  'AJ-',
  'AJUSTE-',
  'NEGATIVO',
  'NEGATIVE',
  'DECREMENT',
  'DECREMENTO',
  'RESTAR',
  'MENOS',
  'MINUS',
]);
const isAjusteNegativoHint = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  const normalized = normalizeText(value);
  if (!normalized) return false;
  const sanitized = normalized.replace(/–/g, '-').replace(/\s+/g, '');
  return AJUSTE_NEGATIVO_TOKENS.has(sanitized);
};
const extractNumeroDocumento = (body = {}) =>
  body.nroDocumento ?? body.numeroSugerido ?? body.numero ?? body.numeroRemito ?? null;
const badRequest = (res, message) => res.status(400).json({ ok: false, err: { message } });
const documentoPopulate = [
  {
    path: 'proveedor',
    populate: [
      { path: 'localidad', populate: { path: 'provincia' } },
      { path: 'condicioniva' },
    ],
  },
  { path: 'usuario', select: 'nombres apellidos email role' },
  { path: 'items.producto', select: 'codprod descripcion tipo iva activo' },
];
const parseItems = async (rawItems = []) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    const error = new Error('Debe incluir al menos un ítem de producto');
    error.status = 400;
    throw error;
  }
  const items = [];
  const productosIds = new Set();
  rawItems.forEach((item, index) => {
    const cantidad = Number(item?.cantidad);
    if (!Number.isFinite(cantidad) || !Number.isInteger(cantidad) || cantidad <= 0) {
      const error = new Error(`La cantidad del ítem ${index + 1} debe ser un entero positivo`);
      error.status = 400;
      throw error;
    }
    const productoId = item?.producto || item?._id;
    if (!isValidObjectId(productoId)) {
      const error = new Error(`El producto del ítem ${index + 1} es inválido`);
      error.status = 400;
      throw error;
    }
    const codprod = item?.codprod;
    if (!codprod || !codprod.toString().trim()) {
      const error = new Error(`El código de producto es obligatorio en el ítem ${index + 1}`);
      error.status = 400;
      throw error;
    }
    productosIds.add(productoId.toString());
    items.push({
      cantidad,
      producto: productoId,
      codprod: codprod.toString().trim(),
    });
  });
  const productos = await Producserv.find({ _id: { $in: [...productosIds] } })
    .select('_id')
    .lean()
    .exec();
  if (productos.length !== productosIds.size) {
    const error = new Error('Uno o más productos referenciados no existen en la base de datos');
    error.status = 400;
    throw error;
  }
  return items;
};

const aggregateItemsByProducto = (items = []) => {
  const aggregatedMap = new Map();

  items.forEach((item) => {
    const key = `${item.producto.toString()}::${item.codprod}`;
    const current = aggregatedMap.get(key);
    if (current) {
      current.cantidad += item.cantidad;
    } else {
      aggregatedMap.set(key, {
        producto: item.producto,
        codprod: item.codprod,
        cantidad: item.cantidad,
      });
    }
  });

  aggregatedMap.forEach((value) => {
    if (
      !Number.isFinite(value.cantidad) ||
      !Number.isInteger(value.cantidad) ||
      value.cantidad <= 0
    ) {
      const error = new Error(
        `La cantidad total para el producto ${value.codprod} debe ser un entero positivo`,
      );
      error.status = 400;
      throw error;
    }
  });

  return [...aggregatedMap.values()];
};

// -----------------------------------------------------------------------------
// 1. CREAR DOCUMENTO ------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post('/documentos', [verificaToken], asyncHandler(async (req, res) => {
  const body = req.body || {};
  const tipo = normalizeTipo(body.tipo);
  if (!tipo) return badRequest(res, 'Tipo de documento inválido. Use R, NR o AJ.');

  const prefijo = normalizePrefijoInput(body.prefijo);
  if (prefijo === null) return badRequest(res, 'El prefijo debe ser numérico de hasta 4 dígitos.');

  if (!body.fechaRemito) return badRequest(res, 'La fecha de remito es obligatoria.');

  const proveedorId = body.proveedor;
  if (!isValidObjectId(proveedorId)) return badRequest(res, 'Proveedor inválido.');

  const proveedor = await Proveedor.findById(proveedorId).select('_id').lean().exec();
  if (!proveedor) return badRequest(res, 'El proveedor indicado no existe.');

  const userId = req.usuario?._id;
  if (!userId) return res.status(401).json({ ok: false, err: { message: 'Usuario no autenticado' } });

  const resolvedPrefijo = prefijo || '0001';
  const numeroCrudo = extractNumeroDocumento(body);

  let remitoNumero = null;
  let notaRecepcionNumero = null;
  let ajusteIncrementNumero = null;
  let ajusteManualNumero = null;
  if (tipo === 'R') {
    remitoNumero = normalizeRemitoNumber(numeroCrudo);
    if (!remitoNumero) {
      return badRequest(res, 'El número de remito es obligatorio y debe ser un entero positivo.');
    }
  }
  if (tipo === 'NR') {
    notaRecepcionNumero = normalizeNotaRecepcionNumber(numeroCrudo, resolvedPrefijo);
    if (!notaRecepcionNumero) {
      return badRequest(
        res,
        `El número de nota de recepción es obligatorio y debe respetar el formato ${resolvedPrefijo}NR########.`,
      );
    }
  }
  const ajusteOperacionRaw = body?.ajusteOperacion ?? body?.operacionAjuste ?? body?.operacion;
  const isAjusteIncremental = tipo === 'AJ' && isAjusteIncrementalOperacion(ajusteOperacionRaw);
  const nroSugeridoRaw = body?.nroSugerido;
  const nroSugeridoProvided = nroSugeridoRaw !== undefined && nroSugeridoRaw !== null;
  if (tipo === 'AJ' && (isAjusteIncremental || nroSugeridoProvided)) {
    if (typeof nroSugeridoRaw !== 'string' || !nroSugeridoRaw.trim()) {
      const message = isAjusteIncremental
        ? 'El número sugerido es obligatorio para los ajustes positivos.'
        : 'El número sugerido debe ser un string no vacío.';
      return badRequest(res, message);
    }
    const nroSugeridoTrimmed = nroSugeridoRaw.trim();
    const nroSugeridoValidado = normalizeAjusteIncrementNumber(nroSugeridoTrimmed, resolvedPrefijo);
    if (!nroSugeridoValidado) {
      return badRequest(
        res,
        `El número sugerido para el ajuste debe respetar el formato ${resolvedPrefijo}AJ########.`,
      );
    }
    if (isAjusteIncremental) {
      ajusteIncrementNumero = nroSugeridoValidado;
    } else {
      ajusteManualNumero = nroSugeridoRaw;
    }
  }

  let items;
  try {
    items = await parseItems(body.items);
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, err: { message: error.message } });
  }

  const ajusteTipoRaw = [
    body?.ajusteTipo,
    body?.tipoAjuste,
    body?.ajusteTipoSeleccion,
    body?.ajusteTipoMarcador,
    body?.ajusteNegativo,
    body?.esAjusteNegativo,
    body?.ajusteEsNegativo,
  ].find((value) => value !== undefined);

  const marcadorDocumentoRaw = [
    body?.documentoMarca,
    body?.documentMarker,
    body?.marcaDocumento,
    body?.documentoMarcador,
    body?.documentTypeMarker,
    body?.marcador,
    body?.marker,
    body?.marca,
    body?.tipoMarcador,
    body?.tipoSeleccion,
  ].find((value) => typeof value === 'string' && value.trim());

  const marcadorDocumentoNormalizado = marcadorDocumentoRaw
    ? normalizeText(marcadorDocumentoRaw.replace(/–/g, '-'))
    : '';
  const marcadorDocumentoCompacto = marcadorDocumentoNormalizado.replace(/[\s()]/g, '');
  const marcadorAjusteNegativo = new Set(['AJUSTE-', 'AJ-']);
  // La UI moderna envía ajusteTipo: 'AJ-' para indicar que las cantidades deben persistirse en negativo,
  // pero mantenemos compatibilidad con el marcador textual usado previamente por hojas de cálculo.
  const shouldPersistNegativeItems =
    tipo === 'AJ' &&
    (isAjusteNegativoHint(ajusteTipoRaw) || marcadorAjusteNegativo.has(marcadorDocumentoCompacto));

  const itemsParaDocumento = items.map((item) => {
    const cloned = { ...item };
    if (shouldPersistNegativeItems) {
      cloned.cantidad = -Math.abs(item.cantidad);
    }
    return cloned;
  });

  let aggregatedItemsNR = [];
  if (tipo === 'NR') {
    try {
      aggregatedItemsNR = aggregateItemsByProducto(items);
    } catch (error) {
      return res.status(error.status || 500).json({ ok: false, err: { message: error.message } });
    }
  }

  const data = {
    tipo,
    proveedor: proveedorId,
    fechaRemito: body.fechaRemito,
    usuario: userId,
    items: itemsParaDocumento,
    observaciones: body.observaciones,
  };
  if (prefijo) data.prefijo = prefijo;
  if (tipo === 'R') {
    data.NrodeDocumento = `${resolvedPrefijo}${tipo}${remitoNumero}`;
  }
  if (tipo === 'NR') {
    data.NrodeDocumento = notaRecepcionNumero;
  }
  if (tipo === 'AJ') {
    if (ajusteIncrementNumero) {
      data.NrodeDocumento = ajusteIncrementNumero;
    } else if (ajusteManualNumero) {
      data.NrodeDocumento = ajusteManualNumero;
    }
  }

  if (data.NrodeDocumento) {
    const existingDocumento = await Documento.exists({
      NrodeDocumento: data.NrodeDocumento,
      activo: true,
    });
    if (existingDocumento) {
      return res.status(409).json({
        ok: false,
        err: { message: `Ya existe un documento activo con el número ${data.NrodeDocumento}.` },
      });
    }
  }

  const session = await mongoose.startSession();
  let documentoDB;
  const stockResult = { updates: [], errors: [] };

  try {
    await session.startTransaction();

    const documento = new Documento(data);
    documentoDB = await documento.save({ session });

    if (tipo === 'R') {
      for (const item of items) {
        try {
          const updatedProduct = await Producserv.findByIdAndUpdate(
            item.producto,
            { $inc: { stkactual: item.cantidad } },
            { new: true, session },
          );
          if (!updatedProduct) {
            stockResult.errors.push(`No se encontró el producto ${item.codprod} para actualizar el stock.`);
            continue;
          }
          stockResult.updates.push({
            producto: String(updatedProduct._id),
            codprod: item.codprod,
            incremento: item.cantidad,
            stkactual: Number(updatedProduct.stkactual ?? 0),
          });
        } catch (error) {
          const message = error?.message || 'operación fallida';
          stockResult.errors.push(`Error al actualizar el stock de ${item.codprod}: ${message}`);
        }
      }
    }

    if (tipo === 'AJ') {
      for (const item of items) {
        const delta = isAjusteIncremental ? item.cantidad : -item.cantidad;
        try {
          const updatedProduct = await Producserv.findByIdAndUpdate(
            item.producto,
            { $inc: { stkactual: delta } },
            { new: true, session },
          );
          if (!updatedProduct) {
            stockResult.errors.push(`No se encontró el producto ${item.codprod} para actualizar el stock.`);
            continue;
          }
          const updatePayload = {
            producto: String(updatedProduct._id),
            codprod: item.codprod,
            stkactual: Number(updatedProduct.stkactual ?? 0),
            operacion: isAjusteIncremental ? 'increment' : 'decrement',
          };
          if (isAjusteIncremental) {
            updatePayload.incremento = item.cantidad;
          } else {
            updatePayload.decremento = item.cantidad;
          }
          stockResult.updates.push(updatePayload);
        } catch (error) {
          const message = error?.message || 'operación fallida';
          stockResult.errors.push(`Error al actualizar el stock de ${item.codprod}: ${message}`);
        }
      }
    }

    if (tipo === 'NR') {
      for (const item of aggregatedItemsNR) {
        const producto = await Producserv.findOne({ _id: item.producto })
          .session(session)
          .lean();

        if (!producto) {
          const error = new Error(`El producto ${item.codprod} no existe.`);
          error.status = 400;
          throw error;
        }

        if (producto.activo !== true) {
          const error = new Error(`El producto ${item.codprod} está inactivo y no puede recibir stock.`);
          error.status = 400;
          throw error;
        }

        const updatedProduct = await Producserv.findByIdAndUpdate(
          item.producto,
          { $inc: { stkactual: item.cantidad } },
          { new: true, session },
        );

        if (!updatedProduct) {
          const error = new Error(`No se pudo actualizar el stock del producto ${item.codprod}.`);
          error.status = 500;
          throw error;
        }

        stockResult.updates.push({
          producto: String(updatedProduct._id ?? item.producto),
          codprod: item.codprod,
          incremento: item.cantidad,
          stkactual: Number(updatedProduct.stkactual ?? 0),
        });
      }
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    return res.status(error.status || 500).json({
      ok: false,
      err: { message: error?.message || 'No se pudo guardar el documento' },
    });
  } finally {
    await session.endSession();
  }

  if (!documentoDB) {
    return res.status(500).json({ ok: false, err: { message: 'No se pudo guardar el documento' } });
  }

  await documentoDB.populate(documentoPopulate);
  const documentoRespuesta = documentoDB.toObject();

  const responsePayload = { ok: true, documento: documentoRespuesta, stock: stockResult };
  res.status(201).json(responsePayload);
}));

// -----------------------------------------------------------------------------
// 2. LISTAR DOCUMENTOS ----------------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/documentos', [verificaToken], asyncHandler(async (req, res) => {
  const { desde = 0, limite = 50, tipo, proveedor, activo = 'true' } = req.query;
  const query = {};

  if (tipo) {
    const tipoNormalizado = normalizeTipo(tipo);
    if (!tipoNormalizado) return badRequest(res, 'Tipo de documento inválido en el filtro.');
    query.tipo = tipoNormalizado;
  }

  if (proveedor) {
    if (!isValidObjectId(proveedor)) return badRequest(res, 'Proveedor inválido en el filtro.');
    query.proveedor = proveedor;
  }

  if (activo !== undefined) {
    query.activo = !(activo === 'false' || activo === false);
  }

  const desdeNumber = toNumber(desde, 0);
  const limiteNumber = toNumber(limite, 50);
  const safeSkip = Number.isFinite(desdeNumber) ? Math.max(desdeNumber, 0) : 0;
  const safeLimit = Number.isFinite(limiteNumber) ? Math.max(limiteNumber, 0) : 50;

  const documentos = await Documento.find(query)
    .skip(safeSkip)
    .limit(safeLimit)
    .sort({ fechaRegistro: -1 })
    .populate(documentoPopulate)
    .lean()
    .exec();

  const cantidad = await Documento.countDocuments(query);
  res.json({ ok: true, documentos, cantidad });
}));

// -----------------------------------------------------------------------------
// 3. OBTENER DOCUMENTO POR ID ---------------------------------------------------
// -----------------------------------------------------------------------------
router.get('/documentos/:id', [verificaToken], asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return badRequest(res, 'Identificador inválido.');

  const documento = await Documento.findById(id).populate(documentoPopulate).lean().exec();
  if (!documento) return res.status(404).json({ ok: false, err: { message: 'Documento no encontrado' } });

  res.json({ ok: true, documento });
}));

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR DOCUMENTO -------------------------------------------------------
// -----------------------------------------------------------------------------
router.put('/documentos/:id', [verificaToken], asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return badRequest(res, 'Identificador inválido.');

  const documento = await Documento.findById(id).exec();
  if (!documento) return res.status(404).json({ ok: false, err: { message: 'Documento no encontrado' } });

  const body = req.body || {};

  if (body.tipo && normalizeTipo(body.tipo) !== documento.tipo) {
    return badRequest(res, 'No se permite cambiar el tipo del documento una vez creado.');
  }

  if (body.prefijo !== undefined) {
    const prefijoNormalizado = normalizePrefijoInput(body.prefijo);
    if (prefijoNormalizado === null) return badRequest(res, 'El prefijo debe ser numérico de hasta 4 dígitos.');
    if (prefijoNormalizado) documento.prefijo = prefijoNormalizado;
  }

  if (body.proveedor) {
    if (!isValidObjectId(body.proveedor)) return badRequest(res, 'Proveedor inválido.');
    const prov = await Proveedor.findById(body.proveedor).select('_id').lean().exec();
    if (!prov) return badRequest(res, 'El proveedor indicado no existe.');
    documento.proveedor = body.proveedor;
  }

  if (body.fechaRemito) {
    documento.fechaRemito = body.fechaRemito;
  }

  if (Array.isArray(body.items)) {
    let itemsActualizados;
    try {
      itemsActualizados = await parseItems(body.items);
    } catch (error) {
      return res.status(error.status || 500).json({ ok: false, err: { message: error.message } });
    }

    const marcadorDocumentoRaw = [
      body?.documentoMarca,
      body?.documentMarker,
      body?.marcaDocumento,
      body?.documentoMarcador,
      body?.documentTypeMarker,
      body?.marcador,
      body?.marker,
      body?.marca,
      body?.tipoMarcador,
      body?.tipoSeleccion,
    ].find((value) => typeof value === 'string' && value.trim());

    const marcadorDocumentoNormalizado = marcadorDocumentoRaw
      ? normalizeText(marcadorDocumentoRaw.replace(/–/g, '-'))
      : '';
    const marcadorDocumentoCompacto = marcadorDocumentoNormalizado.replace(/[\s()]/g, '');
    const marcadorAjusteNegativo = new Set(['AJUSTE-', 'AJ-']);

    const documentoTieneItemsNegativos = Array.isArray(documento.items)
      ? documento.items.some((item) => Number(item?.cantidad) < 0)
      : false;

    const shouldMantenerNegativos =
      documento.tipo === 'AJ'
      && (marcadorDocumentoCompacto
        ? marcadorAjusteNegativo.has(marcadorDocumentoCompacto)
        : documentoTieneItemsNegativos);

    const itemsNormalizados = itemsActualizados.map((item) => {
      if (!shouldMantenerNegativos) {
        return { ...item };
      }
      const cantidadNormalizada = item.cantidad < 0 ? item.cantidad : -Math.abs(item.cantidad);
      return { ...item, cantidad: cantidadNormalizada };
    });

    documento.items = itemsNormalizados;
  }

  if (body.observaciones !== undefined) {
    documento.observaciones = body.observaciones;
  }

  if (body.activo !== undefined) {
    documento.activo = !(body.activo === 'false' || body.activo === false);
  }

  const documentoDB = await documento.save();
  await documentoDB.populate(documentoPopulate);

  res.json({ ok: true, documento: documentoDB });
}));

// -----------------------------------------------------------------------------
module.exports = router;
