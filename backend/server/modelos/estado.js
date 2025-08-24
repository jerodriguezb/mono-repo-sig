const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let estadoSchema = new Schema({
  codestado: {
    type: Number,
    required: [true, "Ingrese el codigo valido"],
  },

  estado: {
    type: String,
    required: [true, "Debe ingresar un estado"],
  },

  orden: {
    type: Number,
    required: [true, "Ingrese el orden valido"],
  },

  activo: {
    type: Boolean,
    default: true,
  },
});

estadoSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Estado", estadoSchema);
