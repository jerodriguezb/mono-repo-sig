const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let rutaSchema = new Schema({
  // codruta: {
  //   type: Number,
  //   required: [true, "Ingrese el codigo valido"],
  // },

  ruta: {
    type: String,
    required: [true, "Debe ingresar una ruta valida"],
  },

  activo: {
    type: Boolean,
    default: true,
  },

  //   usuario: {
  //     type: Schema.Types.ObjectId,
  //     ref: "Usuario",
  //   },
});

rutaSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Ruta", rutaSchema);
