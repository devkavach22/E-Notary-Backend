const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    advocateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Advocate",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userFilledTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserFilledTemplate",
      required: true,
    },
    meetingLink: {
      type: String,
      required: true,
      trim: true,
    },
    uniqueCode: {
      type: String,
      required: true,
      unique: true,
    },
    scheduledAt: {
      type: Date,
      required: true,  
    },
    scheduledEndAt: {
      type: Date,
      required: true, 
    },
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "completed"],
      default: "scheduled",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", meetingSchema);