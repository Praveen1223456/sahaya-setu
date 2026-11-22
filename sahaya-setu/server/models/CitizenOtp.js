const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    codeHash: String,
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CitizenOtp = mongoose.models.CitizenOtp || mongoose.model('CitizenOtp', otpSchema);

module.exports = CitizenOtp;
