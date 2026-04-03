const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const User = require("../models/User");
const Advocate = require("../models/Advocate"); 

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

const userAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided",
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Not a user",
      });
    }
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is deactivated",
      });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};


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
    if (!advocate.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is deactivated",
      });
    }
    if (advocate.approvalStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Your account is not approved yet",
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

module.exports = { adminAuth, userAuth, advocateAuth }; 