const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let remitosSchema = new Schema({
  nroderemito: {
    type: String,
    required: [true, "Debe ingresar un nro de remito"],
  },

  fecha: {
    type: Date,
    required: [true, "Ingrese el codigo postal correspondiente"],
  },

  codprov: {
    type: Schema.Types.ObjectId,
    ref: "Proveedor",
  },

  codprod: {
    type: Schema.Types.ObjectId,
    ref: "Producserv",
  },

  cantidad: {
    type: Number,
    required: [true, "Debe ingresar una cantidad"],
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

remitosSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Remitos", remitosSchema);
