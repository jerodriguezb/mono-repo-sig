const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
let Schema = mongoose.Schema;

// Subdocumento para adjuntos genéricos (fotos, archivos, etc.)
const archivoSchema = new Schema(
  {
    nombre: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    url: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

const preparacionSchema = new Schema(
  {
    responsable: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    },
    inicio: {
      type: Date,
    },
    fin: {
      type: Date,
    },
    verificacionBultos: {
      type: Boolean,
      default: false,
    },
    controlTemperatura: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    incidencias: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    archivos: {
      type: [archivoSchema],
      default: [],
    },
  },
  { _id: false, timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' } }
);

const controlCargaSchema = new Schema(
  {
    inspector: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    },
    fechaHora: {
      type: Date,
    },
    checklistDeposito: {
      type: Boolean,
      default: false,
    },
    selloSeguridad: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    anotaciones: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    adjuntos: {
      type: [archivoSchema],
      default: [],
    },
  },
  { _id: false, timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' } }
);

const historialSchema = new Schema(
  {
    accion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    },
    motivo: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    fecha: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const entregaSchema = new Schema(
  {
    parada: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    estado: {
      type: String,
      enum: ['Completada', 'Parcial', 'Rechazada'],
      default: 'Completada',
    },
    fecha: {
      type: Date,
      default: Date.now,
    },
    motivo: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    checklistConfirmado: {
      type: Boolean,
      default: false,
    },
    fotos: {
      type: [archivoSchema],
      default: [],
    },
    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
    },
    observaciones: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    _id: false,
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  }
);

// Subdocumento para los ítems de la comanda
const itemSchema = new Schema({
  lista: {
    type: Schema.Types.ObjectId,
    ref: "Lista",
    required: true,
  },
  codprod: {
    type: Schema.Types.ObjectId,
    ref: "Producserv",
    required: true,
  },
  cantidad: {
    type: Number,
    min: 1,
    required: true,
  },
  monto: {
    type: Number,
    required: true,
  },
  cantidadentregada: {
    type: Number,
    min: 0,
    default: 0,
    required: true,
  },
  entregado: {
    type: Boolean,
    default: false,
  }
});

const comandaSchema = new Schema({
  nrodecomanda: {
    type: Number,
    unique: true,
  },

  codcli: {
    type: Schema.Types.ObjectId,
    ref: "Cliente",
    required: true,
  },

  fecha: {
    type: Date,
    default: () => Date.now() - 3 * 60 * 60 * 1000,
  },

  codestado: {
    type: Schema.Types.ObjectId,
    ref: "Estado",
  },

  camion: {
    type: Schema.Types.ObjectId,
    ref: "Camion",
  },

  fechadeentrega: {
    type: Date,
  },

  usuario: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
  },

  camionero: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
  },

  activo: {
    type: Boolean,
    default: true,
  },

  // 💥 Arreglo de ítems de venta
  items: [itemSchema],

  estadoPreparacion: {
    type: String,
    enum: ['A Preparar', 'En Curso', 'Lista para carga'],
    default: 'A Preparar',
    index: true,
  },

  operarioAsignado: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
  },

  preparacion: preparacionSchema,

  controlCarga: controlCargaSchema,

  motivoLogistica: {
    type: String,
    trim: true,
    maxlength: 300,
  },

  usuarioLogistica: {
    type: Schema.Types.ObjectId,
    ref: 'Usuario',
  },

  historial: {
    type: [historialSchema],
    default: [],
  },

  entregas: {
    type: [entregaSchema],
    default: [],
  },
});

comandaSchema.set('timestamps', true);

comandaSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});


module.exports = mongoose.model("Comanda", comandaSchema);
