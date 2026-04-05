const OldChargerScrap = require("../models/OldChargerScrap");

// @desc    Create a new old charger scrap entry (scrap reduces displayed old charger quantity)
// @route   POST /api/old-charger-scraps
// @access  Private
const createOldChargerScrap = async (req, res) => {
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

    const scrap = new OldChargerScrap({
      quantity,
      entryDate: new Date(entryDate),
    });

    const created = await scrap.save();
    return res.status(201).json(created);
  } catch (error) {
    console.error("Error creating old charger scrap:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all old charger scrap entries (for computing effective old charger quantity)
// @route   GET /api/old-charger-scraps
// @access  Private
const getOldChargerScraps = async (req, res) => {
  try {
    const scraps = await OldChargerScrap.find({})
      .sort({ entryDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json(scraps);
  } catch (error) {
    console.error("Error fetching old charger scraps:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Permanently delete an old charger scrap entry
// @route   DELETE /api/old-charger-scraps/:id
const deleteOldChargerScrap = async (req, res) => {
  try {
    const { id } = req.params;
    const removed = await OldChargerScrap.findByIdAndDelete(id);
    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Old charger scrap not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Deleted",
      id: String(removed._id),
    });
  } catch (error) {
    console.error("Error deleting old charger scrap:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  createOldChargerScrap,
  getOldChargerScraps,
  deleteOldChargerScrap,
};
