const express = require("express");
const router = express.Router();
const {
  sendOTP, verifyOTP, sendMobileOTP, verifyMobileOTP,
  registerAdvocate,  getPracticeAreas,getLoginAdvocate
} = require("../controllers/advocate.controller");

const {
  createTemplate,
  getTemplates,
  getTemplateById,
  editTemplate,
  deleteTemplate,
} = require("../controllers/Template.controller");

const { login, sendForgetPasswordOtp, confirmPassword } = require("../controllers/Auth.controller");
const {
  advocateUpload, userUpload,
  recordingUpload,
  handleUploadError,
} = require("../middlewares/upload.middleware");
const { UserverifyDocuments, registerUser, getUserById, getAdvocatesForUser } = require("../controllers/User.controller");
const { bookAdvocate, getUserBookings } = require("../controllers/Booking.controller");
const {
  getAllAdvocates, getAdvocateDetails,
  verifyAdvocateDocuments,
  approveAdvocate, rejectAdvocate,
  getAllUsers, getUserDetails, getPendingAdvocates
} = require("../controllers/Admin.controller");
const { adminAuth, userAuth, advocateAuth } = require("../middlewares/Auth.middleware");

// ── Advocate Booking ──────────────────────────────────────
const {
  getPendingBookings, getAllBookings,
  confirmBooking, cancelBooking, getVideoCallRoom,
} = require("../controllers/AdvocateBooking.controller");

// ── Meeting Notes + Recording ─────────────────────────────
const {
  saveNote, getNote, downloadNote,
  uploadRecording, getRecordings, downloadRecording,
} = require("../controllers/MeetingData.controller");

// ─── OTP ─────────────────────────────────────────────────
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/send-mobile-otp", sendMobileOTP);
router.post("/verify-mobile-otp", verifyMobileOTP);

// ─── Auth ────────────────────────────────────────────────
router.post("/login", login);
router.post("/send-forget-password-otp", sendForgetPasswordOtp);
router.post("/confirm-password", confirmPassword);

// ─── Advocate ────────────────────────────────────────────
router.post("/register", advocateUpload, handleUploadError, registerAdvocate);
router.get("/advocates/practice-areas", getPracticeAreas);
router.get("/advocate/me", advocateAuth, getLoginAdvocate);
 
// ─── Template ─────────────────────────────────────────────

router.post  ("/create/template",        advocateAuth, createTemplate);
router.get   ("/templates",              advocateAuth, getTemplates);
router.get   ("/template/:templateId",   advocateAuth, getTemplateById);
router.put   ("/template/:templateId",   advocateAuth, editTemplate);
router.delete("/template/:templateId",   advocateAuth, deleteTemplate);

// ─── User ────────────────────────────────────────────────
router.post("/user/verify-documents", userUpload, handleUploadError, UserverifyDocuments);
router.post("/user/register", userUpload, handleUploadError, registerUser);
router.get("/user/advocates", getAdvocatesForUser);

// ─── Admin ───────────────────────────────────────────────
router.get("/admin/advocates",         adminAuth, getAllAdvocates);
router.get("/admin/users",             adminAuth, getAllUsers);
router.get("/admin/advocates/pending", adminAuth, getPendingAdvocates);

// ─── Booking ─────────────────────────────────────────────
router.post("/user/book-advocate", userAuth, bookAdvocate);
router.get("/user/bookings",       userAuth, getUserBookings);

// ─── Admin Actions ────────────────────────────────────────
router.put("/admin/advocate/:id/verify",  adminAuth, verifyAdvocateDocuments);
router.put("/admin/advocate/:id/approve", adminAuth, approveAdvocate);
router.put("/admin/advocate/:id/reject",  adminAuth, rejectAdvocate);
router.get("/admin/user/:id",             adminAuth, getUserDetails);
router.get("/admin/advocate/:id",         adminAuth, getAdvocateDetails);
router.get("/user/:id", getUserById);

// ─── Advocate Booking ─────────────────────────────────────
router.get("/advocate/bookings/pending",            advocateAuth, getPendingBookings);
router.get("/advocate/bookings",                    advocateAuth, getAllBookings);
router.put("/advocate/bookings/:bookingId/confirm", advocateAuth, confirmBooking);
router.put("/advocate/bookings/:bookingId/cancel",  advocateAuth, cancelBooking);

// ─── Video Call ───────────────────────────────────────────
router.get("/video-call/:roomId", isUserOrAdvocate, getVideoCallRoom);

// ─── Meeting Notes ────────────────────────────────────────
router.post("/meeting/notes",                    isUserOrAdvocate, saveNote);
router.get("/meeting/notes/:bookingId",          isUserOrAdvocate, getNote);
router.get("/meeting/notes/:bookingId/download", isUserOrAdvocate, downloadNote);

// ─── Meeting Recording ────────────────────────────────────
router.post(
  "/meeting/recording/upload",
  isUserOrAdvocate,
  (req, res, next) => recordingUpload(req, res, (err) => err ? next(err) : next()),
  handleUploadError,
  uploadRecording
);
router.get("/meeting/recordings/:bookingId",           isUserOrAdvocate, getRecordings);
router.get("/meeting/recording/:recordingId/download", isUserOrAdvocate, downloadRecording);

// ── Flexible auth: user OR advocate token ─────────────────
// ✅ FIXED: decoded token ke saare possible field names handle kiye
function isUserOrAdvocate(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  const jwt = require("jsonwebtoken");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("DECODED TOKEN →", decoded);

    if (decoded.role === "advocate") {
      req.advocate = decoded;
    } else {
      req.user = decoded;
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}

module.exports = router;