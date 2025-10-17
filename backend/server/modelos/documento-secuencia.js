const mongoose = require('mongoose');

const { Schema } = mongoose;

const documentoSecuenciaSchema = new Schema(
  {
    tipo: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    prefijo: {
      type: String,
      required: true,
      trim: true,
    },
    ultimoConfirmado: {
      type: Number,
      default: 0,
      min: 0,
    },
    actualizadoEn: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: 'documento_secuencias',
  },
);

documentoSecuenciaSchema.index({ tipo: 1, prefijo: 1 }, { unique: true });

documentoSecuenciaSchema.pre('save', function updateTimestamp(next) {
  this.actualizadoEn = new Date();
  next();
});

module.exports = mongoose.model('DocumentoSecuencia', documentoSecuenciaSchema);
