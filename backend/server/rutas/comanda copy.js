// rutas/comanda.js — Compatible con Node.js v22.17.1 y Mongoose v8.16.5
// ---------------------------------------------------------------------------
// Todas las rutas relativas al recurso «Comanda».
// Se usa async/await + un wrapper para capturar errores y enviarlos al middleware
// de Express sin repetir try/catch en cada handler.

const express = require('express');
const _ = require('underscore');
const Comanda = require('../modelos/comanda');

const {
  verificaToken,
  verificaAdmin_role,
  verificaCam_role,
  verificaAdminCam_role,
  verificaAdminPrev_role,
} = require('../middlewares/autenticacion');

const router = express.Router();

/**
 * Helper: captura excepciones en handlers async y pasa al error‑handler de Express.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Transform util: convierte strings a número con un default.
 */
const toNumber = (value, def) => Number(value ?? def);

// -----------------------------------------------------------------------------
// 1. OBTENER TODAS LAS COMANDAS -------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/comandas',
  asyncHandler(async (req, res) => {
    const { desde = 0, limite = 500 } = req.query;

    const comandas = await Comanda.find()
      // .skip(toNumber(desde, 0))
      // .limit(toNumber(limite, 500))
      .sort('nrodecomanda')
      .populate('codcli')
      .populate('lista')
      .populate('codestado')
      .populate('camion')
      .populate({ path: 'codprod', populate: [{ path: 'marca' }, { path: 'unidaddemedida' }] })
      .exec();

    const cantidad = await Comanda.countDocuments({ activo: true });

    res.json({ ok: true, comandas, cantidad });
  })
);

// -----------------------------------------------------------------------------
// 2. COMANDAS ACTIVAS -----------------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/comandasactivas',
  asyncHandler(async (req, res) => {
    const { limite = 700 } = req.query;

    const query = { activo: true };

    const comandas = await Comanda.find(query)
      .limit(toNumber(limite, 700))
      .sort({ nrodecomanda: -1 })
      .populate({ path: 'codcli', select: 'codcli razonsocial localidad', populate: 'ruta' })
      .populate('lista')
      .populate('codestado', 'codestado estado')
      .populate('camion', 'camion')
      .populate('usuario', 'role nombres apellidos')
      .populate('camionero', 'role nombres apellidos')
      .populate({ path: 'codprod', populate: [{ path: 'marca' }, { path: 'unidaddemedida' }] })
      .exec();

    const cantidad = await Comanda.countDocuments(query);
    res.json({ ok: true, comandas, cantidad });
  })
);

// -----------------------------------------------------------------------------
// 3. COMANDAS PARA PREVENTISTA --------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/comandasprev',
  asyncHandler(async (_req, res) => {
    const query = { activo: true };

    const comandas = await Comanda.find(query)
      .sort({ nrodecomanda: -1 })
      .populate({ path: 'codcli', populate: 'ruta' })
      .populate('lista')
      .populate('codestado')
      .populate('camion')
      .populate('camionero')
      .populate({ path: 'codprod', populate: [{ path: 'marca' }, { path: 'unidaddemedida' }] })
      .exec();

    const cantidad = await Comanda.countDocuments(query);
    res.json({ ok: true, comandas, cantidad });
  })
);

// -----------------------------------------------------------------------------
// 4. COMANDAS "A PREPARAR" -----------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/comandasapreparar',
  asyncHandler(async (_req, res) => {
    const ESTADO_A_PREPARAR = '62200265c811f41820d8bda9';
    const query = { activo: true, codestado: ESTADO_A_PREPARAR };

    const comandas = await Comanda.find(query)
      .sort('nrodecomanda')
      .populate({ path: 'codcli', populate: 'ruta' })
      .populate({ path: 'codprod', populate: 'rubro' })
      .populate('lista')
      .populate('codestado')
      .populate('camion')
      .populate('usuario')
      .exec();

    const cantidad = await Comanda.countDocuments(query);
    res.json({ ok: true, comandas, cantidad });
  })
);

// -----------------------------------------------------------------------------
// 5. COMANDAS PREPARADAS --------------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/comandaspreparadas',
  asyncHandler(async (req, res) => {
    const { limite = 1000 } = req.query;
    const ESTADOS = ['622002eac811f41820d8bdab', '6231174f962c72253b6fb6bd'];
    const query = { activo: true, codestado: { $in: ESTADOS } };

    const comandas = await Comanda.find(query)
      .limit(toNumber(limite, 1000))
      .sort('nrodecomanda')
      .populate('codcli')
      .populate('lista')
      .populate('codestado')
      .populate('camion')
      .populate('usuario')
      .populate({ path: 'codprod', populate: [{ path: 'marca' }, { path: 'unidaddemedida' }] })
      .exec();

    const cantidad = await Comanda.countDocuments(query);
    res.json({ ok: true, comandas, cantidad });
  })
);

