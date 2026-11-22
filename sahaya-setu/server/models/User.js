const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: ['citizen', 'department_admin', 'field_employee', 'super_admin'],
      default: 'citizen',
      index: true,
    },
    // Associated department for department admins and field employees
    department: {
      type: String,
      default: null,
      index: true,
    },
    // Skills for field employees
    skills: {
      type: [String],
      default: [],
    },
    // Employee availability status
    availability: {
      type: String,
      enum: ['available', 'busy', 'off_duty'],
      default: 'available',
      index: true,
    },
    activeTasksCount: {
      type: Number,
      default: 0,
    },
    // Last reported location of field employee
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [82.0061, 16.5787], // [lon, lat] default
      },
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Safe object without password
UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

UserSchema.index({ location: '2dsphere' });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

module.exports = User;
