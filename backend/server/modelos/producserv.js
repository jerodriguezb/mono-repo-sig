const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let tiposValidos = {
  values: ["PRODUCTO", "SERVICIO"],
  message: "{VALUE} no es tipo valido ",
};

let ivavaloresValidos = {
  values: [10.5, 21],
  min: 10.5,
  max: 21,
  message: "{VALUE} no es tipo valido ",
};

let Schema = mongoose.Schema;

let producservSchema = new Schema({
  codprod: {
    type: String,
    // unique: true,
  },
  descripcion: {
    type: String,
    required: [true, "La descripcion es necesaria"],
  },
  rubro: {
    type: Schema.Types.ObjectId,
    ref: "Rubro",
  },
  marca: {
    type: Schema.Types.ObjectId,
    ref: "Marca",
  },

  unidaddemedida: {
    type: Schema.Types.ObjectId,
    ref: "Unidaddemedida",
  },

  tipo: {
    type: String,
    enum: tiposValidos,
  },

  iva: {
    type: Number,
    enum: ivavaloresValidos,
    require: false,
  },

  stkactual: {
    type: Number,
    require: true,
  },

  activo: {
    type: Boolean,
    default: true,
  },

  // usuario: {
  //   type: Schema.Types.ObjectId,
  //   ref: "Usuario",
  // },
});

producservSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Producserv", producservSchema);
