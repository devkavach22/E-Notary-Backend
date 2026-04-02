// models/Booking.js
const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    advocateId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Advocate",
      required: true,
    },
    caseType: {
      type:     String,
      required: [true, "Case type is required"],
      trim:     true,
    },
    message: {
      type:    String,
      trim:    true,
      default: "",
    },
    status: {
      type:    String,
      enum:    ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },

    meetingDate: { type: Date,   default: null },
    meetingTime: { type: String, default: null },
    meetLink:    { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);