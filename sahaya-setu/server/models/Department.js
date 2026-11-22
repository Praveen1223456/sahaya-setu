const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    headEmail: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    slaHoursDefault: {
      type: Number,
      default: 24,
    },
    icon: {
      type: String,
      default: 'Building2',
    },
    color: {
      type: String,
      default: '#1b4f9c',
    },
    categories: {
      type: [String],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
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

const Department = mongoose.models.Department || mongoose.model('Department', DepartmentSchema);

module.exports = Department;
