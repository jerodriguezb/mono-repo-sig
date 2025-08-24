const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Usuario = require("../modelos/usuario");
const app = express();

app.post("/login", (req, res) => {
  let body = req.body;
  console.log(body);
  Usuario.findOne({ email: body.email }, (err, usuarioDB) => {
    if (err) {
      return res.status(500).json({
        ok: false,
        err,
      });
    }

    //si el usuario existe
    if (!usuarioDB) {
      return res.status(400).json({
        ok: false,
        err: {
          message: "Usuario incorrecto",
        },
      });
    }

    //chequear la contraseña
    if (!bcrypt.compareSync(body.password, usuarioDB.password)) {
      return res.status(400).json({
        ok: false,
        err: {
          message: "Contraseña incorrecto",
        },
      });
    }

    let token = jwt.sign({ usuario: usuarioDB }, process.env.SEED, {
      expiresIn: process.env.EXPIRACION,
    });

    //si todo esta ok
    res.json({
      ok: true,
      usuario: usuarioDB,
      token: token,
    });
  });
});

module.exports = app;
