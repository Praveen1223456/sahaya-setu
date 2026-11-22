const mongoose = require('mongoose');

const DisasterEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    hazardType: {
      type: String,
      enum: [
        'cyclone',
        'flood',
        'heavy_rainfall',
        'earthquake',
        'storm_surge',
        'landslide',
        'infrastructure_failure',
        'other',
      ],
      default: 'cyclone',
      index: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'high',
      index: true,
    },
    areaName: {
      type: String,
      required: true,
      trim: true,
    },
    center_lat: {
      type: Number,
      required: true,
    },
    center_lon: {
      type: Number,
      required: true,
    },
    radius_km: {
      type: Number,
      default: 25,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lon, lat]
        required: true,
      },
    },
    safetyGuidelines: {
      type: [String],
      default: [
        'Do not approach fallen electricity poles or downed live power lines.',
        'Avoid driving or walking through flooded roads and submerged bridges.',
        'Stay away from unstable structures, weakened compound walls, and uprooted trees.',
        'Report hazards immediately from a safe distance.',
        'Contact official emergency services (112 / 108) for immediate life-threatening situations.',
      ],
    },
    status: {
      type: String,
      enum: ['active', 'ended'],
      default: 'active',
      index: true,
    },
    activatedBy: {
      type: String,
      default: 'Emergency Command Center',
    },
    activatedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

DisasterEventSchema.index({ location: '2dsphere' });

const DisasterEvent = mongoose.models.DisasterEvent || mongoose.model('DisasterEvent', DisasterEventSchema);

module.exports = DisasterEvent;
