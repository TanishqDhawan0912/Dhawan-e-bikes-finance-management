const Model = require("../models/Model");
const asyncHandler = require("../middleware/async");

// @desc    Check for duplicate model with same details
// @route   GET /api/models/check-duplicate
// @access  Public
exports.checkDuplicateModel = async (req, res) => {
  try {
    const { modelName, company, purchasedInWarranty } = req.query;

    console.log("=== DUPLICATE CHECK DEBUG ===");
    console.log("Input parameters:");
    console.log("  modelName:", modelName);
    console.log("  company:", company);
    console.log("  purchasedInWarranty:", purchasedInWarranty);

    if (!modelName || !company || purchasedInWarranty === undefined) {
      console.log("ERROR: Missing required parameters");
      return res.status(400).json({
        success: false,
        message: "Please provide modelName, company, and purchasedInWarranty",
      });
    }

    // Find ALL active models
    const allModels = await Model.find({ isActive: true });
    console.log(`Found ${allModels.length} total models in database`);

    // Check each model for exact duplicate
    for (let i = 0; i < allModels.length; i++) {
      const model = allModels[i];

      console.log(`\n--- Checking model ${i + 1}: ${model.modelName} ---`);

      // Normalize and compare each field (only model name, company, and warranty)
      const nameMatch =
        model.modelName.trim().toUpperCase() === modelName.trim().toUpperCase();
      const companyMatch =
        model.company.trim().toUpperCase() === company.trim().toUpperCase();
      const warrantyMatch =
        model.purchasedInWarranty.toString() ===
        (purchasedInWarranty || "false");

      console.log("Field comparisons:");
      console.log(
        "  Name match:",
        nameMatch,
        `(${model.modelName} vs ${modelName})`
      );
      console.log(
        "  Company match:",
        companyMatch,
        `(${model.company} vs ${company})`
      );
      console.log(
        "  Warranty match:",
        warrantyMatch,
        `(${model.purchasedInWarranty} vs ${purchasedInWarranty})`
      );

      // Check if ALL three fields match exactly
      if (nameMatch && companyMatch && warrantyMatch) {
        console.log(" EXACT DUPLICATE FOUND! Blocking creation.");
        console.log("=== END DUPLICATE CHECK ===");

        return res.status(200).json({
          success: true,
          exists: true,
          model: model,
          message: `EXACT DUPLICATE: A model with identical details already exists (Name: ${
            model.modelName
          }, Company: ${model.company}, Warranty: ${model.purchasedInWarranty})`,
        });
      } else {
        console.log(" Not a duplicate - at least one field differs");
      }
    }

    console.log(" NO EXACT DUPLICATES FOUND! Allowing creation.");
    console.log("=== END DUPLICATE CHECK ===");

    return res.status(200).json({
      success: true,
      exists: false,
      message: "No exact duplicate found - creation allowed",
    });
  } catch (error) {
    console.error(" ERROR in duplicate check:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Create a new model
// @route   POST /api/models
// @access  Public (for now, add auth later)
exports.createModel = asyncHandler(async (req, res) => {
  const {
    modelName,
    company,
    colour,
    quantity,
    purchasePrice,
    sellingPrice,
    batteriesPerSet,
    description,
    colorQuantities,
    purchasedInWarranty,
    purchaseDate,
  } = req.body;

  // Validate required fields
  if (!modelName || !company || quantity === undefined) {
    return res.status(400).json({
      success: false,
      message: "Please provide modelName, company, and quantity",
    });
  }

  // Function to convert string to title case (first letter of each word capitalized)
  const toTitleCase = (str) => {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  };

  // Validate and sanitize purchase price
  const validatePurchasePrice = (price) => {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return 0; // Default to 0 for negative or invalid prices
    }
    return numPrice;
  };

  // Normalize date to start/end of day for duplicate checks
  const getDayRange = (dateInput) => {
    if (!dateInput) return null;
    const toDate = () => {
      if (typeof dateInput === "string" && dateInput.includes("/")) {
        // dd/mm/yyyy
        const [dd, mm, yyyy] = dateInput.split("/");
        return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      }
      return new Date(dateInput);
    };
    const d = toDate();
    if (Number.isNaN(d.getTime())) return null;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { start, end };
  };

  // Prevent duplicate color entry with same purchase date (and warranty) for same model/company/color
  const purchaseDayRange = getDayRange(purchaseDate);
  if (purchaseDayRange) {
    const existing = await Model.findOne({
      isActive: true,
      modelName: { $regex: new RegExp(`^${modelName.trim()}$`, "i") },
      company: { $regex: new RegExp(`^${company.trim()}$`, "i") },
      colour: { $regex: new RegExp(`^${(colour || "").trim()}$`, "i") },
      purchaseDate: { $gte: purchaseDayRange.start, $lt: purchaseDayRange.end },
      purchasedInWarranty: !!purchasedInWarranty,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          "Duplicate detected: this model, company, color, purchase date, and warranty combination already exists. Please use a different date or update the existing entry.",
      });
    }
  }

  // Note: We allow creating models with same details but different purchase dates
  // The frontend will handle preventing exact duplicates (same details + same purchase date)

  // Prepare colorQuantities array
  const validatedColorQuantities = Array.isArray(colorQuantities) 
    ? colorQuantities.filter(entry => entry && entry.color && entry.quantity !== undefined)
      .map(entry => ({
        color: entry.color.trim(),
        quantity: parseInt(entry.quantity) || 0,
      }))
    : [];

  // Prepare stock entry if colorQuantities are provided
  const stockEntries = [];
  console.log("createModel - validatedColorQuantities:", validatedColorQuantities);
  console.log("createModel - validatedColorQuantities.length:", validatedColorQuantities.length);
  if (validatedColorQuantities.length > 0) {
    // Format purchase date as string (dd/mm/yyyy)
    const formatDateString = (dateInput) => {
      if (!dateInput) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        return `${day}/${month}/${year}`;
      }
      
      let date;
      if (dateInput instanceof Date) {
        date = dateInput;
      } else if (typeof dateInput === "string" && dateInput.includes("/")) {
        // dd/mm/yyyy format
        const [dd, mm, yyyy] = dateInput.split("/");
        date = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      } else {
        date = new Date(dateInput);
      }
      
      if (Number.isNaN(date.getTime())) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        return `${day}/${month}/${year}`;
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const formattedDate = formatDateString(purchaseDate);
    stockEntries.push({
      purchaseDate: formattedDate,
      batteriesPerSet: batteriesPerSet && [5, 6].includes(parseInt(batteriesPerSet)) ? parseInt(batteriesPerSet) : 5,
      sellingPrice: validatePurchasePrice(sellingPrice),
      colorQuantities: validatedColorQuantities,
      description: Array.isArray(description) ? description.filter(tag => tag && tag.trim()).map(tag => tag.trim()) : [],
      purchasedInWarranty: purchasedInWarranty || false,
    });
    console.log("Creating stock entry with:", {
      purchaseDate: formattedDate,
      colorQuantities: validatedColorQuantities,
      batteriesPerSet: batteriesPerSet && [5, 6].includes(parseInt(batteriesPerSet)) ? parseInt(batteriesPerSet) : 5,
      sellingPrice: validatePurchasePrice(sellingPrice),
    });
  }

  const model = await Model.create({
    modelName: toTitleCase(modelName.trim()),
    company: toTitleCase(company.trim()),
    colour: colour ? colour.trim().toLowerCase() : "",
    quantity: parseInt(quantity),
    purchasePrice: validatePurchasePrice(purchasePrice),
    sellingPrice: validatePurchasePrice(sellingPrice),
    batteriesPerSet: batteriesPerSet && [5, 6].includes(parseInt(batteriesPerSet)) ? parseInt(batteriesPerSet) : 5,
    description: Array.isArray(description) ? description.filter(tag => tag && tag.trim()).map(tag => tag.trim()) : [],
    colorQuantities: validatedColorQuantities,
    purchasedInWarranty: purchasedInWarranty || false,
    purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
    stockEntries: stockEntries,
  });

  console.log("Model created with stockEntries:", model.stockEntries?.length || 0);
  console.log("Model stockEntries:", JSON.stringify(model.stockEntries, null, 2));

  res.status(201).json({
    success: true,
    data: model,
  });
});

// @desc    Get all models
// @route   GET /api/models
// @access  Public (for now, add auth later)
exports.getModels = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    company,
    colour,
    stockStatus,
    warranty,
  } = req.query;

  // Build query
  const query = { isActive: true };

  // Add search functionality - Google-style prefix matching
  if (search) {
    console.log("=== MAIN SEARCH LOGIC ===");
    console.log("Search term:", search);
    console.log("This will match fields starting with:", `"${search}"`);

    query.$or = [
      {
        modelName: {
          $regex: "^" + search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        },
      },
      {
        company: {
          $regex: "^" + search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        },
      },
      {
        colour: {
          $regex: "^" + search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        },
      },
    ];

    console.log("MongoDB query $or array built for prefix matching");
  }

  // Add filters
  if (company && company !== "all") {
    query.company = company;
  }

  if (colour && colour !== "all") {
    query.colour = { $regex: colour, $options: "i" };
  }

  // Add stock status filter
  if (stockStatus && stockStatus !== "all") {
    if (stockStatus === "instock") {
      query.quantity = { $gt: 0 };
    } else if (stockStatus === "outofstock") {
      query.quantity = 0;
    }
  }

  // Add warranty filter
  if (warranty && warranty !== "all") {
    if (warranty === "inwarranty") {
      query.purchasedInWarranty = true;
    } else if (warranty === "nowarranty") {
      query.purchasedInWarranty = false;
    }
  }

  // Execute query with pagination - different logic for admin vs regular users
  console.log("Query:", query);
  console.log("Limit:", parseInt(limit));

  // Admin list: full sorted catalog (not $sample). Query param is reliable when Referer is stripped.
  const isAdminRequest =
    req.query.admin === "1" ||
    req.query.admin === "true" ||
    req.headers.referer?.includes("/admin") ||
    req.headers["user-agent"]?.includes("admin");
  console.log("Is admin request:", isAdminRequest);

  let models;
  if (isAdminRequest) {
    // Admin: Show all models with sorting by name
    models = await Model.find(query)
      .sort({ modelName: 1, company: 1 })
      .limit(parseInt(limit));
  } else {
    // Regular user: Show random models
    models = await Model.aggregate([
      { $match: query },
      { $sample: { size: parseInt(limit) } },
      {
        $project: {
          _id: 1,
          modelName: 1,
          company: 1,
          colour: 1,
          colorQuantities: 1,
          quantity: 1,
          purchasePrice: 1,
          sellingPrice: 1,
          purchasedInWarranty: 1,
          purchaseDate: 1,
          stockEntries: 1,
          createdAt: 1,
          updatedAt: 1,
          isActive: 1,
        },
      },
    ]);
  }

  // Auto-migrate models without purchaseDate (one-time operation)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const migrationResult = await Model.updateMany(
    {
      isActive: true,
      purchaseDate: { $exists: false },
    },
    {
      $set: {
        purchaseDate: today,
      },
    }
  );

  if (migrationResult.modifiedCount > 0) {
    console.log(
      `Auto-migrated ${migrationResult.modifiedCount} models with today's purchase date`
    );
  }

  console.log("Models found:", models.length);
  console.log("Sample model data:", models[0]);

  // Get total count for pagination
  const total = await Model.countDocuments(query);

  // Get unique companies and colours for filters
  const companies = await Model.distinct("company", { isActive: true });
  const colours = await Model.distinct("colour", {
    isActive: true,
    colour: { $ne: "" },
  });

  res.status(200).json({
    success: true,
    data: models,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
    filters: {
      companies,
      colours,
    },
  });
});

