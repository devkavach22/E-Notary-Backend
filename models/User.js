const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
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

        fullName:    { type: String, required: [function () { return this.role === "user"; }, "Full name is required"], trim: true },
        dateOfBirth: { type: Date,   required: [function () { return this.role === "user"; }, "Date of birth is required"] },
        gender: {
            type:     String,
            enum:     ["male", "female", "other"],
            required: false,
            default:  null,
        },

        aadhaarNumber: {
            type:     String,
            required: [function () { return this.role === "user"; }, "Aadhaar number is required"],
            unique:   true,
            sparse:   true,
            match:    [/^\d{12}$/, "Aadhaar must be 12 digits"],
        },
        panNumber: {
            type:      String,
            required:  [function () { return this.role === "user"; }, "PAN number is required"],
            unique:    true,
            sparse:    true,
            uppercase: true,
            match:     [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number"],
        },

        documents: {
            aadhaarFront: { type: String, required: [function () { return this.role === "user"; }, "Aadhaar front is required"] },
            panCard:      { type: String, required: [function () { return this.role === "user"; }, "PAN card is required"] },
        },

        address: { type: String, required: [function () { return this.role === "user"; }, "Address is required"],  trim: true },
        city:    { type: String, required: [function () { return this.role === "user"; }, "City is required"],     trim: true },
        state:   { type: String, required: [function () { return this.role === "user"; }, "State is required"],    trim: true },
        pincode: { type: String, required: [function () { return this.role === "user"; }, "Pincode is required"],  match: [/^\d{6}$/, "Invalid pincode"] },

        role: { type: String, default: "user", enum: ["user", "company"] },

        // ─── Verification ─────────────────────────────────────
        isEmailVerified:  { type: Boolean, default: false },
        isMobileVerified: { type: Boolean, default: false },

        verificationChecks: {
            aadhaarVerified: { type: Boolean, default: false },
            panVerified:     { type: Boolean, default: false },
        },

        isActive: { type: Boolean, default: true },

        inviteToken: {
            type:    String,
            default: null,
            trim:    true,
        },

        

        companyName: {
            type:     String,
            trim:     true,
            required: [function () { return this.role === "company"; }, "Company name is required"],
        },
        entityType: {
            type:     String,
            trim:     true,
            required: [function () { return this.role === "company"; }, "Entity type is required"],
        },
        registrationNumber: {
            type:      String,
            trim:      true,
            uppercase: true,
            unique:    true,
            sparse:    true,
            required:  [function () { return this.role === "company"; }, "Registration number is required"],
        },
        gstNumber: {
            type:      String,
            trim:      true,
            uppercase: true,
            sparse:    true,
            match: [
                /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
                "Invalid GST number format",
            ],
        },

        authorizedPerson: {
            fullName: {
                type:     String,
                trim:     true,
                required: [function () { return this.role === "company"; }, "Authorized person name is required"],
            },
            designation: {
                type:     String,
                trim:     true,
                required: [function () { return this.role === "company"; }, "Authorized person designation is required"],
            },
            email: {
                type:      String,
                trim:      true,
                lowercase: true,
                required:  [function () { return this.role === "company"; }, "Authorized person email is required"],
            },
            mobile: {
                type:     String,
                trim:     true,
                required: [function () { return this.role === "company"; }, "Authorized person mobile is required"],
            },
        },

        companyDocuments: {
            registrationCertificate: {
                type:     String,
                required: [function () { return this.role === "company"; }, "Registration certificate is required"],
            },
            authorizationLetter: {
                type:     String,
                required: [function () { return this.role === "company"; }, "Authorization letter is required"],
            },
        },

        registeredOfficeAddress: {
            type:     String,
            trim:     true,
            required: [function () { return this.role === "company"; }, "Registered office address is required"],
        },
        businessAddress: {
            type: String,
            trim: true,
        },
        companyCity: {
            type:     String,
            trim:     true,
            required: [function () { return this.role === "company"; }, "Company city is required"],
        },
        companyState: {
            type:     String,
            trim:     true,
            required: [function () { return this.role === "company"; }, "Company state is required"],
        },
        companyPincode: {
            type:     String,
            match:    [/^\d{6}$/, "Invalid pincode"],
            required: [function () { return this.role === "company"; }, "Company pincode is required"],
        },
    },
    { timestamps: true }
);

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt    = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);