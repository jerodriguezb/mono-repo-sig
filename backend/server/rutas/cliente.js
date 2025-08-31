// rutas/cliente.js — Actualizado para Node.js 22.17.1 y Mongoose 8.16.5
// ---------------------------------------------------------------------------
const express = require('express');
const Cliente = require('../modelos/cliente');

const {
  verificaToken,
  verificaAdmin_role,
} = require('../middlewares/autenticacion');

const router = express.Router();

/* helper async → evita try/catch repetitivo */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* ---------------------------------------------------------------------------
   1. LISTAR CLIENTES - Paginación + Filtros en Servidor
--------------------------------------------------------------------------- */
router.get(
  '/clientes',
  asyncHandler(async (req, res) => {
    /* paginación --------------------------------------------------------- */
    const limit = parseInt(req.query.limit, 10) || 10;        // default 10
    const page  = parseInt(req.query.page, 10)  || 1;         // 1-based
    const skip  = (page - 1) * limit;

    /* filtros ------------------------------------------------------------ */
    const q = {};

    // Razón social
    if (req.query['filter[razonsocial]'])
      q.razonsocial = {
        $regex: req.query['filter[razonsocial]'],
        $options: 'i',
      };

    // Domicilio
    if (req.query['filter[domicilio]'])
      q.domicilio = {
        $regex: req.query['filter[domicilio]'],
        $options: 'i',
      };

    // Teléfono
    if (req.query['filter[telefono]'])
      q.telefono = {
        $regex: req.query['filter[telefono]'],
        $options: 'i',
      };

    // Email
    if (req.query['filter[email]'])
      q.email = {
        $regex: req.query['filter[email]'],
        $options: 'i',
      };

    // CUIT
    if (req.query['filter[cuit]'])
      q.cuit = {
        $regex: req.query['filter[cuit]'],
        $options: 'i',
      };

    // Localidad (nombre)
    if (req.query['filter[localidadNombre]'])
      q['localidad.localidad'] = {
        $regex: req.query['filter[localidadNombre]'],
        $options: 'i',
      };

    // Ruta (nombre)
    if (req.query['filter[rutaNombre]'])
      q['ruta.ruta'] = {
        $regex: req.query['filter[rutaNombre]'],
        $options: 'i',
      };

    // Quick Filter global
    if (req.query['filter[global]']) {
      const g = req.query['filter[global]'];
      q.$or = [
        { razonsocial:           { $regex: g, $options: 'i' } },
        { domicilio:             { $regex: g, $options: 'i' } },
        { telefono:              { $regex: g, $options: 'i' } },
        { email:                 { $regex: g, $options: 'i' } },
        { cuit:                  { $regex: g, $options: 'i' } },
        { 'localidad.localidad': { $regex: g, $options: 'i' } },
        { 'ruta.ruta':           { $regex: g, $options: 'i' } },
      ];
    }

    /* aggregation: join → match → facet ------------------------------- */
    const agg = await Cliente.aggregate([
      // join localidad
      { $lookup: {
          from: 'localidads',
          localField: 'localidad',
          foreignField: '_id',
          as: 'localidad',
      }},
      { $unwind: { path: '$localidad', preserveNullAndEmptyArrays: true } },

      // join ruta
      { $lookup: {
          from: 'rutas',
          localField: 'ruta',
          foreignField: '_id',
          as: 'ruta',
      }},
      { $unwind: { path: '$ruta', preserveNullAndEmptyArrays: true } },

      // aplicar filtros
      { $match: q },

      // total + paginado
      { $facet: {
          total: [ { $count: 'count' } ],
          data:  [ { $skip: skip }, { $limit: limit } ],
      }},
      { $unwind: { path: '$total', preserveNullAndEmptyArrays: true } },
      { $project: {
          total: { $ifNull: [ '$total.count', 0 ] },
          clientes: '$data',
      }},
    ]);

    const { total = 0, clientes = [] } = agg[0] || {};

    res.json({
      ok: true,
      clientes,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  })
);

/* ---------------------------------------------------------------------------
   2. BUSCAR CLIENTES POR NOMBRE (sin cambios)
--------------------------------------------------------------------------- */
router.get(
  '/clientes/buscar',
  asyncHandler(async (req, res) => {
    const { nombre } = req.query;
    if (!nombre)
      return res.status(400).json({ ok: false, error: 'Debe proporcionar un nombre' });

    const clientes = await Cliente.find({ razonsocial: { $regex: nombre, $options: 'i' } })
      .limit(50)
      .sort('razonsocial')
      .populate({ path: 'localidad', populate: { path: 'provincia' } })
      .populate('condicioniva')
      .populate('ruta')
      .exec();

    res.json({ ok: true, clientes });
  })
);

/* ---------------------------------------------------------------------------
   2.a AUTOCOMPLETE CLIENTES POR NOMBRE
--------------------------------------------------------------------------- */
router.get(
  '/clientes/autocomplete',
  asyncHandler(async (req, res) => {
    const { term = '' } = req.query;
    if (term.length < 3)
      return res.status(400).json({ ok: false, error: 'El término debe tener al menos 3 caracteres' });

    const clientes = await Cliente.find({ razonsocial: { $regex: term, $options: 'i' } })
      .limit(20)
      .sort('razonsocial')
      .select('_id razonsocial cuit')
      .exec();

    res.json({ ok: true, clientes });
  })
);

/* ---------------------------------------------------------------------------
   3. OBTENER CLIENTE POR ID (sin cambios)
--------------------------------------------------------------------------- */
router.get(
  '/clientes/:id',
  asyncHandler(async (req, res) => {
    const cliente = await Cliente.findById(req.params.id)
      .populate({ path: 'localidad', populate: { path: 'provincia' } })
      .populate('condicioniva')
      .populate('ruta')
      .exec();

    if (!cliente)
      return res.status(404).json({ ok: false, err: { message: 'Cliente no encontrado' } });

    res.json({ ok: true, cliente });
  })
);

/* ---------------------------------------------------------------------------
   4. CREAR CLIENTE  (sin cambios)
--------------------------------------------------------------------------- */
router.post(
  '/clientes',
  asyncHandler(async (req, res) => {
    const body = req.body;
    const cliente = new Cliente({
      codcli:       body.codcli,
      razonsocial:  body.razonsocial,
      domicilio:    body.domicilio,
      telefono:     body.telefono,
      cuit:         body.cuit,
      email:        body.email,
      localidad:    body.localidad,
      condicioniva: body.condicioniva,
      ruta:         body.ruta,
      lat:          body.lat,
      lng:          body.lng,
      activo:       body.activo,
    });

    const clienteDB = await cliente.save();
    res.json({ ok: true, cliente: clienteDB });
  })
);

/* ---------------------------------------------------------------------------
   5. ACTUALIZAR CLIENTE  (sin cambios principales)
--------------------------------------------------------------------------- */
router.put(
  '/clientes/:id',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (req, res) => {
    const clienteDB = await Cliente.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).exec();

    if (!clienteDB)
      return res.status(404).json({ ok: false, err: { message: 'Cliente no encontrado' } });

    res.json({ ok: true, cliente: clienteDB });
  })
);

/* ---------------------------------------------------------------------------
   6. DESACTIVAR (Soft-Delete) CLIENTE  (sin cambios)
--------------------------------------------------------------------------- */
router.delete(
  '/clientes/:id',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (req, res) => {
    const clienteBorrado = await Cliente.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    ).exec();

    if (!clienteBorrado)
      return res.status(404).json({ ok: false, err: { message: 'Cliente no encontrado' } });

    res.json({ ok: true, cliente: clienteBorrado });
  })
);

module.exports = router;