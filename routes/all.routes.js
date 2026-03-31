const express = require("express");
const router  = express.Router();

const {
    sendOTP, verifyOTP, sendMobileOTP, verifyMobileOTP,
    advocateVerifyDocuments, registerAdvocate, getAdvocateById,
} = require("../controllers/advocate.controller");

const { login, sendForgetPasswordOtp, confirmPassword } = require("../controllers/Auth.controller");

const { advocateUpload, userUpload, handleUploadError } = require("../middlewares/upload.middleware");

const { UserverifyDocuments, registerUser, getUserById } = require("../controllers/User.controller");

const { getAllAdvocates, getAdvocateDetails, getAllUsers, getUserDetails } = require("../controllers/Admin.controller");

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
router.post("/advocate/verify-documents", advocateUpload, handleUploadError, advocateVerifyDocuments);
router.post("/register",                  advocateUpload, handleUploadError, registerAdvocate);
router.get("/:id",                        getAdvocateById);

// ─── User ────────────────────────────────────────────────
router.post("/user/verify-documents", userUpload, handleUploadError, UserverifyDocuments);
router.post("/user/register",         userUpload, handleUploadError, registerUser);
router.get("/user/:id",               getUserById);

// ─── Admin ───────────────────────────────────────────────
router.get("/admin/advocates",    adminAuth, getAllAdvocates);    
router.get("/admin/advocate/:id", adminAuth, getAdvocateDetails); 
router.get("/admin/users",        adminAuth, getAllUsers);
router.get("/admin/user/:id",     adminAuth, getUserDetails);    

module.exports = router;