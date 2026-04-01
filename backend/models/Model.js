const mongoose = require("mongoose");

const modelSchema = new mongoose.Schema(
  {
    modelName: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    colour: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    purchasePrice: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    sellingPrice: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    batteriesPerSet: {
      type: Number,
      required: false,
      default: 5,
      enum: [5, 6],
    },
    description: {
      type: [String],
      required: false,
      default: [],
    },
    colorQuantities: [
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
        },
      },
    ],
    purchasedInWarranty: {
      type: Boolean,
      required: false,
      default: false,
    },
    purchaseDate: {
      type: Date,
      required: false,
      default: Date.now,
    },
    stockEntries: [
      {
        purchaseDate: {
          type: String,
          required: true,
        },
        batteriesPerSet: {
          type: Number,
          required: false,
          default: 5,
          enum: [5, 6],
        },
        sellingPrice: {
          type: Number,
          required: false,
          min: 0,
          default: 0,
        },
        purchasePrice: {
          type: Number,
          required: false,
          min: 0,
          default: 0,
        },
        colorQuantities: [
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
            },
          },
        ],
        description: {
          type: [String],
          required: false,
          default: [],
        },
        purchasedInWarranty: {
          type: Boolean,
          required: false,
          default: false,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    lastSyncedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for stock status
modelSchema.virtual("stockStatus").get(function () {
  if (this.quantity === 0) {
    return "Out of Stock";
  } else if (this.quantity < 15) {
    return "Low Stock";
  } else {
    return "In Stock";
  }
});

// Virtual for stock status color
modelSchema.virtual("stockStatusColor").get(function () {
  if (this.quantity === 0) {
    return "#ef4444"; // Red
  } else if (this.quantity < 15) {
    return "#f59e0b"; // Yellow
  } else {
    return "#10b981"; // Green
  }
});

// Virtual field to calculate total quantity from stockEntries
modelSchema.virtual("totalQuantityFromEntries").get(function () {
  if (!this.stockEntries || this.stockEntries.length === 0) {
    return 0;
  }
  return this.stockEntries.reduce(
    (total, entry) => total + (entry.quantity || 0),
    0
  );
});

// Method to update quantity
modelSchema.methods.updateQuantity = async function (quantity, type = "set") {
  if (type === "set") {
    this.quantity = Math.max(0, quantity);
  } else if (type === "add") {
    this.quantity += quantity;
  } else if (type === "subtract") {
    this.quantity = Math.max(0, this.quantity - quantity);
  }

  this.lastUpdated = Date.now();
  return this.save();
};

// Pre-save middleware to update lastUpdated and quantity from stockEntries
modelSchema.pre("save", function (next) {
  // If stockEntries has values, calculate quantity from entries' colorQuantities
  if (this.stockEntries && this.stockEntries.length > 0) {
    this.quantity = this.stockEntries.reduce((total, entry) => {
      if (entry.colorQuantities && entry.colorQuantities.length > 0) {
        return (
          total +
          entry.colorQuantities.reduce(
            (sum, cq) => sum + (cq.quantity || 0),
            0
          )
        );
      }
      return total;
    }, 0);
  }
  
  if (
    this.isModified("quantity") ||
    this.isModified("modelName") ||
    this.isModified("company") ||
    this.isModified("stockEntries")
  ) {
    this.lastUpdated = Date.now();
  }
  next();
});

// Atlas/local sync: createdAt range + updatedAt vs lastSyncedAt in candidate filter.
modelSchema.index({ createdAt: 1 });
modelSchema.index({ updatedAt: 1 });

module.exports = mongoose.model("Model", modelSchema);
