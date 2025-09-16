const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

const Schema = mongoose.Schema;

const documentoSchema = new Schema(
  {
    tipo: {
      type: String,
      required: true,
      trim: true,
    },
    secuencia: {
      type: Number,
    },
    descripcion: {
      type: String,
      trim: true,
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

documentoSchema.plugin(AutoIncrement, {
  id: "documento_secuencia",
  inc_field: "secuencia",
  reference_fields: ["tipo"],
});

module.exports = mongoose.model("Documento", documentoSchema);
