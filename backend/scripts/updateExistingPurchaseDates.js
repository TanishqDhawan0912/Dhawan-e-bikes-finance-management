require("dotenv").config();
const mongoose = require("mongoose");
const Model = require("../models/Model");

// Update existing models to have today's date as purchaseDate
const updateExistingPurchaseDates = async () => {
  try {
    // Connect to MongoDB
    const localUri = process.env.MONGO_LOCAL_URI?.trim();
    if (!localUri) {
      console.error("MONGO_LOCAL_URI is not set");
      process.exit(1);
    }
    await mongoose.connect(localUri);

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
