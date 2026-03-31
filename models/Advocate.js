const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const advocateSchema = new mongoose.Schema(
  {
    // ─── Personal Details ────────────────────────────────
    fullName:    { type: String, required: [true, "Full name is required"], trim: true },
    dateOfBirth: { type: Date,   required: [true, "Date of birth is required"] },
    gender:      { type: String, enum: ["male", "female", "other"], required: [true, "Gender is required"] },

    // ─── Contact Details ─────────────────────────────────
    mobile: {
      type: String, required: [true, "Mobile number is required"],
      unique: true, trim: true, match: [/^[6-9]\d{9}$/, "Invalid mobile number"],
    },
    email: {
      type: String, required: [true, "Email is required"],
      unique: true, lowercase: true, trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    password: {
      type: String, required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"], select: false,
    },

    // ─── Professional Details ────────────────────────────
    barCouncilNumber: { type: String, required: [true, "Bar Council number is required"], unique: true, trim: true },
    barCouncilState:  { type: String, required: [true, "Bar Council state is required"], trim: true },
    yearOfEnrollment: {
      type: Number, required: [true, "Year of enrollment is required"],
      min: [1950, "Invalid year"], max: [new Date().getFullYear(), "Invalid year"],
    },

    // ─── NO enum restriction — frontend se jo bhi aaye accept karo ──
    practiceAreas:  { type: [String], required: [true, "At least one practice area is required"] },
    languagesKnown: { type: [String], required: [true, "At least one language is required"] },

    // ─── Address Details ─────────────────────────────────
    city:          { type: String, required: [true, "City is required"], trim: true },
    state:         { type: String, required: [true, "State is required"], trim: true },
    officeAddress: { type: String, required: [true, "Office address is required"], trim: true },
    pincode:       { type: String, required: [true, "Pincode is required"], match: [/^\d{6}$/, "Invalid pincode"] },

    // ─── Identity ────────────────────────────────────────
    aadhaarNumber: {
      type: String, required: [true, "Aadhaar number is required"],
      unique: true, match: [/^\d{12}$/, "Aadhaar must be 12 digits"],
    },
    panNumber: {
      type: String, required: [true, "PAN number is required"],
      unique: true, uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number"],
    },

    // ─── Documents ───────────────────────────────────────
    documents: {
      aadhaarFront:          { type: String, required: [true, "Aadhaar front photo is required"] },
      aadhaarBack:           { type: String, required: [true, "Aadhaar back photo is required"] },
      panCard:               { type: String, required: [true, "PAN card photo is required"] },
      barCouncilCertificate: { type: String, required: [true, "Bar Council certificate is required"] },
    },
    liveSelfie: { type: String, required: [true, "Live selfie is required"] },

    // ─── Bank Details ────────────────────────────────────
    bankDetails: {
      accountHolderName: { type: String, required: [true, "Account holder name is required"], trim: true },
      bankName:          { type: String, required: [true, "Bank name is required"], trim: true },
      accountNumber:     { type: String, required: [true, "Account number is required"], trim: true },
      ifscCode:          { type: String, required: [true, "IFSC code is required"], uppercase: true, match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"] },
      upiId:             { type: String, trim: true, default: null },
    },

    // ─── Availability — NO enum, free string array ────────
    availableDays: { type: [String], required: [true, "Available days are required"] },
    availableHours: {
      from: { type: String, required: [true, "Available from time is required"] },
      to:   { type: String, required: [true, "Available to time is required"] },
    },
    perDocumentFee: { type: Number, required: [true, "Per document fee is required"], min: [100, "Minimum fee is ₹100"] },

    // ─── Verification ────────────────────────────────────
    isEmailVerified:  { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false },

    // ─── Active — seedha true, koi approval nahi ─────────
    isActive: { type: Boolean, default: true },

    // ─── Role ────────────────────────────────────────────
    role: { type: String, default: "advocate" },
  },
  { timestamps: true }
);

// ─── Password Hash ────────────────────────────────────────
advocateSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt    = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── Password Compare ─────────────────────────────────────
advocateSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Advocate", advocateSchema);