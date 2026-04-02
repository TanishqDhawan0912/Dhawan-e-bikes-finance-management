require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cron = require("node-cron");
const { connectMongoDatabases } = require("./config/database");
const { syncAllLocalToAtlas } = require("./services/atlasSync");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Routes will be added here
app.get("/", (req, res) => {
  res.send("Finance Management API is running");
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
const syncRoutes = require("./routes/syncRoutes");
const restoreRoutes = require("./routes/restoreRoutes");
require("./models/SyncLog");

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
app.use(syncRoutes);
app.use(restoreRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const portRaw = process.env.PORT?.trim();
const PORT = portRaw !== undefined && portRaw !== "" ? Number(portRaw) : NaN;
if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(
    "[Server] Exiting: set PORT in environment to an integer 1–65535 (e.g. PORT=5000)."
  );
  process.exit(1);
}

(async function startServer() {
  try {
    await connectMongoDatabases();
  } catch {
    console.error(
      "[Server] Exiting: local MongoDB (primary) is required and could not connect."
    );
    process.exit(1);
  }

  const server = app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    try {
      console.log("[Sync] Initial Atlas sync (startup)…");
      const initial = await syncAllLocalToAtlas();
      console.log("[Sync] Initial sync result:", {
        success: initial.success,
        skipped: Boolean(initial.skipped),
        totalCandidates: initial.totalCandidates,
        synced: initial.synced,
        failed: initial.failed,
        deletedFromAtlas: initial.deletedFromAtlas,
        durationMs: initial.durationMs,
      });
    } catch (err) {
      console.error("[Sync] Initial sync error:", err.message);
    }

    const cronExpr = process.env.SYNC_CRON?.trim() || "0 */6 * * *";
    if (!cron.validate(cronExpr)) {
      console.error(
        "[Sync] Invalid SYNC_CRON; expected 5-field cron (e.g. 0 */6 * * *). Scheduled sync disabled."
      );
    } else {
      cron.schedule(cronExpr, () => {
        syncAllLocalToAtlas()
          .then((r) => {
            console.log("[Sync] Scheduled run result:", {
              success: r.success,
              skipped: Boolean(r.skipped),
              totalCandidates: r.totalCandidates,
              synced: r.synced,
              failed: r.failed,
              durationMs: r.durationMs,
            });
          })
          .catch((e) => console.error("[Sync] Scheduled run error:", e.message));
      });
      console.log(`[Sync] Recurring sync scheduled: SYNC_CRON="${cronExpr}"`);
    }
  });

  server.on("error", (err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
})();
