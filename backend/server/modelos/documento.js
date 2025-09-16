const mongoose = require('mongoose');
const moment = require('moment-timezone');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const { Schema } = mongoose;

const DOCUMENT_TYPES = {
  R: 'R',
  NR: 'NR',
  AJ: 'AJ',
};

const TIMEZONE = 'America/Argentina/Buenos_Aires';
const PREFIX = '0000';

const itemSchema = new Schema(
  {
    cantidad: {
      type: Number,
      required: [true, 'Debe indicar la cantidad del producto'],
      validate: {
        validator: (value) => typeof value === 'number' && value > 0,
        message: 'La cantidad debe ser un número positivo',
      },
    },
    producto: {
      type: Schema.Types.ObjectId,
      ref: 'Producserv',
      required: [true, 'Debe indicar el producto'],
    },
    codprod: {
      type: String,
      required: [true, 'Debe indicar el código del producto'],
      trim: true,
    },
  },
  { _id: false }
);

const documentoSchema = new Schema(
  {
    tipo: {
      type: String,
      required: [true, 'El tipo de documento es obligatorio'],
      enum: {
        values: Object.values(DOCUMENT_TYPES),
        message: 'Tipo de documento inválido',
      },
    },
    secuencia: {
      type: Number,
      default: 0,
      select: false,
    },
    nroDocumento: {
      type: String,
      unique: true,
      alias: 'NrodeDocumento',
    },
    proveedor: {
      type: Schema.Types.ObjectId,
      ref: 'Proveedor',
      required: [true, 'Debe seleccionar un proveedor'],
    },
    fechaRemito: {
      type: Date,
      required: [true, 'Debe indicar la fecha del documento'],
    },
    fechaCreacion: {
      type: Date,
      default: () => moment.tz(TIMEZONE).toDate(),
    },
    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'Debe indicar el usuario que registra el documento'],
    },
    items: {
      type: [itemSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'Debe cargar al menos un producto en el documento',
      },
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const buildDocumentoNumber = (tipo, secuencia) =>
  `${PREFIX}${tipo}${String(secuencia).padStart(8, '0')}`;

documentoSchema.plugin(AutoIncrement, {
  id: 'documento_seq',
  inc_field: 'secuencia',
  reference_fields: ['tipo'],
});

documentoSchema.pre('save', function generateNroDocumento(next) {
  if (!this.isNew || this.nroDocumento) return next();
  if (typeof this.secuencia !== 'number' || Number.isNaN(this.secuencia)) {
    return next(new Error('No se pudo generar el número correlativo del documento'));
  }
  this.nroDocumento = buildDocumentoNumber(this.tipo, this.secuencia);
  next();
});

const Documento = mongoose.model('Documento', documentoSchema);

Documento.DOCUMENT_TYPES = DOCUMENT_TYPES;
Documento.TIMEZONE = TIMEZONE;
Documento.buildDocumentoNumber = buildDocumentoNumber;

module.exports = Documento;
