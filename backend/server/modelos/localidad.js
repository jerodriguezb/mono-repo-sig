const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let localidadSchema = new Schema({
  localidad: {
    type: String,
    required: [true, "Debe ingresar una localidad"],
  },
  codigopostal: {
    type: Number,
    required: [true, "Ingrese el codigo postal correspondiente"],
  },

  activo: {
    type: Boolean,
    default: true,
  },

  provincia: {
    type: Schema.Types.ObjectId,
    ref: "Provincia",
  },

  //   usuario: {
  //     type: Schema.Types.ObjectId,
  //     ref: "Usuario",
  //   },
});

localidadSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Localidad", localidadSchema);
