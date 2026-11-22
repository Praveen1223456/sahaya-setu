const mongoose = require('mongoose');

const CitizenSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    phone: { type: String, required: true, unique: true },
    name: { type: String, default: null },
    village: { type: String, default: null },
    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
    household_size: { type: Number, default: 1 },
    needs: { type: [String], default: [] },
    medical_notes: { type: String, default: null },
    family_contacts: { type: [String], default: [] },
    consent: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Citizen = mongoose.models.Citizen || mongoose.model('Citizen', CitizenSchema);

module.exports = Citizen;
