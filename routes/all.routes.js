const express = require("express");
const router  = express.Router();

const {
  sendOTP, verifyOTP, sendMobileOTP, verifyMobileOTP,
   registerAdvocate, getAdvocateById, getAdvocatesByType,getPracticeAreas
} = require("../controllers/advocate.controller");

const { login, sendForgetPasswordOtp, confirmPassword } = require("../controllers/Auth.controller");

const { advocateUpload, userUpload, handleUploadError } = require("../middlewares/upload.middleware");

const { UserverifyDocuments, registerUser, getUserById,getAdvocatesForUser } = require("../controllers/User.controller");

const {
  getAllAdvocates, getAdvocateDetails,
  verifyAdvocateDocuments,
  approveAdvocate, rejectAdvocate,
  getAllUsers, getUserDetails,getPendingAdvocates
} = require("../controllers/Admin.controller");

const { adminAuth } = require("../middlewares/Auth.middleware");

// ─── OTP ─────────────────────────────────────────────────
router.post("/send-otp",          sendOTP);
router.post("/verify-otp",        verifyOTP);
router.post("/send-mobile-otp",   sendMobileOTP);
router.post("/verify-mobile-otp", verifyMobileOTP);

// ─── Auth ────────────────────────────────────────────────
router.post("/login",                    login);
router.post("/send-forget-password-otp", sendForgetPasswordOtp);
router.post("/confirm-password",         confirmPassword);

// ─── Advocate ────────────────────────────────────────────
router.post("/register",                  advocateUpload, handleUploadError, registerAdvocate);

router.get("/advocates/practice-areas", getPracticeAreas);

router.get("/:id", getAdvocateById);

// ─── User ────────────────────────────────────────────────
router.post("/user/verify-documents", userUpload, handleUploadError, UserverifyDocuments);
router.post("/user/register",         userUpload, handleUploadError, registerUser);
router.get("/user/advocates", getAdvocatesForUser);
router.get("/user/:id",               getUserById);

// ─── Admin ───────────────────────────────────────────────
// List & detail
router.get("/admin/advocates",    adminAuth, getAllAdvocates);
router.get("/admin/advocate/:id", adminAuth, getAdvocateDetails);
router.get("/admin/users",        adminAuth, getAllUsers);
router.get("/admin/user/:id",     adminAuth, getUserDetails);
router.get("/admin/advocates/pending", adminAuth, getPendingAdvocates);   


// Verify documents → Approve / Reject advocate (admin only)
router.put("/admin/advocate/:id/verify",  adminAuth, verifyAdvocateDocuments);
router.put("/admin/advocate/:id/approve", adminAuth, approveAdvocate);
router.put("/admin/advocate/:id/reject",  adminAuth, rejectAdvocate);

module.exports = router;