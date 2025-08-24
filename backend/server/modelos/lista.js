const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let listaSchema = new Schema({
  codlista: {
    type: Number,
    required: [true, "Ingrese el codigo valido"],
  },

  lista: {
    type: String,
    required: [true, "Debe ingresar un lista"],
  },

  activo: {
    type: Boolean,
    default: true,
  },
});

listaSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Lista", listaSchema);
