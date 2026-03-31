const Advocate = require("../models/Advocate");
const OTP      = require("../models/OTP");
const { generateOTP, sendOTPEmail } = require("./sendOTP");
const Tesseract = require("tesseract.js");
const { createCanvas, loadImage } = require("canvas");
const path = require("path");
const fs   = require("fs");

// ─── HARDCODED TEST OTP ───────────────────────────────────
const TEST_MOBILE_OTP = "872356";

// ═══════════════════════════════════════════════════════════
// OCR HELPERS
// ═══════════════════════════════════════════════════════════
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
    const abs = path.resolve(filePath);
    const out = abs.replace(/(\.\w+)$/, "_canvas.png");
    const img = await loadImage(abs);
    const sc  = 2400 / img.width;
    const cv  = createCanvas(img.width * sc, img.height * sc);
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const id  = ctx.getImageData(0, 0, cv.width, cv.height);
    const d   = id.data;
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
    const abs = path.resolve(filePath);
    const out = abs.replace(/(\.\w+)$/, "_canvasbw.png");
    const img = await loadImage(abs);
    const sc  = 2400 / img.width;
    const cv  = createCanvas(img.width * sc, img.height * sc);
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const id  = ctx.getImageData(0, 0, cv.width, cv.height);
    const d   = id.data;
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

const isNameWord = (w) => /^[A-Z]{3,}$/.test(w) && /[AEIOU]/.test(w) && !INVALID_WORDS.has(w);

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

  const freq2 = {}, freq3 = {};
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
  if (best3 && best3[1] >= 2) { console.log(`✅ Name (${label} - 3gram):`, best3[0]); return best3[0]; }
  if (best2 && best2[1] >= 2) { console.log(`✅ Name (${label} - 2gram):`, best2[0]); return best2[0]; }
  console.log(`❌ Name not found in ${label}`);
  return null;
};

