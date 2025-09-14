const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const AutoIncrement = require("mongoose-sequence")(mongoose);
let Schema = mongoose.Schema;

// Subdocumento para los ítems de la comanda
const itemSchema = new Schema({
  lista: {
    type: Schema.Types.ObjectId,
    ref: "Lista",
    required: true,
  },
  codprod: {
    type: Schema.Types.ObjectId,
    ref: "Producserv",
    required: true,
  },
  cantidad: {
    type: Number,
    min: 1,
    required: true,
  },
  monto: {
    type: Number,
    required: true,
  },
  cantidadentregada: {
    type: Number,
    min: 0,
    default: 0,
    required: true,
  },
  entregado: {
    type: Boolean,
    default: false,
  }
});

const comandaSchema = new Schema({
  nrodecomanda: {
    type: Number,
    unique: true,
  },

  codcli: {
    type: Schema.Types.ObjectId,
    ref: "Cliente",
    required: true,
  },

  fecha: {
    type: Date,
    default: () => Date.now() - 3 * 60 * 60 * 1000,
  },

  codestado: {
    type: Schema.Types.ObjectId,
    ref: "Estado",
  },

  camion: {
    type: Schema.Types.ObjectId,
    ref: "Camion",
  },

  fechadeentrega: {
    type: Date,
  },

  usuario: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
  },

  camionero: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
  },

  activo: {
    type: Boolean,
    default: true,
  },

  // 💥 Arreglo de ítems de venta
  items: [itemSchema]
});

comandaSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

comandaSchema.plugin(AutoIncrement, {
  inc_field: "nrodecomanda",
});

module.exports = mongoose.model("Comanda", comandaSchema);
