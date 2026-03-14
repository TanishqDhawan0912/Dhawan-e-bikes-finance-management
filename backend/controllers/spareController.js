const Spare = require("../models/Spare");
const Model = require("../models/Model");

// @desc    Create a new spare
// @route   POST /api/spares
// @access  Private
const createSpare = async (req, res) => {
  try {
    const {
      name,
      quantity,
      sellingPrice,
      supplierName,
      models = [],
      minStockLevel,
      stockEntries = [],
      colorQuantity = [],
      hasColors = false,
      securityKey,
    } = req.body;

    // Check if purchase price is being set in stockEntries
    const hasStockEntriesPurchasePrice = Array.isArray(stockEntries) && 
      stockEntries.some(entry => entry && entry.purchasePrice !== undefined && entry.purchasePrice !== null && entry.purchasePrice > 0);

    // Check if purchase price is being set in colorQuantity
    const hasColorQuantityPurchasePrice = Array.isArray(colorQuantity) && 
      colorQuantity.some(cq => cq && cq.purchasePrice !== undefined && cq.purchasePrice !== null && cq.purchasePrice > 0);

    // If purchase price is being set, require admin authentication
    if (hasStockEntriesPurchasePrice || hasColorQuantityPurchasePrice) {
      // Check if securityKey is provided and matches the admin security key
      if (!securityKey || securityKey === null || securityKey === undefined || securityKey !== process.env.ADMIN_SECURITY_KEY) {
        console.log("Purchase price creation blocked - Invalid or missing securityKey");
        return res.status(401).json({ 
          message: "Admin authentication required to set purchase price",
          requiresAuth: true 
        });
      }
      console.log("Purchase price creation authorized - Valid securityKey");
    }

    // Capitalize first letter of each word in spare name (Title Case)
    const capitalizedName = name
      ? name.replace(/\b\w/g, (char) => char.toUpperCase())
      : "";

    const spare = new Spare({
      name: capitalizedName,
      quantity: quantity || 0,
      sellingPrice,
      supplierName,
      models,
      minStockLevel: minStockLevel || 0,
      stockEntries,
      colorQuantity,
      hasColors: !!hasColors,
    });

    const createdSpare = await spare.save();
    res.status(201).json(createdSpare);
  } catch (error) {
    console.error("Error creating spare:", error);
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

// @desc    Get all spares
// @route   GET /api/spares
// @access  Private
const getSpares = async (req, res) => {
  try {
    const {
      category,
      search,
      lowStock,
      sortBy,
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Search by name or SKU
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    // Filter low stock items
    if (lowStock === "true") {
      filter.$expr = { $lte: ["$quantity", "$minStockLevel"] };
    }

    // Sorting - default to newest first (by createdAt descending)
    const sort = {};
    if (sortBy) {
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;
    } else {
      // Default: sort by createdAt descending (newest first)
      sort.createdAt = -1;
    }

    const spares = await Spare.find(filter).sort(sort).select("-__v");

    res.json(spares);
  } catch (error) {
    console.error("Error getting spares:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get spare by ID
// @route   GET /api/spares/:id
// @access  Private
const getSpareById = async (req, res) => {
  try {
    const spare = await Spare.findById(req.params.id).select("-__v");

    if (!spare) {
      return res.status(404).json({ message: "Spare not found" });
    }

    res.json(spare);
  } catch (error) {
    console.error("Error getting spare:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update spare
// @route   PUT /api/spares/:id
// @access  Private
const updateSpare = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      costPrice,
      sellingPrice,
      minStockLevel,
      supplier,
      location,
      notes,
      models,
      stockEntries,
      colorQuantity,
      quantity,
      hasColors,
      securityKey,
    } = req.body;

    const spare = await Spare.findById(req.params.id);

    if (!spare) {
      return res.status(404).json({ message: "Spare not found" });
    }

    // Check if purchase price is being UPDATED (changed or newly set > 0)
    // We compare against existing spare data so we don't require auth
    // when simply re-sending existing entries or sending 0-price entries.
    const hasStockEntriesPurchasePrice =
      Array.isArray(stockEntries) &&
      stockEntries.some((entry, index) => {
        if (!entry || entry.purchasePrice === undefined || entry.purchasePrice === null) {
          return false;
        }
        const newPrice = parseFloat(entry.purchasePrice);
        if (!(newPrice > 0)) return false;

        const existingEntry =
          Array.isArray(spare.stockEntries) && spare.stockEntries[index]
            ? spare.stockEntries[index]
            : null;
        const oldPrice =
          existingEntry && existingEntry.purchasePrice !== undefined && existingEntry.purchasePrice !== null
            ? parseFloat(existingEntry.purchasePrice)
            : null;

        // Require auth only if price is actually being changed or newly set
        return oldPrice === null || newPrice !== oldPrice;
      });

    // Determine if any colorQuantity item is *changing* its purchasePrice to a
    // new positive value. Deletions or pure quantity / minStock changes should
    // NOT require admin authentication.
    const hasColorQuantityPurchasePrice =
      Array.isArray(colorQuantity) &&
      colorQuantity.some((cq) => {
        if (!cq || cq.purchasePrice === undefined || cq.purchasePrice === null) {
          return false;
        }

        const newPrice = parseFloat(cq.purchasePrice);
        if (!(newPrice > 0)) return false;

        // Prefer matching by _id so that array reordering / deletions do not
        // confuse the comparison logic.
        let existingCq = null;
        if (cq._id && Array.isArray(spare.colorQuantity)) {
          existingCq = spare.colorQuantity.find(
            (existing) =>
              existing._id &&
              existing._id.toString() === cq._id.toString()
          );
        }

        // Fallback: try to match by color + purchaseDate if _id is missing.
        if (!existingCq && Array.isArray(spare.colorQuantity)) {
          existingCq = spare.colorQuantity.find((existing) => {
            const sameColor =
              (existing.color || "").toLowerCase() ===
              String(cq.color || "").toLowerCase();
            const sameDate =
              String(existing.purchaseDate || "") ===
              String(cq.purchaseDate || "");
            return sameColor && sameDate;
          });
        }

        const oldPrice =
          existingCq &&
          existingCq.purchasePrice !== undefined &&
          existingCq.purchasePrice !== null
            ? parseFloat(existingCq.purchasePrice)
            : null;

        // Require auth only if the price is actually being changed or newly set.
        return oldPrice === null || newPrice !== oldPrice;
      });

    // If purchase price is being updated (non-zero and changed), require admin authentication
    if (hasStockEntriesPurchasePrice || hasColorQuantityPurchasePrice) {
      // Check if securityKey is provided and matches the admin security key
      if (!securityKey || securityKey === null || securityKey === undefined || securityKey !== process.env.ADMIN_SECURITY_KEY) {
        console.log("Purchase price update blocked - Invalid or missing securityKey");
        return res.status(401).json({ 
          message: "Admin authentication required to update purchase price",
          requiresAuth: true 
        });
      }
      console.log("Purchase price update authorized - Valid securityKey");
    }

    // Update fields if provided
    if (name) {
      // Capitalize first letter of each word in spare name (Title Case)
      const capitalizedName = name.replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );
      spare.name = capitalizedName;
    }
    if (description) spare.description = description;
    if (category) spare.category = category;
    if (costPrice) spare.costPrice = costPrice;
    if (sellingPrice) spare.sellingPrice = sellingPrice;
    if (minStockLevel !== undefined) spare.minStockLevel = minStockLevel;
    if (supplier) spare.supplier = { ...spare.supplier, ...supplier };
    if (location) spare.location = { ...spare.location, ...location };
    if (notes !== undefined) spare.notes = notes;
    if (models !== undefined) spare.models = models;
    if (stockEntries) spare.stockEntries = stockEntries;
    if (colorQuantity !== undefined) spare.colorQuantity = colorQuantity;
    if (hasColors !== undefined) {
      spare.hasColors = !!hasColors;
      // If color tracking is being disabled and caller did not explicitly send an empty array,
      // clear the stored color quantities so the UI reflects the new mode.
      if (!hasColors && colorQuantity === undefined) {
        spare.colorQuantity = [];
      }
    }

    // Recalculate quantity when stock entries or color quantities are provided
    // Priority: explicit quantity from request > color quantities sum > stock entries sum > 0
    if (quantity !== undefined) {
      spare.quantity = quantity;
    } else if (
      Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0
    ) {
      spare.quantity = spare.colorQuantity.reduce(
        (sum, cq) => sum + (cq.quantity || 0),
        0
      );
    } else if (
      Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0
    ) {
      spare.quantity = spare.stockEntries.reduce(
        (sum, entry) => sum + (entry.quantity || 0),
        0
      );
    } else {
      spare.quantity = 0;
    }

    console.log("Updating spare with computed quantity:", spare.quantity);
    console.log("Updating spare with colorQuantity:", spare.colorQuantity);

    const updatedSpare = await spare.save();

    console.log("Updated spare result:", updatedSpare);

    res.json(updatedSpare);
  } catch (error) {
    console.error("Error updating spare:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update spare stock
// @route   PUT /api/spares/:id/stock
// @access  Private
const updateSpareStock = async (req, res) => {
  try {
    const { quantity, type = "in", notes } = req.body;

    if (quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0" });
    }

    const spare = await Spare.findById(req.params.id);

    if (!spare) {
      return res.status(404).json({ message: "Spare not found" });
    }

    try {
      await spare.updateStock(type === "in" ? quantity : -quantity);

      // Add stock movement history
      if (!spare.stockHistory) {
        spare.stockHistory = [];
      }

      spare.stockHistory.push({
        date: new Date(),
        quantity: type === "in" ? quantity : -quantity,
        type,
        notes,
        newQuantity: spare.quantity,
      });

      await spare.save();

      res.json({
        message: `Stock ${type === "in" ? "added to" : "removed from"} ${
          spare.name
        } successfully`,
        spare,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  } catch (error) {
    console.error("Error updating spare stock:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete spare
// @route   DELETE /api/spares/:id
// @access  Private
const deleteSpare = async (req, res) => {
  try {
    const spare = await Spare.findById(req.params.id);

    if (!spare) {
      return res.status(404).json({ message: "Spare not found" });
    }

    await Spare.deleteOne({ _id: req.params.id });

    res.json({ message: "Spare removed" });
  } catch (error) {
    console.error("Error deleting spare:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get spare analytics
// @route   GET /api/spares/analytics/stock
// @access  Private
const getStockAnalytics = async (req, res) => {
  try {
    const analytics = await Spare.aggregate([
      {
        $group: {
          _id: "$category",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalValue: {
            $sum: { $multiply: ["$quantity", "$costPrice"] },
          },
          lowStockItems: {
            $sum: {
              $cond: [{ $lte: ["$quantity", "$minStockLevel"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          totalItems: 1,
          totalQuantity: 1,
          totalValue: { $round: ["$totalValue", 2] },
          lowStockItems: 1,
          lowStockPercentage: {
            $cond: [
              { $eq: ["$totalItems", 0] },
              0,
              {
                $multiply: [
                  { $divide: ["$lowStockItems", "$totalItems"] },
                  100,
                ],
              },
            ],
          },
        },
      },
      { $sort: { category: 1 } },
    ]);

    // Calculate totals
    const totals = {
      category: "Total",
      totalItems: 0,
      totalQuantity: 0,
      totalValue: 0,
      lowStockItems: 0,
    };

    analytics.forEach((item) => {
      totals.totalItems += item.totalItems;
      totals.totalQuantity += item.totalQuantity;
      totals.totalValue += item.totalValue;
      totals.lowStockItems += item.lowStockItems;
    });

    totals.lowStockPercentage =
      totals.totalItems > 0
        ? (totals.lowStockItems / totals.totalItems) * 100
        : 0;
    totals.totalValue = parseFloat(totals.totalValue.toFixed(2));
    totals.lowStockPercentage = parseFloat(
      totals.lowStockPercentage.toFixed(2)
    );

    res.json({
      byCategory: analytics,
      totals,
    });
  } catch (error) {
    console.error("Error getting stock analytics:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get spare name suggestions
// @route   GET /api/spares/suggestions/names
// @access  Private
const getSpareNameSuggestions = async (req, res) => {
  try {
    const { search } = req.query;

    if (!search || search.trim().length < 1) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await Spare.aggregate([
      {
        $match: {
          name: { $regex: search, $options: "i" },
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
    res.json({ suggestions: names });
  } catch (error) {
    console.error("Error getting spare name suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get model suggestions for spares
// @route   GET /api/spares/suggestions/models
// @access  Private
const getModelSuggestions = async (req, res) => {
  try {
    const { search } = req.query;

    if (!search || search.trim().length < 1) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await Spare.aggregate([
      { $unwind: "$models" },
      {
        $match: {
          models: { $regex: search, $options: "i" },
        },
      },
      {
        $group: {
          _id: "$models",
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
    res.json({ suggestions: names });
  } catch (error) {
    console.error("Error getting model suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get supplier name suggestions
// @route   GET /api/spares/suggestions/suppliers
// @access  Private
const getSupplierSuggestions = async (req, res) => {
  try {
    const { search } = req.query;

    if (!search || search.trim().length < 1) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await Spare.aggregate([
      {
        $match: {
          supplierName: { $regex: search, $options: "i" },
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
    res.json({ suggestions: names });
  } catch (error) {
    console.error("Error getting supplier suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Check for duplicate spare
// @route   GET /api/spares/check-duplicate
// @access  Private
const checkDuplicateSpare = async (req, res) => {
  try {
    const { name, models, supplierName, excludeId } = req.query;

    if (!name || !supplierName) {
      return res.status(400).json({
        success: false,
        message: "Please provide name and supplierName",
      });
    }

    // Parse models from query string (can be comma-separated or JSON array)
    let modelsArray = [];
    if (models) {
      try {
        modelsArray = JSON.parse(models);
      } catch {
        // If not JSON, treat as comma-separated string
        modelsArray = models.split(",").map((m) => m.trim()).filter((m) => m);
      }
    }

    // Build query to find spares with matching name, models, and supplierName
    const query = {
      name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
      supplierName: { $regex: new RegExp(`^${supplierName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
    };

    // Exclude current spare if excludeId is provided
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    console.log("Duplicate check - Input:", { name, models: modelsArray, supplierName });
    console.log("Duplicate check - Full query:", JSON.stringify(query, null, 2));

    // Find spares matching name and supplier
    const candidates = await Spare.find(query);

    // Filter by models - all models must match (order doesn't matter)
    let duplicate = null;
    if (modelsArray.length > 0) {
      duplicate = candidates.find((spare) => {
        const spareModels = (spare.models || []).map((m) => (m || "").toLowerCase().trim());
        const searchModels = modelsArray.map((m) => m.toLowerCase().trim());
        
        // Check if all search models are in spare models and vice versa (exact match)
        const allSearchInSpare = searchModels.every((m) => spareModels.includes(m));
        const allSpareInSearch = spareModels.every((m) => searchModels.includes(m));
        
        return allSearchInSpare && allSpareInSearch && searchModels.length === spareModels.length;
      });
    } else {
      // If no models provided, check if any spare has no models or empty models array
      duplicate = candidates.find((spare) => {
        const spareModels = spare.models || [];
        return spareModels.length === 0;
      });
    }

    if (duplicate) {
      console.log("Duplicate check result: FOUND DUPLICATE");
      console.log("Duplicate spare details:", {
        id: duplicate._id,
        name: duplicate.name,
        models: duplicate.models,
        supplierName: duplicate.supplierName,
      });
      
      return res.status(200).json({
        success: true,
        exists: true,
        message: `Duplicate spare found: A spare with the same name (${duplicate.name}), models (${(duplicate.models || []).join(", ")}), and supplier (${duplicate.supplierName}) already exists.`,
      });
    }

    console.log("Duplicate check result: NO DUPLICATE FOUND");
    return res.status(200).json({
      success: true,
      exists: false,
      message: "No duplicate found",
    });
  } catch (error) {
    console.error("Error checking duplicate spare:", error);
    res.status(500).json({
      success: false,
      message: "Error checking for duplicates",
      error: error.message,
    });
  }
};

module.exports = {
  createSpare,
  getSpares,
  getSpareById,
  updateSpare,
  updateSpareStock,
  deleteSpare,
  getStockAnalytics,
  getSpareNameSuggestions,
  getModelSuggestions,
  getSupplierSuggestions,
  checkDuplicateSpare,
};
