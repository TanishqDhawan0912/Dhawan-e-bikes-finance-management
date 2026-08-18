const Customer = require("../models/Customer");
const Jobcard = require("../models/Jobcard");

function cleanText(input) {
  return String(input || "").trim();
}

function normalizeMobile(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMobileRegex(mobileNormalized) {
  if (!mobileNormalized) return null;
  return new RegExp(mobileNormalized.split("").join("\\D*"));
}

async function getCustomerJobcards(customer) {
  const or = [{ customer: customer._id }];

  const mobileRegex = buildMobileRegex(customer.mobileNormalized);
  if (mobileRegex) {
    or.push({ mobile: { $regex: mobileRegex } });
  }

  if (customer.name && customer.place) {
    or.push({
      customerName: new RegExp(`^${escapeRegex(customer.name)}$`, "i"),
      place: new RegExp(`^${escapeRegex(customer.place)}$`, "i"),
    });
  }

  const historyFilter = or.length === 1 ? or[0] : { $or: or };

  const jobcards = await Jobcard.find(historyFilter)
    .sort({ createdAt: -1 })
    .populate("parts.spareId", "name sku")
    .populate("customer", "name place mobile mobileNormalized");

  const missingCustomerIds = jobcards
    .filter((j) => !j.customer)
    .map((j) => j._id);

  if (missingCustomerIds.length > 0) {
    await Jobcard.updateMany(
      { _id: { $in: missingCustomerIds } },
      { $set: { customer: customer._id } }
    );
  }

  return jobcards;
}

// @desc    Create or update customer by mobile number
// @route   POST /api/customers
// @access  Public
const upsertCustomer = async (req, res) => {
  try {
    const name = cleanText(req.body?.name);
    const place = cleanText(req.body?.place);
    const mobile = cleanText(req.body?.mobile);
    const mobileNormalized = normalizeMobile(mobile);

    if (!name || !place || !mobileNormalized) {
      return res.status(400).json({
        message: "name, place and mobile are required",
      });
    }

    const customer = await Customer.findOneAndUpdate(
      { mobileNormalized },
      {
        $set: {
          name,
          place,
          mobile,
          mobileNormalized,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    const jobcards = await getCustomerJobcards(customer);

    res.status(201).json({
      customer,
      totalJobcards: jobcards.length,
      jobcards,
    });
  } catch (error) {
    console.error("Error upserting customer:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get customer list
// @route   GET /api/customers
// @access  Public
const getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};

    if (search) {
      const s = String(search).trim();
      const mobileDigits = normalizeMobile(s);
      const mobileRegex = buildMobileRegex(mobileDigits);
      filter.$or = [
        { name: { $regex: s, $options: "i" } },
        { place: { $regex: s, $options: "i" } },
      ];
      if (mobileRegex) {
        filter.$or.push({ mobile: { $regex: mobileRegex } });
      }
    }

    const customers = await Customer.find(filter).sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    console.error("Error getting customers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get customer by id with full jobcard history
// @route   GET /api/customers/:id/history
// @access  Public
const getCustomerHistoryById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const jobcards = await getCustomerJobcards(customer);

    res.json({
      customer,
      totalJobcards: jobcards.length,
      jobcards,
    });
  } catch (error) {
    console.error("Error getting customer history:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  upsertCustomer,
  getCustomers,
  getCustomerHistoryById,
};