// -----------------------------------------------------------------------------
// 6. COMANDA POR ID -------------------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/comandas/:id',
  asyncHandler(async (req, res) => {
    const comanda = await Comanda.findById(req.params.id).exec();
    if (!comanda) return res.status(404).json({ ok: false, err: { message: 'Comanda no encontrada' } });
    res.json({ ok: true, comanda });
  })
);

// -----------------------------------------------------------------------------
// 7. FILTRAR POR RANGO DE FECHAS ------------------------------------------------
// -----------------------------------------------------------------------------
router.get(
  '/comandasnro',
  asyncHandler(async (req, res) => {
    const { fechaDesde, fechaHasta } = req.query;

    const comandas = await Comanda.find({
      activo: true,
      fecha: { $gte: fechaDesde, $lte: fechaHasta },
    })
      .sort({ nrodecomanda: -1 })
      .populate({ path: 'codcli', populate: 'ruta' })
      .populate('lista')
      .populate('codestado')
      .populate('camion')
      .populate('usuario')
      .populate('camionero')
      .populate({ path: 'codprod', populate: [{ path: 'marca' }, { path: 'unidaddemedida' }] })
      .exec();

    res.json({ ok: true, comandas });
  })
);

// Informe (con poblados y select específicos)
router.get(
  '/comandasinformes',
  asyncHandler(async (req, res) => {
    const { fechaDesde, fechaHasta, limite = 1000 } = req.query;

    const comandas = await Comanda.find({
      activo: true,
      fecha: { $gte: fechaDesde, $lte: fechaHasta },
    })
      .limit(toNumber(limite, 1000))
      .sort({ nrodecomanda: -1 })
      .populate({ path: 'codcli', select: 'codcli razonsocial localidad', populate: 'ruta' })
      .populate('lista')
      .populate('codestado', 'codestado estado')
      .populate('camion', 'camion')
      .populate('usuario', 'role nombres apellidos')
      .populate('camionero', 'role nombres apellidos')
      .populate({ path: 'codprod', populate: [{ path: 'marca' }, { path: 'unidaddemedida' }] })
      .exec();

    res.json({ ok: true, comandas });
  })
);

// -----------------------------------------------------------------------------
// 8. CREAR COMANDA --------------------------------------------------------------
// -----------------------------------------------------------------------------
router.post(
  '/comandas',
  [verificaToken, verificaAdminPrev_role],
  asyncHandler(async (req, res) => {
    const body = req.body;
    const comanda = new Comanda({
      nrodecomanda: body.nrodecomanda,
      codcli: body.codcli,
      lista: body.lista,
      codprod: body.codprod,
      cantidad: body.cantidad,
      monto: body.monto,
      codestado: body.codestado,
      camion: body.camion,
      entregado: body.entregado,
      cantidadentregada: body.cantidadentregada,
      fechadeentrega: body.fechadeentrega,
      activo: body.activo,
      usuario: body.usuario,
      camionero: body.camionero,
    });

    const comandaDB = await comanda.save();
    res.json({ ok: true, comanda: comandaDB });
  })
);

// -----------------------------------------------------------------------------
// 9. ACTUALIZAR COMANDA ---------------------------------------------------------
// -----------------------------------------------------------------------------
router.put(
  '/comandas/:id',
  [verificaToken, verificaAdminCam_role],
  asyncHandler(async (req, res) => {
    const comandaDB = await Comanda.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).exec();

    if (!comandaDB) return res.status(404).json({ ok: false, err: { message: 'Comanda no encontrada' } });
    res.json({ ok: true, comanda: comandaDB });
  })
);

// -----------------------------------------------------------------------------
// 10. DESACTIVAR (SOFT‑DELETE) COMANDA -----------------------------------------
// -----------------------------------------------------------------------------
router.delete(
  '/comandas/:id',
  [verificaToken, verificaAdmin_role],
  asyncHandler(async (req, res) => {
    const comandaBorrada = await Comanda.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    ).exec();

    if (!comandaBorrada)
      return res.status(404).json({ ok: false, err: { message: 'Comanda no encontrada' } });

    res.json({ ok: true, comanda: comandaBorrada });
  })
);

