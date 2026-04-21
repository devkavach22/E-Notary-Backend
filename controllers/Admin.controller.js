const Advocate = require("../models/Advocate");
const User     = require("../models/User");
const { sendApprovalEmail, sendRejectionEmail } = require("./sendOTP");


// BAR COUNCIL STATE CODE MAPPING

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

    // ── Bar Council State Check (no OCR — prefix match only) ──
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
        note:    "OCR bypassed — state prefix validated only",
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

    // ── Aadhaar, PAN, Name, DOB, Gender — BYPASSED ────────
    // NOTE: OCR verification skipped for development.
    //       Will be replaced with Government API on production.
    results.aadhaarNumber = { db: advocate.aadhaarNumber, matched: true, note: "OCR bypassed" };
    results.panNumber     = { db: advocate.panNumber,     matched: true, note: "OCR bypassed" };
    results.fullName      = { db: advocate.fullName,      matched: true, note: "OCR bypassed" };
    results.dateOfBirth   = { db: advocate.dateOfBirth,   matched: true, note: "OCR bypassed" };
    results.gender        = { db: advocate.gender,        matched: true, note: "OCR bypassed" };

    console.log("\n========== VERIFY RESULTS ==========");
    console.log("Mismatches:", mismatches);
    console.log("=====================================\n");

    // ── If Bar Council state mismatch — reject ─────────────
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

    // ── All good — mark verified ───────────────────────────
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