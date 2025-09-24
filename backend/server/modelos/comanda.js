const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
let Schema = mongoose.Schema;

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

const archivoSchema = new Schema(
  {
    nombre: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    url: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    tipo: {
      type: String,
      trim: true,
      maxlength: 40,
    },
  },
  { _id: false }
);

const preparacionSchema = new Schema(
  {
    responsable: {
      type: Schema.Types.ObjectId,
      ref: "Usuario",
    },
    inicio: Date,
    fin: Date,
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
    checklistDepositoConfirmado: {
      type: Boolean,
      default: false,
    },
    archivos: [archivoSchema],
  },
  { _id: false, timestamps: true }
);

const controlCargaSchema = new Schema(
  {
    inspector: {
      type: Schema.Types.ObjectId,
      ref: "Usuario",
    },
    fecha: Date,
    checklistDepositoConfirmado: {
      type: Boolean,
      default: false,
    },
    numeroSello: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    anotaciones: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    archivos: [archivoSchema],
  },
  { _id: false, timestamps: true }
);

const entregaSchema = new Schema(
  {
    parada: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    estado: {
      type: String,
      enum: ["Completa", "Parcial", "Rechazada"],
      default: "Completa",
    },
    cantidadComprometida: {
      type: Number,
      min: 0,
    },
    cantidadEntregada: {
      type: Number,
      min: 0,
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
    fotos: [archivoSchema],
    fecha: {
      type: Date,
      default: Date.now,
    },
    usuario: {
      type: Schema.Types.ObjectId,
      ref: "Usuario",
    },
  },
  { timestamps: true }
);

const historialSchema = new Schema(
  {
    accion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    usuario: {
      type: Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
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

  estadoPreparacion: {
    type: String,
    enum: ["A Preparar", "En Curso", "Lista para carga"],
    default: "A Preparar",
  },

  operarioAsignado: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
  },

  preparacion: preparacionSchema,

  controlCarga: controlCargaSchema,

  motivoLogistica: {
    type: String,
    trim: true,
    maxlength: 500,
  },

  usuarioLogistica: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
  },

  salidaDeposito: Date,

  usuarioDespacho: {
    type: Schema.Types.ObjectId,
    ref: "Usuario",
  },

  historial: [historialSchema],

  entregas: [entregaSchema],

  // 💥 Arreglo de ítems de venta
  items: [itemSchema]
});

comandaSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});


module.exports = mongoose.model("Comanda", comandaSchema);
