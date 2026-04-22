const Advocate = require("../models/Advocate");
const User = require("../models/User");
const OTP = require("../models/OTP");
const fs  = require("fs");
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



    // ── Duplicate checks ────────────────────────────────
    // Email — block only if registered in BOTH collections
    const emailInAdv  = await Advocate.findOne({ email });
    const emailInUser = await User.findOne({ email });
    if (emailInAdv && emailInUser)
      return res.status(409).json({ success: false, message: "Email already registered in both accounts" });

    // If email already exists only in Advocate collection
    if (emailInAdv)
      return res.status(409).json({ success: false, message: "Email already registered as an advocate" });

    // Mobile — block only if registered in BOTH collections
    const mobileInAdv  = await Advocate.findOne({ mobile });
    const mobileInUser = await User.findOne({ mobile });
    if (mobileInAdv && mobileInUser)
      return res.status(409).json({ success: false, message: "Mobile number already registered in both accounts" });

    // If mobile already exists only in Advocate collection
    if (mobileInAdv)
      return res.status(409).json({ success: false, message: "Mobile number already registered as an advocate" });

    // Bar Council Number — must be unique
    const bcnExists = await Advocate.findOne({ barCouncilNumber: barCouncilNumber.toUpperCase() });
    if (bcnExists)
      return res.status(409).json({ success: false, message: "Bar Council number is already registered" });

    // Aadhaar Number — must be unique
    const aadhaarExists = await Advocate.findOne({ aadhaarNumber });
    if (aadhaarExists)
      return res.status(409).json({ success: false, message: "Aadhaar number is already registered" });

    // PAN Number — must be unique
    const panExists = await Advocate.findOne({ panNumber: panNumber.toUpperCase() });
    if (panExists)
      return res.status(409).json({ success: false, message: "PAN number is already registered" });

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

      // ✅ Profile picture — optional
      profilePicAdvocate: files?.profilePicAdvocate?.[0]?.path || null,

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

    // Catch any remaining MongoDB duplicate key errors as a safety net
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const fieldNames = {
        email:            "Email",
        mobile:           "Mobile number",
        barCouncilNumber: "Bar Council number",
        aadhaarNumber:    "Aadhaar number",
        panNumber:        "PAN number",
      };
      const friendlyName = fieldNames[field] || field;
      return res.status(409).json({
        success: false,
        message: `${friendlyName} is already registered`,
      });
    }

    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const getPracticeAreas = async (req, res) => {
  return res.status(200).json({
    success: true,
    total: PRACTICE_AREAS_GROUPED.length,
    grouped: PRACTICE_AREAS_GROUPED,
  });
};

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

// ═══════════════════════════════════════════════════════════
// HELPER — delete old file from disk
// ═══════════════════════════════════════════════════════════
const deleteOldFile = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error("File delete error:", err.message);
  }
};