// -----------------------------------------------------------------------------
// EXPORTACIÓN -------------------------------------------------------------------
// -----------------------------------------------------------------------------
module.exports = router;

// const express = require("express");
// const Comanda = require("../modelos/comanda");

// const {
//   verificaToken,
//   verificaAdmin_role,
//   verificaCam_role,
//   verificaAdminCam_role,
//   verificaAdminPrev_role,
// } = require("../middlewares/autenticacion");

// const _ = require("underscore");
// const app = express();

// //TODAS LAS COMANDAS
// app.get("/comandas", function (req, res) {
//   // res.json("GET usuarios");

//   let desde = req.query.desde || 0;
//   desde = Number(desde);

//   let limite = req.query.limite || 500;
//   limite = Number(limite);

//   Comanda.find()
//     // .limit(limite)
//     // .skip(desde)
//     .sort("nrodecomanda") //ordenar alfabeticamente
//     .populate("codcli")
//     .populate("lista")
//     .populate("codestado")
//     .populate("camion")
//     // .populate("usuario")
//     .populate({
//       path: "codprod",
//       populate: "marca",
//       populate: "unidaddemedida",
//     })

//     // .populate({
//     //   path: "localidad",
//     //   populate: { path: "provincia" },
//     // })

//     // .populate({ path: "condicioniva")
//     // .populate({"localidad", "localidad codigopostal", populate:{"provincia", "provincia"}})
//     // .populate("razonsocial")
//     .exec((err, comandas) => {
//       if (err) {
//         return res.status(400).json({
//           ok: false,
//           err,
//         });
//       }

//       Comanda.countDocuments({ activo: true }, (err, conteo) => {
//         res.json({
//           ok: true,
//           comandas,
//           cantidad: conteo,
//         });
//       });
//     });
// });

// //SOLO COMANDAS ACTIVAS
// app.get("/comandasactivas", function (req, res) {
//   // res.json("GET usuarios");
//   let desde = req.query.desde || 0;
//   desde = Number(desde);

//   let limite = req.query.limite || 700;
//   limite = Number(limite);

//   Comanda.find({ activo: true })
//     .limit(limite)
//     // .skip(desde)
//     .sort({ nrodecomanda: -1 }) // -1 orden desc
//     .populate({ path: "codcli", select: 'codcli razonsocial localidad' , populate: "ruta" })
//     .populate("lista")
//     .populate("codestado", "codestado estado")
//     .populate("camion", "camion")
//     .populate("usuario" , "role nombres apellidos")
//     .populate("camionero", "role nombres apellidos")

//     .populate({
//       path: "codprod", 
//       populate: "marca",
//       populate: "unidaddemedida",
//     })

//     // .populate({
//     //   path: "localidad",
//     //   populate: { path: "provincia" },
//     // })

//     // .populate({ path: "condicioniva")
//     // .populate({"localidad", "localidad codigopostal", populate:{"provincia", "provincia"}})
//     // .populate("razonsocial")
//     .exec((err, comandas) => {
//       if (err) {
//         return res.status(400).json({
//           ok: false,
//           err,
//         });
//       }

//        Comanda.countDocuments({ activo: true }, (err, conteo) => {
//          res.json({
//            ok: true,
//           comandas,
//           cantidad: conteo,
//          });
//        });
//     });
// });

// //SOLO COMANDAS PREVENTISTA
// app.get("/comandasprev", function (req, res) {
//   // res.json("GET usuarios");

//   Comanda.find({ activo: true })
//     // .limit(limite)
//     // .skip(desde)
//     .sort({ nrodecomanda: -1 }) // -1 orden desc
//     .populate({ path: "codcli", populate: "ruta" })
//     .populate("lista")
//     .populate("codestado")
//     .populate("camion")
//     .populate("camionero")

//     .populate({
//       path: "codprod",
//       populate: "marca",
//       populate: "unidaddemedida",
//     })

//     // .populate({
//     //   path: "localidad",
//     //   populate: { path: "provincia" },
//     // })

//     // .populate({ path: "condicioniva")
//     // .populate({"localidad", "localidad codigopostal", populate:{"provincia", "provincia"}})
//     // .populate("razonsocial")
//     .exec((err, comandas) => {
//       if (err) {
//         return res.status(400).json({
//           ok: false,
//           err,
//         });
//       }

//       Comanda.countDocuments({ activo: true }, (err, conteo) => {
//         res.json({
//           ok: true,
//           comandas,
//           cantidad: conteo,
//         });
//       });
//     });
// });

