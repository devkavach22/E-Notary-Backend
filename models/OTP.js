const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    // ─── Email ────────────────────────────────────────────
    email: {
      type:      String,
      required:  false,
      lowercase: true,
      trim:      true,
    },

    // ─── Mobile number ────────────────────────────────────
    mobile: {
      type:     String,
      required: false,
      trim:     true,
    },

    // ─── OTP code ─────────────────────────────────────────
    otp: {
      type:     String,
      required: true,
    },

    // ─── Purpose ──────────────────────────────────────────
    purpose: {
      type:     String,
      enum:     ["email_verify", "mobile_verify", "forget_password"], // ← added
      required: true,
    },

    // ─── Role (forget_password ke liye) ───────────────────
    role: {
      type:     String,
      enum:     ["admin", "advocate", "user"],
      required: false,
    },

    // ─── Login blocker flag ───────────────────────────────
    passwordResetPending: {
      type:    Boolean,
      default: false,
    },

    // ─── Expiry ───────────────────────────────────────────
    expiresAt: {
      type:    Date,
      default: () => new Date(Date.now() + 10 * 60 * 1000),
    },

    // ─── Used flag ────────────────────────────────────────
    isUsed: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OTP", otpSchema);