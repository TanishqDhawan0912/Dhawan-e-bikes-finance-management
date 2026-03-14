const Jobcard = require("../models/Jobcard");
const Spare = require("../models/Spare");
const Battery = require("../models/Battery");
const Charger = require("../models/Charger");
const OldCharger = require("../models/OldCharger");

// Helper: adjust main spare stock for parts on a jobcard that come from the
// spare inventory.
// - Applies to:
//   - Service parts: part.partType === "service"
//   - Sales spares: part.partType === "sales" && part.salesType === "spare"
//   - Controller/motor replacements taken from spares:
//       part.partType === "replacement" &&
//       part.replacementType in ["controller", "motor"]
// - Only parts that are NOT custom (isCustom !== true) and have a spareId
// - When mode === "deduct": subtract quantity from stock
// - When mode === "restore": add quantity back to stock
const adjustSpareInventoryForJobcard = async (jobcard, mode = "deduct") => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  const factor = mode === "restore" ? 1 : -1;

  for (const part of jobcard.parts) {
    if (!part || part.isCustom === true || !part.spareId) {
      continue;
    }

    const isService = part.partType === "service";
    const isSpareSales =
      part.partType === "sales" && part.salesType === "spare";
    const isControllerOrMotorReplacement =
      part.partType === "replacement" &&
      (part.replacementType === "controller" ||
        part.replacementType === "motor");

    if (!isService && !isSpareSales && !isControllerOrMotorReplacement) {
      continue;
    }

    const qty = Number(part.quantity) || 0;
    if (qty <= 0) continue;

    const qtyDelta = factor * qty;

    const spare = await Spare.findById(part.spareId);
    if (!spare) continue;

    const colorKey = (part.selectedColor || "").trim().toLowerCase();

    if (spare.hasColors && Array.isArray(spare.colorQuantity) && colorKey) {
      const colorEntry = spare.colorQuantity.find(
        (cq) =>
          cq &&
          typeof cq.color === "string" &&
          cq.color.trim().toLowerCase() === colorKey
      );

      if (colorEntry) {
        const newQty = Math.max(
          0,
          (Number(colorEntry.quantity) || 0) + qtyDelta
        );
        colorEntry.quantity = newQty;
      } else {
        // Fallback to global quantity if matching color is not found
        spare.quantity = Math.max(0, (Number(spare.quantity) || 0) + qtyDelta);
      }
    } else {
      // No color-based stock; use main quantity
      spare.quantity = Math.max(0, (Number(spare.quantity) || 0) + qtyDelta);
    }

    await spare.save();
  }
};

// Helper: adjust battery inventory for replacement batteries.
// - part.partType === "replacement"
// - part.replacementType === "battery"
// - part.batteryInventoryId points to Battery document
// mode: "deduct" when applying, "restore" when rolling back (on delete)
const adjustBatteryInventoryForReplacements = async (
  jobcard,
  mode = "deduct"
) => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  const factor = mode === "restore" ? 1 : -1;

  for (const part of jobcard.parts) {
    if (
      !part ||
      part.partType !== "replacement" ||
      part.replacementType !== "battery"
    ) {
      continue;
    }

    // Support different keys used for the battery reference
    const batteryId =
      part.batteryInventoryId ||
      part.batteryId ||
      part.spareId ||
      part.id ||
      null;
    if (!batteryId) {
      continue;
    }

    // In jobcard parts, quantity / selectedQuantity represent the number of
    // individual batteries used. We therefore adjust total *batteries* in
    // stock, and then re-derive totalSets/openBatteries from that.
    const qtyUnits =
      Number(
        part.selectedQuantity !== undefined && part.selectedQuantity !== null
          ? part.selectedQuantity
          : part.quantity
      ) || 0;
    if (qtyUnits <= 0) {
      continue;
    }

    const battery = await Battery.findById(batteryId);
    if (!battery) {
      continue;
    }

    const perSet = Number(battery.batteriesPerSet) || 0;
    const totalUnitsBefore =
      (Number(battery.totalSets) || 0) * (perSet || 0) +
      (Number(battery.openBatteries) || 0);

    let totalUnitsAfter = totalUnitsBefore + factor * qtyUnits;
    if (totalUnitsAfter < 0) {
      totalUnitsAfter = 0;
    }

    if (perSet > 0) {
      battery.totalSets = Math.floor(totalUnitsAfter / perSet);
      battery.openBatteries = totalUnitsAfter % perSet;
    } else {
      battery.totalSets = 0;
      battery.openBatteries = totalUnitsAfter;
    }

    await battery.save();
  }
};

