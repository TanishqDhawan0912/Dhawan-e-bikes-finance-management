const Battery = require("../models/Battery");

// @desc    Create a new battery
// @route   POST /api/batteries
// @access  Private
const createBattery = async (req, res) => {
  try {
    const {
      name,
      ampereValue,
      batteriesPerSet,
      totalSets,
      openBatteries,
      warrantyStatus,
      sellingPrice,
      supplierName,
      batteryType,
      minStockLevel,
      purchaseDate,
      stockEntries,
    } = req.body;

    // Capitalize first letter of each word in battery name (Title Case)
    const capitalizedName = name
      ? name.replace(/\b\w/g, (char) => char.toUpperCase())
      : "";

    const battery = new Battery({
      name: capitalizedName,
      ampereValue: ampereValue || "",
      batteriesPerSet: batteriesPerSet || 0,
      totalSets: totalSets || 0,
      openBatteries: openBatteries || 0,
      warrantyStatus: warrantyStatus || false,
      sellingPrice: sellingPrice || 0,
      supplierName: supplierName || "",
      batteryType: batteryType === "lead" || batteryType === "lithium" ? batteryType : "",
      minStockLevel: minStockLevel || 0,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      stockEntries:
        Array.isArray(stockEntries) && stockEntries.length > 0
          ? stockEntries.map((entry) => ({
              quantity: entry.quantity || 0,
              purchasePrice: entry.purchasePrice || 0,
              purchaseDate: entry.purchaseDate
                ? new Date(entry.purchaseDate)
                : new Date(),
              batteriesPerSet: entry.batteriesPerSet || undefined,
            }))
          : [],
    });

    // If stock entries were provided, recalculate total sets/open batteries
    if (battery.stockEntries && battery.stockEntries.length > 0) {
      battery.recalculateFromStockEntries();
    }

    const createdBattery = await battery.save();
    res.status(201).json(createdBattery);
  } catch (error) {
    console.error("Error creating battery:", error);
    console.error("Error code:", error.code);
    console.error("Error keyPattern:", error.keyPattern);
    console.error("Error keyValue:", error.keyValue);

    if (error.code === 11000) {
      res.status(400).json({
        message: "Duplicate entry error",
        error: `Duplicate key error: ${JSON.stringify(
          error.keyPattern
        )} with value ${JSON.stringify(error.keyValue)}`,
      });
    } else if (error.name === "ValidationError") {
      res.status(400).json({
        message: "Validation error",
        error: error.message,
      });
    } else {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
};

// @desc    Get all batteries
// @route   GET /api/batteries
// @access  Private
const getBatteries = async (req, res) => {
  try {
    const { search, lowStock, sortBy = "name", sortOrder = "asc" } = req.query;

    const filter = {};

    // Search by name
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // Filter low stock items
    if (lowStock === "true") {
      filter.$expr = { $lte: ["$totalSets", "$minStockLevel"] };
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const batteries = await Battery.find(filter).sort(sort).select("-__v");

    res.json(batteries);
  } catch (error) {
    console.error("Error getting batteries:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get battery by ID
// @route   GET /api/batteries/:id
// @access  Private
const getBatteryById = async (req, res) => {
  try {
    const battery = await Battery.findById(req.params.id).select("-__v");

    if (!battery) {
      return res.status(404).json({ message: "Battery not found" });
    }

    res.json(battery);
  } catch (error) {
    console.error("Error getting battery:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update battery
// @route   PUT /api/batteries/:id
// @access  Private
const updateBattery = async (req, res) => {
  try {
    const {
      name,
      ampereValue,
      batteriesPerSet,
      totalSets,
      openBatteries,
      warrantyStatus,
      sellingPrice,
      supplierName,
      batteryType,
      minStockLevel,
      purchaseDate,
      stockEntries,
    } = req.body;

    const battery = await Battery.findById(req.params.id);

    if (!battery) {
      return res.status(404).json({ message: "Battery not found" });
    }

    // Update fields if provided
    if (name) {
      const capitalizedName = name.replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );
      battery.name = capitalizedName;
    }
    if (ampereValue !== undefined) battery.ampereValue = ampereValue;
    if (batteriesPerSet !== undefined)
      battery.batteriesPerSet = batteriesPerSet;
    if (totalSets !== undefined) battery.totalSets = totalSets;
    if (openBatteries !== undefined) battery.openBatteries = openBatteries;
    if (warrantyStatus !== undefined) battery.warrantyStatus = warrantyStatus;
    if (sellingPrice !== undefined) battery.sellingPrice = sellingPrice;
    if (supplierName !== undefined) battery.supplierName = supplierName;
    if (batteryType !== undefined) {
      battery.batteryType = batteryType === "lead" || batteryType === "lithium" ? batteryType : "";
    }
    if (minStockLevel !== undefined) battery.minStockLevel = minStockLevel;
    if (purchaseDate !== undefined) {
      battery.purchaseDate = purchaseDate ? new Date(purchaseDate) : undefined;
    }
    if (Array.isArray(stockEntries)) {
      battery.stockEntries = stockEntries.map((entry) => ({
        quantity: entry.quantity || 0,
        purchasePrice: entry.purchasePrice || 0,
        purchaseDate: entry.purchaseDate
          ? new Date(entry.purchaseDate)
          : new Date(),
        batteriesPerSet: entry.batteriesPerSet || undefined,
      }));
      // When stock entries are updated, keep totals in sync
      battery.recalculateFromStockEntries();
    }

    const updatedBattery = await battery.save();

    res.json(updatedBattery);
  } catch (error) {
    console.error("Error updating battery:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete battery
// @route   DELETE /api/batteries/:id
// @access  Private
const deleteBattery = async (req, res) => {
  try {
    const battery = await Battery.findById(req.params.id);

    if (!battery) {
      return res.status(404).json({ message: "Battery not found" });
    }

    await Battery.deleteOne({ _id: req.params.id });

    res.json({ message: "Battery removed" });
  } catch (error) {
    console.error("Error deleting battery:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get battery name suggestions
// @route   GET /api/batteries/suggestions/name
// @access  Private
const getBatteryNameSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json([]);
    }

    const suggestions = await Battery.aggregate([
      {
        $match: {
          name: { $regex: q, $options: "i" },
        },
      },
      {
        $group: {
          _id: "$name",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          count: 1,
        },
      },
      {
        $sort: { count: -1, name: 1 },
      },
      {
        $limit: 10,
      },
    ]);

    const names = suggestions.map((s) => s.name);
    res.json(names);
  } catch (error) {
    console.error("Error getting battery name suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get supplier name suggestions
// @route   GET /api/batteries/suggestions/supplier
// @access  Private
const getSupplierSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json([]);
    }

    const suggestions = await Battery.aggregate([
      {
        $match: {
          supplierName: { $regex: q, $options: "i" },
        },
      },
      {
        $group: {
          _id: "$supplierName",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          count: 1,
        },
      },
      {
        $sort: { count: -1, name: 1 },
      },
      {
        $limit: 10,
      },
    ]);

    const names = suggestions.map((s) => s.name);
    res.json(names);
  } catch (error) {
    console.error("Error getting supplier suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get ampere value suggestions
// @route   GET /api/batteries/suggestions/ampere
// @access  Private
const getAmpereValueSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json([]);
    }

    // Remove any non-numeric characters from query for matching
    const numericQuery = q.replace(/[^0-9.]/g, "");

    if (!numericQuery) {
      return res.json([]);
    }

    const suggestions = await Battery.aggregate([
      {
        $match: {
          ampereValue: { $regex: numericQuery, $options: "i" },
        },
      },
      {
        $group: {
          _id: "$ampereValue",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          value: "$_id",
          count: 1,
        },
      },
      {
        $sort: { count: -1, value: 1 },
      },
      {
        $limit: 10,
      },
    ]);

    // Extract numeric values and remove "A" suffix if present
    const values = suggestions
      .map((s) => {
        const val = s.value?.toString().replace(/[^0-9.]/g, "") || "";
        return val;
      })
      .filter((v) => v); // Remove empty values

    // Remove duplicates and return unique values
    const uniqueValues = [...new Set(values)];
    res.json(uniqueValues);
  } catch (error) {
    console.error("Error getting ampere value suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Check for duplicate battery
// @route   GET /api/batteries/check-duplicate
// @access  Private
const checkDuplicateBattery = async (req, res) => {
  try {
    const { name, ampereValue, supplierName, excludeId } = req.query;

    if (!name || !ampereValue || !supplierName) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, ampereValue, and supplierName",
      });
    }

    // Normalize ampereValue - remove "A" suffix if present for comparison
    // This handles both "32" and "32A" and "32 A" formats
    const normalizedAmpereValue = ampereValue
      .trim()
      .replace(/\s*A\s*$/i, "")
      .trim();

    // Escape special regex characters in the normalized value
    const escapedAmpereValue = normalizedAmpereValue.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    // Build query to find batteries with matching name, ampereValue, and supplierName
    // For ampereValue, use regex to match the value with or without "A" suffix (case-insensitive)
    // Pattern matches: "32", "32 A", "32A", "32 a", etc.
    // The pattern ^32(\s*A)?$ will match: "32", "32 A", "32A", "32a", "32 a"
    const ampereRegex = new RegExp(`^${escapedAmpereValue}(\\s*A)?$`, "i");

    const query = {
      name: {
        $regex: new RegExp(
          `^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      },
      ampereValue: ampereRegex,
      supplierName: {
        $regex: new RegExp(
          `^${supplierName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      },
    };

    // Exclude current battery if excludeId is provided
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    console.log("Duplicate check - Input:", {
      name,
      ampereValue,
      supplierName,
    });
    console.log(
      "Duplicate check - Normalized ampereValue:",
      normalizedAmpereValue
    );
    console.log(
      "Duplicate check - Ampere regex pattern:",
      ampereRegex.toString()
    );
    console.log(
      "Duplicate check - Full query:",
      JSON.stringify(query, null, 2)
    );

    const duplicate = await Battery.findOne(query);

    if (duplicate) {
      console.log("Duplicate check result: FOUND DUPLICATE");
      console.log("Duplicate battery details:", {
        id: duplicate._id,
        name: duplicate.name,
        ampereValue: duplicate.ampereValue,
        supplierName: duplicate.supplierName,
      });
    } else {
      console.log("Duplicate check result: NO DUPLICATE FOUND");
    }

    if (duplicate) {
      return res.status(200).json({
        success: true,
        exists: true,
        message: `Duplicate battery found: A battery with the same name (${duplicate.name}), ampere value (${duplicate.ampereValue}), and supplier (${duplicate.supplierName}) already exists.`,
      });
    }

    return res.status(200).json({
      success: true,
      exists: false,
      message: "No duplicate found",
    });
  } catch (error) {
    console.error("Error checking duplicate battery:", error);
    res.status(500).json({
      success: false,
      message: "Error checking for duplicates",
      error: error.message,
    });
  }
};

module.exports = {
  createBattery,
  getBatteries,
  getBatteryById,
  updateBattery,
  deleteBattery,
  getBatteryNameSuggestions,
  getSupplierSuggestions,
  getAmpereValueSuggestions,
  checkDuplicateBattery,
};
