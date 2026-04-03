// models/MeetingNote.js
const mongoose = require("mongoose");

const meetingNoteSchema = new mongoose.Schema(
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
    authorId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,        // userId ya advocateId
    },
    authorName: {
      type:     String,
      required: true,
    },
    authorRole: {
      type:     String,
      enum:     ["user", "advocate"],
      required: true,
    },
    content: {
      type:     String,
      required: true,
      trim:     true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MeetingNote", meetingNoteSchema);