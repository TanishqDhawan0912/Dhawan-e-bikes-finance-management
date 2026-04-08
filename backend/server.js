// 🔥 CRASH PROTECTION (keep process alive for logs)
process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 UNHANDLED REJECTION:", err);
});

require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");

const { connectDatabase, closeDatabase } = require("./config/database");
const { buildCorsOptions } = require("./config/corsOptions");

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Middleware
app.use(cors(buildCorsOptions()));
app.options("*", cors(buildCorsOptions()));

// Lightweight request logger
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Health routes MUST be before DB middleware so Render / Cloudflare probes never wait on MongoDB
app.get("/", (req, res) => {
  res.type("text/plain").send("API Running");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "dhawan-e-bikes-finance-api",
    uptime: process.uptime(),
    env: process.env.NODE_ENV || "development",
    dbReady: mongoose.connection.readyState === 1,
  });
});

app.get("/test", (req, res) => {
  res.type("text/plain").send("Backend working");
});

/* DB gate: API routes wait for Mongo; health routes above skip this */
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  let attempts = 2;
  while (attempts--) {
    try {
      console.warn("⚠️ DB reconnect attempt...");
      await connectDatabase();
      return next();
    } catch (err) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return res.status(503).json({
    success: false,
    message: "Database temporarily unavailable",
  });
});

// DB test route
app.get("/db-test", async (req, res) => {
  const User = require("./models/User");

  try {
    const userCount = await User.countDocuments().maxTimeMS(15000);

    const payload = {
      success: true,
      message: "Database reachable",
      userCount,
    };

    if (process.env.NODE_ENV !== "production") {
      const users = await User.find()
        .select("-password")
        .limit(5)
        .lean()
        .maxTimeMS(15000);

      payload.sampleCount = users.length;
      payload.users = users.map((u) => ({
        id: String(u._id),
        email: u.email,
        name: u.name,
        role: u.role,
      }));
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error("[db-test] Query failed:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Database query failed",
      ...(process.env.NODE_ENV !== "production" && {
        detail: err?.message,
      }),
    });
  }
});

// Routes
app.use("/api/models", require("./routes/modelRoutes"));
app.use("/api/spares", require("./routes/spareRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/batteries", require("./routes/batteryRoutes"));
app.use("/api/battery-scraps", require("./routes/batteryScrapRoutes"));
app.use("/api/chargers", require("./routes/chargerRoutes"));
app.use("/api/old-chargers", require("./routes/oldChargerRoutes"));
app.use("/api/old-charger-scraps", require("./routes/oldChargerScrapRoutes"));
app.use("/api/old-scooties", require("./routes/oldScootyRoutes"));
app.use("/api/jobcards", require("./routes/jobcardRoutes"));
app.use("/api/bills", require("./routes/billRoutes"));
app.use(require("./routes/restoreRoutes"));

// 404 handlers
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    method: req.method,
    path: req.originalUrl,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    method: req.method,
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("[Express Error]", err);

  if (res.headersSent) return next(err);

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid document id",
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Something broke!",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});