const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema(
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
    citizen_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    citizen_phone: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    comment: {
      type: String,
      default: '',
    },
    is_resolved: {
      type: Boolean,
      required: true,
    },
    reopened: {
      type: Boolean,
      default: false,
      index: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', FeedbackSchema);

module.exports = Feedback;