// app.get("/comandasapreparar", function (req, res) {
//   // res.json("GET usuarios");
//   // cod estado pertenece al estado A PREPARAR
//   Comanda.find({ activo: true, codestado: "62200265c811f41820d8bda9" })
//     // .limit(limite)
//     // .skip(desde)
//     .sort("nrodecomanda") //ordenar alfabeticamente
//     .populate({ path: "codcli", populate: "ruta" })
//     .populate({ path: "codprod", populate: "rubro" })
//     .populate("lista")
//     .populate("codestado")
//     .populate("camion")
//     .populate("usuario")
    

//     .exec((err, comandas) => {
//       if (err) {
//         return res.status(400).json({
//           ok: false,
//           err,
//         });
//       }

//       Comanda.countDocuments(
//         { activo: true, codestado: "62200265c811f41820d8bda9" },
//         (err, conteo) => {
//           res.json({
//             ok: true,
//             comandas,
//             cantidad: conteo,
//           });
//         }
//       );
//     });
// });

// app.get("/comandaspreparadas", function (req, res) {
//   // res.json("GET usuarios");
//   // cod estado pertenece al estado EN DISTRIBUCION y otro ENTREGADA
//   let desde = req.query.desde || 0;
//   desde = Number(desde);

//   let limite = req.query.limite || 1000;
//   limite = Number(limite);

//   Comanda.find({
//     activo: true,
//     codestado: {
//       $in: ["622002eac811f41820d8bdab", "6231174f962c72253b6fb6bd"],
//     },
//   })
//     .limit(limite)
//     // .skip(desde)
//     .sort("nrodecomanda") //ordenar alfabeticamente
//     .populate("codcli")
//     .populate("lista")
//     .populate("codestado")
//     .populate("camion")
//     .populate("usuario")
//     .populate({
//       path: "codprod",
//       populate: "marca",
//       populate: "unidaddemedida",
//     })

//     // .populate({
//     //   path: "localidad",
//     //   populate: { path: "provincia" },
//     // })

//     // .populate({ path: "condicioniva")
//     // .populate({"localidad", "localidad codigopostal", populate:{"provincia", "provincia"}})
//     // .populate("razonsocial")
//     .exec((err, comandas) => {
//       if (err) {
//         return res.status(400).json({
//           ok: false,
//           err,
//         });
//       }

//       Comanda.countDocuments(
//         {
//           activo: true,
//           codestado: {
//             $in: ["622002eac811f41820d8bdab", "6231174f962c72253b6fb6bd"],
//           },
//         },
//         (err, conteo) => {
//           res.json({
//             ok: true,
//             comandas,
//             cantidad: conteo,
//           });
//         }
//       );
//     });
// });

// app.get("/comandas/:id", function (req, res) {
//   // res.json("GET usuarios");

//   let id = req.params.id;

//   Comanda.findById(id).exec((err, comandas) => {
//     if (err) {
//       return res.status(400).json({
//         ok: false,
//         err,
//       });
//     }

//     res.json({
//       ok: true,
//       comandas,
//     });
//   });
// });

// // by Other fileds
// //
// app.get("/comandasnro", function (req, res) {
//   // res.json("GET usuarios");
//   let desde = req.query.desde || 0;
//   desde = Number(desde);

//   let limite = req.query.limite || 50;
//   limite = Number(limite);

//   // let nrodecomanda = req.query.nrodecomanda;
//   console.log(req.query);
//   // console.log(nrodecomanda);
//    // Comanda.find({fecha: { $gte: '2022-08-03T21:14:24.896Z' , $lte: '2022-08-07T21:14:24.896Z' }})
//   let fechaDesde=req.query.fechaDesde;
//   let fechaHasta=req.query.fechaHasta;
//   console.log(fechaDesde);
//   console.log(fechaHasta);
//   Comanda.find({fecha: { $gte: fechaDesde , $lte: fechaHasta }})
//   // Comanda.find(req.query)
//   .find ({activo:true})
//   .sort({ nrodecomanda: -1 }) // -1 orden desc
//     .populate({ path: "codcli", populate: "ruta" })
//     .populate("lista")
//     .populate("codestado")
//     .populate("camion")
//     .populate("usuario")
//     .populate("camionero")

//     .populate({
//       path: "codprod",
//       populate: "marca",
//       populate: "unidaddemedida",
//     })
//   // .limit(limite)
//   .exec((err, comandas) => {
//     if (err) {
//       return res.status(400).json({
//         ok: false,
//         err,
//       });
//     }

