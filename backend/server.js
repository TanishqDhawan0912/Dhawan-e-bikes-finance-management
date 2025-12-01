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

// Use routes
app.use("/api/models", modelRoutes);
app.use("/api/spares", spareRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle port conflicts automatically
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${PORT} is busy, trying to find an available port...`);
    // Try the next port
    const newPort = parseInt(PORT) + 1;
    server.listen(newPort, () => {
      console.log(
        `Server running on port ${newPort} (original port ${PORT} was busy)`
      );
    });
  } else {
    console.error("Server error:", err);
    process.exit(1);
  }
});
