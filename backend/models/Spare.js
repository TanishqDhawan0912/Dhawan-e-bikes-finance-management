const mongoose = require("mongoose");

const spareSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    minStockLevel: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    supplierName: {
      type: String,
      required: false,
      trim: true,
    },
    colorQuantity: [
      {
        color: {
          type: String,
          required: true,
          trim: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
          default: 0,
        },
        minStockLevel: {
          type: Number,
          required: true,
          min: 0,
          default: 0,
        },
        purchasePrice: {
          type: Number,
          required: true,
          min: 0,
          default: 0,
        },
        purchaseDate: {
          type: String,
          required: false,
          default: "",
        },
      },
    ],
    hasColors: {
      type: Boolean,
      default: false,
    },
    models: [
      {
        type: String,
        trim: true,
      },
    ],
    stockEntries: [
      {
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        purchasePrice: {
          type: Number,
          required: true,
          min: 0,
        },
        purchaseDate: {
          type: String,
          required: true,
        },
        color: {
          type: String,
          required: false,
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Virtual field to calculate total quantity from stockEntries
spareSchema.virtual("totalQuantity").get(function () {
  if (!this.stockEntries || this.stockEntries.length === 0) {
    return 0;
  }
  return this.stockEntries.reduce(
    (total, entry) => total + (entry.quantity || 0),
    0
  );
});

// Pre-save hook to update quantity field based on stockEntries or colorQuantity
spareSchema.pre("save", function (next) {
  // If colorQuantity has values, calculate quantity from colors
  if (this.colorQuantity && this.colorQuantity.length > 0) {
    this.quantity = this.colorQuantity.reduce(
      (total, cq) => total + (cq.quantity || 0),
      0
    );
  }
  // If quantity is explicitly set (not 0), use it as-is (for manual entries)
  else if (this.quantity !== undefined && this.quantity !== 0) {
    // Keep the manually set quantity - don't override it
    console.log("Keeping manually set quantity:", this.quantity);
  }
  // Otherwise, calculate from stockEntries (original behavior)
  else if (this.stockEntries && this.stockEntries.length > 0) {
    this.quantity = this.stockEntries.reduce(
      (total, entry) => total + (entry.quantity || 0),
      0
    );
  } else {
    this.quantity = 0;
  }
  next();
});

// Pre-update hook to recalculate quantity when stockEntries or colorQuantity are modified
spareSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  function (next) {
    const update = this.getUpdate();

    // If colorQuantity is being updated, calculate quantity from colors
    if (update.colorQuantity) {
      if (
        Array.isArray(update.colorQuantity) &&
        update.colorQuantity.length > 0
      ) {
        const totalQuantity = update.colorQuantity.reduce(
          (total, cq) => total + (cq.quantity || 0),
          0
        );
        update.quantity = totalQuantity;
      } else {
        update.quantity = 0;
      }
    }
    // If quantity is explicitly being updated, use it as-is (for manual entries)
    else if (update.quantity !== undefined && update.quantity !== 0) {
      // Keep the manually set quantity - don't override it
      console.log("Keeping manually set quantity in update:", update.quantity);
    }
    // Otherwise, use original stockEntries logic
    else if (update.stockEntries) {
      if (
        Array.isArray(update.stockEntries) &&
        update.stockEntries.length > 0
      ) {
        const totalQuantity = update.stockEntries.reduce(
          (total, entry) => total + (entry.quantity || 0),
          0
        );
        update.quantity = totalQuantity;
      } else {
        update.quantity = 0;
      }
    }
    next();
  }
);

// Ensure virtual fields are included in JSON output
spareSchema.set("toJSON", { virtuals: true });
spareSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Spare", spareSchema);
