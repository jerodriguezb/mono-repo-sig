const express = require("express");
const Ultimacomanda = require("../modelos/ultimacomanda");

const {
  verificaToken,
  verificaAdmin_role,
} = require("../middlewares/autenticacion");

const _ = require("underscore");
const app = express();

//TODAS LAS COMANDAS
app.get("/ultimacomandas", function (req, res) {
  // res.json("GET usuarios");

  let desde = req.query.desde || 0;
  desde = Number(desde);

  let limite = req.query.limite || 500;
  limite = Number(limite);

  Ultimacomanda.find()
    // .limit(limite)
    // .skip(desde)
    .sort("nrodecomanda") //ordenar alfabeticamente
    

    // .populate({
    //   path: "localidad",
    //   populate: { path: "provincia" },
    // })

    // .populate({ path: "condicioniva")
    // .populate({"localidad", "localidad codigopostal", populate:{"provincia", "provincia"}})
    // .populate("razonsocial")
    .exec((err, comandas) => {
      if (err) {
        return res.status(400).json({
          ok: false,
          err,
        });
      }

      Ultimacomanda.countDocuments({ activo: true }, (err, conteo) => {
        res.json({
          ok: true,
          comandas,
          cantidad: conteo,
        });
      });
    });
});

app.get("/ultimacomandas/:id", function (req, res) {
  // res.json("GET usuarios");

  let id = req.params.id;

  Ultimacomanda.findById(id).exec((err, comandas) => {
    if (err) {
      return res.status(400).json({
        ok: false,
        err,
      });
    }

    res.json({
      ok: true,
      comandas,
    });
  });
});




//LO COMENTADO ES CON VERIFICACION DE TOKEN
// app.post("/comandas", [verificaToken, verificaAdmin_role], function (req, res) {
app.post("/ultimacomandas", function (req, res) {
  // res.json('POST usuarios')

  let body = req.body;
  console.log(body);

  let ultimacomanda = new Ultimacomanda({
    nrodecomanda: body.nrodecomanda,
    activo: body.activo,
    // usuario: req.usuario._id,
  });

  ultimacomanda.save((err, ultimacomandaDB) => {
    console.log("ERRORRR:",err)
    if (err) {
      return res.status(400).json({
        ok: false,
        err,
        
      });
      
      
    }

 

    res.json({
      ok: true,
      ultimacomanda: ultimacomandaDB,
    });
  });
});


module.exports = app;
