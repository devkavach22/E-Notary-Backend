const User      = require("../models/User");
const Advocate  = require("../models/Advocate");
const OTP       = require("../models/OTP");
const Tesseract = require("tesseract.js");
const { createCanvas, loadImage } = require("canvas");
const path      = require("path");
const fs        = require("fs");

const cleanOCRText = (text) => text.toUpperCase().replace(/\s+/g, " ").trim();

const extractTextOriginal = async (filePath) => {
  try {
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
    const result = await Tesseract.recognize(abs, "eng+hin", { logger: () => {} });
    return result.data.text.toUpperCase();
  } catch (e) {
    console.error("OCR Original Error:", e.message);
    throw new Error("Document could not be read. Please ensure image is clear.");
  }
};

const extractTextCanvas = async (filePath) => {
  try {
    const abs  = path.resolve(filePath);
    const out  = abs.replace(/(\.\w+)$/, "_canvas.png");
    const img  = await loadImage(abs);
    const sc   = 2400 / img.width;
    const cv   = createCanvas(img.width * sc, img.height * sc);
    const ctx  = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const id   = ctx.getImageData(0, 0, cv.width, cv.height);
    const d    = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const c = Math.min(255, Math.max(0, 2.0 * (g - 128) + 128));
      d[i] = d[i + 1] = d[i + 2] = c;
    }
    ctx.putImageData(id, 0, 0);
    fs.writeFileSync(out, cv.toBuffer("image/png"));
    const r = await Tesseract.recognize(out, "eng+hin", { logger: () => {}, tessedit_pageseg_mode: 6 });
    if (fs.existsSync(out)) fs.unlinkSync(out);
    return r.data.text.toUpperCase();
  } catch (e) { console.error("OCR Canvas Error:", e.message); return ""; }
};

const extractTextCanvasBW = async (filePath) => {
  try {
    const abs  = path.resolve(filePath);
    const out  = abs.replace(/(\.\w+)$/, "_canvasbw.png");
    const img  = await loadImage(abs);
    const sc   = 2400 / img.width;
    const cv   = createCanvas(img.width * sc, img.height * sc);
    const ctx  = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const id   = ctx.getImageData(0, 0, cv.width, cv.height);
    const d    = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const bw = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) > 140 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = bw;
    }
    ctx.putImageData(id, 0, 0);
    fs.writeFileSync(out, cv.toBuffer("image/png"));
    const r = await Tesseract.recognize(out, "eng+hin", { logger: () => {}, tessedit_pageseg_mode: 4 });
    if (fs.existsSync(out)) fs.unlinkSync(out);
    return r.data.text.toUpperCase();
  } catch (e) { console.error("OCR Canvas BW Error:", e.message); return ""; }
};

const extractTextCanvasSharpen = async (filePath) => {
  try {
    const abs    = path.resolve(filePath);
    const out    = abs.replace(/(\.\w+)$/, "_canvassharp.png");
    const img    = await loadImage(abs);
    const sc     = 2400 / img.width;
    const cv     = createCanvas(img.width * sc, img.height * sc);
    const ctx    = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const id     = ctx.getImageData(0, 0, cv.width, cv.height);
    const d      = id.data;
    const W      = cv.width;
    const H      = cv.height;
    const output = new Uint8ClampedArray(d);
    const K      = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        let r = 0, g = 0, b = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * W + (x + kx)) * 4;
            const k   = K[(ky + 1) * 3 + (kx + 1)];
            r += d[idx] * k; g += d[idx + 1] * k; b += d[idx + 2] * k;
          }
        }
        const i    = (y * W + x) * 4;
        const gray = 0.299 * Math.min(255, Math.max(0, r))
                   + 0.587 * Math.min(255, Math.max(0, g))
                   + 0.114 * Math.min(255, Math.max(0, b));
        output[i] = output[i + 1] = output[i + 2] = gray;
        output[i + 3] = 255;
      }
    }
    ctx.putImageData(new (require("canvas").ImageData)(output, W, H), 0, 0);
    fs.writeFileSync(out, cv.toBuffer("image/png"));
    const r = await Tesseract.recognize(out, "eng+hin", { logger: () => {}, tessedit_pageseg_mode: 6 });
    if (fs.existsSync(out)) fs.unlinkSync(out);
    return r.data.text.toUpperCase();
  } catch (e) { console.error("OCR Sharpen Error:", e.message); return ""; }
};


