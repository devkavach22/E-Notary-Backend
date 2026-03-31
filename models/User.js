const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        // ─── Contact Details ─────────────────────────────────
        email: {
            type:      String,
            required:  [true, "Email is required"],
            unique:    true,
            lowercase: true,
            trim:      true,
            maxlength: [30, "Email must not exceed 30 characters"],
            match:     [/^\S+@\S+\.\S+$/, "Invalid email address"],
        },
        mobile: {
            type:     String,
            required: [true, "Mobile number is required"],
            unique:   true,
            trim:     true,
            match:    [/^[6-9]\d{9}$/, "Invalid mobile number"],
        },
        password: {
            type:      String,
            required:  [true, "Password is required"],
            minlength: [8,  "Password must be at least 8 characters"],
            maxlength: [28, "Password must not exceed 28 characters"],
            select:    false,
        },

        // ─── Personal Details (OCR se auto fill) ─────────────
        fullName:    { type: String, required: [true, "Full name is required"], trim: true },
        dateOfBirth: { type: Date,   required: [true, "Date of birth is required"] },
        gender: {
            type:     String,
            enum:     ["male", "female", "other"],
            required: false,
            default:  null,
        },

        // ─── Identity ─────────────────────────────────────────
        aadhaarNumber: {
            type:     String,
            required: [true, "Aadhaar number is required"],
            unique:   true,
            match:    [/^\d{12}$/, "Aadhaar must be 12 digits"],
        },
        panNumber: {
            type:      String,
            required:  [true, "PAN number is required"],
            unique:    true,
            uppercase: true,
            match:     [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number"],
        },

        // ─── Documents ────────────────────────────────────────
        documents: {
            aadhaarFront: { type: String, required: [true, "Aadhaar front is required"] },
            panCard:      { type: String, required: [true, "PAN card is required"] },
        },

        // ─── Address ──────────────────────────────────────────
        address: { type: String, required: [true, "Address is required"],  trim: true },
        city:    { type: String, required: [true, "City is required"],     trim: true },
        state:   { type: String, required: [true, "State is required"],    trim: true },
        pincode: { type: String, required: [true, "Pincode is required"],  match: [/^\d{6}$/, "Invalid pincode"] },

        // ─── Role ─────────────────────────────────────────────
        role: { type: String, default: "user" },

        // ─── Verification ─────────────────────────────────────
        isEmailVerified:  { type: Boolean, default: false },
        isMobileVerified: { type: Boolean, default: false },

        // ─── Document Verification Checks ─────────────────────
        verificationChecks: {
            aadhaarVerified: { type: Boolean, default: false },
            panVerified:     { type: Boolean, default: false },
        },

        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// ─── Password Hash ────────────────────────────────────────
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt    = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// ─── Password Compare ─────────────────────────────────────
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);