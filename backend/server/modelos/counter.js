const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  nrodecomanda: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model('Counter', counterSchema);
