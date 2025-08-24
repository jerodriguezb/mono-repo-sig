const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let stockSchema = new Schema({
  codprod: {
    type: Schema.Types.ObjectId,
    ref: "Producserv",
  },

  movimiento: {
    type: Schema.Types.ObjectId,
    ref: "Tipomovimiento",
  },

  cantidad: {
    type: Number,
    required: [true, "Ingrese una cantidad valida"],
  },

  fecha: {
    type: Date,
    required: [true, "Ingrese una cantidad valida"],
  },

  activo: {
    type: Boolean,
    default: true,
  },

  usuario: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
  },

  fechadecarga: {
    type: Date,
    default: () => Date.now() - 3 * 60 * 60 * 1000,
  },

});

stockSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Stock", stockSchema);
