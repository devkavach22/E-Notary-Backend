const Advocate = require("../models/Advocate");
const User     = require("../models/User");

// ═══════════════════════════════════════════════════════════
// @route  GET /api/admin/advocates
// View all advocates
// ═══════════════════════════════════════════════════════════
const getAllAdvocates = async (req, res) => {
    try {
        const advocates = await Advocate.find()
            .select("-password")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            total: advocates.length,
            data: advocates,
        });
    } catch (error) {
        console.error("getAllAdvocates Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ═══════════════════════════════════════════════════════════
// @route  GET /api/admin/advocate/:id
// View single advocate
// ═══════════════════════════════════════════════════════════
const getAdvocateDetails = async (req, res) => {
    try {
        const advocate = await Advocate.findById(req.params.id).select("-password");

        if (!advocate) {
            return res.status(404).json({ success: false, message: "Advocate not found" });
        }

        return res.status(200).json({
            success: true,
            data: advocate,
        });
    } catch (error) {
        console.error("getAdvocateDetails Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ═══════════════════════════════════════════════════════════
// @route  GET /api/admin/users
// View all users
// ═══════════════════════════════════════════════════════════
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select("-password")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            total: users.length,
            data: users,
        });
    } catch (error) {
        console.error("getAllUsers Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ═══════════════════════════════════════════════════════════
// @route  GET /api/admin/user/:id
// View single user
// ═══════════════════════════════════════════════════════════
const getUserDetails = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        return res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error("getUserDetails Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    getAllAdvocates,
    getAdvocateDetails,
    getAllUsers,
    getUserDetails,
};