// Helper: adjust charger inventory for replacement chargers.
// Deduct/restore charger.quantity in All Chargers when a charger is used in replacement.
const adjustChargerInventoryForReplacements = async (
  jobcard,
  mode = "deduct"
) => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  const factor = mode === "restore" ? 1 : -1;

  for (const part of jobcard.parts) {
    if (
      !part ||
      part.partType !== "replacement" ||
      part.replacementType !== "charger"
    ) {
      continue;
    }

    const chargerId =
      part.chargerInventoryId ||
      part.chargerId ||
      part.spareId ||
      part.id ||
      null;
    if (!chargerId) continue;

    const qty =
      Number(
        part.quantity !== undefined && part.quantity !== null
          ? part.quantity
          : part.selectedQuantity
      ) || 0;
    if (qty <= 0) continue;

    const charger = await Charger.findById(chargerId);
    if (!charger) continue;

    const currentQty = Number(charger.quantity) || 0;
    const newQty = Math.max(0, currentQty + factor * qty);
    charger.quantity = newQty;
    await charger.save();
  }
};

// Helper: create OldCharger entries when replacement charger has old charger arrived
// (oldChargerName or oldChargerVoltage set). On restore (jobcard delete), delete those entries.
const adjustOldChargerEntriesForReplacementChargers = async (
  jobcard,
  mode = "deduct"
) => {
  if (!jobcard || !Array.isArray(jobcard.parts) || jobcard.parts.length === 0) {
    return;
  }

  const jobcardNumber = jobcard.jobcardNumber || null;
  if (!jobcardNumber) return;

  if (mode === "restore") {
    await OldCharger.deleteMany({ jobcardNumber });
    return;
  }

  // mode === "deduct" -> create entries for each replacement charger part that has old charger arrived
  const validVoltages = ["48V", "60V", "72V"];
  const validBatteryTypes = ["lead", "lithium"];
  const validAmperes = ["3A", "4A", "5A"];
  const validStatuses = ["working", "notWorking"];

  const parseVoltage = (v) => {
    if (!v || typeof v !== "string") return "48V";
    const s = v.trim().toUpperCase();
    if (s.includes("72") || s === "72") return "72V";
    if (s.includes("60") || s === "60") return "60V";
    return "48V";
  };

  const parseJobcardDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (typeof dateStr !== "string") return new Date(dateStr);
    const iso = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00.000Z`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const normalizeStatus = (raw) => {
    if (!raw || typeof raw !== "string") return "working";
    const s = raw.toString().trim().toLowerCase();
    if (validStatuses.includes(s)) return s;
    if (s.includes("not")) return "notWorking";
    return "working";
  };

  // 1) Replacement charger parts: old charger arrived
  for (const part of jobcard.parts) {
    if (
      !part ||
      part.partType !== "replacement" ||
      part.replacementType !== "charger"
    ) {
      continue;
    }

    const hasOldChargerArrived =
      (part.oldChargerName && String(part.oldChargerName).trim()) ||
      (part.oldChargerVoltage && String(part.oldChargerVoltage).trim());
    if (!hasOldChargerArrived) continue;

    const voltage = parseVoltage(part.oldChargerVoltage || part.voltage);
    if (!validVoltages.includes(voltage)) continue;

    let batteryType = (part.batteryType || "lead")
      .toString()
      .trim()
      .toLowerCase();
    if (!validBatteryTypes.includes(batteryType)) batteryType = "lead";

    const ampere = "4A";
    const statusNorm = normalizeStatus(part.oldChargerWorking);
    const entryDate = parseJobcardDate(jobcard.date);

    const oldCharger = new OldCharger({
      voltage,
      batteryType,
      ampere,
      status: statusNorm,
      entryDate,
      jobcardNumber,
    });
    await oldCharger.save();
  }

  // 2) Sales charger parts (Add Charger for Sale) with old charger available:
  //    create one OldCharger entry per quantity, with jobcard date so they appear in the entry table.
  for (const part of jobcard.parts) {
    if (!part || part.partType !== "sales" || part.salesType !== "charger") {
      continue;
    }
    const isOldChargerSale =
      part.chargerOldNew === "old" || part.oldChargerAvailable === true;
    if (!isOldChargerSale) continue;

    const volRaw = (part.oldChargerVoltage || part.voltage || "")
      .toString()
      .trim();
    if (!volRaw) continue;

    const voltage = parseVoltage(volRaw);
    if (!validVoltages.includes(voltage)) continue;

    let batteryType = (part.batteryType || "lead")
      .toString()
      .trim()
      .toLowerCase();
    if (!validBatteryTypes.includes(batteryType)) batteryType = "lead";

    const ampere = "4A";
    const statusNorm = normalizeStatus(part.oldChargerWorking);
    const entryDate = parseJobcardDate(jobcard.date);
    const qty = Math.max(1, Number(part.quantity) || 1);

    for (let i = 0; i < qty; i++) {
      const oldCharger = new OldCharger({
        voltage,
        batteryType,
        ampere,
        status: statusNorm,
        entryDate,
        jobcardNumber,
      });
      await oldCharger.save();
    }
  }
};

// @desc    Create a new jobcard
// @route   POST /api/jobcards
// @access  Public (add auth later)
const createJobcard = async (req, res) => {
  try {
    const jobcardData = req.body;

    // Calculate total amount from parts, excluding replacement parts from billing
    // (only service + sales parts should contribute to the bill)
    const totalAmount = Array.isArray(jobcardData.parts)
      ? jobcardData.parts.reduce((sum, part) => {
          if (part.partType === "replacement" || part.replacementType) {
            return sum;
          }
          return sum + (part.price || 0) * (part.quantity || 1);
        }, 0)
      : 0;

    const jobcard = new Jobcard({
      ...jobcardData,
      totalAmount,
      status: "pending", // Always create as pending
    });

    const createdJobcard = await jobcard.save();
    res.status(201).json(createdJobcard);
  } catch (error) {
    console.error("Error creating jobcard:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all jobcards
// @route   GET /api/jobcards
// @access  Public
const getJobcards = async (req, res) => {
  try {
    const { status, jobcardType } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (jobcardType) {
      // Match jobcards where jobcardType contains the filter (handles "service, replacement" etc.)
      const escaped = String(jobcardType).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      filter.jobcardType = new RegExp(`\\b${escaped}\\b`, "i");
    }

    const jobcards = await Jobcard.find(filter)
      .sort({ createdAt: -1 })
      .populate("parts.spareId", "name sku");

    res.json(jobcards);
  } catch (error) {
    console.error("Error getting jobcards:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get jobcard by ID
// @route   GET /api/jobcards/:id
// @access  Public
const getJobcardById = async (req, res) => {
  try {
    const jobcard = await Jobcard.findById(req.params.id).populate(
      "parts.spareId",
      "name sku price quantity hasColors colorQuantity"
    );

    if (!jobcard) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    res.json(jobcard);
  } catch (error) {
    console.error("Error getting jobcard:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update jobcard
// @route   PUT /api/jobcards/:id
// @access  Public
const updateJobcard = async (req, res) => {
  try {
    const jobcardData = req.body;

    // Calculate total amount from parts if parts are provided
    // Exclude replacement parts from billing total (only service + sales count)
    if (Array.isArray(jobcardData.parts)) {
      jobcardData.totalAmount = jobcardData.parts.reduce((sum, part) => {
        if (part.partType === "replacement" || part.replacementType) {
          return sum;
        }
        return sum + (part.price || 0) * (part.quantity || 1);
      }, 0);
    }

    const jobcard = await Jobcard.findByIdAndUpdate(
      req.params.id,
      jobcardData,
      { new: true, runValidators: true }
    ).populate("parts.spareId", "name sku");

    if (!jobcard) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    res.json(jobcard);
  } catch (error) {
    console.error("Error updating jobcard:", error);
    // Return more specific error message
    const errorMessage = error.message || "Unknown error occurred";
    res.status(500).json({
      message: "Server error",
      error: errorMessage,
      details: error.name === "ValidationError" ? error.errors : undefined,
    });
  }
};

// @desc    Finalize jobcard (move from pending to finalized)
// @route   PUT /api/jobcards/:id/finalize
// @access  Public
const finalizeJobcard = async (req, res) => {
  try {
    const {
      labour,
      discount,
      paidAmount,
      totalAmount,
      paymentMode,
      pendingAmount,
      paymentDate,
    } = req.body;
    const jobcard = await Jobcard.findById(req.params.id);

    if (!jobcard) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    if (jobcard.status === "finalized") {
      return res.status(400).json({ message: "Jobcard is already finalized" });
    }

    // Update jobcard with finalization data
    if (labour !== undefined) jobcard.labour = labour || 0;
    if (discount !== undefined) jobcard.discount = discount || 0;
    if (totalAmount !== undefined) jobcard.totalAmount = totalAmount || 0;
    if (paymentMode !== undefined) jobcard.paymentMode = paymentMode || "cash";
    if (pendingAmount !== undefined) jobcard.pendingAmount = pendingAmount || 0;

    // Save initial payment to payment history if paidAmount is provided
    if (paidAmount !== undefined && paidAmount > 0) {
      // Initialize payment history if it doesn't exist
      if (!jobcard.paymentHistory || jobcard.paymentHistory.length === 0) {
        jobcard.paymentHistory = [];
      }

      // Determine the payment date string (dd/mm/yyyy).
      // Prefer the date sent from the frontend; if not provided, use today's date.
      let paymentDateString;
      if (paymentDate) {
        // If already in dd/mm/yyyy, use as is
        if (typeof paymentDate === "string" && paymentDate.includes("/")) {
          paymentDateString = paymentDate;
        } else {
          const d = new Date(paymentDate);
          const day = String(d.getDate()).padStart(2, "0");
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const year = d.getFullYear();
          paymentDateString = `${day}/${month}/${year}`;
        }
      } else {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();
        paymentDateString = `${day}/${month}/${year}`;
      }

      // Get current time in HH:mm AM/PM format
      const now = new Date();
      const paymentTime = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Check if this payment already exists in history (to avoid duplicates)
      const paymentExists = jobcard.paymentHistory.some(
        (p) =>
          p.amount === paidAmount &&
          p.date === paymentDateString &&
          p.paymentMode === (paymentMode || "cash")
      );
      // Add initial payment to history if it doesn't exist
      if (!paymentExists) {
        jobcard.paymentHistory.push({
          amount: paidAmount,
          date: paymentDateString,
          time: paymentTime,
          paymentMode: paymentMode || "cash",
        });
      }
      // Update paidAmount to match total in payment history
      const totalPaid = jobcard.paymentHistory.reduce(
        (sum, payment) => sum + (payment.amount || 0),
        0
      );
      jobcard.paidAmount = totalPaid;
    }

    // Adjust inventory once, the first time this jobcard is finalized/saved.
    // This applies even if the jobcard remains in "pending" status due to unpaid amount.
    if (!jobcard.inventoryAdjusted) {
      await adjustSpareInventoryForJobcard(jobcard, "deduct");
      await adjustBatteryInventoryForReplacements(jobcard, "deduct");
      await adjustChargerInventoryForReplacements(jobcard, "deduct");
      await adjustOldChargerEntriesForReplacementChargers(jobcard, "deduct");
      jobcard.inventoryAdjusted = true;
    }

    // Only mark as finalized if there's no pending amount.
    // If pendingAmount > 0, keep status as "pending".
    if (
      pendingAmount === undefined ||
      pendingAmount === 0 ||
      pendingAmount === ""
    ) {
      jobcard.status = "finalized";
    }
    // Otherwise, keep status as "pending" (already pending, so no change needed)

    const savedJobcard = await jobcard.save();

    res.json(savedJobcard);
  } catch (error) {
    console.error("Error finalizing jobcard:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Settle payment for jobcard
// @route   PUT /api/jobcards/:id/settle
// @access  Public
const settleJobcard = async (req, res) => {
  try {
    const { amount, paymentMode, paymentDate } = req.body;
    const jobcard = await Jobcard.findById(req.params.id);

    if (!jobcard) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    const currentPending = jobcard.pendingAmount || 0;
    if (amount > currentPending) {
      return res.status(400).json({
        message: `Payment amount (₹${amount}) cannot exceed pending amount (₹${currentPending})`,
      });
    }

    // Initialize payment history if it doesn't exist
    if (!jobcard.paymentHistory) {
      jobcard.paymentHistory = [];
      // If there's an initial paidAmount, add it to history
      if (jobcard.paidAmount && jobcard.paidAmount > 0) {
        const initialTime = new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        jobcard.paymentHistory.push({
          amount: jobcard.paidAmount,
          date: jobcard.date || new Date().toISOString().split("T")[0],
          time: initialTime,
          paymentMode: jobcard.paymentMode || "cash",
        });
      }
    }

    // Get current time in HH:mm AM/PM format
    const now = new Date();
    const paymentTime = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Format payment date
    let paymentDateString;
    if (paymentDate) {
      // If already in dd/mm/yyyy, use as is
      if (typeof paymentDate === "string" && paymentDate.includes("/")) {
        paymentDateString = paymentDate;
      } else {
        const d = new Date(paymentDate);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        paymentDateString = `${day}/${month}/${year}`;
      }
    } else {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, "0");
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();
      paymentDateString = `${day}/${month}/${year}`;
    }

    // Add new payment to history
    jobcard.paymentHistory.push({
      amount: amount,
      date: paymentDateString,
      time: paymentTime,
      paymentMode: paymentMode || "cash",
    });

    // Update pending amount
    jobcard.pendingAmount = Math.max(0, currentPending - amount);

    // Update total paid amount
    const totalPaid = jobcard.paymentHistory.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );
    jobcard.paidAmount = totalPaid;

    // If pending amount is now 0, finalize the jobcard
    if (jobcard.pendingAmount === 0) {
      jobcard.status = "finalized";
    }

    const savedJobcard = await jobcard.save();

    res.json(savedJobcard);
  } catch (error) {
    console.error("Error settling payment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete jobcard
// @route   DELETE /api/jobcards/:id
// @access  Public
const deleteJobcard = async (req, res) => {
  try {
    const jobcard = await Jobcard.findById(req.params.id);

    if (!jobcard) {
      return res.status(404).json({ message: "Jobcard not found" });
    }

    // If inventory was previously adjusted for this jobcard, restore stock.
    if (jobcard.inventoryAdjusted) {
      try {
        await adjustSpareInventoryForJobcard(jobcard, "restore");
        await adjustBatteryInventoryForReplacements(jobcard, "restore");
        await adjustChargerInventoryForReplacements(jobcard, "restore");
        await adjustOldChargerEntriesForReplacementChargers(jobcard, "restore");
        jobcard.inventoryAdjusted = false;
      } catch (invErr) {
        console.error(
          "Error restoring inventory while deleting jobcard:",
          invErr
        );
        // Continue with delete even if inventory restore fails
      }
    }

    await jobcard.deleteOne();
    res.json({ message: "Jobcard deleted successfully" });
  } catch (error) {
    console.error("Error deleting jobcard:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createJobcard,
  getJobcards,
  getJobcardById,
  updateJobcard,
  finalizeJobcard,
  settleJobcard,
  deleteJobcard,
};
