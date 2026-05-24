const mongoose = require('mongoose');

const MarqueeSchema = new mongoose.Schema({
  text: { type: String, required: true },
  tag: { type: String },
  url: { type: String },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Marquee', MarqueeSchema);
