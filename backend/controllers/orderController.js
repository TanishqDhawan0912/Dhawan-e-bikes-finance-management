const Order = require("../models/Order");
const Spare = require("../models/Spare");

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const { customerName, items, tax = 0, discount = 0, notes } = req.body;

    // Calculate subtotal and update stock
    let subtotal = 0;
    let profit = 0;

    // Process each item in the order
    for (const item of items) {
      const spare = await Spare.findById(item.spareId);

      if (!spare) {
        return res
          .status(404)
          .json({ message: `Spare with ID ${item.spareId} not found` });
      }

      if (spare.quantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${spare.name}. Available: ${spare.quantity}`,
        });
      }

      // Calculate item total and update order totals
      const itemTotal = item.quantity * item.unitPrice;
      subtotal += itemTotal;
      profit += (item.unitPrice - spare.costPrice) * item.quantity;

      // Update spare quantity
      await spare.updateStock(item.quantity, "out");
    }

    // Calculate total amount
    const totalAmount = subtotal + tax - discount;

    // Create order
    const order = new Order({
      customerName,
      items,
      subtotal,
      tax,
      discount,
      totalAmount,
      profit,
      notes,
      status: "completed", // Assuming immediate processing
    });

    const createdOrder = await order.save();

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
const getOrders = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    const filter = {};

    // Add date range filter
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) filter.orderDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of the day
        filter.orderDate.$lte = end;
      }
    }

    // Add status filter
    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .sort({ orderDate: -1 })
      .populate("items.spareId", "name sku");

    res.json(orders);
  } catch (error) {
    console.error("Error getting orders:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.spareId",
      "name sku costPrice"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error("Error getting order:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = status;
    const updatedOrder = await order.save();

    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get profit analytics
// @route   GET /api/orders/analytics/profit
// @access  Private
const getProfitAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    const match = {};

    // Add date range filter
    if (startDate || endDate) {
      match.orderDate = {};
      if (startDate) match.orderDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.orderDate.$lte = end;
      }
    }

    // Grouping logic
    let group = {};
    let sort = {};

    switch (groupBy) {
      case "day":
        group = {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
          date: {
            $first: {
              $dateToString: { format: "%Y-%m-%d", date: "$orderDate" },
            },
          },
        };
        sort = { _id: 1 };
        break;
      case "month":
        group = {
          _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
          date: {
            $first: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
          },
        };
        sort = { _id: 1 };
        break;
      case "year":
        group = {
          _id: { $dateToString: { format: "%Y", date: "$orderDate" } },
          date: {
            $first: { $dateToString: { format: "%Y", date: "$orderDate" } },
          },
        };
        sort = { _id: 1 };
        break;
      default:
        return res
          .status(400)
          .json({
            message: "Invalid groupBy parameter. Use day, month, or year.",
          });
    }

    // Add aggregation fields
    group.totalSales = { $sum: "$totalAmount" };
    group.totalProfit = { $sum: "$profit" };
    group.orderCount = { $sum: 1 };

    const analytics = await Order.aggregate([
      { $match: match },
      { $group: group },
      { $sort: sort },
    ]);

    res.json(analytics);
  } catch (error) {
    console.error("Error getting profit analytics:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getProfitAnalytics,
};
