const Spare = require("../models/Spare");

// @desc    Create a new spare
// @route   POST /api/spares
// @access  Private
const createSpare = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      quantity,
      costPrice,
      sellingPrice,
      minStockLevel = 5,
      supplier = {},
      location = {},
      notes,
    } = req.body;

    const spare = new Spare({
      name,
      description,
      category,
      quantity: quantity || 0,
      costPrice,
      sellingPrice,
      minStockLevel,
      supplier,
      location,
      notes,
    });

    const createdSpare = await spare.save();
    res.status(201).json(createdSpare);
  } catch (error) {
    console.error("Error creating spare:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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
      sortBy = "name",
      sortOrder = "asc",
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

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

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
    } = req.body;

    const spare = await Spare.findById(req.params.id);

    if (!spare) {
      return res.status(404).json({ message: "Spare not found" });
    }

    // Update fields if provided
    if (name) spare.name = name;
    if (description) spare.description = description;
    if (category) spare.category = category;
    if (costPrice) spare.costPrice = costPrice;
    if (sellingPrice) spare.sellingPrice = sellingPrice;
    if (minStockLevel !== undefined) spare.minStockLevel = minStockLevel;
    if (supplier) spare.supplier = { ...spare.supplier, ...supplier };
    if (location) spare.location = { ...spare.location, ...location };
    if (notes !== undefined) spare.notes = notes;

    const updatedSpare = await spare.save();

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

    // Check if spare is used in any orders
    const orderCount = await Order.countDocuments({
      "items.spareId": req.params.id,
    });

    if (orderCount > 0) {
      return res.status(400).json({
        message:
          "Cannot delete spare that is associated with orders. Mark as inactive instead.",
      });
    }

    await spare.remove();

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

module.exports = {
  createSpare,
  getSpares,
  getSpareById,
  updateSpare,
  updateSpareStock,
  deleteSpare,
  getStockAnalytics,
};