// @desc    Get single model by ID
// @route   GET /api/models/:id
// @access  Public (for now, add auth later)
exports.getModelById = asyncHandler(async (req, res) => {
  const model = await Model.findById(req.params.id);

  if (!model) {
    return res.status(404).json({
      success: false,
      message: "Model not found",
    });
  }

  // If model has colorQuantities but no stockEntries, create an initial stock entry
  // This handles both new models and existing models that were created before this feature
  const hasColorQuantities = model.colorQuantities && Array.isArray(model.colorQuantities) && model.colorQuantities.length > 0;
  const hasStockEntries = model.stockEntries && Array.isArray(model.stockEntries) && model.stockEntries.length > 0;
  
  console.log("getModelById - Checking model:", {
    id: model._id,
    hasColorQuantities,
    colorQuantitiesLength: model.colorQuantities?.length || 0,
    hasStockEntries,
    stockEntriesLength: model.stockEntries?.length || 0,
  });

  if (hasColorQuantities && !hasStockEntries) {
    const formatDateString = (dateInput) => {
      if (!dateInput) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        return `${day}/${month}/${year}`;
      }
      
      let date;
      if (dateInput instanceof Date) {
        date = dateInput;
      } else if (typeof dateInput === "string" && dateInput.includes("/")) {
        const [dd, mm, yyyy] = dateInput.split("/");
        date = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      } else {
        date = new Date(dateInput);
      }
      
      if (Number.isNaN(date.getTime())) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        return `${day}/${month}/${year}`;
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const initialStockEntry = {
      purchaseDate: formatDateString(model.purchaseDate),
      batteriesPerSet: model.batteriesPerSet || 5,
      sellingPrice: model.sellingPrice || 0,
      colorQuantities: model.colorQuantities,
      description: model.description || [],
      purchasedInWarranty: model.purchasedInWarranty || false,
    };

    model.stockEntries = [initialStockEntry];
    await model.save();
    console.log("Created initial stock entry for model:", model._id);
    console.log("Stock entry created:", JSON.stringify(initialStockEntry, null, 2));
  }

  console.log("getModelById - Returning model with stockEntries:", model.stockEntries?.length || 0);

  res.status(200).json({
    success: true,
    data: model,
  });
});

