const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ─── Storage Config ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "uploads/";

    // Selfie alag folder mein, documents alag mein
    if (file.fieldname === "liveSelfie") {
      folder += "selfies/";
    } else {
      folder += "documents/";
    }

    // Folder exist nahi karta toh banao
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    cb(null, folder);
  },

  filename: (req, file, cb) => {
    // Unique filename: fieldname_timestamp.extension
    const uniqueName = `${file.fieldname}_${Date.now()}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

// ─── File Type Check ──────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(
      {
        status: 400,
        message: "Only JPG, PNG, and PDF files are allowed",
      },
      false
    );
  }
};

// ─── Multer Instance ──────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Max 5MB per file
  },
});

// ─── Advocate ke saare files ek saath upload ─────────────
const advocateUpload = upload.fields([
  { name: "liveSelfie", maxCount: 1 },
  { name: "aadhaarFront", maxCount: 1 },
  { name: "aadhaarBack", maxCount: 1 },
  { name: "panCard", maxCount: 1 },
  { name: "barCouncilCertificate", maxCount: 1 },
]);

// ─── Multer Error Handle karo ────────────────────────────
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size must be less than 5MB",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err) {
    return res.status(err.status || 400).json({
      success: false,
      message: err.message || "File upload error",
    });
  }

  next();
};
const userUpload = upload.fields([
  { name: "aadhaarFront", maxCount: 1 },
  { name: "panCard",      maxCount: 1 },
  { name: "liveSelfie",   maxCount: 1 },
]);


module.exports = { advocateUpload,userUpload, handleUploadError };