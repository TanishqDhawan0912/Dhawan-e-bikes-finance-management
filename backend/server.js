require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Database connection
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/finance-management";

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const PORT = 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
