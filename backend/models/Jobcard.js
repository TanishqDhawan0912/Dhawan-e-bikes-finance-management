/**
 * Jobcard — canonical model for service / job records.
 * MongoDB collection: jobcards (Mongoose default for model name "Jobcard").
 */
const mongoose = require("mongoose");
const softDeletePlugin = require("./plugins/softDelete");

const jobcardPartSchema = new mongoose.Schema({
  // For normal parts this references a Spare document.
  // For custom parts this can be null.
  spareId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Spare",
    required: false,
    default: null,
  },
  /** For new battery sales / battery replacement stock: Battery document id (may match spareId when id was stored there). */
  batteryInventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Battery",
    required: false,
    default: null,
  },
  /** For new charger sales from All Chargers stock — do not use spareId (Spare ref + populate breaks Charger ObjectIds). */
  chargerInventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Charger",
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
  // Old scooty sales metadata
  pmcNo: {
    type: String,
    required: false,
    default: "",
  },
  sparesUsed: [
    {
      spareId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Spare",
        required: false,
        default: null,
      },
      name: {
        type: String,
        required: false,
        default: "",
      },
      quantity: {
        type: Number,
        required: false,
        min: 1,
        default: 1,
      },
      color: {
        type: String,
        required: false,
        default: "",
      },
      // true when spare came from old scooty master entry (already deducted there)
      fromOldScooty: {
        type: Boolean,
        default: false,
      },
    },
  ],
  // Old scooty sales specific fields
  batteryChemistry: {
    type: String,
    required: false,
  },
  batteryVoltage: {
    type: String,
    required: false,
  },
  batteryName: {
    type: String,
    required: false,
  },
  chargerType: {
    type: String,
    required: false,
  },
  chargerName: {
    type: String,
    required: false,
  },
  chargerChemistry: {
    type: String,
    required: false,
  },
  chargerVoltage: {
    type: String,
    required: false,
  },
  chargerWarrantyStatus: {
    type: String,
    required: false,
  },
  // Models this part/spare is compatible with (copied from Spare.models)
  models: [
    {
      type: String,
      trim: true,
    },
  ],
  /** Total FIFO purchase cost for this line when inventory was deducted (finalize/settle) */
  fifoLinePurchaseCost: {
    type: Number,
    default: 0,
    min: 0,
  },
  /** Manual unit purchase cost override (used for custom lines or when stock cost is unknown) */
  manualUnitPurchaseCost: {
    type: Number,
    default: 0,
    min: 0,
  },
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
        // Canonical timestamp for this payment (used for correct time display across timezones).
        paidAt: {
          type: Date,
          default: Date.now,
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
    // Old charger rows removed from inventory when selling chargerOldNew "old" (restored on jobcard delete).
    consumedOldChargers: {
      type: [
        {
          voltage: { type: String, required: true },
          batteryType: { type: String, required: true },
          ampere: { type: String, default: "4A" },
          status: { type: String, default: "working" },
          entryDate: { type: Date, default: Date.now },
          jobcardNumber: { type: String, default: null },
        },
      ],
      default: [],
    },
    // Battery scrap units consumed from stock when selling old batteries.
    // Restored on jobcard delete.
    consumedBatteryScraps: {
      type: [
        {
          quantity: { type: Number, required: true, min: 1 },
          entryDate: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    // Old scooty entries removed from old scooty section when sold via jobcard.
    consumedOldScooties: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // Extra spares added in old scooty sales (jobcard-only additions) consumed from Spare stock.
    consumedOldScootySaleSpares: {
      type: [
        {
          spareId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Spare",
            required: false,
            default: null,
          },
          quantity: { type: Number, required: true, min: 1 },
          color: { type: String, default: "" },
        },
      ],
      default: [],
    },
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
    /** Optional client-reported sync timestamp (e.g. mobile); null if unused */
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

jobcardSchema.plugin(softDeletePlugin);

jobcardSchema.index({ createdAt: 1 });
jobcardSchema.index({ updatedAt: 1 });

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

const Jobcard =
  mongoose.models.Jobcard || mongoose.model("Jobcard", jobcardSchema);

module.exports = Jobcard;
module.exports.jobcardSchema = jobcardSchema;