// @desc    Update model
// @route   PUT /api/models/:id
// @access  Public (for now, add auth later)
exports.updateModel = asyncHandler(async (req, res) => {
  const {
    modelName,
    company,
    colour,
    quantity,
    purchasePrice,
    purchasedInWarranty,
    purchaseDate,
    stockEntries,
    batteriesPerSet,
    sellingPrice,
    colorQuantities,
    description,
  } = req.body;

  let model = await Model.findById(req.params.id);

  if (!model) {
    return res.status(404).json({
      success: false,
      message: "Model not found",
    });
  }

  // Note: We allow updating models to have same details but different purchase dates
  // The frontend will handle preventing exact duplicates (same details + same purchase date)

  // Function to convert string to title case (first letter of each word capitalized)
  const toTitleCase = (str) => {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  };

  // Validate and sanitize purchase price
  const validatePurchasePrice = (price) => {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return 0; // Default to 0 for negative or invalid prices
    }
    return numPrice;
  };

  // Update fields
  const updateData = {};
  if (modelName !== undefined)
    updateData.modelName = toTitleCase(modelName.trim());
  if (company !== undefined) updateData.company = toTitleCase(company.trim());
  if (colour !== undefined) updateData.colour = colour ? colour.trim() : "";
  if (quantity !== undefined) updateData.quantity = parseInt(quantity);
  if (purchasePrice !== undefined)
    updateData.purchasePrice = validatePurchasePrice(purchasePrice);
  if (purchasedInWarranty !== undefined)
    updateData.purchasedInWarranty = Boolean(purchasedInWarranty);
  if (purchaseDate !== undefined)
    updateData.purchaseDate = new Date(purchaseDate);
  if (stockEntries !== undefined) {
    // Validate stockEntries array
    if (Array.isArray(stockEntries)) {
      // Validate each stock entry structure
      const validatedEntries = stockEntries.map((entry) => {
      const validated = {
        purchaseDate: entry.purchaseDate || "",
        batteriesPerSet: entry.batteriesPerSet === 6 ? 6 : 5,
        sellingPrice: parseFloat(entry.sellingPrice) || 0,
        purchasePrice: parseFloat(entry.purchasePrice) || 0,
        colorQuantities: Array.isArray(entry.colorQuantities)
          ? entry.colorQuantities
              .filter((cq) => cq && cq.color && cq.quantity !== undefined)
              .map((cq) => ({
                color: cq.color.trim(),
                quantity: parseInt(cq.quantity) || 0,
              }))
          : [],
        description: Array.isArray(entry.description)
          ? entry.description.filter((tag) => tag && tag.trim())
          : [],
        purchasedInWarranty: Boolean(entry.purchasedInWarranty),
      };
        return validated;
      });
      updateData.stockEntries = validatedEntries;
    }
  }
  // Only update model-level fields if explicitly provided (not from stockEntries)
  if (batteriesPerSet !== undefined && stockEntries === undefined) {
    if (batteriesPerSet === 5 || batteriesPerSet === 6) {
      updateData.batteriesPerSet = parseInt(batteriesPerSet);
    }
  }
  if (sellingPrice !== undefined && stockEntries === undefined) {
    const numPrice = parseFloat(sellingPrice);
    if (!isNaN(numPrice) && numPrice >= 0) {
      updateData.sellingPrice = numPrice;
    }
  }
  if (colorQuantities !== undefined && stockEntries === undefined) {
    if (Array.isArray(colorQuantities)) {
      updateData.colorQuantities = colorQuantities.filter(
        (entry) => entry && entry.color && entry.quantity !== undefined
      );
    }
  }
  if (description !== undefined && stockEntries === undefined) {
    if (Array.isArray(description)) {
      updateData.description = description.filter((tag) => tag && tag.trim());
    }
  }

  const applyToGroup =
    req.query &&
    req.query.admin === "true" &&
    req.query.applyToGroup === "true";

  if (applyToGroup) {
    const groupUpdateData = {};
    if (updateData.purchaseDate !== undefined)
      groupUpdateData.purchaseDate = updateData.purchaseDate;
    if (updateData.purchasedInWarranty !== undefined)
      groupUpdateData.purchasedInWarranty = updateData.purchasedInWarranty;

    if (Object.keys(groupUpdateData).length > 0) {
      await Model.updateMany(
        {
          isActive: true,
          modelName: { $regex: new RegExp(`^${model.modelName}$`, "i") },
          company: { $regex: new RegExp(`^${model.company}$`, "i") },
        },
        { $set: groupUpdateData }
      );
    }
  }

  model = await Model.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: model,
    appliedToGroup: applyToGroup || false,
  });
});

