const BatteryScrap = require("../models/BatteryScrap");

// @desc    Create a new battery scrap entry
// @route   POST /api/battery-scraps
// @access  Private
const createBatteryScrap = async (req, res) => {
  try {
    const { quantity, entryDate } = req.body;

    if (!quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0" });
    }

    if (!entryDate) {
      return res.status(400).json({ message: "Entry date is required" });
    }

    const scrap = new BatteryScrap({
      quantity,
      entryDate: new Date(entryDate),
      source: "manual",
    });

    const created = await scrap.save();
    return res.status(201).json(created);
  } catch (error) {
    console.error("Error creating battery scrap:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all battery scrap entries
// @route   GET /api/battery-scraps
// @access  Private
const getBatteryScraps = async (req, res) => {
  try {
    const scraps = await BatteryScrap.find({})
      .sort({ entryDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json(scraps);
  } catch (error) {
    console.error("Error fetching battery scraps:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Update a battery scrap entry
// @route   PUT /api/battery-scraps/:id
// @access  Private
const updateBatteryScrap = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, entryDate } = req.body;

    if (!quantity || Number(quantity) <= 0) {
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0" });
    }
    if (!entryDate) {
      return res.status(400).json({ message: "Entry date is required" });
    }

    const scrap = await BatteryScrap.findById(id);
    if (!scrap) {
      return res.status(404).json({ message: "Scrap entry not found" });
    }
    scrap.quantity = Number(quantity);
    scrap.entryDate = new Date(entryDate);
    const updated = await scrap.save();
    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating battery scrap:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete a battery scrap entry
// @route   DELETE /api/battery-scraps/:id
// @access  Private
const deleteBatteryScrap = async (req, res) => {
  try {
    const { id } = req.params;
    const scrap = await BatteryScrap.findById(id);
    if (!scrap) {
      return res.status(404).json({ message: "Scrap entry not found" });
    }
    await BatteryScrap.deleteOne({ _id: id });
    return res.status(200).json({ message: "Deleted", id });
  } catch (error) {
    console.error("Error deleting battery scrap:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Create or update battery scrap entry for a specific date
// @route   POST /api/battery-scraps/upsert
// @access  Private
const upsertBatteryScrap = async (req, res) => {
  try {
    const { quantity, entryDate } = req.body;

    if (!quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0" });
    }

    if (!entryDate) {
      return res.status(400).json({ message: "Entry date is required" });
    }

    // Convert entryDate to start of day for comparison
    const dateStart = new Date(entryDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStart);
    dateEnd.setHours(23, 59, 59, 999);

    // Find existing entry for this date
    const existingScrap = await BatteryScrap.findOne({
      entryDate: {
        $gte: dateStart,
        $lte: dateEnd,
      },
    });

    if (existingScrap) {
      // Update existing entry
      existingScrap.quantity = (existingScrap.quantity || 0) + quantity;
      const updated = await existingScrap.save();
      return res.status(200).json(updated);
    } else {
      // Create new entry
      const scrap = new BatteryScrap({
        quantity,
        entryDate: new Date(entryDate),
        source: "manual",
      });
      const created = await scrap.save();
      return res.status(201).json(created);
    }
  } catch (error) {
    console.error("Error upserting battery scrap:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createBatteryScrap,
  getBatteryScraps,
  updateBatteryScrap,
  deleteBatteryScrap,
  upsertBatteryScrap,
};


