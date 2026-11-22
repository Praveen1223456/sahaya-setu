const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    level: { type: String, default: 'orange' }, // red | orange | yellow
    hazard: { type: String, default: 'Cyclone' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    message_te: { type: String, default: null },
    area_name: { type: String, default: null },
    center_lat: { type: Number, default: null },
    center_lon: { type: Number, default: null },
    radius_km: { type: Number, default: null },
    source: { type: String, default: 'manual' }, // manual | cap
    cap_identifier: { type: String, default: null },
    created_by: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
    expires_at: { type: Date, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AlertSchema.index(
  { cap_identifier: 1 },
  { unique: true, partialFilterExpression: { cap_identifier: { $type: 'string' } } }
);

const Alert = mongoose.models.Alert || mongoose.model('Alert', AlertSchema);

module.exports = Alert;