// @desc    Delete model (soft delete)
// @route   DELETE /api/models/:id
// @access  Public (for now, add auth later)
exports.deleteModel = asyncHandler(async (req, res) => {
  const model = await Model.findById(req.params.id);

  if (!model) {
    return res.status(404).json({
      success: false,
      message: "Model not found",
    });
  }

  // Soft delete by setting isActive to false
  await Model.findByIdAndUpdate(req.params.id, { isActive: false });

  res.status(200).json({
    success: true,
    message: "Model deleted successfully",
  });
});

// @desc    Check for existing purchase price for models with same name, company, purchase date, and warranty status (regardless of color)
// @route   GET /api/models/check-purchase-price
// @access  Public
exports.checkPurchasePrice = async (req, res) => {
  try {
    const { modelName, company, purchaseDate, purchasedInWarranty } = req.query;

    console.log("=== PURCHASE PRICE CHECK DEBUG ===");
    console.log("Input parameters:");
    console.log("  modelName:", modelName);
    console.log("  company:", company);
    console.log("  purchaseDate:", purchaseDate);
    console.log("  purchasedInWarranty:", purchasedInWarranty);

    if (
      !modelName ||
      !company ||
      !purchaseDate ||
      purchasedInWarranty === undefined
    ) {
      console.log("ERROR: Missing required parameters");
      return res.status(400).json({
        success: false,
        message:
          "Please provide modelName, company, purchaseDate, and purchasedInWarranty",
      });
    }

    // Normalize warranty flag from query (string or boolean)
    const warrantyFlag =
      purchasedInWarranty === true ||
      purchasedInWarranty === "true" ||
      purchasedInWarranty === "1";

    // Parse purchase date safely to avoid timezone drift (use local start/end of day)
    const parsedDate = (() => {
      // Accept both yyyy-mm-dd and dd/mm/yyyy
      if (purchaseDate.includes("/")) {
        const [dd, mm, yyyy] = purchaseDate.split("/");
        return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      }
      return new Date(purchaseDate);
    })();

    const startOfDay = new Date(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate()
    );
    const endOfDay = new Date(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate() + 1
    );

    // Find models with same name, company, purchase date, and warranty status (any color) that have a purchase price
    const existingModels = await Model.find({
      isActive: true,
      modelName: { $regex: new RegExp(`^${modelName.trim()}$`, "i") },
      company: { $regex: new RegExp(`^${company.trim()}$`, "i") },
      purchaseDate: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
      purchasedInWarranty: warrantyFlag,
      purchasePrice: { $exists: true, $gt: 0 },
    });

    console.log(
      `Found ${existingModels.length} models with purchase price and same warranty status`
    );

    if (existingModels.length > 0) {
      // Return the first matching model's purchase price
      const referenceModel = existingModels[0];
      console.log(
        "Found existing purchase price:",
        referenceModel.purchasePrice
      );
      console.log("Reference model color:", referenceModel.colour);
      console.log(
        "Reference model warranty status:",
        referenceModel.purchasedInWarranty
      );

      return res.status(200).json({
        success: true,
        hasPrice: true,
        purchasePrice: referenceModel.purchasePrice,
        referenceModel: {
          modelName: referenceModel.modelName,
          company: referenceModel.company,
          colour: referenceModel.colour,
          purchaseDate: referenceModel.purchaseDate,
          purchasedInWarranty: referenceModel.purchasedInWarranty,
        },
        message: `Found existing purchase price of ${
          referenceModel.purchasePrice
        } for ${referenceModel.modelName} ${referenceModel.company} (${
          referenceModel.colour
        }) with warranty status: ${
          referenceModel.purchasedInWarranty ? "In Warranty" : "Out of Warranty"
        }`,
      });
    }

    console.log("No existing purchase price found with same warranty status");
    return res.status(200).json({
      success: true,
      hasPrice: false,
      message:
        "No existing purchase price found for models with these details and warranty status",
    });
  } catch (error) {
    console.error(" ERROR in purchase price check:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Update model quantity
// @route   PUT /api/models/:id/quantity
// @access  Public (for now, add auth later)
exports.updateModelQuantity = asyncHandler(async (req, res) => {
  const { quantity, type = "set" } = req.body; // type can be 'set', 'add', 'subtract'

  const model = await Model.findById(req.params.id);

  if (!model) {
    return res.status(404).json({
      success: false,
      message: "Model not found",
    });
  }

  await model.updateQuantity(quantity, type);

  res.status(200).json({
    success: true,
    data: model,
  });
});

// @desc    Get model analytics
// @route   GET /api/models/analytics
// @access  Public (for now, add auth later)
exports.getModelAnalytics = asyncHandler(async (req, res) => {
  const totalModels = await Model.countDocuments({ isActive: true });
  const inStockModels = await Model.countDocuments({
    isActive: true,
    quantity: { $gt: 0 },
  });
  const outOfStockModels = await Model.countDocuments({
    isActive: true,
    quantity: 0,
  });
  const lowStockModels = await Model.countDocuments({
    isActive: true,
    quantity: { $gt: 0, $lt: 15 },
  });

  const totalQuantity = await Model.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);

  const modelsByCompany = await Model.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$company",
        count: { $sum: 1 },
        totalQuantity: { $sum: "$quantity" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const modelsByColour = await Model.aggregate([
    { $match: { isActive: true, colour: { $ne: "" } } },
    { $group: { _id: "$colour", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalModels,
        inStockModels,
        outOfStockModels,
        lowStockModels,
        totalQuantity: totalQuantity[0]?.total || 0,
      },
      byCompany: modelsByCompany,
      byColour: modelsByColour,
    },
  });
});

// @desc    Check for duplicate model during editing
// @route   GET /api/models/check-duplicate-edit
// @access  Public
exports.checkDuplicateEdit = async (req, res) => {
  try {
    const {
      modelName,
      company,
      colour,
      purchaseDate,
      purchasedInWarranty,
      excludeId,
      admin,
    } = req.query;

    console.log("=== BACKEND DUPLICATE CHECK EDIT ===");
    console.log("Received parameters:");
    console.log("  modelName:", modelName);
    console.log("  company:", company);
    console.log("  colour:", colour);
    console.log("  purchaseDate:", purchaseDate);
    console.log("  purchasedInWarranty:", purchasedInWarranty);
    console.log("  excludeId:", excludeId);

    const isAdminEdit = admin === "true";

    if (isAdminEdit) {
      if (!modelName || !company || purchasedInWarranty === undefined) {
        console.log(
          "ERROR: Missing required parameters for admin duplicate check"
        );
        return res.status(400).json({
          success: false,
          message:
            "Please provide modelName, company, and purchasedInWarranty for admin duplicate check",
        });
      }
    } else {
      if (
        !modelName ||
        !company ||
        !colour ||
        !purchaseDate ||
        purchasedInWarranty === undefined
      ) {
        console.log("ERROR: Missing required parameters");
        return res.status(400).json({
          success: false,
          message: "Missing required parameters for duplicate check",
        });
      }
    }

    // Build query to find existing model with same details
    // Use the same logic as checkDuplicateModel but excluding current model
    const allModels = await Model.find({ isActive: true });

    console.log(`Found ${allModels.length} total models in database`);
    console.log("Looking for duplicates excluding ID:", excludeId);

    let existingModel = null;

    // Check each model for exact duplicate (excluding current model)
    for (let i = 0; i < allModels.length; i++) {
      const model = allModels[i];

      // Skip the current model being edited
      if (model._id.toString() === excludeId) {
        console.log(`Skipping current model ${i + 1}: ${model._id}`);
        continue;
      }

      console.log(`\n--- Checking model ${i + 1}: ${model.modelName} ---`);

      // Normalize and compare
      const nameMatch =
        model.modelName.trim().toUpperCase() === modelName.trim().toUpperCase();
      const companyMatch =
        model.company.trim().toUpperCase() === company.trim().toUpperCase();
      const warrantyMatch =
        model.purchasedInWarranty.toString() ===
        (purchasedInWarranty || "false");

      let colourMatch = true;
      let dateMatch = true;

      if (!isAdminEdit) {
        colourMatch =
          (model.colour || "").trim().toLowerCase() ===
          (colour || "").trim().toLowerCase();

        dateMatch = false;
        if (model.purchaseDate && purchaseDate) {
          const existingDate = new Date(model.purchaseDate)
            .toISOString()
            .split("T")[0];

          let newDate;
          if (purchaseDate.includes("/")) {
            const [day, month, year] = purchaseDate.split("/");
            newDate = new Date(`${year}-${month}-${day}`)
              .toISOString()
              .split("T")[0];
          } else {
            newDate = new Date(purchaseDate).toISOString().split("T")[0];
          }

          dateMatch = existingDate === newDate;
          console.log(
            `  Comparing dates: DB="${existingDate}" vs New="${newDate}" (from "${purchaseDate}")`
          );
        }
      }

      console.log("Field comparisons:");
      console.log(
        "  Name match:",
        nameMatch,
        `(DB: "${model.modelName}" vs New: "${modelName}")`
      );
      console.log(
        "  Company match:",
        companyMatch,
        `(DB: "${model.company}" vs New: "${company}")`
      );
      if (!isAdminEdit) {
        console.log(
          "  Colour match:",
          colourMatch,
          `(DB: "${model.colour}" vs New: "${colour}")`
        );
        console.log(
          "  Date match:",
          dateMatch,
          `(DB: "${model.purchaseDate}" vs New: "${purchaseDate}")`
        );
      } else {
        console.log("  Colour match: (ignored in admin edit)");
        console.log("  Date match: (ignored in admin edit)");
      }
      console.log(
        "  Warranty match:",
        warrantyMatch,
        `(DB: ${model.purchasedInWarranty} vs New: ${
          purchasedInWarranty || "false"
        })`
      );

      // Duplicate criteria
      if (isAdminEdit) {
        if (nameMatch && companyMatch && warrantyMatch) {
          console.log("🚨 DUPLICATE FOUND (admin criteria)!");
          existingModel = model;
          break;
        }
      } else {
        if (
          nameMatch &&
          companyMatch &&
          colourMatch &&
          dateMatch &&
          warrantyMatch
        ) {
          console.log("🚨 DUPLICATE FOUND!");
          existingModel = model;
          break;
        }
      }
    }

    res.status(200).json({
      success: true,
      exists: !!existingModel,
      message: existingModel
        ? isAdminEdit
          ? "A model with same name, company and warranty status already exists"
          : "A model with these details already exists"
        : "No duplicate found",
    });
  } catch (error) {
    console.error("Error checking duplicate for edit:", error);
    res.status(500).json({
      success: false,
      message: "Error checking for duplicates",
      error: error.message,
    });
  }
};

// @desc    Get model name suggestions for autocomplete
// @route   GET /api/models/suggestions
// @access  Public
exports.getModelSuggestions = async (req, res) => {
  try {
    const { search } = req.query;

    console.log("=== MODEL SUGGESTIONS ===");
    console.log("Search term:", search);

    if (!search || search.trim().length < 1) {
      console.log("Search term empty or missing");
      return res.status(200).json({
        success: true,
        suggestions: [],
      });
    }

    // First check if there are any active models at all
    const totalActiveModels = await Model.countDocuments({ isActive: true });
    console.log("Total active models in database:", totalActiveModels);

    if (totalActiveModels === 0) {
      console.log("WARNING: No active models found in database!");
      return res.status(200).json({
        success: true,
        suggestions: [],
      });
    }

    // Step 1: Get all distinct model names from database
    const allModels = await Model.find({ isActive: true }).select("modelName");
    const distinctModelNames = [
      ...new Set(allModels.map((model) => model.modelName).filter(Boolean)),
    ];

    console.log("All distinct model names:", distinctModelNames);

    // Step 2: Get the search string (substring generated on every key input)
    const searchStr = search.trim().toLowerCase();
    console.log("Search string (substring from key input):", searchStr);

    // Step 3: Compare search string with each model name
    // Step 4: Keep only model names where search string is a substring
    const suggestions = distinctModelNames.filter((modelName) => {
      const name = modelName.toLowerCase();
      const isSubstring = name.includes(searchStr);
      console.log(`"${searchStr}" in "${name}"? ${isSubstring}`);
      return isSubstring;
    });

    // Sort by relevance - exact matches first, then prefix matches, then position (SAME LOGIC AS COMPANIES)
    const sortedSuggestions = suggestions.sort((a, b) => {
      const aName = a.toLowerCase();
      const bName = b.toLowerCase();

      // Priority 1: Exact match first
      if (aName === searchStr && bName !== searchStr) return -1;
      if (bName === searchStr && aName !== searchStr) return 1;

      // Priority 2: Prefix matches (starts with stored string)
      const aStartsWith = aName.startsWith(searchStr);
      const bStartsWith = bName.startsWith(searchStr);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Priority 3: Earlier position of stored string in the name
      const aPosition = aName.indexOf(searchStr);
      const bPosition = bName.indexOf(searchStr);
      if (aPosition !== bPosition) return aPosition - bPosition;

      // Priority 4: Shorter name first
      return aName.length - bName.length;
    });

    console.log("Final sorted model suggestions:", sortedSuggestions);

    // Limit to maximum 4 suggestions for frontend
    const limitedSuggestions = sortedSuggestions.slice(0, 4);
    console.log("Limited suggestions (max 4):", limitedSuggestions);

    res.status(200).json({
      success: true,
      suggestions: limitedSuggestions,
    });
  } catch (error) {
    console.error("Error getting model suggestions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching suggestions",
      error: error.message,
    });
  }
};

// @desc    Get all distinct company names for autocomplete
// @route   GET /api/models/all-companies
// @access  Public
exports.getAllCompanies = async (req, res) => {
  try {
    console.log("=== GET ALL COMPANIES ===");

    // Get all distinct company names from active models
    const allModels = await Model.find({ isActive: true }).select("company");
    const distinctCompanies = [
      ...new Set(allModels.map((model) => model.company).filter(Boolean)),
    ];

    // Sort companies alphabetically for better organization
    const sortedCompanies = distinctCompanies.sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    console.log("Total distinct companies found:", sortedCompanies.length);
    console.log("Sample companies:", sortedCompanies.slice(0, 10));

    res.status(200).json({
      success: true,
      companies: sortedCompanies,
      total: sortedCompanies.length,
    });
  } catch (error) {
    console.error("Error getting all companies:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching companies",
      error: error.message,
    });
  }
};

// @desc    Get all distinct model names for autocomplete
// @route   GET /api/models/all-model-names
// @access  Public
exports.getAllModelNames = async (req, res) => {
  try {
    console.log("=== GET ALL MODEL NAMES ===");

    // Get all distinct model names from active models
    const allModels = await Model.find({ isActive: true }).select("modelName");
    const distinctModelNames = [
      ...new Set(allModels.map((model) => model.modelName).filter(Boolean)),
    ];

    // Sort model names alphabetically for better organization
    const sortedModelNames = distinctModelNames.sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    console.log("Total distinct model names found:", sortedModelNames.length);
    console.log("Sample model names:", sortedModelNames.slice(0, 10));

    res.status(200).json({
      success: true,
      modelNames: sortedModelNames,
      total: sortedModelNames.length,
    });
  } catch (error) {
    console.error("Error getting all model names:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching model names",
      error: error.message,
    });
  }
};

