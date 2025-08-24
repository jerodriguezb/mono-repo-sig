const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let marcaSchema = new Schema({
  codmarca: {
    type: Number,
    required: [true, "Ingrese el codigo valido"],
  },

  marca: {
    type: String,
    required: [true, "Debe ingresar una marca"],
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

marcaSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Marca", marcaSchema);
