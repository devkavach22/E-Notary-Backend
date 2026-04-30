const mongoose = require("mongoose");

const filledFieldSchema = new mongoose.Schema(
  {
    fieldName: {
      type: String,
      required: true,
      trim: true,
    },
    fieldType: {
      type: String,
      enum: ["text", "number", "date", "textarea", "image", "file", "dropdown"],
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false }
);

// ✅ NEW: har party ka schema
const partyFilledSchema = new mongoose.Schema(
  {
    partyName: {
      type: String,
      required: true,
      trim: true,
    },
    // ✅ User ne select kiya - main_case_holder ya invited_person
    role: {
      type: String,
      enum: ["main_case_holder", "invited_person"],
      required: true,
    },
    // ✅ Invited person ki email (main_case_holder ne di)
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    // ✅ Kaun sa user is party ko fill kar raha hai
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // ✅ Invite token - email mein jayega
    inviteToken: {
      type: String,
      default: null,
    },
    // ✅ Party level status
    status: {
      type: String,
      enum: ["pending", "invited", "accepted", "filled"],
      default: "pending",
    },
    // ✅ Us party ke filled fields
    filledFields: {
      type: [filledFieldSchema],
      default: [],
    },
  },
  { _id: true }
);

const userFilledTemplateSchema = new mongoose.Schema(
  {
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      required: true,
    },
    advocateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Advocate",
      required: true,
    },
    // ✅ Main case holder ka userId (jo pehle fill karta hai)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
    },
    practiceArea: {
      type: String,
    },
    category: {
      type: String,
    },
    // ✅ NEW: parties array - har party ka status track hoga
    parties: {
      type: [partyFilledSchema],
      default: [],
    },
    // ✅ NEW: template level status
    templateStatus: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
    // existing - advocate ke liye
    status: {
      type: String,
      enum: ["submitted", "accepted", "rejected"],
      default: "submitted",
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserFilledTemplate", userFilledTemplateSchema);