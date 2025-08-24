// rutas/camion.js — Preparado para Node.js v22.17.1 y Mongoose v8.16.5
// ---------------------------------------------------------------------------
const express = require('express');
const Camion = require('../modelos/camion');

const {
  verificaToken,
  verificaAdmin_role,
  verificaCam_role, // aún no usado; deja preparado para futuros endpoints
} = require('../middlewares/autenticacion');

const router = express.Router();

/**
 * Envoltura para handlers async → forward de errores a Express.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const toNumber = (v, def) => Number(v ?? def);

// -----------------------------------------------------------------------------
// 1. LISTAR CAMIONES ACTIVOS ----------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/camiones',
  asyncHandler(async (req, res) => {
    const { desde = 0, limite = 500 } = req.query;

    const query = { activo: true };

    const camiones = await Camion.find(query)
      // .skip(toNumber(desde, 0)) // descomenta si agregas paginado real
      // .limit(toNumber(limite, 500))
      .sort('camion')
      .exec();

    const cantidad = await Camion.countDocuments(query);
    res.json({ ok: true, camiones, cantidad });
  })
);

// -----------------------------------------------------------------------------
// 2. OBTENER CAMION POR ID ------------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/camiones/:id',
  asyncHandler(async (req, res) => {
    const camion = await Camion.findById(req.params.id).exec();
    if (!camion) return res.status(404).json({ ok: false, err: { message: 'Camion no encontrado' } });
    res.json({ ok: true, camion });
  })
);

// -----------------------------------------------------------------------------
// 3. CREAR CAMION ---------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post(
  '/camiones',
  // [verificaToken, verificaAdmin_role],   // activa en producción
  asyncHandler(async (req, res) => {
    const body = req.body;
    const camion = new Camion({
      camion: body.camion,
      patente: body.patente,
      activo: body.activo,
    });

    const camionDB = await camion.save();
    res.json({ ok: true, camion: camionDB });
  })
);

// -----------------------------------------------------------------------------
// 4. ACTUALIZAR CAMION ----------------------------------------------------------
// -----------------------------------------------------------------------------
router.put(
  '/camiones/:id',
  [verificaToken /*, verificaAdmin_role, verificaCam_role */],
  asyncHandler(async (req, res) => {
    const camionDB = await Camion.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).exec();

    if (!camionDB) return res.status(404).json({ ok: false, err: { message: 'Camion no encontrado' } });
    res.json({ ok: true, camion: camionDB });
  })
);

// -----------------------------------------------------------------------------
// 5. DESACTIVAR (SOFT‑DELETE) CAMION -------------------------------------------
// -----------------------------------------------------------------------------
router.delete(
  '/camiones/:id',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (req, res) => {
    const camionBorrado = await Camion.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    ).exec();

    if (!camionBorrado)
      return res.status(404).json({ ok: false, err: { message: 'Camion no encontrado' } });

    res.json({ ok: true, camion: camionBorrado });
  })
);

// -----------------------------------------------------------------------------
// EXPORTACIÓN -------------------------------------------------------------------
// -----------------------------------------------------------------------------
module.exports = router;


// const express = require("express");
// const Camion = require("../modelos/camion");

// const {
//   verificaToken,
//   verificaAdmin_role,
//   verificaCam_role,
// } = require("../middlewares/autenticacion");

// const _ = require("underscore");
// const app = express();

// app.get("/camiones", function (req, res) {
//   // res.json("GET usuarios");

//   let desde = req.query.desde || 0;
//   desde = Number(desde);

//   let limite = req.query.limite || 500;
//   limite = Number(limite);

//   Camion.find({ activo: true })
//     // .limit(limite)
//     // .skip(desde)
//     .sort("camion") //ordenar alfabeticamente
//     // .populate({
//     //   path: "localidad",
//     //   populate: { path: "provincia" },
//     // })
//     // .populate("condicioniva")

//     // .populate({ path: "condicioniva")
//     // .populate({"localidad", "localidad codigopostal", populate:{"provincia", "provincia"}})
//     // .populate("razonsocial")
//     .exec((err, camiones) => {
//       if (err) {
//         return res.status(400).json({
//           ok: false,
//           err,
//         });
//       }

//       Camion.countDocuments({ activo: true }, (err, conteo) => {
//         res.json({
//           ok: true,
//           camiones,
//           cantidad: conteo,
//         });
//       });
//     });
// });

// app.get("/camiones/:id", function (req, res) {
//   // res.json("GET usuarios");

//   let id = req.params.id;

//   Camion.findById(id).exec((err, camiones) => {
//     if (err) {
//       return res.status(400).json({
//         ok: false,
//         err,
//       });
//     }

//     res.json({
//       ok: true,
//       camiones,
//     });
//   });
// });

// //LO COMENTADO ES CON VERIFICACION DE TOKEN
// // app.post("/listas", [verificaToken, verificaAdmin_role], function (req, res) {
// app.post("/camiones", function (req, res) {
//   // res.json('POST usuarios')

//   let body = req.body;
//   console.log(body)

//   let camion = new Camion({
//     camion: body.camion,
//     patente: body.patente,
//     activo: body.activo,
//     // usuario: req.usuario._id,
//   });

//   camion.save((err, camionDB) => {
//     if (err) {
//       return res.status(400).json({
//         ok: false,
//         err,
//       });
//     }

//     res.json({
//       ok: true,
//       camion: camionDB,
//     });
//   });
// });
// app.put(
//   "/camiones/:id",
//   [verificaToken],
//   // [verificaToken, verificaAdmin_role, verificaCam_role],
//   function (req, res) {
//     // res.json("PUT usuarios");
//     let id = req.params.id;
//     let body = req.body;

//     Camion.findByIdAndUpdate(
//       id,
//       body,
//       { new: true, runValidators: true },
//       (err, camionDB) => {
//         if (err) {
//           return res.status(400).json({
//             ok: false,
//             err,
//           });
//         }
//         res.json({
//           ok: true,
//           camion: camionDB,
//         });
//       }
//     );
//   }
// );

// app.delete(
//   "/camiones/:id",
//   [verificaToken, verificaAdmin_role],
//   function (req, res) {
//     let id = req.params.id;

//     let estadoActualizado = {
//       activo: false,
//     };

//     Camion.findByIdAndUpdate(
//       id,
//       estadoActualizado,
//       { new: true },
//       (err, camionBorrado) => {
//         if (err) {
//           return res.status(400).json({
//             ok: false,
//             err,
//           });
//         }

//         if (!camionBorrado) {
//           return res.status(400).json({
//             ok: false,
//             err: {
//               message: "Camion no encontrado",
//             },
//           });
//         }

//         res.json({
//           ok: true,
//           camion: camionBorrado,
//         });
//       }
//     );
//   }
// );

// module.exports = app;
