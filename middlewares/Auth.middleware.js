const jwt = require("jsonwebtoken");
const Advocate = require("../models/Advocate");
const Admin = require("../models/Admin");

// ─── Advocate Auth ────────────────────────────────────────
const advocateAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access denied. No token provided",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "advocate") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Not an advocate",
            });
        }

        const advocate = await Advocate.findById(decoded.id);
        if (!advocate) {
            return res.status(404).json({
                success: false,
                message: "Advocate not found",
            });
        }

        req.advocate = advocate;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
};

// ─── Admin Auth ───────────────────────────────────────────
const adminAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access denied. No token provided",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Not an admin",
            });
        }

        const admin = await Admin.findById(decoded.id);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found",
            });
        }

        req.admin = admin;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
};

module.exports = { advocateAuth, adminAuth };