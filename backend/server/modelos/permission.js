const mongoose = require('mongoose');

const rolesValidos = {
  values: ['ADMIN_ROLE', 'USER_ROLE', 'USER_CAM', 'USER_PREV'],
  message: '{VALUE} no es un rol válido',
};

const permissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      unique: true,
      required: true,
      enum: rolesValidos,
      trim: true,
    },
    screens: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('Permission', permissionSchema);
