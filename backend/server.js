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

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";

// Middleware
app.use(cors(buildCorsOptions()));

// Lightweight request logger
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

/* 🔥 OPTIMIZED DB MIDDLEWARE (FINAL FIX) */
app.use(async (req, res, next) => {
  // ✅ Skip if already connected
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

  return res.status(500).json({
    success: false,
    message: "Database temporarily unavailable",
  });
});

// Health routes
app.get("/", (req, res) => {
  res.type("text/plain").send("API Running");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "dhawan-e-bikes-finance-api",
    uptime: process.uptime(),
    env: process.env.NODE_ENV || "development",
  });
});

app.get("/test", (req, res) => {
  res.type("text/plain").send("Backend working");
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

// 🚀 START SERVER WITH DB RETRY
(async function startServer() {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
      console.error("JWT_SECRET is required in production");
      process.exit(1);
    }
  }

  let retries = 5;
  while (retries) {
    try {
      await connectDatabase();
      console.log("✅ MongoDB connected");
      break;
    } catch (err) {
      console.error("❌ MongoDB connection failed. Retrying...");
      retries -= 1;
      await new Promise((res) => setTimeout(res, 5000));
    }
  }

  if (!retries) {
    console.error("❌ Could not connect to MongoDB after retries.");
  }

  const server = app.listen(PORT, HOST, () => {
    const publicUrl = process.env.RENDER_EXTERNAL_URL;
    console.log(
      publicUrl
        ? `🚀 Server running at ${publicUrl}`
        : `🚀 Server running on http://${HOST}:${PORT}`
    );
  });

  server.on("error", (err) => {
    console.error("Server error:", err);
  });

  const shutdown = () => {
    console.log("Shutting down server...");
    server.close(() => {
      closeDatabase().catch(() => {});
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})();