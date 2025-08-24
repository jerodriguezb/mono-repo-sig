const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let tipoivaValidos = {
  values: [
    "RESPONSABLE INSCRIPTO",
    "MONOTRIBUTO",
    "CONSUMIDOR FINAL",
    "EXENTO",
  ],
  message: "{VALUE} no es tipo valido ",
};

let Schema = mongoose.Schema;

let tipoivaSchema = new Schema({
  codigoiva: {
    type: Number,
    min: 1,
    max: 50,
    required: [true, "Ingrese el codigo valido"],
  },

  iva: {
    type: String,
    required: [true, "Debe ingresar un tipo de Iva"],
    enum: tipoivaValidos,
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

tipoivaSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Tipoiva", tipoivaSchema);
