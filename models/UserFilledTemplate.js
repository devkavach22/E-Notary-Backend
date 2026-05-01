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

const partyFilledSchema = new mongoose.Schema(
  {
    partyName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["main_case_holder", "invited_person"],
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    inviteToken: {
      type: String,
      default: null,
    },
    isUserRegistered: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "invited", "accepted", "filled"],
      default: "pending",
    },
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
    parties: {
      type: [partyFilledSchema],
      default: [],
    },
    templateStatus: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
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