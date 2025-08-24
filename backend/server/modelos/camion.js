const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let camionSchema = new Schema({
  camion: {
    type: String,
    required: [true, "Debe ingresar un camion"],
  },

  patente: {
    type: String,
    required: [true, "Ingrese patente valido"],
  },

  activo: {
    type: Boolean,
    default: true,
  },
});

camionSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Camion", camionSchema);
