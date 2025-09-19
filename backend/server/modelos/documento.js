const mongoose = require('mongoose');
const moment = require('moment-timezone');
const AutoIncrementFactory = require('mongoose-sequence');

const AutoIncrement = AutoIncrementFactory(mongoose);
const { Schema } = mongoose;

const ZONA_ARGENTINA = 'America/Argentina/Buenos_Aires';
const TIPOS_DOCUMENTO = ['R', 'NR', 'AJ'];

const toArgDate = (value) => (value ? moment.tz(value, ZONA_ARGENTINA).toDate() : value);
const padSecuencia = (value) => String(value ?? 0).padStart(8, '0');
const padPrefijo = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const str = String(value).trim();
  if (/^\d{1,4}$/.test(str)) return str.padStart(4, '0');
  return str;
};

const itemSchema = new Schema({
  cantidad: {
    type: Number,
    required: [true, 'La cantidad es obligatoria'],
    validate: {
      validator: (valor) => typeof valor === 'number' && !Number.isNaN(valor) && valor > 0,
      message: 'La cantidad debe ser un número positivo',
    },
  },
  producto: {
    type: Schema.Types.ObjectId,
    ref: 'Producserv',
    required: [true, 'El producto es obligatorio'],
  },
  codprod: {
    type: String,
    trim: true,
    required: [true, 'El código de producto es obligatorio'],
  },
}, { _id: false });

const documentoSchema = new Schema({
  prefijo: {
    type: String,
    default: '0001',
    set: padPrefijo,
    validate: {
      validator: (valor) => /^\d{4}$/.test(valor),
      message: 'El prefijo debe componerse de cuatro dígitos',
    },
  },
  tipo: {
    type: String,
    required: [true, 'El tipo de documento es obligatorio'],
    enum: {
      values: TIPOS_DOCUMENTO,
      message: 'Tipo de documento inválido',
    },
  },
  secuencia: Number,
  NrodeDocumento: {
    type: String,
    // unique: true,
    index: true,
  },
  proveedor: {
    type: Schema.Types.ObjectId,
    ref: 'Proveedor',
    required: [true, 'El proveedor es obligatorio'],
  },
  fechaRemito: {
    type: Date,
    required: [true, 'La fecha del documento es obligatoria'],
  },
  fechaRegistro: {
    type: Date,
    default: () => toArgDate(new Date()),
  },
  usuario: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
    required: [true, 'El usuario es obligatorio'],
  },
  items: {
    type: [itemSchema],
    validate: {
      validator: (items) => Array.isArray(items) && items.length > 0,
      message: 'Debe incluir al menos un ítem de producto',
    },
  },
  observaciones: {
    type: String,
    trim: true,
  },
  activo: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: false,
  versionKey: false,
});

documentoSchema.plugin(AutoIncrement, {
  inc_field: 'secuencia',
  // reference_fields: ['tipo'],
});

documentoSchema.pre('validate', function(next) {
  if (!this.prefijo) {
    this.prefijo = '0001';
  }
  if (this.fechaRemito) {
    this.fechaRemito = toArgDate(this.fechaRemito);
  }
  if (!this.fechaRegistro) {
    this.fechaRegistro = toArgDate(new Date());
  } else {
    this.fechaRegistro = toArgDate(this.fechaRegistro);
  }
  next();
});

documentoSchema.pre('save', function(next) {
  const tipo = this.tipo;
  if (!TIPOS_DOCUMENTO.includes(tipo)) {
    return next(new Error('Tipo de documento inválido'));
  }
  if (tipo === 'R' && this.isNew && this.NrodeDocumento) {
    return next();
  }
  this.NrodeDocumento = `${this.prefijo}${tipo}${padSecuencia(this.secuencia)}`;
  next();
});

documentoSchema.index({ tipo: 1, secuencia: 1 }, { unique: true });

documentoSchema.statics.TIPOS_DOCUMENTO = TIPOS_DOCUMENTO;
documentoSchema.statics.ZONA_ARGENTINA = ZONA_ARGENTINA;

documentoSchema.methods.toJSON = function() {
  const obj = this.toObject();
  return obj;
};

module.exports = mongoose.model('Documento', documentoSchema);
