// models/MeetingRecording.js
const mongoose = require("mongoose");

const meetingRecordingSchema = new mongoose.Schema(
  {
    bookingId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Booking",
      required: true,
    },
    roomId: {
      type:     String,
      required: true,
      trim:     true,
    },
    uploadedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
    },
    uploaderName: {
      type:     String,
      required: true,
    },
    uploaderRole: {
      type:     String,
      enum:     ["user", "advocate"],
      required: true,
    },
    fileName: {
      type:     String,
      required: true,        // stored file name on disk
    },
    originalName: {
      type:     String,
      required: true,        // original file name from client
    },
    fileSize: {
      type:     Number,      // bytes
    },
    filePath: {
      type:     String,
      required: true,        // relative path: uploads/recordings/xxx.webm
    },
    duration: {
      type:     Number,      // seconds (optional, sent by client)
      default:  null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MeetingRecording", meetingRecordingSchema);