const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

let Schema = mongoose.Schema;

let ultimacomandaSchema = new Schema({
  nrodecomanda: {
    type: Number, 
    unique:true,
    // required: [true, "Ingrese el codigo valido"],
  },

   activo: {
    type: Boolean,
    default: true,
  },

   
});

ultimacomandaSchema.plugin(uniqueValidator, {
  message: "{PATH} debe ser único",
});

module.exports = mongoose.model("Ultimacomanda", ultimacomandaSchema);
