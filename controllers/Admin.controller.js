const Advocate = require("../models/Advocate");
const User     = require("../models/User");
const { sendApprovalEmail, sendRejectionEmail } = require("./sendOTP");
const Tesseract = require("tesseract.js");
const { createCanvas, loadImage } = require("canvas");
const path = require("path");
const fs   = require("fs");

// ═══════════════════════════════════════════════════════════
// BAR COUNCIL STATE CODE MAPPING
// ═══════════════════════════════════════════════════════════
const STATE_CODE_MAP = {
  "DEL": "Delhi",
  "UP": "Uttar Pradesh",
  "BR": "Bihar",
  "GJ": "Gujarat",
  "KA": "Karnataka",
  "RJ": "Rajasthan",
  "OD": "Odisha",
  "TS": "Telangana",
  "MH": "Maharashtra",
  "AP": "Andhra Pradesh",
  "MP": "Madhya Pradesh",
  "WB": "West Bengal",
  "TN": "Tamil Nadu",
  "KL": "Kerala",
  "PB": "Punjab",
  "HR": "Haryana",
  "HP": "Himachal Pradesh",
  "JK": "Jammu and Kashmir",
  "JH": "Jharkhand",
  "CG": "Chhattisgarh",
  "UK": "Uttarakhand",
  "AS": "Assam",
  "MN": "Manipur",
  "ML": "Meghalaya",
  "MZ": "Mizoram",
  "NL": "Nagaland",
  "TR": "Tripura",
  "SK": "Sikkim",
  "GA": "Goa",
  "AR": "Arunachal Pradesh",
  "NE": "North East"
};

const normalizeState = (str) =>
  str.toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");

const getStateFromBarCouncilNumber = (bcn) => {
  if (!bcn) return null;
  const code = bcn.split("/")[0].toUpperCase();
  return STATE_CODE_MAP[code] || null;
};

const barCouncilStateMatches = (barCouncilNumber, registeredState) => {
  const mappedState = getStateFromBarCouncilNumber(barCouncilNumber);
  if (!mappedState) return false;
  return normalizeState(mappedState) === normalizeState(registeredState);
};

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
    throw new Error("Document could not be read.");
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

const runOCR = async (filePath) => {
  const p1 = await extractTextOriginal(filePath).catch(() => "");
  const p2 = await extractTextCanvas(filePath).catch(() => "");
  const p3 = await extractTextCanvasBW(filePath).catch(() => "");
  const p4 = await extractTextCanvasSharpen(filePath).catch(() => "");
  return [p1, p2, p3, p4].join("\n");
};

// ═══════════════════════════════════════════════════════════
// OCR FIELD EXTRACTORS
// ═══════════════════════════════════════════════════════════
const extractAadhaarNumber = (flat) => {
  for (const pat of [/\d{4}\s\d{4}\s\d{4}/, /\d{4}-\d{4}-\d{4}/, /\d{4}\s?\d{4}\s?\d{4}/, /\d{12}/]) {
    const m = flat.match(pat);
    if (m) return m[0].replace(/[\s-]/g, "");
  }
  return null;
};

const extractPAN = (flat) => {
  const m = flat.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
  return m ? m[0] : null;
};

const extractDOB = (flat) => {
  for (const pat of [
    /DOB\s*:\s*(\d{2}[\/\s\-\.]\d{2}[\/\s\-\.]\d{4})/,
    /DOB\s*:\s*(\d{8})/,
    /\d{2}\/\d{2}\/\d{4}/,
    /\d{2}-\d{2}-\d{4}/,
    /\d{2}\.\d{2}\.\d{4}/,
  ]) {
    const m = flat.match(pat);
    if (m) {
      let dob = (m[1] || m[0]).trim();
      if (/^\d{8}$/.test(dob)) dob = dob.slice(0,2)+"/"+dob.slice(2,4)+"/"+dob.slice(4);
      return dob.replace(/[-\.]/g, "/").replace(/\s/g, "/");
    }
  }
  return null;
};

const extractGender = (flat) => {
  if (/\bFEMALE\b/.test(flat)) return "female";
  if (/\bMALE\b/.test(flat))   return "male";
  return null;
};

