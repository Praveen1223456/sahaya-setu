const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    recipient_role: {
      type: String,
      enum: ['citizen', 'department_admin', 'field_employee', 'super_admin', 'all'],
      default: 'all',
      index: true,
    },
    department: {
      type: String,
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    complaint_id: {
      type: Number,
      default: null,
      index: true,
    },
    ticket_code: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: [
        'complaint_submitted',
        'complaint_assigned',
        'task_accepted',
        'task_rejected',
        'task_travelling',
        'task_arrived',
        'task_in_progress',
        'repair_completed',
        'resolution_verified',
        'complaint_reopened',
        'complaint_escalated',
        'disaster_alert',
        'general',
      ],
      default: 'general',
      index: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

module.exports = Notification;
