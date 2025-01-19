const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  group: { type: String, required: true },
  theme: { type: String, required: true },
  code: { type: String, unique: true, required: true },
  cardType: { type: String, enum: ['normal', 'lim-ed', 'event'], required: true },
  imagePath: { type: String, required: true },
  backCoverUrl: { type: String },
  eventCoverUrl: { type: String },
  eventEmoji: { type: String },
  availability: {type: String, enum: ['droppable', 'archived'], required: true, default: 'droppable'} 
 });

module.exports = mongoose.model('Card', cardSchema);
