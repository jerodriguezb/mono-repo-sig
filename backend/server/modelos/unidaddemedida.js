const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let unidaddemedidaSchema = new Schema({
  codigomedida: {
    type: Number,
    // required: [true, "Ingrese el codigo valido"],
  },
  unidaddemedida: {
    type: String,
    // required: [true, "Debe ingresar la unidad de medida"],
  },
  activo: {
    type: Boolean,
    default: true,
  },
});

unidaddemedidaSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Unidaddemedida", unidaddemedidaSchema);
