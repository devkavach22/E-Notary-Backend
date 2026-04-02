// controllers/Booking.controller.js
const Booking  = require("../models/Booking");
const Advocate = require("../models/Advocate");
const {
  sendBookingEmailToUser,
  sendBookingEmailToAdvocate,
} = require("./sendOTP");

// ═══════════════════════════════════════════════════════════
// bookAdvocate
// POST /api/user/book-advocate
// ═══════════════════════════════════════════════════════════
const bookAdvocate = async (req, res) => {
  try {
    const { advocateId, caseType, message } = req.body;

    // ── Required fields ───────────────────────────────────
    if (!advocateId || !caseType) {
      return res.status(400).json({
        success: false,
        message: "advocateId and caseType are required",
      });
    }

    // ── Advocate exists & approved check ──────────────────
    const advocate = await Advocate.findById(advocateId);
    if (!advocate) {
      return res.status(404).json({
        success: false,
        message: "Advocate not found",
      });
    }

    if (advocate.approvalStatus !== "approved" || !advocate.isActive) {
      return res.status(400).json({
        success: false,
        message: "This advocate is not available for booking",
      });
    }

    // ── Duplicate booking check ───────────────────────────
    const existingBooking = await Booking.findOne({
      userId:     req.user._id,
      advocateId,
      status:     { $in: ["pending", "confirmed"] },
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: "You already have an active booking with this advocate",
      });
    }

    // ── Create booking ────────────────────────────────────
    const booking = await Booking.create({
      userId:    req.user._id,
      advocateId,
      caseType,
      message:   message || "",
    });

    // ── Send emails ───────────────────────────────────────
    try {
      await sendBookingEmailToUser({
        userEmail:    req.user.email,
        userName:     req.user.fullName,
        advocateName: advocate.fullName,
        caseType,
        bookingId:    booking._id,
      });

      await sendBookingEmailToAdvocate({
        advocateEmail: advocate.email,
        advocateName:  advocate.fullName,
        userName:      req.user.fullName,
        userMobile:    req.user.mobile,
        caseType,
        message:       message || "No message provided",
        bookingId:     booking._id,
      });

    } catch (emailErr) {
      console.error("Booking email error:", emailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Advocate booked successfully. The advocate will contact you to schedule a meeting.",
      data: {
        bookingId:    booking._id,
        advocateName: advocate.fullName,
        caseType,
        status:       booking.status,
      },
    });

  } catch (error) {
    console.error("bookAdvocate Error:", error);

    if (error.name === "CastError" && error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid advocate ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ═══════════════════════════════════════════════════════════
// getUserBookings
// GET /api/user/bookings
// ═══════════════════════════════════════════════════════════
const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id })
      .populate("advocateId", "fullName city state practiceAreas perDocumentFee")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total:   bookings.length,
      data:    bookings,
    });

  } catch (error) {
    console.error("getUserBookings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { bookAdvocate, getUserBookings };