// modelos/permissions.js — Asignaciones de pantallas por rol
// -----------------------------------------------------------------------------
// Node.js v22.17.1 + Mongoose v8.16.5

const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    screens: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('Permission', permissionSchema);
