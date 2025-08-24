const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let rolesValidos = {
  values: ["ADMIN_ROLE", "USER_ROLE", "USER_CAM", "USER_PREV"],
  message: "{VALUE} no es un rol válido ",
};

let Schema = mongoose.Schema;

let usuarioSchema = new Schema({
  nombres: {
    type: String,
    required: [true, "El nombre es necesario"],
  },
  apellidos: {
    type: String,
    required: [true, "El apellido es necesario"],
  },
  dni: {
    type: Number,
    required: false,
  },
  email: {
    type: String,
    required: false,
  },
  password: {
    type: String,
    required: [true, "La contraseña es necesaria"],
  },
  avatar: {
    type: String,
    required: false,
  },
  role: {
    type: String,
    default: "USER_ROLE",
    enum: rolesValidos,
  },
  activo: {
    type: Boolean,
    default: true,
  },

  // idempresa: {
  //   type: String,
  //   default: false,
  // },
});

usuarioSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

//Para que no muestre al password cuando haga la petición
usuarioSchema.methods.toJSON = function () {
  let user = this;
  let userObject = user.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model("Usuario", usuarioSchema);
