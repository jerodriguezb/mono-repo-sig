const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let rubroSchema = new Schema({
  codrubro: {
    type: Number,
    required: [true, "Ingrese el codigo valido"],
  },

  rubro: {
    type: String,
    required: [true, "Debe ingresar un rubro"],
  },

  activo: {
    type: Boolean,
    default: true,
  },
});

rubroSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Rubro", rubroSchema);
