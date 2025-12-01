const mongoose = require("mongoose");
const Model = require("../models/Model");
require("dotenv").config();

// Update existing models to have today's date as purchaseDate
const updateExistingPurchaseDates = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/finance-management",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    console.log("Connected to MongoDB");

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day

    console.log(
      "Updating existing models with purchase date:",
      today.toISOString()
    );

    // Update all models that don't have a purchaseDate
    const result = await Model.updateMany(
      {
        purchaseDate: { $exists: false },
      },
      {
        $set: {
          purchaseDate: today,
        },
      }
    );

    console.log(
      `Updated ${result.modifiedCount} models with today's purchase date`
    );

    // Also update models that have null purchaseDate
    const nullResult = await Model.updateMany(
      {
        purchaseDate: null,
      },
      {
        $set: {
          purchaseDate: today,
        },
      }
    );

    console.log(
      `Updated ${nullResult.modifiedCount} models with null purchase date`
    );

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Error updating purchase dates:", error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
};

// Run the migration
updateExistingPurchaseDates();
