const Charger = require("../models/Charger");
const {
  ensureChargerLayersMatchTotal,
} = require("../utils/chargerInventoryAdjust");

// @desc    Create a new charger
// @route   POST /api/chargers
// @access  Private
const createCharger = async (req, res) => {
  try {
    const {
      name,
      batteryType,
      voltage,
      quantity,
      warrantyStatus,
      purchaseDate,
      supplierName,
      sellingPrice,
      minStockLevel,
      stockEntries,
    } = req.body;

    // Capitalize first letter of each word in charger name (Title Case)
    const capitalizedName = name
      ? name.replace(/\b\w/g, (char) => char.toUpperCase())
      : "";

    const charger = new Charger({
      name: capitalizedName,
      batteryType: batteryType || "",
      voltage: voltage || "",
      quantity: quantity || 0,
      warrantyStatus: warrantyStatus || false,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      supplierName: supplierName || "",
      sellingPrice: sellingPrice || 0,
      minStockLevel: minStockLevel || 0,
      stockEntries:
        Array.isArray(stockEntries) && stockEntries.length > 0
          ? stockEntries.map((entry) => {
              const qty = Math.max(0, Number(entry.quantity) || 0);
              const origRaw = entry.originalQuantity;
              const orig =
                origRaw !== undefined && origRaw !== null && origRaw !== ""
                  ? Math.max(0, Number(origRaw))
                  : qty;
              return {
                quantity: qty,
                originalQuantity: orig,
                purchasePrice: entry.purchasePrice || 0,
                purchaseDate: entry.purchaseDate
                  ? new Date(entry.purchaseDate)
                  : new Date(),
                warrantyStatus:
                  entry.warrantyStatus !== undefined
                    ? Boolean(entry.warrantyStatus)
                    : false,
              };
            })
          : [],
    });

    const createdCharger = await charger.save();
    res.status(201).json(createdCharger);
  } catch (error) {
    console.error("Error creating charger:", error);
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

// @desc    Get all chargers
// @route   GET /api/chargers
// @access  Private
const getChargers = async (req, res) => {
  try {
    const { search, lowStock, sortBy = "name", sortOrder = "asc" } = req.query;

    const filter = {};

    // Search by name
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // Filter low stock items
    if (lowStock === "true") {
      filter.$expr = { $lte: ["$quantity", "$minStockLevel"] };
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const chargers = await Charger.find(filter).sort(sort).select("-__v");

    res.json(chargers);
  } catch (error) {
    console.error("Error getting chargers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get charger by ID
// @route   GET /api/chargers/:id
// @access  Private
const getChargerById = async (req, res) => {
  try {
    const charger = await Charger.findById(req.params.id).select("-__v");

    if (!charger) {
      return res.status(404).json({ message: "Charger not found" });
    }

    if (ensureChargerLayersMatchTotal(charger)) {
      charger.markModified("stockEntries");
      await charger.save();
    }

    res.json(charger);
  } catch (error) {
    console.error("Error getting charger:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update charger
// @route   PUT /api/chargers/:id
// @access  Private
const updateCharger = async (req, res) => {
  try {
    const {
      name,
      batteryType,
      voltage,
      quantity,
      warrantyStatus,
      purchaseDate,
      supplierName,
      sellingPrice,
      minStockLevel,
      stockEntries,
    } = req.body;

    const charger = await Charger.findById(req.params.id);

    if (!charger) {
      return res.status(404).json({ message: "Charger not found" });
    }

    // Update fields if provided
    if (name) {
      const capitalizedName = name.replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );
      charger.name = capitalizedName;
    }
    if (batteryType !== undefined) charger.batteryType = batteryType;
    if (voltage !== undefined) charger.voltage = voltage;
    if (quantity !== undefined) charger.quantity = quantity;
    if (warrantyStatus !== undefined) charger.warrantyStatus = warrantyStatus;
    if (purchaseDate !== undefined) {
      charger.purchaseDate = purchaseDate ? new Date(purchaseDate) : undefined;
    }
    if (supplierName !== undefined) charger.supplierName = supplierName;
    if (sellingPrice !== undefined) charger.sellingPrice = sellingPrice;
    if (minStockLevel !== undefined) charger.minStockLevel = minStockLevel;
    if (Array.isArray(stockEntries)) {
      charger.stockEntries = stockEntries.map((entry) => {
        const qty = Math.max(0, Number(entry.quantity) || 0);
        const origRaw = entry.originalQuantity;
        const orig =
          origRaw !== undefined && origRaw !== null && origRaw !== ""
            ? Math.max(0, Number(origRaw))
            : qty;
        return {
          quantity: qty,
          originalQuantity: orig,
          purchasePrice: entry.purchasePrice || 0,
          purchaseDate: entry.purchaseDate
            ? new Date(entry.purchaseDate)
            : new Date(),
          warrantyStatus:
            entry.warrantyStatus !== undefined
              ? Boolean(entry.warrantyStatus)
              : false,
        };
      });
    }

    const updatedCharger = await charger.save();

    res.json(updatedCharger);
  } catch (error) {
    console.error("Error updating charger:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete charger
// @route   DELETE /api/chargers/:id
// @access  Private
const deleteCharger = async (req, res) => {
  try {
    const charger = await Charger.findById(req.params.id);

    if (!charger) {
      return res.status(404).json({ message: "Charger not found" });
    }

    await Charger.updateOne({ _id: req.params.id }, { $set: { isDeleted: true } });
    console.log("[soft-delete] Charger:", req.params.id);
    res.json({ message: "Charger soft deleted" });
  } catch (error) {
    console.error("Error deleting charger:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get charger name suggestions
// @route   GET /api/chargers/suggestions/name
// @access  Private
const getChargerNameSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json([]);
    }

    const suggestions = await Charger.aggregate([
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
    console.error("Error getting charger name suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get supplier name suggestions
// @route   GET /api/chargers/suggestions/supplier
// @access  Private
const getSupplierSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json([]);
    }

    const suggestions = await Charger.aggregate([
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

// @desc    Get battery type suggestions
// @route   GET /api/chargers/suggestions/batteryType
// @access  Private
const getBatteryTypeSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json([]);
    }

    const suggestions = await Charger.aggregate([
      {
        $match: {
          batteryType: { $regex: q, $options: "i" },
        },
      },
      {
        $group: {
          _id: "$batteryType",
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
    console.error("Error getting battery type suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get voltage suggestions
// @route   GET /api/chargers/suggestions/voltage
// @access  Private
const getVoltageSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json([]);
    }

    const suggestions = await Charger.aggregate([
      {
        $match: {
          voltage: { $regex: q, $options: "i" },
        },
      },
      {
        $group: {
          _id: "$voltage",
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
    console.error("Error getting voltage suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Check for duplicate charger
// @route   GET /api/chargers/check-duplicate
// @access  Private
const checkDuplicateCharger = async (req, res) => {
  try {
    const { name, batteryType, voltage, supplierName, excludeId } = req.query;

    if (!name || !supplierName) {
      return res.status(400).json({
        success: false,
        message: "Please provide name and supplierName",
      });
    }

    const query = {
      name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
      supplierName: { $regex: new RegExp(`^${supplierName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
    };

    // Optionally match batteryType and voltage if provided
    if (batteryType) {
      query.batteryType = { $regex: new RegExp(`^${batteryType.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") };
    }
    if (voltage) {
      query.voltage = { $regex: new RegExp(`^${voltage.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") };
    }

    // Exclude current charger if excludeId is provided
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const duplicate = await Charger.findOne(query);
    
    if (duplicate) {
      return res.status(200).json({
        success: true,
        exists: true,
        message: `Duplicate charger found: A charger with the same name (${duplicate.name}), battery type (${duplicate.batteryType || 'N/A'}), voltage (${duplicate.voltage || 'N/A'}), and supplier (${duplicate.supplierName}) already exists.`,
      });
    }

    return res.status(200).json({
      success: true,
      exists: false,
      message: "No duplicate found",
    });
  } catch (error) {
    console.error("Error checking duplicate charger:", error);
    res.status(500).json({
      success: false,
      message: "Error checking for duplicates",
      error: error.message,
    });
  }
};

module.exports = {
  createCharger,
  getChargers,
  getChargerById,
  updateCharger,
  deleteCharger,
  getChargerNameSuggestions,
  getSupplierSuggestions,
  getBatteryTypeSuggestions,
  getVoltageSuggestions,
  checkDuplicateCharger,
};


