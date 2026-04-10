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
      type: String, // copied from template for easy reference
    },
    practiceArea: {
      type: String,
    },
    category: {
      type: String,
    },
    filledFields: {
      type: [filledFieldSchema],
      validate: {
        validator: (fields) => fields.length > 0,
        message: "At least one field value is required",
      },
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