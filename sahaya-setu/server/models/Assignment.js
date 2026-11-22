const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema(
  {
    complaint_id: {
      type: Number,
      required: true,
      index: true,
    },
    incident_oid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      required: true,
      index: true,
    },
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employee_name: {
      type: String,
      default: '',
    },
    assigned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assigned_by_name: {
      type: String,
      default: 'Department Administrator',
    },
    status: {
      type: String,
      enum: [
        'assigned',
        'accepted',
        'rejected',
        'travelling',
        'arrived',
        'in_progress',
        'completed',
        'unable_to_complete',
      ],
      default: 'assigned',
      index: true,
    },
    rejection_reason: {
      type: String,
      default: null,
    },
    unable_reason: {
      type: String,
      default: null,
    },
    repair_notes: {
      type: String,
      default: null,
    },
    proof_photos: {
      type: [String],
      default: [],
    },
    assigned_at: {
      type: Date,
      default: Date.now,
    },
    accepted_at: {
      type: Date,
      default: null,
    },
    started_at: {
      type: Date,
      default: null,
    },
    completed_at: {
      type: Date,
      default: null,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AssignmentSchema.pre('save', function () {
  this.updated_at = new Date();
});

const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);

module.exports = Assignment;
