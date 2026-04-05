require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { connectDatabase, closeDatabase } = require("./config/database");
const { buildCorsOptions } = require("./config/corsOptions");

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors(buildCorsOptions()));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Health check (Render / load balancers) — plain text for simple probes
app.get("/", (req, res) => {
  res.type("text/plain").send("API Running");
});

// JSON health (optional monitoring / debugging)
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

app.get("/db-test", async (req, res) => {
  const User = require("./models/User");
  try {
    const userCount = await User.countDocuments().maxTimeMS(8000);

    const payload = {
      success: true,
      message: "Database reachable",
      userCount,
    };

    // Avoid exposing PII on a public URL in production
    if (process.env.NODE_ENV !== "production") {
      const users = await User.find()
        .select("-password")
        .limit(5)
        .lean()
        .maxTimeMS(8000);
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

// Import routes
const modelRoutes = require("./routes/modelRoutes");
const spareRoutes = require("./routes/spareRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const batteryRoutes = require("./routes/batteryRoutes");
const batteryScrapRoutes = require("./routes/batteryScrapRoutes");
const chargerRoutes = require("./routes/chargerRoutes");
const oldChargerRoutes = require("./routes/oldChargerRoutes");
const oldChargerScrapRoutes = require("./routes/oldChargerScrapRoutes");
const oldScootyRoutes = require("./routes/oldScootyRoutes");
const jobcardRoutes = require("./routes/jobcardRoutes");
const billRoutes = require("./routes/billRoutes");
const restoreRoutes = require("./routes/restoreRoutes");

// Use routes
app.use("/api/models", modelRoutes);
app.use("/api/spares", spareRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/batteries", batteryRoutes);
app.use("/api/battery-scraps", batteryScrapRoutes);
app.use("/api/chargers", chargerRoutes);
app.use("/api/old-chargers", oldChargerRoutes);
app.use("/api/old-charger-scraps", oldChargerScrapRoutes);
app.use("/api/old-scooties", oldScootyRoutes);
app.use("/api/jobcards", jobcardRoutes);
app.use("/api/bills", billRoutes);
app.use(restoreRoutes);

// Unmatched API routes → JSON 404 (mounted routers only handle their prefix)
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    method: req.method,
    path: req.originalUrl,
  });
});

// Error handling middleware — JSON for API clients
app.use((err, req, res, next) => {
  console.error("[Express]", err?.stack || err);
  if (res.headersSent) {
    return next(err);
  }
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid document id",
    });
  }
  const status = Number(err.statusCode || err.status) || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Something broke!",
  });
});

(async function startServer() {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
      console.error(
        "[Server] JWT_SECRET is required in production (Render → Environment)."
      );
      process.exit(1);
    }
  }

  try {
    await connectDatabase();
  } catch (err) {
    console.error("[Server] MongoDB connection failed — exiting.");
    console.error(
      "[Server] Ensure MONGO_URI is set (Render: Dashboard → Environment).",
      err?.message || err
    );
    if (err?.name) console.error("[Server] Error name:", err.name);
    process.exit(1);
  }

  const server = app.listen(PORT, HOST, () => {
    const publicUrl = process.env.RENDER_EXTERNAL_URL;
    if (publicUrl) {
      console.log(`Server listening — public URL: ${publicUrl}`);
    } else {
      console.log(`Server listening on http://${HOST}:${PORT}`);
    }
  });

  server.on("error", (err) => {
    console.error("Server error:", err);
    process.exit(1);
  });

  const shutdown = () => {
    server.close(() => {
      closeDatabase()
        .catch(() => {})
        .finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})();
