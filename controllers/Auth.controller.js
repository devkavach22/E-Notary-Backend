const jwt      = require("jsonwebtoken");
const Advocate = require("../models/Advocate");
const Admin    = require("../models/Admin");
const User     = require("../models/User");
const OTP      = require("../models/OTP");
const { generateOTP, sendForgetPasswordOTP } = require("./sendOTP");

// ─── Generate Token ───────────────────────────────────────
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// ─── Password Validator ───────────────────────────────────
const validatePassword = (password) => {
  if (!password)                return "Password is required";
  if (password.length < 8)     return "Password must be at least 8 characters";
  if (password.length > 28)    return "Password must not exceed 28 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one capital letter";
  return null;
};


// ─────────────────────────────────────────────────────────
// @route   POST /api/login
// ─────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password are required" });

    if (!role)
      return res.status(400).json({ success: false, message: "Role is required" });

    if (!["admin", "advocate", "user"].includes(role))
      return res.status(400).json({ success: false, message: "Invalid role. Must be admin, advocate or user" });

    // ── Find user based on role ──
    let user;
    if (role === "admin")    user = await Admin.findOne({ email }).select("+password");
    if (role === "advocate") user = await Advocate.findOne({ email }).select("+password");
    if (role === "user")     user = await User.findOne({ email }).select("+password");

    if (!user)
      return res.status(404).json({ success: false, message: `No ${role} account found with this email` });

    // ── Password reset pending check ──
    const pendingReset = await OTP.findOne({
      email,
      purpose:              "forget_password",
      isUsed:               false,
      passwordResetPending: true,
      expiresAt:            { $gt: new Date() },
    });

    if (pendingReset)
      return res.status(403).json({
        success: false,
        message: "Your password reset is in progress. Please complete it before logging in",
      });

    // ── Verify password ──
    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ success: false, message: "Incorrect password" });

    // ── Advocate-specific approval checks ──
    if (role === "advocate") {
      if (user.approvalStatus === "pending")
        return res.status(403).json({
          success: false,
          message: "Your account is under review. Please wait for admin approval",
        });

      if (user.approvalStatus === "rejected")
        return res.status(403).json({
          success: false,
          message: `Your account has been rejected. Reason: ${user.rejectionReason || "Contact admin"}`,
        });
    }

    const token = generateToken(user._id, role);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id:    user._id,
        email: user.email,
        role,
        ...(role === "admin" && {
          fullName: user.fullName,
        }),
        ...(role === "advocate" && {
          fullName:       user.fullName,
          approvalStatus: user.approvalStatus,
          practiceAreas:  user.practiceAreas,
        }),
        ...(role === "user" && {
          fullName: user.fullName,
        }),
      },
    });

  } catch (error) {
    console.error("login Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────
// @route   POST /api/send-forget-password-otp
// ─────────────────────────────────────────────────────────
const sendForgetPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // ── Check Admin → Advocate → User ──
    let user = await Admin.findOne({ email });
    if (!user) user = await Advocate.findOne({ email });
    if (!user) user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    const role = user.role;
    const otp  = generateOTP();

    // ── Purane forget_password OTPs delete karo is email ke ──
    await OTP.deleteMany({ email, purpose: "forget_password" });

    // ── Naya OTP MongoDB mein save karo ──
    await OTP.create({
      email,
      otp,
      purpose:              "forget_password",
      role,
      isUsed:               false,
      passwordResetPending: true,
      expiresAt:            new Date(Date.now() + 10 * 60 * 1000), // 10 min
    });

    await sendForgetPasswordOTP(email, otp);

    return res.status(200).json({
      success: true,
      message: "OTP has been sent to your email. Please reset your password to continue",
    });
  } catch (error) {
    console.error("sendForgetPasswordOtp Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// ─────────────────────────────────────────────────────────
// @route   POST /api/confirm-password
// ─────────────────────────────────────────────────────────
const confirmPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    // ── Required fields ──
    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, new password and confirm password are all required",
      });
    }

    // ── Passwords match ──
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    // ── Password strength validation ──
    const passwordErr = validatePassword(newPassword);
    if (passwordErr) {
      return res.status(400).json({ success: false, message: passwordErr });
    }

    // ── DB se OTP record fetch karo ──
    const record = await OTP.findOne({
      email,
      purpose: "forget_password",
      isUsed:  false,
    });

    if (!record) {
      return res.status(400).json({ success: false, message: "Please request an OTP first" });
    }

    // ── Expiry check ──
    if (new Date() > new Date(record.expiresAt)) {
      await OTP.deleteMany({ email, purpose: "forget_password" });
      return res.status(400).json({
        success: false,
        message: "OTP has expired, please request a new one",
      });
    }

    // ── OTP match check ──
    if (record.otp !== otp.toString()) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // ── Role ke basis pe model choose karo ──
    const { role } = record;
    const Model = role === "admin"
      ? Admin
      : role === "advocate"
      ? Advocate
      : User;

    const user = await Model.findOne({ email }).select("+password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ── Naya password save karo ──
    user.password = newPassword;
    await user.save();

    // ── OTP delete karo → login unblock ──
    await OTP.deleteMany({ email, purpose: "forget_password" });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. You can now login with your new password",
    });
  } catch (error) {
    console.error("confirmPassword Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


module.exports = { login, sendForgetPasswordOtp, confirmPassword };