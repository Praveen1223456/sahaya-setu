const mongoose = require('mongoose');

const StatusEventSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    incident_id: { type: Number, required: true, index: true },
    status: { type: String, required: true },
    note: { type: String, default: null },
    actor: { type: String, default: 'system' },
    actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actor_role: { type: String, default: 'system' },
    proof_photo: { type: String, default: null },
    created_at: { type: Date, default: Date.now, index: true },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const StatusEvent = mongoose.models.StatusEvent || mongoose.model('StatusEvent', StatusEventSchema);

module.exports = StatusEvent;