// ═══════════════════════════════════════════════════════════
// EDIT ADVOCATE PROFILE  (PUT /api/advocate/profile)
// Allowed: email, mobile, officeAddress, city, state,
//          pincode, availableDays, availableFrom,
//          availableTo, perDocumentFee, profilePicAdvocate
// ═══════════════════════════════════════════════════════════
const editAdvocateProfile = async (req, res) => {
  try {
    const advocateId = req.advocate._id;

    const {
      email,
      mobile,
      officeAddress,
      city,
      state,
      pincode,
      availableDays,
      availableFrom,
      availableTo,
      perDocumentFee,
    } = req.body;

    const files = req.files;

    // ── Fetch current advocate ───────────────────────────
    const advocate = await Advocate.findById(advocateId);
    if (!advocate)
      return res.status(404).json({ success: false, message: "Advocate not found" });

    const updates = {};

    // ════════════════════════════════════════════════════
    // 1. EMAIL
    // ════════════════════════════════════════════════════
    if (email && email !== advocate.email) {
      const emailErr = validateEmail(email);
      if (emailErr)
        return res.status(400).json({ success: false, message: emailErr });

      const emailInAdv  = await Advocate.findOne({ email, _id: { $ne: advocateId } });
      const emailInUser = await User.findOne({ email });
      if (emailInAdv)
        return res.status(409).json({ success: false, message: "Email already registered as an advocate" });
      if (emailInUser)
        return res.status(409).json({ success: false, message: "Email already registered as a user" });

      // New email must be OTP-verified
      const emailOTPVerified = await OTP.findOne({ email, purpose: "email_verify", isUsed: true });
      if (!emailOTPVerified)
        return res.status(400).json({ success: false, message: "New email is not verified. Please verify via OTP first." });

      updates.email           = email.toLowerCase().trim();
      updates.isEmailVerified = true;
    }

    // ════════════════════════════════════════════════════
    // 2. MOBILE
    // ════════════════════════════════════════════════════
    if (mobile && mobile !== advocate.mobile) {
      const mobileErr = validateMobile(mobile);
      if (mobileErr)
        return res.status(400).json({ success: false, message: mobileErr });

      const mobileInAdv  = await Advocate.findOne({ mobile, _id: { $ne: advocateId } });
      const mobileInUser = await User.findOne({ mobile });
      if (mobileInAdv)
        return res.status(409).json({ success: false, message: "Mobile number already registered as an advocate" });
      if (mobileInUser)
        return res.status(409).json({ success: false, message: "Mobile number already registered as a user" });

      // New mobile must be OTP-verified
      const mobileOTPVerified = await OTP.findOne({ mobile, purpose: "mobile_verify", isUsed: true });
      if (!mobileOTPVerified)
        return res.status(400).json({ success: false, message: "New mobile is not verified. Please verify via OTP first." });

      updates.mobile           = mobile;
      updates.isMobileVerified = true;
    }

    // ════════════════════════════════════════════════════
    // 3. ADDRESS
    // ════════════════════════════════════════════════════
    if (officeAddress) updates.officeAddress = officeAddress.trim();
    if (city)          updates.city          = city.trim();
    if (state)         updates.state         = state.trim();

    if (pincode) {
      if (!/^\d{6}$/.test(pincode))
        return res.status(400).json({ success: false, message: "Invalid pincode. Must be 6 digits." });
      updates.pincode = pincode;
    }

    // ════════════════════════════════════════════════════
    // 4. AVAILABILITY
    // ════════════════════════════════════════════════════
    if (availableDays) {
      const parsedDays = typeof availableDays === "string"
        ? JSON.parse(availableDays)
        : availableDays;

      if (!Array.isArray(parsedDays) || parsedDays.length === 0)
        return res.status(400).json({ success: false, message: "availableDays must be a non-empty array" });

      updates.availableDays = parsedDays;
    }

    if (availableFrom || availableTo) {
      updates.availableHours = {
        from: availableFrom || advocate.availableHours.from,
        to:   availableTo   || advocate.availableHours.to,
      };
    }

    // ════════════════════════════════════════════════════
    // 5. PER DOCUMENT FEE
    // ════════════════════════════════════════════════════
    if (perDocumentFee !== undefined && perDocumentFee !== "") {
      const fee = Number(perDocumentFee);
      if (isNaN(fee) || fee < 100)
        return res.status(400).json({ success: false, message: "perDocumentFee must be a number and at least ₹100" });
      updates.perDocumentFee = fee;
    }

    // ════════════════════════════════════════════════════
    // 6. PROFILE PICTURE
    // ════════════════════════════════════════════════════
    if (files?.profilePicAdvocate?.[0]?.path) {
      deleteOldFile(advocate.profilePicAdvocate); // remove old pic from disk
      updates.profilePicAdvocate = files.profilePicAdvocate[0].path;
    }

    // ── Nothing to update? ───────────────────────────────
    if (Object.keys(updates).length === 0)
      return res.status(400).json({ success: false, message: "No valid fields provided to update" });

    // ── Apply updates ────────────────────────────────────
    const updatedAdvocate = await Advocate.findByIdAndUpdate(
      advocateId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedAdvocate,
    });

  } catch (error) {
    console.error("editAdvocateProfile Error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const fieldNames = { email: "Email", mobile: "Mobile number" };
      return res.status(409).json({
        success: false,
        message: `${fieldNames[field] || field} is already registered`,
      });
    }

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
  editAdvocateProfile,
};