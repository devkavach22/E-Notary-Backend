const express = require("express");
const router = express.Router();
const {
  sendOTP, verifyOTP, sendMobileOTP, verifyMobileOTP,
  registerAdvocate, getPracticeAreas, getLoginAdvocate, editAdvocateProfile
} = require("../controllers/advocate.controller");

const {
  createTemplate,
  getTemplates,
  getTemplateById,
  editTemplate,
  deleteTemplate,
  getFilledTemplates,
  rejectSubmission,
  acceptSubmission,
  getAdvocateDashboard
} = require("../controllers/Template.controller");

const { login, sendForgetPasswordOtp, confirmPassword } = require("../controllers/Auth.controller");
const {
  advocateUpload, userUpload,
  templateImageUpload,
  filledTemplateImageUpload,
  handleUploadError,
  companyUpload
} = require("../middlewares/upload.middleware");
const { UserverifyDocuments, registerUser, getUSerProfile, getAdvocatesForUser, getTemplatesForUser, fillTemplate, downloadFilledTemplate, editUserProfile, registerCompany } = require("../controllers/User.controller");
const {
  getAllAdvocates, getAdvocateDetails,
  verifyAdvocateDocuments,
  approveAdvocate, rejectAdvocate,
  getAllUsers, getUserDetails, getPendingAdvocates,
  getDashboardStats


} = require("../controllers/Admin.controller");
const { adminAuth, userAuth, advocateAuth } = require("../middlewares/Auth.middleware");
const { getUserCases } = require("../controllers/Booking.controller")


router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/send-mobile-otp", sendMobileOTP);
router.post("/verify-mobile-otp", verifyMobileOTP);

router.post("/login", login);
router.post("/send-forget-password-otp", sendForgetPasswordOtp);
router.post("/confirm-password", confirmPassword);

router.post("/register", advocateUpload, handleUploadError, registerAdvocate);
router.get("/advocates/practice-areas", getPracticeAreas);
router.get("/advocate/me", advocateAuth, getLoginAdvocate);
router.put("/advocate/profile/edit", advocateAuth, advocateUpload, handleUploadError, editAdvocateProfile);
router.get("/advocate/dashboard", advocateAuth, getAdvocateDashboard);


router.post("/create/template", templateImageUpload, handleUploadError, advocateAuth, createTemplate);
router.get("/templates", advocateAuth, getTemplates);
router.get("/template/:templateId", advocateAuth, getTemplateById);
router.put("/template/:templateId", templateImageUpload, handleUploadError, advocateAuth, editTemplate);
router.delete("/template/:templateId", advocateAuth, deleteTemplate);
router.get("/userfilled-templates", advocateAuth, getFilledTemplates);

router.patch("/submissions/:submissionId/accept", advocateAuth, acceptSubmission);
router.put("/submissions/:submissionId/reject", advocateAuth, rejectSubmission);

router.post("/user/verify-documents", userUpload, handleUploadError, UserverifyDocuments);
router.post("/user/register", userUpload, handleUploadError, registerUser);
router.get("/user/advocates", userAuth, getAdvocatesForUser);
router.get("/user/advocate/:advocateId/templates", userAuth, getTemplatesForUser);
router.post("/templates/:templateId/fill", filledTemplateImageUpload, handleUploadError, userAuth, fillTemplate);
router.get("/template/download/:submissionId", userAuth, downloadFilledTemplate);
router.get("/user/mybooking", userAuth, getUserCases);
router.get("/user/profile", userAuth, getUSerProfile);
router.put("/user/profile/edit", userAuth, editUserProfile,
);

router.post("/company/register", companyUpload, handleUploadError, registerCompany);



router.get("/admin/advocates", adminAuth, getAllAdvocates);
router.get("/admin/users", adminAuth, getAllUsers);
router.get("/admin/advocates/pending", adminAuth, getPendingAdvocates);

router.get("/admin/counts", adminAuth, getDashboardStats);




router.put("/admin/advocate/:id/verify", adminAuth, verifyAdvocateDocuments);
router.put("/admin/advocate/:id/approve", adminAuth, approveAdvocate);
router.put("/admin/advocate/:id/reject", adminAuth, rejectAdvocate);
router.get("/admin/user/:id", adminAuth, getUserDetails);
router.get("/admin/advocate/:id", adminAuth, getAdvocateDetails);







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