require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { connectDatabase, closeDatabase } = require("./config/database");

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
    await connectDatabase();
  } catch {
    console.error(
      "[Server] Exiting: MongoDB connection failed (check MONGO_URI)."
    );
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
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
