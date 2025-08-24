const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const autoIncrement = require("mongoose-auto-increment");

const AutoIncrement = require("mongoose-sequence")(mongoose);
let Schema = mongoose.Schema;

let clienteSchema = new Schema({
  codcli: {
    type: Number,
    //required: true,
    // default: 5000,
  },

  razonsocial: {
    type: String,
    required: [true, "La Razon social de la empresa/cliente es necesaria"],
  },
  domicilio: {
    type: String,
    required: [true, "El domicilio debe completarse"],
  },
  telefono: {
    type: String,
    required: [true, "El telefono debe completarse"],
  },
  cuit: {
    type: String,
    required: false,
  },
  email: {
    type: String,
    unique: false,
  },

  localidad: {
    type: Schema.Types.ObjectId,
    ref: "Localidad",
  },

  condicioniva: {
    type: Schema.Types.ObjectId,
    ref: "Tipoiva",
  },

  ruta: {
    type: Schema.Types.ObjectId,
    ref: "Ruta",
  },

  activo: {
    type: Boolean,
    default: true,
  },

  lat: {
    type: Number,
  },

  lng: {
    type: Number,
  },

  usuario: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
  },
});

clienteSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

clienteSchema.plugin(AutoIncrement, {
  inc_field: "codcli",
});

// clienteSchema.plugin(AutoIncrement.plugin, {
//   model: "Book",
//   field: "codcli",
//   startAt: 1000,
//   incrementBy: 1,
// });
// clienteSchema.plugin(AutoIncrement.plugin, {
//   model: 'Book',
//   field: 'codcli',
//   startAt: 1000,
//   incrementBy: 1
// });
module.exports = mongoose.model("Cliente", clienteSchema);
