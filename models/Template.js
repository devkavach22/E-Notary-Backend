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
    defaultImagePath: {
      type: String,
      trim: true,
      default: null,
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
    isMainCaseHolder: {
      type: Boolean,
      default: false,
    },
    isInvitedPerson: {
      type: Boolean,
      default: false,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    fields: {
      type: [fieldSchema],
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
      default: [],
    },
    fields: {
      type: [fieldSchema],
      default: [],
    },
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