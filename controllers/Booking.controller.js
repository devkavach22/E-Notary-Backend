const mongoose = require("mongoose");
const UserFilledTemplate = require("../models/UserFilledTemplate");

// ── GET ALL CASES FOR USER ───────────────────────────────────
const getUserCases = async (req, res) => {
  try {
    const userId = req.user._id;

    console.log("═══════════════════════════════════════════");
    console.log("📥 getUserCases HIT");
    console.log("👤 userId:", userId);
    console.log("═══════════════════════════════════════════");

    const cases = await UserFilledTemplate.find({ userId })
      .populate({
        path: "advocateId",
        select: "fullName city",
      })
      .sort({ createdAt: -1 });

    console.log(`📦 Total cases found: ${cases.length}`);

    if (cases.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No cases found for this user.",
      });
    }

    const formattedCases = cases.map((c) => ({
      submissionId: c._id,
      templateId: c.templateId,
      advocateId: c.advocateId?._id,
      advocateName: c.advocateId?.fullName || "N/A",
      advocateCity: c.advocateId?.city || "N/A",
      practiceArea: c.practiceArea,
      category: c.category,
      templateTitle: c.title,
      status: c.status,
      dateOfSubmission: new Date(c.createdAt).toLocaleDateString("en-GB").replace(/\//g, "-"),
    }));

    console.log("✅ Cases formatted successfully");
    console.log("═══════════════════════════════════════════");

    return res.status(200).json({
      success: true,
      total: formattedCases.length,
      data: formattedCases,
    });

  } catch (error) {
    console.error("❌ getUserCases Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getUserCases };