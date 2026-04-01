const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");

dotenv.config();

const app = express();
connectDB();

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors());

// Helmet (Allow Images)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Logger
app.use(morgan("dev"));

// Static Folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Routes
app.use("/api", require("./routes/all.routes"));

// Root Test Route (Correct Signature: req, res)
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "E-Notary API is running...",
  });
});

// 404 Handler (MUST be req, res)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error Handler (MUST be err, req, res, next)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});