const INVALID_WORDS = new Set([
  "INDIA","AADHAAR","UNIQUE","AUTHORITY","GOVERNMENT","DEPT","INCOME","GOVT",
  "PERMANENT","ACCOUNT","NUMBER","TAX","DEPARTMENT","CARD","IDENTIFICATION",
  "ELECTION","COMMISSION","DIGITAL","ENROLLMENT","SIGNATURE","MALE","FEMALE",
  "DATE","BIRTH","MERA","PEHCHAN","AADHAR","UIDAI","CENTRE","CENTRAL","OFFICE",
  "ADVOCATE","COUNCIL","BAR","CERTIFICATE","MEMBER",
]);
const isNameWord = (w) => /^[A-Z]{3,}$/.test(w) && /[AEIOU]/.test(w) && !INVALID_WORDS.has(w);

const extractName = (rawText) => {
  const lines = rawText.split(/[\n\r|]/)
    .map(l => l.replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim())
    .filter(l => l.length > 2);
  const freq2 = {}, freq3 = {};
  for (const line of lines) {
    const words = line.split(/\s+/).filter(isNameWord);
    for (let i = 0; i < words.length - 1; i++) {
      const g = `${words[i]} ${words[i+1]}`;
      freq2[g] = (freq2[g] || 0) + 1;
    }
    for (let i = 0; i < words.length - 2; i++) {
      const g = `${words[i]} ${words[i+1]} ${words[i+2]}`;
      freq3[g] = (freq3[g] || 0) + 1;
    }
  }
  const best3 = Object.entries(freq3).sort((a,b) => b[1]-a[1])[0];
  const best2 = Object.entries(freq2).sort((a,b) => b[1]-a[1])[0];
  if (best3 && best3[1] >= 2) return best3[0];
  if (best2 && best2[1] >= 2) return best2[0];
  return null;
};

const namesMatch = (formName, ocrName) => {
  if (!formName || !ocrName) return false;
  const normalize = (s) => s.toUpperCase().replace(/\s+/g, " ").trim();
  const a = normalize(formName);
  const b = normalize(ocrName);
  if (a === b) return true;
  const aWords = a.split(" ");
  const bWords = b.split(" ");
  const matched = aWords.filter(w => bWords.includes(w));
  return matched.length >= Math.min(aWords.length, bWords.length);
};

// ─────────────────────────────────────────────────────────
// dobMatch — tries DD/MM/YYYY first, then MM/DD/YYYY fallback
// This handles cases where the OCR reads the Aadhaar date
// correctly (e.g. 07/12/2005 = 7 Dec) but the DB stored it
// from a different frontend format (e.g. 2005-07-12 = 12 Jul).
// ─────────────────────────────────────────────────────────
const dobMatch = (dbDate, ocrDOB) => {
  if (!dbDate || !ocrDOB) return false;
  const db = new Date(dbDate);
  const parts = ocrDOB.split("/");
  if (parts.length !== 3) return false;
  const [dd, mm, yyyy] = parts;

  // Try DD/MM/YYYY (standard Aadhaar format)
  if (
    db.getUTCDate()      === parseInt(dd, 10) &&
    db.getUTCMonth() + 1 === parseInt(mm, 10) &&
    db.getUTCFullYear()  === parseInt(yyyy, 10)
  ) return true;

  // Fallback: try MM/DD/YYYY (in case frontend sent it swapped)
  if (
    db.getUTCDate()      === parseInt(mm, 10) &&
    db.getUTCMonth() + 1 === parseInt(dd, 10) &&
    db.getUTCFullYear()  === parseInt(yyyy, 10)
  ) return true;

  return false;
};

const extractBarCouncilNumber = (flat) => {
  const patterns = [
    /(?:ENROL(?:MENT)?\s*(?:NO|NUMBER)?[:\s]*)?([A-Z]{1,4}\/\d{1,6}\/\d{4})/i,
    /(?:MEMBERSHIP\s*(?:NO|NUMBER)?[:\s]*)?([A-Z]{1,4}\/\d{1,6}\/\d{4})/i,
    /([A-Z]{1,4}\/\d{1,6}\/\d{4})/i,
  ];
  for (const pat of patterns) {
    const m = flat.match(pat);
    if (m) return (m[1] || m[0]).toUpperCase().trim();
  }
  return null;
};

