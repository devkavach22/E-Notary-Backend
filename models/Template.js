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

const partySchema = new mongoose.Schema(
  {
    partyName: {
      type: String,
      required: [true, "Party name is required"],
      trim: true,
    },
    fields: {
      type: [fieldSchema],
      validate: {
        validator: (fields) => fields.length > 0,
        message: "Each party must have at least one field",
      },
    },
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema(
  {
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
    practiceArea: {
      type: String,
      required: [true, "Practice area is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
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
    parties: {
      type: [partySchema],
      validate: {
        validator: (parties) => parties.length > 0,
        message: "At least one party is required",
      },
    },

    // ── Added: stores HTML from document editor (filled during edit only) ──
    templateLayout: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Template", templateSchema);