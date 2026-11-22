const mongoose = require('mongoose');

const OutboxMessageSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    to_phone: { type: String, required: true, index: true },
    body: { type: String, required: true },
    incident_id: { type: Number, default: null, index: true },
    delivered: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const OutboxMessage = mongoose.models.OutboxMessage || mongoose.model('OutboxMessage', OutboxMessageSchema);

module.exports = OutboxMessage;
