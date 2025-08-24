const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let provinciaSchema = new Schema({
  provincia: {
    type: String,
    required: [true, "Debe ingresar una provincia"],
  },
  codigoprovincia: {
    type: Number,
    required: [true, "Ingrese el codigo de provincia"],
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

provinciaSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Provincia", provinciaSchema);