// @desc    Get company suggestions for autocomplete
// @route   GET /api/models/company-suggestions
// @access  Public
exports.getCompanySuggestions = async (req, res) => {
  try {
    const { search } = req.query;

    console.log("=== COMPANY SUGGESTIONS ===");
    console.log("Search term:", search);

    if (!search || search.trim().length < 1) {
      console.log("Search term empty or missing");
      return res.status(200).json({
        success: true,
        companies: [],
      });
    }

    // Step 1: Get all distinct company names from database
    const allModels = await Model.find({ isActive: true }).select("company");
    const distinctCompanies = [
      ...new Set(allModels.map((model) => model.company).filter(Boolean)),
    ];

    console.log("All distinct companies:", distinctCompanies);

    // Step 2: Get the search string
    const searchStr = search.trim().toLowerCase();
    console.log("Search string:", searchStr);

    // Step 3: Compare search string with each company name
    // Step 4: Keep only companies where search string is a substring
    const suggestions = distinctCompanies.filter((company) => {
      const companyName = company.toLowerCase();
      const isSubstring = companyName.includes(searchStr);
      console.log(`"${searchStr}" in "${companyName}"? ${isSubstring}`);
      return isSubstring;
    });

    // Sort by relevance - exact matches first, then prefix matches, then position (SAME LOGIC AS MODELS)
    const sortedCompanies = suggestions.sort((a, b) => {
      const aName = a.toLowerCase();
      const bName = b.toLowerCase();

      // Priority 1: Exact match first
      if (aName === searchStr && bName !== searchStr) return -1;
      if (bName === searchStr && aName !== searchStr) return 1;

      // Priority 2: Prefix matches (starts with stored string)
      const aStartsWith = aName.startsWith(searchStr);
      const bStartsWith = bName.startsWith(searchStr);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Priority 3: Earlier position of stored string in the name
      const aPosition = aName.indexOf(searchStr);
      const bPosition = bName.indexOf(searchStr);
      if (aPosition !== bPosition) return aPosition - bPosition;

      // Priority 4: Shorter name first
      return aName.length - bName.length;
    });

    console.log("Final sorted companies:", sortedCompanies);

    // Limit to maximum 4 suggestions for frontend
    const limitedCompanies = sortedCompanies.slice(0, 4);
    console.log("Limited companies (max 4):", limitedCompanies);

    res.status(200).json({
      success: true,
      companies: limitedCompanies,
    });
  } catch (error) {
    console.error("Error getting company suggestions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching company suggestions",
      error: error.message,
    });
  }
};