const parseDOB = (dobInput) => {
  if (!dobInput) return null;
  const str = String(dobInput).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split("/");
    return new Date(`${y}-${m}-${d}T12:00:00.000Z`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(`${str}T12:00:00.000Z`);
  const dt = new Date(str);
  if (!isNaN(dt)) { dt.setUTCHours(12, 0, 0, 0); return dt; }
  return null;
};


const INVALID_WORDS = new Set([
  "INDIA", "AADHAAR", "UNIQUE", "AUTHORITY", "GOVERNMENT", "DEPT", "INCOME", "GOVT",
  "PERMANENT", "ACCOUNT", "NUMBER", "TAX", "DEPARTMENT", "CARD", "IDENTIFICATION",
  "ELECTION", "COMMISSION", "DIGITAL", "ENROLLMENT", "SIGNATURE", "MALE", "FEMALE",
  "DATE", "BIRTH", "MERA", "PEHCHAN", "AADHAR", "UIDAI",
  "INDIN", "GOVORNMANT", "GOVURNMANT", "GOVEMMAONT", "GOVORNMENT", "BASTEN",
  "TEAL", "NAAN", "PERN", "GEEGT", "ITGET", "POMANNTHCCOUN",
  "UNGER", "ESTAS", "RAKE", "SPIN", "CENTRE", "CENTRAL", "OFFICE",
  "KUKPS", "UNGER", "BASTEN",
]);

const isNameWord = (w) =>
  /^[A-Z]{3,}$/.test(w) &&
  /[AEIOU]/.test(w) &&
  !INVALID_WORDS.has(w);

const isRealName = (name) => {
  if (!name) return false;
  const words = name.trim().split(/\s+/).filter(w => w.length > 2);
  return words.filter(w => /[AEIOU]/.test(w)).length >= 1 && words.length >= 2;
};

const extractNameByFrequency = (rawText, label = "") => {
  const lines = rawText
    .split(/[\n\r|]/)
    .map(l => l.replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim())
    .filter(l => l.length > 2);

  const freq2 = {};
  const freq3 = {};

  for (const line of lines) {
    const words = line.split(/\s+/).filter(isNameWord);
    for (let i = 0; i < words.length - 1; i++) {
      const g = `${words[i]} ${words[i + 1]}`;
      freq2[g] = (freq2[g] || 0) + 1;
    }
    for (let i = 0; i < words.length - 2; i++) {
      const g = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      freq3[g] = (freq3[g] || 0) + 1;
    }
  }

  const best3 = Object.entries(freq3).sort((a, b) => b[1] - a[1])[0];
  const best2 = Object.entries(freq2).sort((a, b) => b[1] - a[1])[0];

  if (best3 && best3[1] >= 2) {
    console.log(`✅ Name (${label} - 3gram ${best3[1]}x):`, best3[0]);
    return best3[0];
  }
  if (best2 && best2[1] >= 2) {
    console.log(`✅ Name (${label} - 2gram ${best2[1]}x):`, best2[0]);
    return best2[0];
  }

  console.log(`❌ Name not reliably found in ${label}`);
  return null;
};

// ─── Input Validators ─────────────────────────────────────
const validateEmail = (email) => {
  if (!email)                          return "Email is required";
  if (email.length > 30)               return "Email must not exceed 30 characters";
  if (!/^\S+@\S+\.\S+$/.test(email))  return "Invalid email address";
  return null;
};

const validatePassword = (password) => {
  if (!password)              return "Password is required";
  if (password.length < 8)   return "Password must be at least 8 characters";
  if (password.length > 28)  return "Password must not exceed 28 characters";
  return null;
};

// ═══════════════════════════════════════════════════════════
// SEND EMAIL OTP  (User)
// ═══════════════════════════════════════════════════════════
const { generateOTP, sendOTPEmail } = require("./sendOTP");

const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ success: false, message: emailErr });

    // Block only if email exists in BOTH tables (same person can be user + advocate)
    const inUser     = await User.findOne({ email });
    const inAdvocate = await Advocate.findOne({ email });
    if (inUser && inAdvocate)
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
// VERIFY EMAIL OTP  (User)
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
// SEND MOBILE OTP  (User — hardcoded test OTP)
// ═══════════════════════════════════════════════════════════
const TEST_MOBILE_OTP = "872356";

