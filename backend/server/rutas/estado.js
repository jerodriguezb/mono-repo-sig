// rutas/estado.js — Refactor para Node.js v22.17.1 y Mongoose v8.16.5
// ---------------------------------------------------------------------------
const express = require('express');
const Estado = require('../modelos/estado');

const {
  verificaToken,
  verificaAdmin_role,
} = require('../middlewares/autenticacion');

const router = express.Router();

// -----------------------------------------------------------------------------
// Helpers ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const toNumber = (v, def) => Number(v ?? def);

// -----------------------------------------------------------------------------
// 1. LISTAR ESTADOS ACTIVOS -----------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/estados',
  asyncHandler(async (req, res) => {
    const { desde = 0, limite = 500 } = req.query;
    const query = { activo: true };

    const estados = await Estado.find(query)
      // .skip(toNumber(desde, 0))  // Descomenta si necesitas paginado
      // .limit(toNumber(limite, 500))
      .sort('orden')
      .exec();

    const cantidad = await Estado.countDocuments(query);
    res.json({ ok: true, estados, cantidad });
  })
);

// -----------------------------------------------------------------------------
// 2. OBTENER ESTADO POR ID ------------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/estados/:id',
  asyncHandler(async (req, res) => {
    const estado = await Estado.findById(req.params.id).exec();
    if (!estado) return res.status(404).json({ ok: false, err: { message: 'Estado no encontrado' } });
    res.json({ ok: true, estado });
  })
);

// -----------------------------------------------------------------------------
// 3. CREAR ESTADO ---------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post(
  '/estados',
  // [verificaToken, verificaAdmin_role], // descomenta en producción
  asyncHandler(async (req, res) => {
    const body = req.body;
    const estado = new Estado({
      codestado: body.codestado,
      estado: body.estado,
      orden: body.orden,
      activo: body.activo,
    });

    const estadoDB = await estado.save();
    res.json({ ok: true, estado: estadoDB });
  })
);

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR ESTADO ----------------------------------------------------------
// -----------------------------------------------------------------------------
router.put(
  '/estados/:id',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (req, res) => {
    const estadoDB = await Estado.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).exec();

    if (!estadoDB) return res.status(404).json({ ok: false, err: { message: 'Estado no encontrado' } });
    res.json({ ok: true, estado: estadoDB });
  })
);

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT‑DELETE) ESTADO -------------------------------------------
// -----------------------------------------------------------------------------
router.delete(
  '/estados/:id',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (req, res) => {
    const estadoActual = await Estado.findById(req.params.id).exec();

    if (!estadoActual)
      return res.status(404).json({ ok: false, err: { message: 'Estado no encontrado' } });

    const esEstadoCerrada =
      typeof estadoActual.estado === 'string' && estadoActual.estado.trim().toLowerCase() === 'cerrada';

    if (esEstadoCerrada)
      return res.status(400).json({
        ok: false,
        err: {
          message: 'No es posible eliminar el estado "Cerrada" porque implicaría volver a estados anteriores.',
        },
      });

    const estadoBorrado = await Estado.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    ).exec();

    res.json({ ok: true, estado: estadoBorrado });
  })
);

// -----------------------------------------------------------------------------
// EXPORTACIÓN -------------------------------------------------------------------
// -----------------------------------------------------------------------------
module.exports = router;

// const express = require("express");
// const Estado = require("../modelos/estado");

// const {
//   verificaToken,
//   verificaAdmin_role,
// } = require("../middlewares/autenticacion");

// const _ = require("underscore");
// const app = express();

// app.get("/estados", function (req, res) {
//   // res.json("GET usuarios");

//   let desde = req.query.desde || 0;
//   desde = Number(desde);

//   let limite = req.query.limite || 500;
//   limite = Number(limite);

//   Estado.find({ activo: true })
//     // .limit(limite)
//     // .skip(desde)
//     .sort("orden") //ordenar alfabeticamente
//     // .populate({
//     //   path: "localidad",
//     //   populate: { path: "provincia" },
//     // })
//     // .populate("condicioniva")

//     // .populate({ path: "condicioniva")
//     // .populate({"localidad", "localidad codigopostal", populate:{"provincia", "provincia"}})
//     // .populate("razonsocial")
//     .exec((err, estados) => {
//       if (err) {
//         return res.status(400).json({
//           ok: false,
//           err,
//         });
//       }

//       Estado.countDocuments({ activo: true }, (err, conteo) => {
//         res.json({
//           ok: true,
//           estados,
//           cantidad: conteo,
//         });
//       });
//     });
// });

// app.get("/estados/:id", function (req, res) {
//   // res.json("GET usuarios");

//   let id = req.params.id;

//   Estado.findById(id).exec((err, estados) => {
//     if (err) {
//       return res.status(400).json({
//         ok: false,
//         err,
//       });
//     }

//     res.json({
//       ok: true,
//       estados,
//     });
//   });
// });

// //LO COMENTADO ES CON VERIFICACION DE TOKEN
// // app.post("/listas", [verificaToken, verificaAdmin_role], function (req, res) {
// app.post("/estados", function (req, res) {
//   // res.json('POST usuarios')

//   let body = req.body;
//   console.log(body)

//   let estado = new Estado({
//     codestado: body.codestado,
//     estado: body.estado,
//     orden: body.orden,
//     activo: body.activo,
//     // usuario: req.usuario._id,
//   });

//   estado.save((err, estadoDB) => {
//     if (err) {
//       return res.status(400).json({
//         ok: false,
//         err,
//       });
//     }

//     res.json({
//       ok: true,
//       estado: estadoDB,
//     });
//   });
// });
// app.put(
//   "/estados/:id",
//   [verificaToken, verificaAdmin_role],
//   function (req, res) {
//     // res.json("PUT usuarios");
//     let id = req.params.id;
//     let body = req.body;

//     Estado.findByIdAndUpdate(
//       id,
//       body,
//       { new: true, runValidators: true },
//       (err, estadoDB) => {
//         if (err) {
//           return res.status(400).json({
//             ok: false,
//             err,
//           });
//         }
//         res.json({
//           ok: true,
//           estado: estadoDB,
//         });
//       }
//     );
//   }
// );

// app.delete(
//   "/estados/:id",
//   [verificaToken, verificaAdmin_role],
//   function (req, res) {
//     let id = req.params.id;

//     let estadoActualizado = {
//       activo: false,
//     };

//     Estado.findByIdAndUpdate(
//       id,
//       estadoActualizado,
//       { new: true },
//       (err, estadoBorrado) => {
//         if (err) {
//           return res.status(400).json({
//             ok: false,
//             err,
//           });
//         }

//         if (!estadoBorrado) {
//           return res.status(400).json({
//             ok: false,
//             err: {
//               message: "Estado no encontrada",
//             },
//           });
//         }

//         res.json({
//           ok: true,
//           estado: estadoBorrado,
//         });
//       }
//     );
//   }
// );

// module.exports = app;
