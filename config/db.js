const mongoose = require("mongoose");

const seedAdmin = async () => {
  try {
    const Admin = require("../models/Admin");

    const existing = await Admin.findOne({
      email: process.env.ADMIN_EMAIL,
    });

    if (!existing) {
      await Admin.create({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      });
      console.log("✅ Admin created successfully!");
    } else {
      console.log("Admin already exists!");
    }
  } catch (error) {
    console.error(`Admin Seed Error: ${error.message}`);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    await seedAdmin();
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;