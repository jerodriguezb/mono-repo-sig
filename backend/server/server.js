
// server.js — Compatible con Node.js v22.17.1 y Mongoose v8.16.5
// -------------------------------------------------------------------

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Carga de variables de entorno, configuraciones globales, etc.
require('./config/config');

const app = express();

// --- Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Rutas de la aplicación
app.use(require('./rutas/index'));

// --- Variables de entorno
const { URLDB, PORT = 3004 } = process.env;

// --- Función de arranque
async function startServer() {
  try {
    // Conectar a MongoDB — Mongoose 8 ya no acepta callbacks ni necesita las opciones legacy
    await mongoose.connect(URLDB);
    console.log('✅ Base de datos conectada:', URLDB);

    // Levantar el servidor SÓLO después de una conexión exitosa a la BD
    app.listen(PORT, () => {
      console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Error al conectar a la base de datos:', err);
    process.exit(1); // Finaliza el proceso si falla la conexión
  }
}

startServer();
//----
// const express = require("express");
// const cors = require("cors");

// const mongoose = require("mongoose");
// require("./config/config");

// const app = express();

// //CORS
// app.use(cors());

// // app.use(express.json())
// app.use(
//   express.urlencoded({
//     extended: true,
//   })
// );

// app.use(require("./rutas/index"));

// mongoose.connect(
//   process.env.URLDB,
//   {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     useFindAndModify: false,
//     useCreateIndex: true,
//   },
//   (err, res) => {
//     if (err) throw err;
//     console.log("Base de datos online", process.env.URLDB);
//   }
// );

// app.listen(process.env.PORT, () => {
//   console.log("Escuchando en puerto", process.env.PORT);
// });

// ------

//CODIGO EVENNODE

// var mongoPassword = "kaka8596";

// var http = require("http");
// var server = http.createServer(function (req, res) {
//   res.writeHead(200, { "Content-Type": "text/plain" });

//   //var config = JSON.parse(process.env.APP_CONFIG);
//   var MongoClient = require("mongodb").MongoClient;

//   MongoClient.connect(
//     "mongodb://" +
//       "cc40df585d057fdd63c20ed9414b027f" +
//       ":" +
//       encodeURIComponent(mongoPassword) +
//       "@" +
//       "mongodb:27018/cc40df585d057fdd63c20ed9414b027f",
//     function (err, db) {
//       if (!err) {
//         res.end("We are connected to MongoDB");
//       } else {
//         res.end("Error while connecting to MongoDB");
//       }
//     }
//   );
// });
// server.listen(process.env.PORT);
