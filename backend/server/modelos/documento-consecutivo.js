const mongoose = require('mongoose');
const Documento = require('./documento');

const { Schema } = mongoose;

const documentoConsecutivoSchema = new Schema({
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
  valor: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
}, {
  timestamps: true,
});

documentoConsecutivoSchema.index({ tipo: 1, prefijo: 1 }, { unique: true });

module.exports = mongoose.model('DocumentoConsecutivo', documentoConsecutivoSchema);