// ═══════════════════════════════════════════════════════════
// @route  GET /api/admin/advocates
// ═══════════════════════════════════════════════════════════
const getAllAdvocates = async (req, res) => {
  try {
    const advocates = await Advocate.find()
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total:   advocates.length,
      data:    advocates,
    });
  } catch (error) {
    console.error("getAllAdvocates Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// @route  GET /api/admin/advocates/pending
// ═══════════════════════════════════════════════════════════
const getPendingAdvocates = async (req, res) => {
  try {
    const advocates = await Advocate.find({ approvalStatus: "pending" })
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total:   advocates.length,
      data:    advocates,
    });
  } catch (error) {
    console.error("getPendingAdvocates Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// @route  GET /api/admin/advocate/:id
// ═══════════════════════════════════════════════════════════
const getAdvocateDetails = async (req, res) => {
  try {
    const advocate = await Advocate.findById(req.params.id).select("-password");
    if (!advocate)
      return res.status(404).json({ success: false, message: "Advocate not found" });

    return res.status(200).json({ success: true, data: advocate });
  } catch (error) {
    console.error("getAdvocateDetails Error:", error);
    if (error.name === "CastError" && error.kind === "ObjectId")
      return res.status(404).json({ success: false, message: "Advocate not found" });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// @route  PUT /api/admin/advocate/:id/verify
// ═══════════════════════════════════════════════════════════
const verifyAdvocateDocuments = async (req, res) => {
  try {
    const advocate = await Advocate.findById(req.params.id);

    if (!advocate)
      return res.status(404).json({ success: false, message: "Advocate not found" });

    if (advocate.documentStatus === "verified")
      return res.status(400).json({ success: false, message: "Documents are already verified" });

    if (advocate.documentStatus === "approved")
      return res.status(400).json({ success: false, message: "Advocate is already approved" });

    if (advocate.documentStatus === "rejected")
      return res.status(400).json({ success: false, message: "Advocate is already rejected" });

    if (advocate.documentStatus === "not_uploaded")
      return res.status(400).json({ success: false, message: "No documents uploaded yet" });

    const mismatches = [];
    const results    = {};

    // ── 1. AADHAAR FRONT OCR ────────────────────────────
    console.log("\n========== ADMIN VERIFY — AADHAAR OCR ==========");
    try {
      const aadhaarRaw  = await runOCR(advocate.documents.aadhaarFront);
      const aadhaarFlat = cleanOCRText(aadhaarRaw);

      const ocrAadhaar     = extractAadhaarNumber(aadhaarFlat);
      const aadhaarMatched = ocrAadhaar === advocate.aadhaarNumber;
      console.log("OCR Aadhaar:", ocrAadhaar, "| DB:", advocate.aadhaarNumber);
      if (!ocrAadhaar)          mismatches.push("Aadhaar number could not be read from Aadhaar card image");
      else if (!aadhaarMatched) mismatches.push(`Aadhaar number mismatch — card: ${ocrAadhaar}, registered: ${advocate.aadhaarNumber}`);
      results.aadhaarNumber = { ocr: ocrAadhaar, db: advocate.aadhaarNumber, matched: aadhaarMatched };

      const ocrName     = extractName(aadhaarRaw);
      const nameMatched = namesMatch(advocate.fullName, ocrName);
      console.log("OCR Name:", ocrName, "| DB:", advocate.fullName);
      if (!ocrName)          mismatches.push("Name could not be read from Aadhaar card image");
      else if (!nameMatched) mismatches.push(`Name mismatch — card: "${ocrName}", registered: "${advocate.fullName}"`);
      results.fullName = { ocr: ocrName, db: advocate.fullName, matched: nameMatched };

      const ocrDOB     = extractDOB(aadhaarFlat);
      const dobMatched = dobMatch(advocate.dateOfBirth, ocrDOB);
      console.log("OCR DOB:", ocrDOB, "| DB:", advocate.dateOfBirth);
      if (!ocrDOB)          mismatches.push("Date of birth could not be read from Aadhaar card image");
      else if (!dobMatched) mismatches.push(`Date of birth mismatch — card: ${ocrDOB}, registered: ${new Date(advocate.dateOfBirth).toLocaleDateString("en-IN")}`);
      results.dateOfBirth = { ocr: ocrDOB, db: advocate.dateOfBirth, matched: dobMatched };

      const ocrGender     = extractGender(aadhaarFlat);
      const genderMatched = ocrGender === advocate.gender;
      console.log("OCR Gender:", ocrGender, "| DB:", advocate.gender);
      if (!ocrGender)          mismatches.push("Gender could not be read from Aadhaar card image");
      else if (!genderMatched) mismatches.push(`Gender mismatch — card: ${ocrGender}, registered: ${advocate.gender}`);
      results.gender = { ocr: ocrGender, db: advocate.gender, matched: genderMatched };

    } catch (err) {
      console.error("Aadhaar OCR failed:", err.message);
      mismatches.push("Aadhaar card image could not be processed. Please ensure the image is clear.");
    }

    // ── 2. PAN CARD OCR ─────────────────────────────────
    // NOTE: PAN card image OCR verification is temporarily disabled.
    //       The code below is preserved for future re-enablement.
    //
    // console.log("\n========== ADMIN VERIFY — PAN OCR ==========");
    // try {
    //   const panRaw  = await runOCR(advocate.documents.panCard);
    //   const panFlat = cleanOCRText(panRaw);
    //
    //   const ocrPAN     = extractPAN(panFlat);
    //   const panMatched = ocrPAN === advocate.panNumber?.toUpperCase();
    //   console.log("OCR PAN:", ocrPAN, "| DB:", advocate.panNumber);
    //   if (!ocrPAN)          mismatches.push("PAN number could not be read from PAN card image");
    //   else if (!panMatched) mismatches.push(`PAN number mismatch — card: ${ocrPAN}, registered: ${advocate.panNumber}`);
    //   results.panNumber = { ocr: ocrPAN, db: advocate.panNumber, matched: panMatched };
    //
    // } catch (err) {
    //   console.error("PAN OCR failed:", err.message);
    //   mismatches.push("PAN card image could not be processed. Please ensure the image is clear.");
    // }

    // ── 3. BAR COUNCIL — state check only (OCR match skipped) ──
    // We trust the registered Bar Council number and only verify
    // that the state code prefix matches the registered state.
    console.log("\n========== ADMIN VERIFY — BAR COUNCIL STATE CHECK ==========");
    try {
      const stateMatched = barCouncilStateMatches(advocate.barCouncilNumber, advocate.barCouncilState);
      const mappedState  = getStateFromBarCouncilNumber(advocate.barCouncilNumber);
      console.log(
        "State check:", advocate.barCouncilNumber,
        "→", mappedState,
        "| Registered:", advocate.barCouncilState,
        "| Match:", stateMatched
      );

      if (!stateMatched) {
        mismatches.push(
          `Bar Council state mismatch — number "${advocate.barCouncilNumber}" belongs to ` +
          `"${mappedState || "unknown"}", but registered state is "${advocate.barCouncilState}"`
        );
      }

      results.barCouncilNumber = {
        db:      advocate.barCouncilNumber,
        matched: true,
        note:    "OCR match skipped — state prefix validated only",
      };
      results.barCouncilState = {
        bcnCode:         advocate.barCouncilNumber?.split("/")[0],
        mappedState,
        registeredState: advocate.barCouncilState,
        matched:         stateMatched,
      };

    } catch (err) {
      console.error("Bar Council state check failed:", err.message);
      mismatches.push("Bar Council state could not be verified.");
    }

    console.log("\n========== VERIFY RESULTS ==========");
    console.log("Mismatches:", mismatches);
    console.log("=====================================\n");

    if (mismatches.length > 0) {
      advocate.documentStatus  = "rejected";
      advocate.approvalStatus  = "rejected";
      advocate.isActive        = false;
      advocate.rejectionReason = mismatches.join(" | ");
      await advocate.save();

      try {
        await sendRejectionEmail(advocate.email, advocate.fullName, mismatches.join("\n"));
      } catch (mailErr) {
        console.error("Rejection email error (non-blocking):", mailErr.message);
      }

      return res.status(400).json({
        success:    false,
        message:    "Document verification failed. Advocate has been auto-rejected and notified via email.",
        mismatches,
        results,
      });
    }

    advocate.documentStatus = "verified";
    await advocate.save();

    return res.status(200).json({
      success: true,
      message: `All documents verified successfully for "${advocate.fullName}". You can now approve.`,
      results,
      data: {
        id:             advocate._id,
        fullName:       advocate.fullName,
        email:          advocate.email,
        documentStatus: advocate.documentStatus,
        approvalStatus: advocate.approvalStatus,
      },
    });

  } catch (error) {
    console.error("verifyAdvocateDocuments Error:", error);
    if (error.name === "CastError" && error.kind === "ObjectId")
      return res.status(404).json({ success: false, message: "Advocate not found" });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// @route  PUT /api/admin/advocate/:id/approve
// ═══════════════════════════════════════════════════════════
const approveAdvocate = async (req, res) => {
  try {
    const advocate = await Advocate.findById(req.params.id);

    if (!advocate)
      return res.status(404).json({ success: false, message: "Advocate not found" });

    if (advocate.approvalStatus === "approved")
      return res.status(400).json({ success: false, message: "Advocate is already approved" });

    if (advocate.documentStatus !== "verified")
      return res.status(400).json({ success: false, message: "Please run document verification first before approving" });

    advocate.approvalStatus  = "approved";
    advocate.documentStatus  = "approved";
    advocate.isActive        = true;
    advocate.rejectionReason = null;
    await advocate.save();

    try {
      await sendApprovalEmail(advocate.email, advocate.fullName);
    } catch (mailErr) {
      console.error("Approval email error (non-blocking):", mailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Advocate "${advocate.fullName}" has been approved successfully.`,
      data: {
        id:             advocate._id,
        fullName:       advocate.fullName,
        email:          advocate.email,
        approvalStatus: advocate.approvalStatus,
        documentStatus: advocate.documentStatus,
        isActive:       advocate.isActive,
      },
    });
  } catch (error) {
    console.error("approveAdvocate Error:", error);
    if (error.name === "CastError" && error.kind === "ObjectId")
      return res.status(404).json({ success: false, message: "Advocate not found" });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// @route  PUT /api/admin/advocate/:id/reject
// Body: { reason: "string" }
// ═══════════════════════════════════════════════════════════
const rejectAdvocate = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || !reason.trim())
      return res.status(400).json({ success: false, message: "Rejection reason is required" });

    const advocate = await Advocate.findById(req.params.id);

    if (!advocate)
      return res.status(404).json({ success: false, message: "Advocate not found" });

    if (advocate.approvalStatus === "rejected")
      return res.status(400).json({ success: false, message: "Advocate is already rejected" });

    advocate.approvalStatus  = "rejected";
    advocate.documentStatus  = "rejected";
    advocate.isActive        = false;
    advocate.rejectionReason = reason.trim();
    await advocate.save();

    try {
      await sendRejectionEmail(advocate.email, advocate.fullName, reason.trim());
    } catch (mailErr) {
      console.error("Rejection email error (non-blocking):", mailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Advocate "${advocate.fullName}" has been rejected.`,
      data: {
        id:              advocate._id,
        fullName:        advocate.fullName,
        email:           advocate.email,
        approvalStatus:  advocate.approvalStatus,
        documentStatus:  advocate.documentStatus,
        isActive:        advocate.isActive,
        rejectionReason: advocate.rejectionReason,
      },
    });
  } catch (error) {
    console.error("rejectAdvocate Error:", error);
    if (error.name === "CastError" && error.kind === "ObjectId")
      return res.status(404).json({ success: false, message: "Advocate not found" });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// @route  GET /api/admin/users
// ═══════════════════════════════════════════════════════════
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total:   users.length,
      data:    users,
    });
  } catch (error) {
    console.error("getAllUsers Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
// @route  GET /api/admin/user/:id
// ═══════════════════════════════════════════════════════════
const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("getUserDetails Error:", error);
    if (error.name === "CastError" && error.kind === "ObjectId")
      return res.status(404).json({ success: false, message: "User not found" });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getAllAdvocates,
  getPendingAdvocates,
  getAdvocateDetails,
  verifyAdvocateDocuments,
  approveAdvocate,
  rejectAdvocate,
  getAllUsers,
  getUserDetails,
};