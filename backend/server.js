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

const PORT = process.env.PORT || 5000;

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

// Health routes (no DB) — must respond before async route registration
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
    boot: "routes-deferred",
  });
});

app.get("/test", (req, res) => {
  res.type("text/plain").send("Backend working");
});

// Open TCP port immediately so Render / Cloudflare health checks don’t get 521
// if a later require() throws during startup
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log("[BOOT] NODE_ENV:", process.env.NODE_ENV || "development");
  console.log("[BOOT] MONGO_URI set:", Boolean(process.env.MONGO_URI?.trim()));
});

function safeUse(mountPath, modulePath) {
  try {
    app.use(mountPath, require(modulePath));
  } catch (err) {
    console.error(`[BOOT] Failed to mount ${modulePath} at ${mountPath}:`, err);
  }
}

function safeUseRouter(modulePath) {
  try {
    app.use(require(modulePath));
  } catch (err) {
    console.error(`[BOOT] Failed to mount ${modulePath}:`, err);
  }
}

// Register DB gate + API routes after listen (avoids 521 when a route import crashes)
setImmediate(() => {
  try {
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

    safeUse("/api/models", "./routes/modelRoutes");
    safeUse("/api/spares", "./routes/spareRoutes");
    safeUse("/api/auth", "./routes/authRoutes");
    safeUse("/api/admin", "./routes/adminRoutes");
    safeUse("/api/batteries", "./routes/batteryRoutes");
    safeUse("/api/battery-scraps", "./routes/batteryScrapRoutes");
    safeUse("/api/chargers", "./routes/chargerRoutes");
    safeUse("/api/old-chargers", "./routes/oldChargerRoutes");
    safeUse("/api/old-charger-scraps", "./routes/oldChargerScrapRoutes");
    safeUse("/api/old-scooties", "./routes/oldScootyRoutes");
    safeUse("/api/jobcards", "./routes/jobcardRoutes");
    safeUse("/api/bills", "./routes/billRoutes");
    safeUseRouter("./routes/restoreRoutes");

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

    console.log("[BOOT] API routes and error handler registered");
  } catch (err) {
    console.error("[BOOT] Fatal error registering routes:", err);
  }
});

const shutdown = () => {
  console.log("Shutting down server...");
  closeDatabase().catch(() => {});
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
