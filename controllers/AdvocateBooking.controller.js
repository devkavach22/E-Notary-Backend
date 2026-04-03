// controllers/AdvocateBooking.controller.js
const Booking = require("../models/Booking");
const crypto  = require("crypto");
const {
  sendMeetingConfirmationToUser,
} = require("./sendOTP");


const getPendingBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      advocateId: req.advocate._id,
      status:     "pending",
    })
      .populate("userId", "fullName email mobile")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total:   bookings.length,
      data:    bookings.map((b) => ({
        bookingId:   b._id,
        status:      b.status,
        caseType:    b.caseType,
        message:     b.message,
        createdAt:   b.createdAt,
        client: {
          name:   b.userId.fullName,
          email:  b.userId.email,
          mobile: b.userId.mobile,
        },
      })),
    });

  } catch (error) {
    console.error("getPendingBookings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


const getAllBookings = async (req, res) => {
  try {
    const { status } = req.query; // optional filter

    const filter = { advocateId: req.advocate._id };
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate("userId", "fullName email mobile")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total:   bookings.length,
      data:    bookings.map((b) => ({
        bookingId:   b._id,
        status:      b.status,
        caseType:    b.caseType,
        message:     b.message,
        meetingDate: b.meetingDate,
        meetingTime: b.meetingTime,
        meetLink:    b.meetLink,
        createdAt:   b.createdAt,
        client: {
          name:   b.userId.fullName,
          email:  b.userId.email,
          mobile: b.userId.mobile,
        },
      })),
    });

  } catch (error) {
    console.error("getAllBookings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


const confirmBooking = async (req, res) => {
  try {
    const { bookingId }              = req.params;
    const { meetingDate, meetingTime } = req.body;

    if (!meetingDate || !meetingTime) {
      return res.status(400).json({
        success: false,
        message: "meetingDate and meetingTime are required",
      });
    }

    const booking = await Booking.findOne({
      _id:        bookingId,
      advocateId: req.advocate._id,
    }).populate("userId", "fullName email mobile");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${booking.status}`,
      });
    }

    // ── Generate unique WebRTC room ID ────────────────────
    // Format: enotary-<bookingId-last6>-<random6>
    const roomId   = `enotary-${bookingId.toString().slice(-6)}-${crypto.randomBytes(3).toString("hex")}`;
    const meetLink = `${process.env.FRONTEND_URL}/video-call/${roomId}`;

    // ── Update booking ────────────────────────────────────
    booking.status      = "confirmed";
    booking.meetingDate = new Date(meetingDate);
    booking.meetingTime = meetingTime;
    booking.meetLink    = meetLink;
    await booking.save();

    // ── Send email to user ────────────────────────────────
    try {
      await sendMeetingConfirmationToUser({
        userEmail:     booking.userId.email,
        userName:      booking.userId.fullName,
        advocateName:  req.advocate.fullName,
        caseType:      booking.caseType,
        meetingDate:   new Date(meetingDate).toLocaleDateString("en-IN", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        }),
        meetingTime,
        meetLink,
        bookingId:     booking._id,
      });
    } catch (emailErr) {
      console.error("Confirmation email error:", emailErr.message);
      // Don't fail the request if email fails
    }

    return res.status(200).json({
      success: true,
      message: "Booking confirmed. Meeting details sent to client.",
      data: {
        bookingId:   booking._id,
        status:      booking.status,
        meetingDate: booking.meetingDate,
        meetingTime: booking.meetingTime,
        meetLink:    booking.meetLink,
        roomId,
      },
    });

  } catch (error) {
    console.error("confirmBooking Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ═══════════════════════════════════════════════════════════
// cancelBooking
// PUT /api/advocate/bookings/:bookingId/cancel
// Body: { reason } (optional)
// ═══════════════════════════════════════════════════════════
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason }    = req.body;

    const booking = await Booking.findOne({
      _id:        bookingId,
      advocateId: req.advocate._id,
    }).populate("userId", "fullName email");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (["cancelled", "completed"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a ${booking.status} booking`,
      });
    }

    booking.status = "cancelled";
    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data:    { bookingId: booking._id, status: booking.status },
    });

  } catch (error) {
    console.error("cancelBooking Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ═══════════════════════════════════════════════════════════
// getVideoCallRoom
// GET /api/video-call/:roomId
// Returns room details — validates that requester has access
// Both advocate and user can call this
// ═══════════════════════════════════════════════════════════
const getVideoCallRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Find booking by meetLink containing this roomId
    const booking = await Booking.findOne({
      meetLink: { $regex: roomId },
      status:   "confirmed",
    })
      .populate("userId",    "fullName email")
      .populate("advocateId", "fullName email");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Video call room not found or not yet confirmed",
      });
    }

    // ── Access check: only the booked user OR advocate ────
    const requesterId = req.user?._id || req.advocate?._id;
    const isUser      = booking.userId._id.toString()     === requesterId?.toString();
    const isAdvocate  = booking.advocateId._id.toString() === requesterId?.toString();

    if (!isUser && !isAdvocate) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to join this call",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        roomId,
        role:         isAdvocate ? "advocate" : "user",
        meetingDate:  booking.meetingDate,
        meetingTime:  booking.meetingTime,
        caseType:     booking.caseType,
        participant: {
          // Show the OTHER person's name
          name: isAdvocate ? booking.userId.fullName : booking.advocateId.fullName,
        },
      },
    });

  } catch (error) {
    console.error("getVideoCallRoom Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getPendingBookings,
  getAllBookings,
  confirmBooking,
  cancelBooking,
  getVideoCallRoom,
};