const Advocate = require("../models/Advocate");
const User = require("../models/User");
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
// PRACTICE AREAS — GROUPED MASTER LIST
// ═══════════════════════════════════════════════════════════
const PRACTICE_AREAS_GROUPED = [
  {
    group: "Civil & Family",
    areas: [
      "Civil Litigation",
      "Contract Disputes",
      "Divorce & Family Law",
      "Domestic Violence",
      "Child Custody & Adoption",
      "Matrimonial Disputes",
      "Maintenance & Alimony",
    ],
  },
  {
    group: "Property & Real Estate",
    areas: [
      "Property & Real Estate",
      "Land Acquisition",
      "Rent & Tenancy",
      "Construction Disputes",
    ],
  },
  {
    group: "Criminal",
    areas: [
      "Criminal Defense",
      "Bail & Anticipatory Bail",
      "Cyber Crime",
      "Cheque Bounce",
      "POCSO & Child Protection",
    ],
  },
  {
    group: "Corporate & Business",
    areas: [
      "Corporate & Business Law",
      "Partnership & Startup Law",
      "Mergers & Acquisitions",
    ],
  },
  {
    group: "Finance & Tax",
    areas: [
      "Banking & Finance",
      "Tax Law",
      "GST & Indirect Tax",
      "Debt Recovery & Insolvency",
    ],
  },
  {
    group: "Employment & Labour",
    areas: [
      "Labour & Employment",
      "Wrongful Termination",
      "PF & ESI Disputes",
    ],
  },
  {
    group: "Consumer & Rights",
    areas: [
      "Consumer Protection",
      "RTI & Public Interest",
      "Human Rights",
    ],
  },
  {
    group: "Specialized",
    areas: [
      "Intellectual Property",
      "Immigration",
      "Motor Accident Claims",
      "Medical Negligence",
      "Insurance Disputes",
      "Environmental Law",
      "Arbitration & Mediation",
    ],
  },
];

// Flat list of all individual areas — for category validation
const PRACTICE_AREAS = PRACTICE_AREAS_GROUPED.flatMap((g) => g.areas);

