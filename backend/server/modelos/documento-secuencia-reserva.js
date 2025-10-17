const mongoose = require('mongoose');
const Documento = require('./documento');

const { Schema } = mongoose;

const documentoSecuenciaReservaSchema = new Schema({
  tipo: {
    type: String,
    required: true,
    enum: {
      values: Documento.schema.statics?.TIPOS_DOCUMENTO || ['R', 'NR', 'AJ'],
      message: 'Tipo de documento inválido',
    },
  },
  prefijo: {
    type: String,
    required: true,
    match: /^\d{4}$/,
  },
  secuencia: {
    type: Number,
    required: true,
    min: 1,
  },
  usuario: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
  },
  estado: {
    type: String,
    enum: ['reservado', 'consumido', 'liberado'],
    default: 'reservado',
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  consumidoEn: Date,
  liberadoEn: Date,
}, {
  timestamps: true,
});

documentoSecuenciaReservaSchema.index({ tipo: 1, prefijo: 1, secuencia: 1 }, { unique: true });
documentoSecuenciaReservaSchema.index(
  { tipo: 1, prefijo: 1, usuario: 1, estado: 1 },
  { unique: true, partialFilterExpression: { estado: 'reservado' } },
);
documentoSecuenciaReservaSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { estado: 'reservado' } },
);

module.exports = mongoose.model('DocumentoSecuenciaReserva', documentoSecuenciaReservaSchema);
