const Advocate = require("../models/Advocate");
const OTP = require("../models/OTP");
const { generateOTP, sendOTPEmail, sendAdminNewAdvocateNotification } = require("./sendOTP");

// ═══════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════
const validateEmail = (email) => {
  if (!email) return "Email is required";
  if (email.length > 30) return "Email must not exceed 30 characters";
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Invalid email address";
  return null;
};

const validatePassword = (password) => {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 28) return "Password must not exceed 28 characters";
  return null;
};

const validateMobile = (mobile) => {
  if (!mobile) return "Mobile number is required";
  if (!/^[6-9]\d{9}$/.test(mobile)) return "Invalid mobile number format";
  return null;
};

const validateBarCouncilNumber = (bcn) => {
  if (!bcn) return "Bar Council number is required";
  if (!/^[A-Z]{1,4}\/\d{1,6}\/\d{4}$/i.test(bcn.trim()))
    return "Invalid Bar Council number format. Expected format: STATE/NUMBER/YEAR (e.g. D/123/2020 or MH/4567/2019)";
  return null;
};

// ═══════════════════════════════════════════════════════════
// PRACTICE AREAS MASTER LIST  (37 areas)
// ═══════════════════════════════════════════════════════════
const PRACTICE_AREAS = [
  // Family & Personal
  "Divorce & Family Law",
  "Domestic Violence",
  "Child Custody & Adoption",
  "Matrimonial Disputes",
  "Maintenance & Alimony",

  // Property & Real Estate
  "Property & Real Estate",
  "Land Acquisition",
  "Rent & Tenancy",
  "Construction Disputes",

  // Criminal
  "Criminal Defense",
  "Bail & Anticipatory Bail",
  "Cyber Crime",
  "Cheque Bounce",
  "POCSO & Child Protection",

  // Civil & Corporate
  "Civil Litigation",
  "Corporate & Business Law",
  "Contract Disputes",
  "Partnership & Startup Law",
  "Mergers & Acquisitions",

  // Finance & Tax
  "Banking & Finance",
  "Tax Law",
  "GST & Indirect Tax",
  "Debt Recovery & Insolvency",

  // Employment & Labour
  "Labour & Employment",
  "Wrongful Termination",
  "PF & ESI Disputes",

  // Consumer & Rights
  "Consumer Protection",
  "RTI & Public Interest",
  "Human Rights",

  // Specialized
  "Intellectual Property",
  "Immigration",
  "Motor Accident Claims",
  "Medical Negligence",
  "Insurance Disputes",
  "Environmental Law",
  "Arbitration & Mediation",
];

// ═══════════════════════════════════════════════════════════
// parseDOB
// Accepts: DD/MM/YYYY | YYYY-MM-DD | ISO string
// Always stores as UTC noon to avoid timezone date shift
// ═══════════════════════════════════════════════════════════
const parseDOB = (dobInput) => {
  if (!dobInput) return null;
  const str = String(dobInput).trim();

  // DD/MM/YYYY  (frontend date-picker format)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [day, month, year] = str.split("/");
    return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T12:00:00.000Z`);
  }

  // YYYY-MM-DD  (HTML date input / ISO date)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T12:00:00.000Z`);
  }

  // Full ISO with time component
  if (str.includes("T")) {
    const d = new Date(str);
    if (!isNaN(d)) { d.setUTCHours(12, 0, 0, 0); return d; }
  }

  // Fallback – any parseable string
  const d = new Date(str);
  if (!isNaN(d)) { d.setUTCHours(12, 0, 0, 0); return d; }

  return null;
};

