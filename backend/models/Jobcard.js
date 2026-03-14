const mongoose = require("mongoose");

const jobcardPartSchema = new mongoose.Schema({
  // For normal parts this references a Spare document.
  // For custom parts this can be null.
  spareId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Spare",
    required: false,
    default: null,
  },
  spareName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  selectedColor: {
    type: String,
    default: null,
  },
  // Flag so we know this part was entered manually and
  // doesn't belong to the main spares inventory.
  isCustom: {
    type: Boolean,
    default: false,
  },
  // Type of part: service, replacement, or sales
  partType: {
    type: String,
    enum: ["service", "replacement", "sales"],
    default: "service",
  },
  // Sales-related fields
  salesType: {
    type: String,
    enum: ["battery", "charger", "oldScooty", "spare"],
    required: false,
  },
  scrapAvailable: {
    type: Boolean,
    default: false,
  },
  scrapQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  scrapPricePerUnit: {
    type: Number,
    default: 0,
    min: 0,
  },
  batteryOldNew: {
    type: String,
    enum: ["old", "new"],
    required: false,
  },
  chargerOldNew: {
    type: String,
    enum: ["old", "new"],
    required: false,
  },
  ampereValue: {
    type: String,
    required: false,
  },
  warrantyStatus: {
    type: String,
    required: false,
  },
  // Replacement-related fields
  replacementType: {
    type: String,
    enum: ["battery", "charger", "controller", "motor"],
    required: false,
  },
  replacementFromCompany: {
    type: Boolean,
    default: false,
  },
  batteryType: {
    type: String,
    required: false,
  },
  voltage: {
    type: String,
    required: false,
  },
  oldChargerName: {
    type: String,
    required: false,
  },
  oldChargerVoltage: {
    type: String,
    required: false,
  },
  oldChargerWorking: {
    type: String,
    enum: ["working", "notWorking"],
    required: false,
  },
  oldChargerAvailable: {
    type: Boolean,
    default: false,
  },
  // Models this part/spare is compatible with (copied from Spare.models)
  models: [
    {
      type: String,
      trim: true,
    },
  ],
});

const jobcardSchema = new mongoose.Schema(
  {
    jobcardNumber: {
      type: String,
      unique: true,
    },
    jobcardType: {
      type: String,
      required: true,
      // Can be single type or comma-separated: "service", "service, replacement", "service, replacement, sales"
    },
    customerName: {
      type: String,
      default: "N/A",
    },
    place: {
      type: String,
      default: "N/A",
    },
    mobile: {
      type: String,
      default: "N/A",
    },
    charger: {
      type: String,
      enum: ["yes", "no"],
      default: "no",
    },
    date: {
      type: String,
      required: true,
    },
    warrantyType: {
      type: String,
      enum: ["none", "full", "battery", "charger"],
      default: "none",
    },
    warrantyDate: {
      type: String,
      default: "N/A",
    },
    billNo: {
      type: String,
      default: "",
    },
    mechanic: {
      type: String,
      default: "",
    },
    ebikeDetails: {
      type: String,
      default: "",
    },
    details: {
      type: [String],
      default: [],
    },
    parts: {
      type: [jobcardPartSchema],
      default: [],
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    labour: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMode: {
      type: String,
      enum: ["cash", "upi"],
      default: "cash",
    },
    pendingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentHistory: [
      {
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        date: {
          type: String,
          required: true,
        },
        time: {
          type: String,
          default: "",
        },
        paymentMode: {
          type: String,
          enum: ["cash", "upi"],
          required: true,
        },
      },
    ],
    // Whether inventory (spare stock, etc.) has been adjusted for this jobcard.
    // Used so we can safely restore stock on delete without double-counting.
    inventoryAdjusted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "finalized"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Generate jobcard number before saving: jc-date-(entry number of that date)
jobcardSchema.pre("save", async function (next) {
  if (!this.jobcardNumber) {
    // Get the date from the jobcard (format: YYYY-MM-DD)
    const jobcardDate = this.date || new Date().toISOString().split("T")[0];
    
    // Convert date from YYYY-MM-DD to DD-MM-YYYY
    const [year, month, day] = jobcardDate.split("-");
    const formattedDate = `${day}-${month}-${year}`;
    
    // Count how many jobcards exist for this date (entry number = 1, 2, 3, ...)
    const count = await this.constructor.countDocuments({
      date: jobcardDate,
    });
    
    const entryNumber = count + 1;
    
    // Format: jc-11-02-2025-(1)
    this.jobcardNumber = `jc-${formattedDate}-(${entryNumber})`;
  }
  next();
});

module.exports = mongoose.model("Jobcard", jobcardSchema);

