const mongoose = require('mongoose');

const { Schema } = mongoose;

const documentoNumeroReservaSchema = new Schema(
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
    secuencia: {
      type: Number,
      required: true,
      min: 1,
    },
    numero: {
      type: String,
      required: true,
      trim: true,
    },
    estado: {
      type: String,
      enum: ['reservado', 'usado', 'expirado'],
      default: 'reservado',
      required: true,
    },
    reservadoPor: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    },
    reservadoEn: {
      type: Date,
      default: () => new Date(),
    },
    usadoPor: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    },
    usadoEn: Date,
    expiracion: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: 'documento_reservas',
  },
);

documentoNumeroReservaSchema.index(
  { tipo: 1, prefijo: 1, secuencia: 1 },
  {
    unique: true,
    partialFilterExpression: { estado: { $in: ['reservado', 'usado'] } },
  },
);

documentoNumeroReservaSchema.index(
  { expiracion: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { estado: 'reservado' },
  },
);

module.exports = mongoose.model('DocumentoNumeroReserva', documentoNumeroReservaSchema);
