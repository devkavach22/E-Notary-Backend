const multer = require("multer");
const path   = require("path");
const fs     = require("fs");

// ─── Storage Config ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "uploads/";
    if (file.fieldname === "recording") {
      folder += "recordings/";
    } else {
      folder += "documents/";
    }
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// ─── File Type Check ──────────────────────────────────────
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "recording") {
    // ✅ FIXED: video/webm;codecs=vp8,opus jaise mimetypes bhi allow ho jayenge
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb({ status: 400, message: "Only video files are allowed for recording" }, false);
    }
  } else {
    // Documents ke liye image/pdf
    const allowedDocs = /jpeg|jpg|png|pdf/;
    const extname  = allowedDocs.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedDocs.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb({ status: 400, message: "Only JPG, PNG, and PDF files are allowed" }, false);
    }
  }
};

// ─── Multer Instance ──────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

// ─── Advocate ke saare files ek saath upload ─────────────
const advocateUpload = upload.fields([
  { name: "aadhaarFront",          maxCount: 1 },
  { name: "aadhaarBack",           maxCount: 1 },
  { name: "panCard",               maxCount: 1 },
  { name: "barCouncilCertificate", maxCount: 1 },
]);

// ─── User documents upload ────────────────────────────────
const userUpload = upload.fields([
  { name: "aadhaarFront", maxCount: 1 },
  { name: "panCard",      maxCount: 1 },
]);

// ─── Recording upload ─────────────────────────────────────
const recordingUpload = upload.single("recording");

// ─── Multer Error Handle karo ─────────────────────────────
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size limit exceeded (max 500MB)",
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(err.status || 400).json({
      success: false,
      message: err.message || "File upload error",
    });
  }
  next();
};

module.exports = {
  advocateUpload,
  userUpload,
  recordingUpload,
  handleUploadError,
};