//     res.json({
//       ok: true,
//       comandas,
//     });
//     // console.log("hola",res);
//   });
// });


// app.get("/comandasinformes", function (req, res) {
//   // res.json("GET usuarios");
//   let desde = req.query.desde || 0;
//   desde = Number(desde);

//   let limite = req.query.limite || 1000;
//   limite = Number(limite);

//   // let nrodecomanda = req.query.nrodecomanda;
//   console.log(req.query);
//   // console.log(nrodecomanda);
//    // Comanda.find({fecha: { $gte: '2022-08-03T21:14:24.896Z' , $lte: '2022-08-07T21:14:24.896Z' }})
//   let fechaDesde=req.query.fechaDesde;
//   let fechaHasta=req.query.fechaHasta;
//   console.log(fechaDesde);
//   console.log(fechaHasta);
//   Comanda.find({fecha: { $gte: fechaDesde , $lte: fechaHasta }})
//   // Comanda.find(req.query)
//   .find ({activo:true})
//   .sort({ nrodecomanda: -1 }) // -1 orden desc
//     .populate({ path: "codcli", select: 'codcli razonsocial localidad' , populate: "ruta" })
//     .populate("lista")
//     .populate("codestado", "codestado estado")
//     .populate("camion", "camion")
//     .populate("usuario" , "role nombres apellidos")
//     .populate("camionero", "role nombres apellidos")

//     .populate({
//       path: "codprod", 
//       populate: "marca",
//       populate: "unidaddemedida",
//     })
//   .limit(limite)
//   .exec((err, comandas) => {
//     if (err) {
//       return res.status(400).json({
//         ok: false,
//         err,
//       });
//     }

//     res.json({
//       ok: true,
//       comandas,
//     });
//     // console.log("hola",res);
//   });
// });


// //LO COMENTADO ES CON VERIFICACION DE TOKEN
// app.post("/comandas", [verificaToken, verificaAdminPrev_role], function (req, res) {
// // app.post("/comandas", function (req, res) {
//   // res.json('POST usuarios')

//   let body = req.body;
//   console.log(body);

//   let comanda = new Comanda({
//     nrodecomanda: body.nrodecomanda,
//     codcli: body.codcli,
//     lista: body.lista,
//     codprod: body.codprod,
//     cantidad: body.cantidad,
//     monto: body.monto,
//     codestado: body.codestado,
//     camion: body.camion,
//     entregado: body.entregado,
//     cantidadentregada: body.cantidadentregada,
//     fechadeentrega: body.fechadeentrega,
//     activo: body.activo,
//     usuario: body.usuario,
//     camionero: body.camionero,

//     // usuario: req.usuario._id,
//   });

//   comanda.save((err, comandaDB) => {
//     console.log("POST Comanda", err);
//     if (err) {
//       return res.status(400).json({
//         ok: false,
//         err,
//       });
//     }

//     res.json({
//       ok: true,
//       comanda: comandaDB,
//     });
//   });
// });
// app.put(
//   "/comandas/:id",
//   [verificaToken, verificaAdminCam_role],
//   // [verificaToken, verificaAdmin_role, verificaCam_role],
//   // [verificaToken, verificaAdmin_role],
//   function (req, res) {
//     // res.json("PUT usuarios");
//     let id = req.params.id;
//     let body = req.body;

//     Comanda.findByIdAndUpdate(
//       id,
//       body,
//       { new: true, runValidators: true },
//       (err, comandaDB) => {
//         if (err) {
//           return res.status(400).json({
//             ok: false,
//             err,
//           });
//         }
//         res.json({
//           ok: true,
//           comanda: comandaDB,
//         });
//       }
//     );
//   }
// );

// app.delete(
//   "/comandas/:id",
//   [verificaToken, verificaAdmin_role],
//   function (req, res) {
//     let id = req.params.id;

//     let estadoActualizado = {
//       activo: false,
//     };

//     Comanda.findByIdAndUpdate(
//       id,
//       estadoActualizado,
//       { new: true },
//       (err, comandaBorrado) => {
//         if (err) {
//           return res.status(400).json({
//             ok: false,
//             err,
//           });
//         }

//         if (!comandaBorrado) {
//           return res.status(400).json({
//             ok: false,
//             err: {
//               message: "Comanda no encontrada",
//             },
//           });
//         }

//         res.json({
//           ok: true,
//           comanda: comandaBorrado,
//         });
//       }
//     );
//   }
// );

// module.exports = app;
