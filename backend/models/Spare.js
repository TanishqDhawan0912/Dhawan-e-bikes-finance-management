const mongoose = require("mongoose");

const spareSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "engine",
        "electrical",
        "suspension",
        "brakes",
        "interior",
        "exterior",
        "other",
      ],
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    minStockLevel: {
      type: Number,
      default: 5,
      min: 0,
    },
    supplier: {
      name: String,
      contact: String,
      email: String,
    },
    lastRestocked: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    location: {
      aisle: String,
      shelf: String,
      bin: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for profit calculation
spareSchema.virtual("profitPerUnit").get(function () {
  return this.sellingPrice - this.costPrice;
});

// Virtual for inventory value
spareSchema.virtual("inventoryValue").get(function () {
  return this.quantity * this.costPrice;
});

// Check if stock is low
spareSchema.virtual("isLowStock").get(function () {
  return this.quantity <= this.minStockLevel;
});

// Method to update stock
spareSchema.methods.updateStock = async function (quantity, type = "in") {
  if (type === "in") {
    this.quantity += quantity;
  } else if (type === "out") {
    if (this.quantity < quantity) {
      throw new Error("Insufficient stock");
    }
    this.quantity -= quantity;
  }

  if (type === "in") {
    this.lastRestocked = Date.now();
  }

  return this.save();
};

// Generate SKU before saving
spareSchema.pre("save", async function (next) {
  if (!this.sku) {
    const categoryCode = this.category.substring(0, 3).toUpperCase();
    const count = await this.constructor.countDocuments({
      category: this.category,
    });
    this.sku = `${categoryCode}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Spare", spareSchema);
