const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");
const dotenv  = require("dotenv");
const path    = require("path");
const connectDB = require("./config/db");

dotenv.config();

const app = express();
connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ─── Helmet — images allow karo ───────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(morgan("dev"));

// ─── Static Files — uploads folder serve karo ────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API Routes ───────────────────────────────────────────
app.use("/api", require("./routes/all.routes"));

app.get("/", ( res) => {
  res.status(200).json({
    success: true,
    message: "E-Notary API is running...",
  });
});

app.use((res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, res) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});