// ═══════════════════════════════════════════════════════════
// SEND EMAIL OTP
// ═══════════════════════════════════════════════════════════
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ success: false, message: emailErr });

    const existing = await Advocate.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: "Email already registered" });

    // ✅ Check karo — kya valid (unexpired, unused) OTP already exist karta hai?
    const existingOTP = await OTP.findOne({
      email,
      purpose: "email_verify",
      isUsed: false,
      expiresAt: { $gt: new Date() }, // abhi bhi valid hai
    });

    if (existingOTP) {
      // Purana OTP reuse karo — resend karo same OTP
      await sendOTPEmail(email, existingOTP.otp, "email_verify");
      return res.status(200).json({ success: true, message: "OTP resent successfully (previous OTP is still valid)" });
    }

    // Naya OTP banao — purana expire ho chuka hai ya exist nahi karta
    await OTP.deleteMany({ email, purpose: "email_verify" }); // cleanup
    const otp = generateOTP();
    await OTP.create({ email, otp, purpose: "email_verify" });
    await sendOTPEmail(email, otp, "email_verify");

    return res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("sendOTP Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// VERIFY EMAIL OTP
// ═══════════════════════════════════════════════════════════
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ success: false, message: "Email and OTP are required" });

    const otpRecord = await OTP.findOne({ email, purpose: "email_verify", isUsed: false });
    if (!otpRecord)
      return res.status(404).json({ success: false, message: "OTP not found or already used" });
    if (otpRecord.expiresAt < new Date())
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one" });
    if (otpRecord.otp !== otp)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    otpRecord.isUsed = true;
    await otpRecord.save();

    return res.status(200).json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    console.error("verifyOTP Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// SEND MOBILE OTP  (hardcoded test OTP)
// ═══════════════════════════════════════════════════════════
const TEST_MOBILE_OTP = "872356";

const sendMobileOTP = async (req, res) => {
  try {
    const { mobile } = req.body;

    const mobileErr = validateMobile(mobile);
    if (mobileErr) return res.status(400).json({ success: false, message: mobileErr });

    // ✅ Check karo — kya valid OTP already exist karta hai?
    const existingOTP = await OTP.findOne({
      mobile,
      purpose: "mobile_verify",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (existingOTP) {
      // Reuse — same OTP dobara "send" karo (test mode mein sirf response mein dikhao)
      return res.status(200).json({
        success: true,
        message: `OTP resent successfully (Test OTP: ${existingOTP.otp})`,
      });
    }

    // Naya OTP banao
    await OTP.deleteMany({ mobile, purpose: "mobile_verify" }); // cleanup
    await OTP.create({ mobile, otp: TEST_MOBILE_OTP, purpose: "mobile_verify" });

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully (Test OTP: ${TEST_MOBILE_OTP})`,
    });
  } catch (error) {
    console.error("sendMobileOTP Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// VERIFY MOBILE OTP
// ═══════════════════════════════════════════════════════════
const verifyMobileOTP = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp)
      return res.status(400).json({ success: false, message: "Mobile and OTP are required" });

    const otpRecord = await OTP.findOne({ mobile, purpose: "mobile_verify", isUsed: false });
    if (!otpRecord)
      return res.status(404).json({ success: false, message: "OTP not found or already used. Please request a new one." });
    if (otpRecord.expiresAt < new Date())
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    if (otpRecord.otp !== otp)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    otpRecord.isUsed = true;
    await otpRecord.save();
    await Advocate.findOneAndUpdate({ mobile }, { isMobileVerified: true });

    return res.status(200).json({ success: true, message: "Mobile verified successfully" });
  } catch (error) {
    console.error("verifyMobileOTP Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// @route  POST /api/register
// Files: aadhaarFront, aadhaarBack, panCard,
//        barCouncilCertificate  — admin verifies after.
// ═══════════════════════════════════════════════════════════
const registerAdvocate = async (req, res) => {
  try {
    const {
      fullName, dateOfBirth, gender, mobile, email, password,
      barCouncilNumber, barCouncilState, yearOfEnrollment,
      practiceAreas, languagesKnown, city, state, officeAddress,
      pincode, aadhaarNumber, panNumber, accountHolderName,
      bankName, accountNumber, ifscCode, upiId,
      availableDays, availableFrom, availableTo, perDocumentFee,
    } = req.body;

    const files = req.files;

    // ── Field-level validations ──────────────────────────
    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ success: false, message: emailErr });

    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ success: false, message: passwordErr });

    const mobileErr = validateMobile(mobile);
    if (mobileErr) return res.status(400).json({ success: false, message: mobileErr });

    const bcnErr = validateBarCouncilNumber(barCouncilNumber);
    if (bcnErr) return res.status(400).json({ success: false, message: bcnErr });

    if (!fullName?.trim()) return res.status(400).json({ success: false, message: "Full name is required" });
    if (!dateOfBirth) return res.status(400).json({ success: false, message: "Date of birth is required" });
    if (!gender) return res.status(400).json({ success: false, message: "Gender is required" });
    if (!barCouncilState?.trim()) return res.status(400).json({ success: false, message: "Bar Council state is required" });
    if (!yearOfEnrollment) return res.status(400).json({ success: false, message: "Year of enrollment is required" });
    if (!city?.trim()) return res.status(400).json({ success: false, message: "City is required" });
    if (!state?.trim()) return res.status(400).json({ success: false, message: "State is required" });
    if (!officeAddress?.trim()) return res.status(400).json({ success: false, message: "Office address is required" });
    if (!pincode || !/^\d{6}$/.test(pincode))
      return res.status(400).json({ success: false, message: "Invalid pincode. Must be 6 digits" });
    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber))
      return res.status(400).json({ success: false, message: "Aadhaar number must be exactly 12 digits" });
    if (!panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(panNumber))
      return res.status(400).json({ success: false, message: "Invalid PAN number format" });
    if (!ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode))
      return res.status(400).json({ success: false, message: "Invalid IFSC code format" });

    // ── File checks ──────────────────────────────────────
    if (!files?.aadhaarFront?.[0]) return res.status(400).json({ success: false, message: "Aadhaar front is required" });
    if (!files?.aadhaarBack?.[0]) return res.status(400).json({ success: false, message: "Aadhaar back is required" });
    if (!files?.panCard?.[0]) return res.status(400).json({ success: false, message: "PAN card is required" });
    if (!files?.barCouncilCertificate?.[0]) return res.status(400).json({ success: false, message: "Bar Council certificate is required" });

    const parsedDOB = parseDOB(dateOfBirth);
    if (!parsedDOB) return res.status(400).json({ success: false, message: "Invalid dateOfBirth format" });

    // ── Duplicate checks (409) ──────────────────────────
    if (await Advocate.findOne({ email }))
      return res.status(409).json({ success: false, message: "Email already registered" });
    if (await Advocate.findOne({ mobile }))
      return res.status(409).json({ success: false, message: "Mobile number already registered" });
    if (await Advocate.findOne({ aadhaarNumber }))
      return res.status(409).json({ success: false, message: "Aadhaar number already registered" });
    if (await Advocate.findOne({ panNumber: panNumber.toUpperCase() }))
      return res.status(409).json({ success: false, message: "PAN number already registered" });
    if (await Advocate.findOne({ barCouncilNumber: barCouncilNumber.toUpperCase() }))
      return res.status(409).json({ success: false, message: "Bar Council number already registered" });

    // ── OTP verified checks ──────────────────────────────
    const emailOTPVerified = await OTP.findOne({ email, purpose: "email_verify", isUsed: true });
    if (!emailOTPVerified)
      return res.status(400).json({ success: false, message: "Email is not verified. Please verify your email first" });

    const mobileOTPVerified = await OTP.findOne({ mobile, purpose: "mobile_verify", isUsed: true });
    if (!mobileOTPVerified)
      return res.status(400).json({ success: false, message: "Mobile is not verified. Please verify your mobile first" });

    const parsedPracticeAreas = typeof practiceAreas === "string" ? JSON.parse(practiceAreas) : practiceAreas;
    const parsedLanguages = typeof languagesKnown === "string" ? JSON.parse(languagesKnown) : languagesKnown;
    const parsedAvailableDays = typeof availableDays === "string" ? JSON.parse(availableDays) : availableDays;

    // ── Validate practice areas against master list ──────
    const invalidAreas = parsedPracticeAreas.filter((area) => !PRACTICE_AREAS.includes(area));
    if (invalidAreas.length > 0)
      return res.status(400).json({
        success: false,
        message: `Invalid practice area(s): ${invalidAreas.join(", ")}. Please select from the available options.`,
      });

    // ── Create advocate — isActive: false, pending admin approval ──
    const advocate = await Advocate.create({
      fullName,
      dateOfBirth: parsedDOB,
      gender,
      mobile,
      email,
      password,
      barCouncilNumber: barCouncilNumber.toUpperCase(),
      barCouncilState,
      yearOfEnrollment,
      practiceAreas: parsedPracticeAreas,
      languagesKnown: parsedLanguages,
      city, state, officeAddress, pincode,
      aadhaarNumber,
      panNumber: panNumber.toUpperCase(),
      documents: {
        aadhaarFront: files.aadhaarFront[0].path,
        aadhaarBack: files.aadhaarBack[0].path,
        panCard: files.panCard[0].path,
        barCouncilCertificate: files.barCouncilCertificate[0].path,
      },
      bankDetails: {
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode: ifscCode.toUpperCase(),
        upiId: upiId || null,
      },
      availableDays: parsedAvailableDays,
      availableHours: { from: availableFrom, to: availableTo },
      perDocumentFee,
      isEmailVerified: true,
      isMobileVerified: true,
      documentStatus: "pending_review",
      approvalStatus: "pending",
      isActive: false,
    });

    // ── Notify admin about new advocate registration ─────
    try {
      await sendAdminNewAdvocateNotification(advocate);
    } catch (mailErr) {
      console.error("Admin notification email error:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Registration successful! Your documents are under review. You will be notified once approved.",
      data: {
        id: advocate._id,
        fullName: advocate.fullName,
        email: advocate.email,
        role: advocate.role,
        documentStatus: advocate.documentStatus,
        approvalStatus: advocate.approvalStatus,
      },
    });

  } catch (error) {
    console.error("registerAdvocate Error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({ success: false, message: `${field} already exists` });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// @route  GET /api/advocates/practice-areas
// Returns master list of all available practice areas
// Frontend uses this to populate dropdowns / multi-select
// ═══════════════════════════════════════════════════════════
const getPracticeAreas = async (req, res) => {
  return res.status(200).json({
    success: true,
    total: PRACTICE_AREAS.length,
    data: PRACTICE_AREAS,
  });
};

// ═══════════════════════════════════════════════════════════
// @route  GET /api/advocates/:id
// ═══════════════════════════════════════════════════════════
const getLoginAdvocate = async (req, res) => {
  try {
    // req.advocate is set by your auth middleware
    const advocate = await Advocate.findById(req.advocate._id).select("-password");
    if (!advocate)
      return res.status(404).json({ success: false, message: "Advocate not found" });

    return res.status(200).json({ success: true, data: advocate });
  } catch (error) {
    console.error("getMe Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  sendMobileOTP,
  verifyMobileOTP,
  registerAdvocate,
  getPracticeAreas,
getLoginAdvocate};