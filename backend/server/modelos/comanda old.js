// modelos/comanda.js — Compatible con Mongoose v8.16.5 y Node.js v22.17.1
// ---------------------------------------------------------------------

const { Schema, model } = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

/**
 * Esquema Comanda
 * ----------------
 * Representa cada ítem (comanda) de la aplicación.
 *  - Todas las referencias (`ref`) apuntan a otros modelos de la carpeta `modelos`.
 *  - Se aprovechan las mejoras de Mongoose 8 (plugins, validadores y defaults).
 */
const comandaSchema = new Schema(
  {
    nrodecomanda: {
      type: Number,
      // Si en el futuro debe ser único, basta con añadir `unique:true`.
    },

    codcli: {
      type: Schema.Types.ObjectId,
      ref: 'Cliente',
    },

    lista: {
      type: Schema.Types.ObjectId,
      ref: 'Lista',
    },

    codprod: {
      type: Schema.Types.ObjectId,
      ref: 'Producserv',
    },

    cantidad: {
      type: Number,
      min: 1,
      required: [true, 'Ingrese la cantidad'],
    },

    monto: {
      type: Number,
    },

    fecha: {
      type: Date,
      // Ajuste de zona horaria (-3 h) para Argentina; usa función para evitar valor fijo.
      default: () => Date.now() - 3 * 60 * 60 * 1000,
    },

    codestado: {
      type: Schema.Types.ObjectId,
      ref: 'Estado',
    },

    camion: {
      type: Schema.Types.ObjectId,
      ref: 'Camion',
    },

    entregado: {
      type: Boolean,
      default: false,
    },

    cantidadentregada: {
      type: Number,
      min: 0,
      default: 0,
      required: [true, 'Ingrese la cantidad entregada'],
    },

    fechadeentrega: {
      type: Date,
    },

    activo: {
      type: Boolean,
      default: true,
    },

    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    },

    camionero: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    },
  },
  {
    // Añade `createdAt` y `updatedAt` automáticos (opcional pero útil)
    timestamps: true,
    versionKey: false, // elimina el campo __v
  }
);

// Plugin para mensajes de error amigables en campos únicos
comandaSchema.plugin(uniqueValidator, {
  message: '{PATH} debe ser único',
});

module.exports = model('Comanda', comandaSchema);


// const mongoose = require("mongoose");
// const uniqueValidator = require("mongoose-unique-validator");

// let Schema = mongoose.Schema;

// let comandaSchema = new Schema({
//   nrodecomanda: {
//     type: Number,
//     // required: [true, "Ingrese el codigo valido"],
//   },

//   codcli: {
//     type: Schema.Types.ObjectId,
//     ref: "Cliente",
//   },

//   lista: {
//     type: Schema.Types.ObjectId,
//     ref: "Lista",
//   },

//   codprod: {
//     type: Schema.Types.ObjectId,
//     ref: "Producserv",
//   },
  
//   cantidad: {
//     type: Number,
//     min: 1,
//     required: [true, "Ingrese la cantidad"],
//   },

//   monto: {
//     type: Number,
//   },

//   fecha: {
//     type: Date,
//     default: () => Date.now() - 3 * 60 * 60 * 1000,
//   },

//   codestado: {
//     type: Schema.Types.ObjectId,
//     ref: "Estado",
//   },

//   camion: {
//     type: Schema.Types.ObjectId,
//     ref: "Camion",
//   },


//   entregado: {
//     type: Boolean,
//     default: false,
//   },

//   cantidadentregada: {
//     type: Number,
//     min: 0,
//     default:0,
//     required: [true, "Ingrese la cantidad"],
//   },

//   fechadeentrega: {
//     type: Date,
//     // default: () => Date.now() - 3 * 60 * 60 * 1000,
//   },

//   activo: {
//     type: Boolean,
//     default: true,
//   },

//     usuario: {
//       type: Schema.Types.ObjectId,
//       ref: "Usuario",
//     },

//     camionero: {
//       type: Schema.Types.ObjectId,
//       ref: "Usuario",
//     },

// });

// comandaSchema.plugin(uniqueValidator, {
//   message: "{PATH} debe ser único",
// });

// module.exports = mongoose.model("Comanda", comandaSchema);