const getGroupForArea = (area) => {
  const found = PRACTICE_AREAS_GROUPED.find((g) => g.areas.includes(area));
  return found ? found.group : null;
};

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

    const inAdvocate = await Advocate.findOne({ email });
    const inUser     = await User.findOne({ email });
    if (inAdvocate && inUser)
      return res.status(409).json({ success: false, message: "Email already registered in both accounts" });

    const existingOTP = await OTP.findOne({
      email,
      purpose: "email_verify",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (existingOTP) {
      await sendOTPEmail(email, existingOTP.otp, "email_verify");
      return res.status(200).json({ success: true, message: "OTP resent successfully (previous OTP is still valid)" });
    }

    await OTP.deleteMany({ email, purpose: "email_verify" });
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

    // Block only if mobile exists in BOTH tables
    const mobileInAdv  = await Advocate.findOne({ mobile });
    const mobileInUser = await User.findOne({ mobile });
    if (mobileInAdv && mobileInUser)
      return res.status(409).json({ success: false, message: "Mobile number already registered in both accounts" });

    const existingOTP = await OTP.findOne({
      mobile,
      purpose: "mobile_verify",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (existingOTP) {
      return res.status(200).json({
        success: true,
        message: `OTP resent successfully (Test OTP: ${existingOTP.otp})`,
      });
    }

    await OTP.deleteMany({ mobile, purpose: "mobile_verify" });
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
// REGISTER ADVOCATE
// practiceAreas = group names  (e.g. "Civil & Family")
// categories    = specific areas inside those groups
//                 (e.g. "Divorce & Family Law", "Civil Litigation")
// ═══════════════════════════════════════════════════════════
const registerAdvocate = async (req, res) => {
  try {
    const {
      fullName, dateOfBirth, gender, mobile, email, password,
      barCouncilNumber, barCouncilState, yearOfEnrollment,
      practiceAreas, categories, languagesKnown, city, state,
      officeAddress, pincode, aadhaarNumber, panNumber,
      accountHolderName, bankName, accountNumber, ifscCode, upiId,
      availableDays, availableFrom, availableTo, perDocumentFee,
    } = req.body;

    const files = req.files;

    // ── Basic field validations ──────────────────────────
    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ success: false, message: emailErr });

    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ success: false, message: passwordErr });

    const mobileErr = validateMobile(mobile);
    if (mobileErr) return res.status(400).json({ success: false, message: mobileErr });

    const bcnErr = validateBarCouncilNumber(barCouncilNumber);
    if (bcnErr) return res.status(400).json({ success: false, message: bcnErr });

    const parsedDOB = parseDOB(dateOfBirth);
    if (!parsedDOB) return res.status(400).json({ success: false, message: "Invalid dateOfBirth format" });

    // ── Duplicate checks (cross-collection) ─────────────
    // Block only if the same email/mobile exists in BOTH tables
    const emailInAdv  = await Advocate.findOne({ email });
    const emailInUser = await User.findOne({ email });
    if (emailInAdv && emailInUser)
      return res.status(409).json({ success: false, message: "Email already registered in both accounts" });

    const mobileInAdv  = await Advocate.findOne({ mobile });
    const mobileInUser = await User.findOne({ mobile });
    if (mobileInAdv && mobileInUser)
      return res.status(409).json({ success: false, message: "Mobile number already registered in both accounts" });

    // ── OTP verified check ───────────────────────────────
    const emailOTPVerified = await OTP.findOne({ email, purpose: "email_verify", isUsed: true });
    if (!emailOTPVerified)
      return res.status(400).json({ success: false, message: "Email is not verified." });

    // ── Parse array fields ───────────────────────────────
    const parsedPracticeAreas  = typeof practiceAreas  === "string" ? JSON.parse(practiceAreas)  : practiceAreas;
    const parsedCategories     = typeof categories     === "string" ? JSON.parse(categories)     : categories;
    const parsedLanguages      = typeof languagesKnown === "string" ? JSON.parse(languagesKnown) : languagesKnown;
    const parsedAvailableDays  = typeof availableDays  === "string" ? JSON.parse(availableDays)  : availableDays;

    // ── Validate practiceAreas — must be valid GROUP names ──
    const VALID_GROUPS = PRACTICE_AREAS_GROUPED.map(g => g.group);
    const invalidAreas = parsedPracticeAreas.filter(area => !VALID_GROUPS.includes(area));
    if (invalidAreas.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid practice area(s): ${invalidAreas.join(", ")}. Valid options: ${VALID_GROUPS.join(", ")}`,
      });
    }

    // ── Validate categories — must be valid individual AREA names ──
    const invalidCats = parsedCategories.filter(cat => !PRACTICE_AREAS.includes(cat));
    if (invalidCats.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid category(ies): ${invalidCats.join(", ")}`,
      });
    }

    // ── Cross-check: every category must belong to one of the selected practiceAreas (groups) ──
    const invalidCross = parsedCategories.filter(cat => {
      const group = getGroupForArea(cat);
      return !parsedPracticeAreas.includes(group);
    });
    if (invalidCross.length > 0) {
      return res.status(400).json({
        success: false,
        message: `These categories don't belong to your selected practice areas: ${invalidCross.join(", ")}`,
      });
    }

    // ── Create advocate ──────────────────────────────────
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
      categories: parsedCategories,
      languagesKnown: parsedLanguages,
      city, state, officeAddress, pincode,
      aadhaarNumber,
      panNumber: panNumber.toUpperCase(),
      documents: {
        aadhaarFront:          files.aadhaarFront[0].path,
        aadhaarBack:           files.aadhaarBack[0].path,
        panCard:               files.panCard[0].path,
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
      isEmailVerified:  true,
      isMobileVerified: true,
      documentStatus:   "pending_review",
      approvalStatus:   "pending",
      isActive:         false,
    });

    try {
      await sendAdminNewAdvocateNotification(advocate);
    } catch (mailErr) {
      console.error("Admin notification error:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Registration successful! Your documents are under review.",
      data: { id: advocate._id, email: advocate.email },
    });

  } catch (error) {
    console.error("registerAdvocate Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// GET PRACTICE AREAS (grouped)
// ═══════════════════════════════════════════════════════════
const getPracticeAreas = async (req, res) => {
  return res.status(200).json({
    success: true,
    total: PRACTICE_AREAS_GROUPED.length,
    grouped: PRACTICE_AREAS_GROUPED,
  });
};

// ═══════════════════════════════════════════════════════════
// GET LOGGED IN ADVOCATE
// ═══════════════════════════════════════════════════════════
const getLoginAdvocate = async (req, res) => {
  try {
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
  getLoginAdvocate,
};