require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { connectDatabase, closeDatabase } = require("./config/database");

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";

// Middleware — allow all origins (tighten for production later if needed)
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Health check (Render / load balancers)
app.get("/", (req, res) => {
  res.type("text/plain").send("API Running");
});

// Import routes
const modelRoutes = require("./routes/modelRoutes");
const spareRoutes = require("./routes/spareRoutes");
const orderRoutes = require("./routes/orderRoutes");
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
app.use("/api/orders", orderRoutes);
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
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
