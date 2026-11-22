const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    client_report_id: { type: String, default: null },
    incident_id: { type: Number, index: true, default: null },

    channel: { type: String, required: true }, // app | sms | mesh | voice
    phone: { type: String, default: null, index: true },
    relayed_by: { type: String, default: null },

    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
    gps_accuracy_m: { type: Number, default: null },
    location_source: { type: String, default: 'gps' }, // gps | text | none
    captured_at: { type: Date, default: null },
    received_at: { type: Date, default: Date.now },
    address: { type: String, default: null },

    category: { type: String, required: true },
    subtype: { type: String, default: null },
    severity: { type: Number, default: 1 },
    people_count: { type: Number, default: 0 },
    description: { type: String, default: null },
    battery_pct: { type: Number, default: null },

    is_sos: { type: Boolean, default: false },
    is_mocked: { type: Boolean, default: false },

    photo_path: { type: String, default: null },
    photo_sha256: { type: String, default: null, index: true },
    phash: { type: String, default: null, index: true },
    sharpness: { type: Number, default: null },
    embedding: { type: Array, default: null },
    integrity: { type: String, default: 'unsigned' }, // verified | unsigned | failed

    dedup_decision: { type: String, default: 'new' },
    dedup_detail: { type: String, default: null },

    input_method: { type: String, enum: ['MANUAL', 'VOICE'], default: 'MANUAL' },
    voice_metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Unique index on client_report_id only for string values (ignoring null/undefined)
ReportSchema.index(
  { client_report_id: 1 },
  { unique: true, partialFilterExpression: { client_report_id: { $type: 'string' } } }
);

ReportSchema.virtual('inputMethod').get(function () {
  return this.input_method;
});
ReportSchema.virtual('voiceMetadata').get(function () {
  return this.voice_metadata;
});
ReportSchema.virtual('voice').get(function () {
  return this.voice_metadata;
});

const Report = mongoose.models.Report || mongoose.model('Report', ReportSchema);

module.exports = Report;