// ═══════════════════════════════════════════════════════════
// parseDOB
// ═══════════════════════════════════════════════════════════
const parseDOB = (dobInput) => {
  if (!dobInput) return null;
  const str = String(dobInput).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [day, month, year] = str.split("/");
    return new Date(`${year}-${month}-${day}T12:00:00.000Z`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(`${str}T12:00:00.000Z`);
  if (str.includes("T")) { const d = new Date(str); d.setUTCHours(12,0,0,0); return d; }
  const d = new Date(str);
  if (!isNaN(d)) { d.setUTCHours(12,0,0,0); return d; }
  return null;
};

// ─── Email Validator ──────────────────────────────────────
const validateEmail = (email) => {
  if (!email)                         return "Email is required";
  if (email.length > 30)              return "Email must not exceed 30 characters";
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Invalid email address";
  return null;
};

// ═══════════════════════════════════════════════════════════
// SEND EMAIL OTP
// Request body: { email }
// purpose is auto-set to "email_verify" — no need to send it
// ═══════════════════════════════════════════════════════════
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // ── Email validation ──────────────────────────────────
    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ success: false, message: emailErr });

    // ── Duplicate check ───────────────────────────────────
    const existing = await Advocate.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: "Email already registered" });

    // ── Delete old OTP and create new ────────────────────
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
// Request body: { email, otp }
// purpose is auto-set to "email_verify" — no need to send it
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
// SEND MOBILE OTP
// Request body: { mobile }
// purpose is auto-set to "mobile_verify" — no need to send it
// ═══════════════════════════════════════════════════════════
const sendMobileOTP = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile)
      return res.status(400).json({ success: false, message: "Mobile number is required" });
    if (!/^[6-9]\d{9}$/.test(mobile))
      return res.status(400).json({ success: false, message: "Invalid mobile number format" });

    // ── Delete old OTP and create new ────────────────────
    await OTP.deleteMany({ mobile, purpose: "mobile_verify" });
    await OTP.create({ mobile, otp: TEST_MOBILE_OTP, purpose: "mobile_verify" });

    return res.status(200).json({ success: true, message: `OTP sent successfully (Test OTP: ${TEST_MOBILE_OTP})` });
  } catch (error) {
    console.error("sendMobileOTP Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// VERIFY MOBILE OTP
// Request body: { mobile, otp }
// purpose is auto-set to "mobile_verify" — no need to send it
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
// @route  POST /api/advocate/verify-documents
// ═══════════════════════════════════════════════════════════
const advocateVerifyDocuments = async (req, res) => {
  try {
    const files = req.files;

    if (!files?.aadhaarFront || !files?.panCard) {
      return res.status(400).json({ success: false, message: "Aadhaar front and PAN card are required" });
    }

    let extractedData = {
      fullName:      null,
      dateOfBirth:   null,
      gender:        null,
      aadhaarNumber: null,
      panNumber:     null,
    };

    // ── Aadhaar OCR — 4 passes ──
    try {
      const p1 = await extractTextOriginal(files.aadhaarFront[0].path);
      const p2 = await extractTextCanvas(files.aadhaarFront[0].path);
      const p3 = await extractTextCanvasBW(files.aadhaarFront[0].path);
      const p4 = await extractTextCanvasSharpen(files.aadhaarFront[0].path);

      const aadhaarRaw  = [p1, p2, p3, p4].join("\n");
      const aadhaarFlat = cleanOCRText(aadhaarRaw);

      console.log("\n========== ADVOCATE AADHAAR OCR ==========");
      console.log("Pass 1:", cleanOCRText(p1).slice(0, 120));
      console.log("Pass 2:", cleanOCRText(p2).slice(0, 120));
      console.log("Pass 3:", cleanOCRText(p3).slice(0, 120));
      console.log("Pass 4:", cleanOCRText(p4).slice(0, 120));
      console.log("==========================================\n");

      // Aadhaar Number
      for (const pat of [/\d{4}\s\d{4}\s\d{4}/, /\d{4}-\d{4}-\d{4}/, /\d{4}\s?\d{4}\s?\d{4}/, /\d{12}/]) {
        const m = aadhaarFlat.match(pat);
        if (m) { extractedData.aadhaarNumber = m[0].replace(/[\s-]/g, ""); console.log("✅ Aadhaar:", extractedData.aadhaarNumber); break; }
      }

      // DOB
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
          if (/^\d{4}\/\d{4}$/.test(dob)) dob = dob.slice(0,2)+"/"+dob.slice(2,4)+"/"+dob.slice(5);
          if (/^\d{8}$/.test(dob))         dob = dob.slice(0,2)+"/"+dob.slice(2,4)+"/"+dob.slice(4);
          extractedData.dateOfBirth = dob.replace(/[-\.]/g,"/").replace(/\s/g,"/");
          console.log("✅ DOB:", extractedData.dateOfBirth); break;
        }
      }

      // Name
      const aadhaarName = extractNameByFrequency(aadhaarRaw, "Aadhaar");
      if (isRealName(aadhaarName)) extractedData.fullName = aadhaarName;

      // Gender
      if (/\bFEMALE\b/.test(aadhaarFlat))    extractedData.gender = "female";
      else if (/\bMALE\b/.test(aadhaarFlat)) extractedData.gender = "male";
      else                                   extractedData.gender = null;
      console.log("✅ Gender:", extractedData.gender);

    } catch (err) {
      console.error("Aadhaar OCR Error:", err.message);
      return res.status(400).json({ success: false, message: "Could not read Aadhaar card. Please upload a clearer image." });
    }

    if (!extractedData.aadhaarNumber) {
      return res.status(400).json({ success: false, message: "Could not read Aadhaar number. Please upload a clearer photo." });
    }

    // ── PAN OCR — 4 passes ──
    try {
      const pp1 = await extractTextOriginal(files.panCard[0].path);
      const pp2 = await extractTextCanvas(files.panCard[0].path);
      const pp3 = await extractTextCanvasBW(files.panCard[0].path);
      const pp4 = await extractTextCanvasSharpen(files.panCard[0].path);

      const panFlat = cleanOCRText([pp1, pp2, pp3, pp4].join("\n"));

      console.log("\n========== ADVOCATE PAN OCR ==========");
      console.log("Pass 1:", cleanOCRText(pp1).slice(0, 120));
      console.log("Pass 2:", cleanOCRText(pp2).slice(0, 120));
      console.log("Pass 3:", cleanOCRText(pp3).slice(0, 120));
      console.log("Pass 4:", cleanOCRText(pp4).slice(0, 120));
      console.log("======================================\n");

      const pm = panFlat.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
      if (pm) { extractedData.panNumber = pm[0]; console.log("✅ PAN:", extractedData.panNumber); }
      else    { console.log("⚠️  PAN number not found — advocate manually fill karega"); }
    } catch (err) {
      console.warn("PAN OCR error (non-blocking):", err.message);
    }

    console.log("\n========== FINAL EXTRACTED DATA ==========");
    console.log(JSON.stringify(extractedData, null, 2));
    console.log("==========================================\n");

    return res.status(200).json({
      success: true,
      message: "Documents scanned successfully",
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
    console.error("advocateVerifyDocuments Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// @route  POST /api/register
// ═══════════════════════════════════════════════════════════
const registerAdvocate = async (req, res) => {
  try {
    const {
      fullName, dateOfBirth, gender, mobile, email, password,
      barCouncilNumber, barCouncilState, yearOfEnrollment,
      practiceAreas, languagesKnown, city, state, officeAddress,
      pincode, aadhaarNumber, panNumber, accountHolderName,
      bankName, accountNumber, ifscCode, upiId,
      availableDays, availableFrom, availableTo, perDocumentFee,
      aadhaarFrontPath, panCardPath,
    } = req.body;

    const files = req.files;

    // ── File check ──
    if (!files?.aadhaarBack?.[0])           return res.status(400).json({ success: false, message: "Aadhaar back is required" });
    if (!files?.barCouncilCertificate?.[0]) return res.status(400).json({ success: false, message: "Bar Council certificate is required" });
    if (!files?.liveSelfie?.[0])            return res.status(400).json({ success: false, message: "Live selfie is required" });
    if (!aadhaarFrontPath || !panCardPath)  return res.status(400).json({ success: false, message: "Please complete document verification first" });

    const parsedDOB = parseDOB(dateOfBirth);
    if (!parsedDOB) return res.status(400).json({ success: false, message: "Invalid dateOfBirth format" });

    // ── Duplicate check (409) ──
    if (await Advocate.findOne({ email }))            return res.status(409).json({ success: false, message: "Email already registered" });
    if (await Advocate.findOne({ mobile }))           return res.status(409).json({ success: false, message: "Mobile number already registered" });
    if (await Advocate.findOne({ aadhaarNumber }))    return res.status(409).json({ success: false, message: "Aadhaar number already registered" });
    if (await Advocate.findOne({ panNumber }))        return res.status(409).json({ success: false, message: "PAN number already registered" });
    if (await Advocate.findOne({ barCouncilNumber })) return res.status(409).json({ success: false, message: "Bar Council number already registered" });

    // ── OTP verified check (purpose auto-set internally) ──
    const emailOTPVerified = await OTP.findOne({ email, purpose: "email_verify", isUsed: true });
    if (!emailOTPVerified) return res.status(400).json({ success: false, message: "Email is not verified. Please verify your email first" });

    const mobileOTPVerified = await OTP.findOne({ mobile, purpose: "mobile_verify", isUsed: true });
    if (!mobileOTPVerified) return res.status(400).json({ success: false, message: "Mobile is not verified. Please verify your mobile first" });

    const parsedPracticeAreas = typeof practiceAreas  === "string" ? JSON.parse(practiceAreas)  : practiceAreas;
    const parsedLanguages      = typeof languagesKnown === "string" ? JSON.parse(languagesKnown) : languagesKnown;
    const parsedAvailableDays  = typeof availableDays  === "string" ? JSON.parse(availableDays)  : availableDays;

    const advocate = await Advocate.create({
      fullName, dateOfBirth: parsedDOB, gender, mobile, email, password,
      barCouncilNumber, barCouncilState, yearOfEnrollment,
      practiceAreas:  parsedPracticeAreas,
      languagesKnown: parsedLanguages,
      city, state, officeAddress, pincode, aadhaarNumber, panNumber,
      liveSelfie: files.liveSelfie[0].path,
      documents: {
        aadhaarFront:          aadhaarFrontPath,
        aadhaarBack:           files.aadhaarBack[0].path,
        panCard:               panCardPath,
        barCouncilCertificate: files.barCouncilCertificate[0].path,
      },
      bankDetails: { accountHolderName, bankName, accountNumber, ifscCode, upiId: upiId || null },
      availableDays:  parsedAvailableDays,
      availableHours: { from: availableFrom, to: availableTo },
      perDocumentFee,
      isEmailVerified:  true,
      isMobileVerified: true,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful! You can now login.",
      data: {
        id:       advocate._id,
        fullName: advocate.fullName,
        email:    advocate.email,
        role:     advocate.role,
      },
    });

  } catch (error) {
    console.error("registerAdvocate Error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({ success: false, message: `${field} already exists` });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// @route  GET /api/:id
// ═══════════════════════════════════════════════════════════
const getAdvocateById = async (req, res) => {
  try {
    const advocate = await Advocate.findById(req.params.id).select("-password");
    if (!advocate) return res.status(404).json({ success: false, message: "Advocate not found" });
    return res.status(200).json({ success: true, data: advocate });
  } catch (error) {
    console.error("getAdvocateById Error:", error);
    if (error.name === "CastError" && error.kind === "ObjectId")
      return res.status(404).json({ success: false, message: "Advocate not found" });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  sendMobileOTP,
  verifyMobileOTP,
  advocateVerifyDocuments,
  registerAdvocate,
  getAdvocateById,
};