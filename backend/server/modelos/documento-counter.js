const mongoose = require('mongoose');

const { Schema } = mongoose;

const documentoCounterSchema = new Schema({
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
  secuencia: {
    type: Number,
    default: 0,
  },
}, {
  collection: 'documento_counters',
  versionKey: false,
});

documentoCounterSchema.index({ tipo: 1, prefijo: 1 }, { unique: true });

module.exports = mongoose.model('DocumentoCounter', documentoCounterSchema);
