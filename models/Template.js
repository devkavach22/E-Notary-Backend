const mongoose = require("mongoose");


const fieldSchema = new mongoose.Schema(
  {
    fieldName: {
      type: String,
      required: [true, "Field name is required"],
      trim: true,
    },
    fieldType: {
      type: String,
      enum: ["text", "number", "date", "textarea", "image", "file", "dropdown"],
      required: [true, "Field type is required"],
    },
    required: {
      type: Boolean,
      default: false,
    },
    placeholder: {
      type: String,
      trim: true,
      default: "",
    },
    options: {
      type: [String],
      default: [],
    },
  },
  { _id: false } 
);

// ═══════════════════════════════════════════════════════════
// TEMPLATE SCHEMA
// ═══════════════════════════════════════════════════════════
const templateSchema = new mongoose.Schema(
  {
    // ── Advocate Info ──────────────────────────────────────
    advocateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Advocate",
      required: [true, "Advocate ID is required"],
    },
    advocateName: {
      type: String,
      required: [true, "Advocate name is required"],
      trim: true,
    },

    // ── Template Info ──────────────────────────────────────
    practiceArea: {
      type: String,
      required: [true, "Practice area is required"],
      trim: true,
    },
    caseType: {
      type: String,
      required: [true, "Case type is required"],
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Template title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Dynamic Fields (advocate define karega) ────────────
    fields: {
      type: [fieldSchema],
      validate: {
        validator: (fields) => fields.length > 0,
        message: "At least one field is required",
      },
    },

    // ── Status ─────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt auto
  }
);

module.exports = mongoose.model("Template", templateSchema);