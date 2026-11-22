const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    title: { type: String, default: null },
    description: { type: String, default: null },
    category: { type: String, required: true, index: true },
    department: { type: String, required: true, index: true },
    status: { type: String, default: 'received', index: true },

    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
    gps_accuracy_m: { type: Number, default: null },
    address: { type: String, default: null },
    landmark: { type: String, default: null },

    // GeoJSON Point format: [longitude, latitude]
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },

    // Citizen Info
    citizen_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    citizen_name: { type: String, default: null },
    citizen_phone: { type: String, default: null, index: true },

    // Photo evidence
    images: { type: [String], default: [] },
    after_images: { type: [String], default: [] },
    best_photo_path: { type: String, default: null },
    best_photo_sharpness: { type: Number, default: null },
    resolution_photo_path: { type: String, default: null },
    resolution_notes: { type: String, default: null },

    // Workforce Assignment
    assigned_employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assigned_employee_name: { type: String, default: null },
    assignment_status: {
      type: String,
      enum: ['unassigned', 'assigned', 'accepted', 'rejected', 'travelling', 'arrived', 'in_progress', 'completed', 'unable_to_complete'],
      default: 'unassigned',
      index: true,
    },
    assigned_at: { type: Date, default: null },
    assignment_response_at: { type: Date, default: null },
    rejection_reason: { type: String, default: null },
    unable_reason: { type: String, default: null },

    // Disaster & Emergency Mode
    is_disaster_mode: { type: Boolean, default: false, index: true },
    disaster_event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DisasterEvent', default: null, index: true },
    emergency_severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
      index: true,
    },

    // Citizen Verification & Feedback
    verification_status: {
      type: String,
      enum: ['pending', 'verified', 'rejected_reopened'],
      default: 'pending',
      index: true,
    },
    citizen_feedback: {
      rating: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, default: null },
      submitted_at: { type: Date, default: null },
    },
    reopen_count: { type: Number, default: 0 },

    // Duplicate support & Community backing
    upvotes: { type: Number, default: 0 },
    supporters: { type: [String], default: [] },

    // Legacy support fields
    is_sos: { type: Boolean, default: false, index: true },
    sos_area_id: { type: Number, default: null },
    severity: { type: Number, default: 1 },
    vulnerable: { type: Boolean, default: false },
    people_count: { type: Number, default: 0 },
    report_count: { type: Number, default: 1 },
    priority: { type: Number, default: 0.0, index: true },
    escalation_level: { type: Number, default: 0 },

    needs_review: { type: Boolean, default: false, index: true },
    review_reason: { type: String, default: null },
    possible_duplicate_of: { type: Number, default: null },
    merged_into: { type: Number, default: null },

    created_at: { type: Date, default: Date.now, index: true },
    updated_at: { type: Date, default: Date.now },
    sla_due_at: { type: Date, default: null },
    resolved_at: { type: Date, default: null },
    closed_at: { type: Date, default: null },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual ticket code / complaint ID
IncidentSchema.virtual('ticket_code').get(function () {
  if (this.id === undefined || this.id === null) return '';
  return `SS-${String(this.id).padStart(4, '0')}`;
});

// Sync GeoJSON location from lat/lon before saving
IncidentSchema.pre('save', function () {
  this.updated_at = new Date();
  if (
    this.lat !== null &&
    this.lat !== undefined &&
    this.lon !== null &&
    this.lon !== undefined &&
    !isNaN(this.lat) &&
    !isNaN(this.lon)
  ) {
    this.location = {
      type: 'Point',
      coordinates: [this.lon, this.lat],
    };
  } else {
    this.location = undefined;
  }
  // Keep best_photo_path in images array if not present
  if (this.best_photo_path && !this.images.includes(this.best_photo_path)) {
    this.images.unshift(this.best_photo_path);
  }
  // Keep resolution_photo_path in after_images
  if (this.resolution_photo_path && !this.after_images.includes(this.resolution_photo_path)) {
    this.after_images.unshift(this.resolution_photo_path);
  }
});

// 2dsphere index for geospatial proximity queries (sparse so null locations are allowed)
IncidentSchema.index({ location: '2dsphere' }, { sparse: true });

const Incident = mongoose.models.Incident || mongoose.model('Incident', IncidentSchema);

module.exports = Incident;