const sendMobileOTP = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) return res.status(400).json({ success: false, message: "Mobile number is required" });
    if (!/^[6-9]\d{9}$/.test(mobile))
      return res.status(400).json({ success: false, message: "Invalid mobile number format" });

    // Block only if mobile exists in BOTH tables
    const mobileInUser = await User.findOne({ mobile });
    const mobileInAdv  = await Advocate.findOne({ mobile });
    if (mobileInUser && mobileInAdv)
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
// VERIFY MOBILE OTP  (User)
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
    await User.findOneAndUpdate({ mobile }, { isMobileVerified: true });

    return res.status(200).json({ success: true, message: "Mobile verified successfully" });
  } catch (error) {
    console.error("verifyMobileOTP Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// UserverifyDocuments
// ═══════════════════════════════════════════════════════════
const UserverifyDocuments = async (req, res) => {
  try {
    const files = req.files;

    if (!files?.aadhaarFront || !files?.panCard) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar front and PAN card are required",
      });
    }

    let extractedData = {
      fullName:      null,
      dateOfBirth:   null,
      gender:        null,
      aadhaarNumber: null,
      panNumber:     null,
    };

    try {
      const p1 = await extractTextOriginal(files.aadhaarFront[0].path);
      const p2 = await extractTextCanvas(files.aadhaarFront[0].path);
      const p3 = await extractTextCanvasBW(files.aadhaarFront[0].path);
      const p4 = await extractTextCanvasSharpen(files.aadhaarFront[0].path);

      const aadhaarRaw  = [p1, p2, p3, p4].join("\n");
      const aadhaarFlat = cleanOCRText(aadhaarRaw);

      console.log("\n========== AADHAAR OCR ==========");
      console.log("Pass 1:", cleanOCRText(p1).slice(0, 120));
      console.log("Pass 2:", cleanOCRText(p2).slice(0, 120));
      console.log("Pass 3:", cleanOCRText(p3).slice(0, 120));
      console.log("Pass 4:", cleanOCRText(p4).slice(0, 120));
      console.log("==================================\n");

      // ── Aadhaar Number ──
      for (const pat of [
        /\d{4}\s\d{4}\s\d{4}/,
        /\d{4}-\d{4}-\d{4}/,
        /\d{4}\s?\d{4}\s?\d{4}/,
        /\d{12}/,
      ]) {
        const m = aadhaarFlat.match(pat);
        if (m) {
          extractedData.aadhaarNumber = m[0].replace(/[\s-]/g, "");
          console.log("✅ Aadhaar Number:", extractedData.aadhaarNumber);
          break;
        }
      }

      // ── DOB from Aadhaar ──
      for (const pat of [
        /DOB\s*:\s*(\d{2}[\/\s\-\.]\d{2}[\/\s\-\.]\d{4})/,
        /DOB\s*:\s*(\d{4}\/\d{4})/,
        /DOB\s*:\s*(\d{8})/,
        /\d{2}\/\d{2}\/\d{4}/,
        /\d{2}-\d{2}-\d{4}/,
        /\d{2}\.\d{2}\.\d{4}/,
      ]) {
        const m = aadhaarFlat.match(pat);
        if (m) {
          let dob = (m[1] || m[0]).trim();
          if (/^\d{4}\/\d{4}$/.test(dob)) dob = dob.slice(0, 2) + "/" + dob.slice(2, 4) + "/" + dob.slice(5);
          if (/^\d{8}$/.test(dob))         dob = dob.slice(0, 2) + "/" + dob.slice(2, 4) + "/" + dob.slice(4);
          extractedData.dateOfBirth = dob.replace(/[-\.]/g, "/").replace(/\s/g, "/");
          console.log("✅ DOB (Aadhaar):", extractedData.dateOfBirth);
          break;
        }
      }

      // ── Name from Aadhaar ──
      const aadhaarName = extractNameByFrequency(aadhaarRaw, "Aadhaar");
      if (isRealName(aadhaarName)) {
        extractedData.fullName = aadhaarName;
        console.log("✅ Name (Aadhaar):", aadhaarName);
      }

      // ── Gender from Aadhaar ──
      if (/\bFEMALE\b/.test(aadhaarFlat)) {
        extractedData.gender = "female";
      } else if (/\bMALE\b/.test(aadhaarFlat)) {
        extractedData.gender = "male";
      } else {
        extractedData.gender = null;
      }
      console.log("✅ Gender (Aadhaar):", extractedData.gender);

    } catch (err) {
      console.error("Aadhaar OCR Error:", err.message);
      return res.status(400).json({
        success: false,
        message: "Could not read Aadhaar card. Please upload a clearer image.",
      });
    }

    if (!extractedData.aadhaarNumber) {
      return res.status(400).json({
        success: false,
        message: "Could not read Aadhaar number from the image. Please upload a clearer photo.",
      });
    }

    try {
      const pp1 = await extractTextOriginal(files.panCard[0].path);
      const pp2 = await extractTextCanvas(files.panCard[0].path);
      const pp3 = await extractTextCanvasBW(files.panCard[0].path);
      const pp4 = await extractTextCanvasSharpen(files.panCard[0].path);

      const panFlat = cleanOCRText([pp1, pp2, pp3, pp4].join("\n"));

      console.log("\n========== PAN OCR ==========");
      console.log("Pass 1:", cleanOCRText(pp1).slice(0, 120));
      console.log("Pass 2:", cleanOCRText(pp2).slice(0, 120));
      console.log("Pass 3:", cleanOCRText(pp3).slice(0, 120));
      console.log("Pass 4:", cleanOCRText(pp4).slice(0, 120));
      console.log("==============================\n");

      const pm = panFlat.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
      if (pm) {
        extractedData.panNumber = pm[0];
        console.log("✅ PAN Number:", extractedData.panNumber);
      } else {
        console.log("⚠️  PAN number not found — user manually fill karega");
      }
    } catch (err) {
      console.warn("PAN OCR error (non-blocking):", err.message);
    }

    console.log("\n========== FINAL EXTRACTED DATA ==========");
    console.log(JSON.stringify(extractedData, null, 2));
    console.log("==========================================\n");

    return res.status(200).json({
      success: true,
      message: "Documents uploaded successfully",
      extractedData,
      autoFilled: {
        fullName:      !!extractedData.fullName,
        dateOfBirth:   !!extractedData.dateOfBirth,
        gender:        !!extractedData.gender,
        aadhaarNumber: !!extractedData.aadhaarNumber,
        panNumber:     !!extractedData.panNumber,
      },
      filePaths: {
        aadhaarFront: files.aadhaarFront[0].path,
        panCard:      files.panCard[0].path,
      },
    });

  } catch (error) {
    console.error("UserverifyDocuments Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// ═══════════════════════════════════════════════════════════
// registerUser
// ═══════════════════════════════════════════════════════════
const registerUser = async (req, res) => {
  try {
    const {
      email, mobile, password,
      fullName, dateOfBirth,
      aadhaarNumber, panNumber,
      address, city, state, pincode,
      gender,
      aadhaarFrontPath, panCardPath,
    } = req.body;

    // ── Required fields check ─────────────────────────────
    if (!email || !mobile || !password || !fullName || !dateOfBirth ||
        !aadhaarNumber || !panNumber || !address ||
        !city || !state || !pincode ||
        !aadhaarFrontPath || !panCardPath) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // ── Email validation ──────────────────────────────────
    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ success: false, message: emailErr });

    // ── Password validation ───────────────────────────────
    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ success: false, message: passwordErr });

    // ── Mobile format validation ──────────────────────────
    if (!/^[6-9]\d{9}$/.test(mobile))
      return res.status(400).json({ success: false, message: "Invalid mobile number" });

    // ── Aadhaar format validation ─────────────────────────
    if (!/^\d{12}$/.test(aadhaarNumber))
      return res.status(400).json({ success: false, message: "Aadhaar must be 12 digits" });

    // ── PAN format validation ─────────────────────────────
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase()))
      return res.status(400).json({ success: false, message: "Invalid PAN number format" });

    // ── Pincode format validation ─────────────────────────
    if (!/^\d{6}$/.test(pincode))
      return res.status(400).json({ success: false, message: "Invalid pincode" });

    // ── Duplicate checks (cross-collection) ──────────────
    // Block only if the same email/mobile exists in BOTH tables
    const emailInUser = await User.findOne({ email });
    const emailInAdv  = await Advocate.findOne({ email });
    if (emailInUser && emailInAdv)
      return res.status(409).json({ success: false, message: "Email already registered in both accounts" });

    const mobileInUser = await User.findOne({ mobile });
    const mobileInAdv  = await Advocate.findOne({ mobile });
    if (mobileInUser && mobileInAdv)
      return res.status(409).json({ success: false, message: "Mobile number already registered in both accounts" });

    // ── Aadhaar / PAN unique within User table only ───────
    if (await User.findOne({ aadhaarNumber }))
      return res.status(409).json({ success: false, message: "Aadhaar number is already registered" });

    if (await User.findOne({ panNumber: panNumber.toUpperCase() }))
      return res.status(409).json({ success: false, message: "PAN number is already registered" });

    // ── OTP verification checks ───────────────────────────
    const emailVerified = await OTP.findOne({ email, purpose: "email_verify", isUsed: true });
    if (!emailVerified)
      return res.status(400).json({ success: false, message: "Email is not verified. Please verify your email first" });

    const mobileVerified = await OTP.findOne({ mobile, purpose: "mobile_verify", isUsed: true });
    if (!mobileVerified)
      return res.status(400).json({ success: false, message: "Mobile is not verified. Please verify your mobile first" });

    // ── DOB parse ─────────────────────────────────────────
    const parsedDOB = parseDOB(dateOfBirth);
    if (!parsedDOB)
      return res.status(400).json({ success: false, message: "Invalid date of birth format" });

    // ── Create user ───────────────────────────────────────
    const user = await User.create({
      email,
      mobile,
      password,
      fullName,
      dateOfBirth: parsedDOB,
      gender:      gender || null,
      aadhaarNumber,
      panNumber:   panNumber.toUpperCase(),
      address, city, state, pincode,
      documents: {
        aadhaarFront: aadhaarFrontPath,
        panCard:      panCardPath,
      },
      isEmailVerified:  true,
      isMobileVerified: true,
      verificationChecks: {
        aadhaarVerified: true,
        panVerified:     true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      data: {
        id:       user._id,
        fullName: user.fullName,
        email:    user.email,
        role:     user.role,
      },
    });

  } catch (error) {
    console.error("registerUser Error:", error);

    if (error.name === "ValidationError") {
      const msgs = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: msgs[0] });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const fieldLabels = {
        email:         "Email",
        mobile:        "Mobile number",
        aadhaarNumber: "Aadhaar number",
        panNumber:     "PAN number",
      };
      const label = fieldLabels[field] || field;
      return res.status(409).json({ success: false, message: `${label} is already registered` });
    }

    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// ═══════════════════════════════════════════════════════════
