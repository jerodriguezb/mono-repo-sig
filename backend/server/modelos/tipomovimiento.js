const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

// let factoresValidos = {
//   values: [1, -1],
//   message: "{VALUE} no es tipo valido ",
// };

let movimientosValidos = {
  values: ["COMPRA", "VENTA", "DEVOLUCION", "AJUSTE+", "AJUSTE-"],
  message: "{VALUE} no es tipo valido ",
};

let Schema = mongoose.Schema;

let tipomovimientoSchema = new Schema({
  codmov: {
    type: Number,
    required: [true, "Ingrese el codigo valido"],
  },

  movimiento: {
    type: String,
    enum: movimientosValidos,
  },

  factor: {
    type: Number,
    // enum: factoresValidos,
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

tipomovimientoSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Tipomovimiento", tipomovimientoSchema);
