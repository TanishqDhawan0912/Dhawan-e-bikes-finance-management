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
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
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

// Pre-save middleware to update lastUpdated
modelSchema.pre("save", function (next) {
  if (
    this.isModified("quantity") ||
    this.isModified("modelName") ||
    this.isModified("company")
  ) {
    this.lastUpdated = Date.now();
  }
  next();
});

module.exports = mongoose.model("Model", modelSchema);