// getUserById
// ═══════════════════════════════════════════════════════════
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, data: user });

  } catch (error) {
    console.error("getUserById Error:", error);

    if (error.name === "CastError" && error.kind === "ObjectId")
      return res.status(404).json({ success: false, message: "User not found" });

    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// ═══════════════════════════════════════════════════════════
// @route  GET /api/user/advocates?caseType=Divorce & Family Law
// User selects a case type → returns matching active & approved advocates
// Use caseType=all to fetch all available advocates
// ═══════════════════════════════════════════════════════════
const getAdvocatesForUser = async (req, res) => {
  try {
    const { caseType, category } = req.query;

    if (!caseType && !category) {
      return res.status(400).json({
        success: false,
        message: "Either 'caseType' or 'category' query parameter is required. Use 'all' to fetch all advocates.",
      });
    }

    const baseFilter = { isActive: true, approvalStatus: "approved" };
    let filter = { ...baseFilter };

    // ── caseType filter (group name → practiceAreas) ──────
    if (caseType && caseType.trim().toLowerCase() !== "all") {
      filter.practiceAreas = {
        $elemMatch: { $regex: new RegExp(`^${caseType.trim()}$`, "i") },
      };
    }

    // ── category filter (specific area → categories) ──────
    if (category && category.trim().toLowerCase() !== "all") {
      filter.categories = {
        $elemMatch: { $regex: new RegExp(`^${category.trim()}$`, "i") },
      };
    }

    const advocates = await Advocate.find(filter)
      .select(
        "fullName city state barCouncilState practiceAreas categories " +
        "languagesKnown availableDays availableHours perDocumentFee yearOfEnrollment"
      )
      .sort({ createdAt: -1 });

    if (advocates.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No advocates found for the applied filters`,
      });
    }

    return res.status(200).json({
      success: true,
      filterApplied: {
        ...(caseType && caseType.trim().toLowerCase() !== "all" && { caseType: caseType.trim() }),
        ...(category && category.trim().toLowerCase() !== "all" && { category: category.trim() }),
      },
      total: advocates.length,
      data: advocates,
    });

  } catch (error) {
    console.error("getAdvocatesForUser Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


module.exports = {
  sendOTP,
  verifyOTP,
  sendMobileOTP,
  verifyMobileOTP,
  UserverifyDocuments,
  registerUser,
  getUserById,
  getAdvocatesForUser,
};