import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { formatDate } from "../utils/dateUtils";
import { useSessionTimeout } from "../hooks/useSessionTimeout";
import {
  FaTools,
  FaBatteryFull,
  FaMotorcycle,
  FaMoneyBillWave,
} from "react-icons/fa";

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState("spares");
  const [spares, setSpares] = useState([]);
  const [sparesLoading, setSparesLoading] = useState(false);
  const [sparesError, setSparesError] = useState("");
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [batteries, setBatteries] = useState([]);
  const [batteriesLoading, setBatteriesLoading] = useState(false);
  const [batteriesError, setBatteriesError] = useState("");
  const [showBatteryLowStockModal, setShowBatteryLowStockModal] =
    useState(false);
  const [chargers, setChargers] = useState([]);
  const [chargersLoading, setChargersLoading] = useState(false);
  const [chargersError, setChargersError] = useState("");
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billsError, setBillsError] = useState("");
  const [jobcards, setJobcards] = useState([]);
  const [jobcardsLoading, setJobcardsLoading] = useState(false);
  const [jobcardsError, setJobcardsError] = useState("");
  /** null = finance home (pick Bills vs Jobcards); otherwise full detail for that area */
  const [financeSubView, setFinanceSubView] = useState(null); // null | "bills" | "jobcards"
  const [financeRangeMode, setFinanceRangeMode] = useState("day"); // "day" | "month"
  const [financeSelectedDate, setFinanceSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  ); // yyyy-mm-dd
  const [financeSelectedMonth, setFinanceSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  ); // yyyy-mm
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("sellingPrice");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [companies, setCompanies] = useState([]);

  // Initialize session timeout for admin
  const { showAdminLeavePrompt } = useSessionTimeout();

  // Handle authentication check in useEffect
  useEffect(() => {
    const isAdminAuth = sessionStorage.getItem("adminAuth");
    if (!isAdminAuth) {
      navigate("/admin-login", { replace: true });
    }
  }, [navigate]);

  // Handle URL parameter for section
  useEffect(() => {
    const section = searchParams.get("section");
    if (
      section &&
      ["spares", "batteries", "models", "finance"].includes(section)
    ) {
      setActiveSection(section);
    }
  }, [searchParams]);

  const fetchModels = async () => {
    try {
      setModelsLoading(true);
      setModelsError("");
      // Add cache-busting timestamp so latest model changes always reflect
      const timestamp = Date.now();
      const response = await fetch(
        `http://localhost:5000/api/models?limit=1000&t=${timestamp}`
      );
      const data = await response.json();

      console.log("Admin fetchModels - Response:", data);
      console.log("Admin fetchModels - Data array:", data.data);
      console.log("Admin fetchModels - Data length:", data.data?.length);

      if (!response.ok) {
        throw new Error(data.message || "Error fetching models");
      }

      setModels(data.data || []);
      // Extract unique companies for filter
      const uniqueCompanies = [
        ...new Set(data.data?.map((m) => m.company).filter(Boolean) || []),
      ];
      setCompanies(uniqueCompanies);
    } catch (err) {
      console.error("Error fetching models:", err);
      setModelsError(err.message || "Error fetching models");
    } finally {
      setModelsLoading(false);
    }
  };

  // Fetch models data
  useEffect(() => {
    if (activeSection === "models") {
      fetchModels();
    }
  }, [activeSection]);

  // Fetch spares data for admin spares section
  const fetchSparesForAdmin = async () => {
    try {
      setSparesLoading(true);
      setSparesError("");

      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(
        `http://localhost:5000/api/spares?t=${timestamp}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error fetching spares");
      }

      setSpares(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Admin - Error fetching spares:", error);
      setSparesError(error.message || "Error fetching spares. Please try again.");
    } finally {
      setSparesLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === "spares") {
      fetchSparesForAdmin();
    }
  }, [activeSection]);

  // Fetch batteries data for admin batteries section
  const fetchBatteriesForAdmin = async () => {
    try {
      setBatteriesLoading(true);
      setBatteriesError("");

      const timestamp = Date.now();
      const response = await fetch(
        `http://localhost:5000/api/batteries?t=${timestamp}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error fetching batteries");
      }

      setBatteries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Admin - Error fetching batteries:", error);
      setBatteriesError(
        error.message || "Error fetching batteries. Please try again."
      );
    } finally {
      setBatteriesLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === "batteries") {
      fetchBatteriesForAdmin();
    }
  }, [activeSection]);

  const fetchChargersForAdmin = async () => {
    try {
      setChargersLoading(true);
      setChargersError("");
      const timestamp = Date.now();
      const response = await fetch(
        `http://localhost:5000/api/chargers?t=${timestamp}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Error fetching chargers");
      }
      setChargers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Admin - Error fetching chargers:", error);
      setChargersError(
        error.message || "Error fetching chargers. Please try again."
      );
    } finally {
      setChargersLoading(false);
    }
  };

  const fetchBillsForAdmin = async () => {
    try {
      setBillsLoading(true);
      setBillsError("");
      const timestamp = Date.now();
      const response = await fetch(
        `http://localhost:5000/api/bills?t=${timestamp}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Error fetching bills");
      }
      setBills(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Admin - Error fetching bills:", error);
      setBillsError(error.message || "Error fetching bills. Please try again.");
    } finally {
      setBillsLoading(false);
    }
  };

  const fetchJobcardsForAdmin = async () => {
    try {
      setJobcardsLoading(true);
      setJobcardsError("");
      const timestamp = Date.now();
      const response = await fetch(
        `http://localhost:5000/api/jobcards?status=finalized&t=${timestamp}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Error fetching jobcards");
      }
      setJobcards(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Admin - Error fetching jobcards:", error);
      setJobcardsError(
        error.message || "Error fetching jobcards. Please try again."
      );
    } finally {
      setJobcardsLoading(false);
    }
  };

  // When finance section is active, fetch the data needed for profit calculations
  useEffect(() => {
    if (activeSection !== "finance") return;
    fetchBillsForAdmin();
    fetchJobcardsForAdmin();
    // Needed to estimate cost (profit = revenue - cost)
    fetchSparesForAdmin();
    fetchModels();
    fetchBatteriesForAdmin();
    fetchChargersForAdmin();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "finance") {
      setFinanceSubView(null);
    }
  }, [activeSection]);

  // Check if user is authenticated
  const isAdminAuth = sessionStorage.getItem("adminAuth");
  if (!isAdminAuth) {
    return null;
  }

  // Filter and sort models
  const getFilteredAndSortedModels = () => {
    let filtered = [...models];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (model) =>
          model.modelName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          model.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          model.colour?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply company filter
    if (filterCompany !== "all") {
      filtered = filtered.filter((model) => model.company === filterCompany);
    }

    // Apply stock filter
    if (filterStock === "instock") {
      filtered = filtered.filter((model) => model.quantity > 0);
    } else if (filterStock === "outofstock") {
      filtered = filtered.filter((model) => model.quantity === 0);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle different data types
      if (
        sortBy === "quantity" ||
        sortBy === "purchasePrice" ||
        sortBy === "sellingPrice"
      ) {
        aValue = aValue ?? 0;
        bValue = bValue ?? 0;
        aValue = typeof aValue === "number" ? aValue : parseFloat(aValue) || 0;
        bValue = typeof bValue === "number" ? bValue : parseFloat(bValue) || 0;
        if (sortOrder === "asc") return aValue - bValue;
        return bValue - aValue;
      } else if (sortBy === "purchasedInWarranty") {
        // For warranty sorting, convert boolean to number for comparison
        aValue = aValue ? 1 : 0;
        bValue = bValue ? 1 : 0;
      } else {
        aValue = (aValue || "").toString().toLowerCase();
        bValue = (bValue || "").toString().toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  // Group models by name and company (matching Models page grouping & quantities)
  const getModelsGroupedByNameAndCompany = () => {
    const filteredModels = getFilteredAndSortedModels();
    const grouped = {};

    filteredModels.forEach((model) => {
      const key = `${model.modelName}-${model.company}`;

      if (!grouped[key]) {
        grouped[key] = {
          modelName: model.modelName,
          company: model.company,
          // Use earliest purchase date within the group for display
          purchaseDate: model.purchaseDate || model.createdAt || null,
          // True if any entry in the group was purchased in warranty
          purchasedInWarranty: !!model.purchasedInWarranty,
          colours: [],
          // Map of description label -> { [colour]: quantity }
          descriptionColorMap: {},
          totalQuantity: 0,
          totalValue: 0,
          hasMissingPrice: false,
          inWarranty: false,
          models: [],
          lowestPrice: null,
          sellingPrice: null,
        };
      } else {
        // Keep the earliest purchase date for the group
        const currentDate = grouped[key].purchaseDate
          ? new Date(grouped[key].purchaseDate)
          : null;
        const modelDate = model.purchaseDate || model.createdAt || null;
        if (modelDate) {
          const modelDateObj = new Date(modelDate);
          if (!currentDate || modelDateObj < currentDate) {
            grouped[key].purchaseDate = modelDate;
          }
        }

        if (model.purchasedInWarranty) {
          grouped[key].purchasedInWarranty = true;
        }
      }

      // Store selling price from model (first non-null)
      if (!grouped[key].sellingPrice && model.sellingPrice) {
        grouped[key].sellingPrice = model.sellingPrice;
      }

      // Update lowest purchase price (only consider prices > 0)
      if (model.purchasePrice && model.purchasePrice > 0) {
        if (
          grouped[key].lowestPrice === null ||
          model.purchasePrice < grouped[key].lowestPrice
        ) {
          grouped[key].lowestPrice = model.purchasePrice;
        }
      }

      // Aggregate colors from stockEntries if available
      let hasColorsFromStockEntries = false;
      if (
        model.stockEntries &&
        Array.isArray(model.stockEntries) &&
        model.stockEntries.length > 0
      ) {
        model.stockEntries.forEach((entry) => {
          if (
            entry.colorQuantities &&
            Array.isArray(entry.colorQuantities) &&
            entry.colorQuantities.length > 0
          ) {
            hasColorsFromStockEntries = true;
            entry.colorQuantities.forEach((cq) => {
              if (cq.color && cq.color.trim() !== "") {
                const existingColor = grouped[key].colours.find(
                  (c) => c.colour === cq.color
                );
                const quantityToAdd = parseInt(cq.quantity) || 0;
                if (existingColor) {
                  existingColor.quantity += quantityToAdd;
                } else {
                  grouped[key].colours.push({
                    colour: cq.color,
                    quantity: quantityToAdd,
                  });
                }
                grouped[key].totalQuantity += quantityToAdd;

                // Also aggregate by combined description tags for this stock entry.
                // All description tags entered together for this entry are treated as ONE label.
                const descParts = Array.isArray(entry.description)
                  ? entry.description
                  : entry.description
                  ? [entry.description]
                  : [];
                const combinedLabel = descParts
                  .map((d) => (d || "").toString().trim())
                  .filter(Boolean)
                  .join(", ");
                if (combinedLabel) {
                  if (!grouped[key].descriptionColorMap[combinedLabel]) {
                    grouped[key].descriptionColorMap[combinedLabel] = {};
                  }
                  const mapForDesc =
                    grouped[key].descriptionColorMap[combinedLabel];
                  const colorKey = cq.color;
                  mapForDesc[colorKey] =
                    (mapForDesc[colorKey] || 0) + quantityToAdd;
                }
              }
            });
          }
        });
      }

      // Also check model.colorQuantities directly (aggregated from stockEntries)
      if (
        model.colorQuantities &&
        Array.isArray(model.colorQuantities) &&
        model.colorQuantities.length > 0
      ) {
        model.colorQuantities.forEach((cq) => {
          if (cq.color && cq.color.trim() !== "") {
            const existingColor = grouped[key].colours.find(
              (c) => c.colour === cq.color
            );
            const quantityToAdd = parseInt(cq.quantity) || 0;
            if (existingColor) {
              // Only update if the quantity from colorQuantities is greater (more recent/accurate)
              if (quantityToAdd > existingColor.quantity) {
                grouped[key].totalQuantity -= existingColor.quantity;
                existingColor.quantity = quantityToAdd;
                grouped[key].totalQuantity += quantityToAdd;
              }
            } else {
              grouped[key].colours.push({
                colour: cq.color,
                quantity: quantityToAdd,
              });
              grouped[key].totalQuantity += quantityToAdd;
            }

            // Also aggregate by combined model-level description tags if present
            const descParts = Array.isArray(model.description)
              ? model.description
              : model.description
              ? [model.description]
              : [];
            const combinedLabel = descParts
              .map((d) => (d || "").toString().trim())
              .filter(Boolean)
              .join(", ");
            if (combinedLabel) {
              if (!grouped[key].descriptionColorMap[combinedLabel]) {
                grouped[key].descriptionColorMap[combinedLabel] = {};
              }
              const mapForDesc =
                grouped[key].descriptionColorMap[combinedLabel];
              const colorKey = cq.color;
              mapForDesc[colorKey] =
                (mapForDesc[colorKey] || 0) + quantityToAdd;
            }
          }
        });
      }

      // Fallback: use old single colour/quantity fields if no colorQuantities found
      if (
        !hasColorsFromStockEntries &&
        (!model.colorQuantities || model.colorQuantities.length === 0) &&
        model.colour &&
        model.colour.trim() !== ""
      ) {
        const modelQuantity = model.quantity || 0;
        const existingColor = grouped[key].colours.find(
          (c) => c.colour === model.colour
        );
        if (existingColor) {
          existingColor.quantity += modelQuantity;
        } else {
          grouped[key].colours.push({
            colour: model.colour,
            quantity: modelQuantity,
          });
        }
        grouped[key].totalQuantity += modelQuantity;

        // Also aggregate fallback colour by combined model-level description tags if present
        const descParts = Array.isArray(model.description)
          ? model.description
          : model.description
          ? [model.description]
          : [];
        const combinedLabel = descParts
          .map((d) => (d || "").toString().trim())
          .filter(Boolean)
          .join(", ");
        if (combinedLabel) {
          if (!grouped[key].descriptionColorMap[combinedLabel]) {
            grouped[key].descriptionColorMap[combinedLabel] = {};
          }
          const mapForDesc =
            grouped[key].descriptionColorMap[combinedLabel];
          const colorKey = model.colour;
          mapForDesc[colorKey] =
            (mapForDesc[colorKey] || 0) + modelQuantity;
        }
      }

      // Inventory value: sum purchasePrice × quantity per stock entry (like Models/AddMoreStock).
      // Also mark groups that have missing purchase prices.
      let modelValueFromEntries = 0;
      let modelHasMissingPrice = false;

      if (
        model.stockEntries &&
        Array.isArray(model.stockEntries) &&
        model.stockEntries.length > 0
      ) {
        model.stockEntries.forEach((entry) => {
          const entryQuantity = Array.isArray(entry.colorQuantities)
            ? entry.colorQuantities.reduce(
                (sum, cq) => sum + (parseInt(cq.quantity) || 0),
                0
              )
            : 0;

          if (entryQuantity <= 0) return;

          const entryPurchasePrice = parseFloat(entry.purchasePrice) || 0;
          if (entryPurchasePrice > 0) {
            modelValueFromEntries += entryQuantity * entryPurchasePrice;
          } else {
            modelHasMissingPrice = true;
          }
        });
      }

      // Fallback for older models without detailed stockEntries: use model-level quantity × purchasePrice
      if (modelValueFromEntries === 0) {
        const qty = model.quantity || 0;
        const purchasePrice = parseFloat(model.purchasePrice) || 0;

        if (qty > 0 && purchasePrice > 0) {
          modelValueFromEntries += qty * purchasePrice;
        } else if (qty > 0) {
          modelHasMissingPrice = true;
        }
      }

      grouped[key].totalValue += modelValueFromEntries;
      if (modelHasMissingPrice) {
        grouped[key].hasMissingPrice = true;
      }
      if (model.purchasedInWarranty) grouped[key].inWarranty = true;
      grouped[key].models.push(model);
    });

    // Convert to array and sort: by selling price if selected, else by lowest purchase price
    const groupedArray = Object.values(grouped);
    if (sortBy === "sellingPrice") {
      groupedArray.sort((a, b) => {
        const pa = parseFloat(a.sellingPrice) || 0;
        const pb = parseFloat(b.sellingPrice) || 0;
        return sortOrder === "asc" ? pa - pb : pb - pa;
      });
    } else {
      groupedArray.sort((a, b) => {
        if (a.lowestPrice === null && b.lowestPrice === null) return 0;
        if (a.lowestPrice === null) return 1;
        if (b.lowestPrice === null) return -1;
        return a.lowestPrice - b.lowestPrice;
      });
    }

    return groupedArray;
  };

  // Get colour for display
  const getColourDisplay = (colour) => {
    const colourMap = {
      red: "#dc3545",
      cherry: "#8B0000",
      blue: "#007bff",
      green: "#28a745",
      black: "#343a40",
      white: "#f8f9fa",
      peacock: "#006994",
      grey: "#808080",
      silver: "#C0C0C0",
      yellow: "#FFFF00",
      "white-black": "#6c757d",
    };
    return colourMap[colour?.toLowerCase()] || "#6c757d";
  };

  // Function to update model price in database
  const updateModelPrice = async (modelId, newPrice) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/models/${modelId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ purchasePrice: parseFloat(newPrice) }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error updating price");
      }

      // Update local state with the updated model
      setModels((prevModels) =>
        prevModels.map((m) => (m._id === modelId ? data.data : m))
      );

      return true;
    } catch (error) {
      console.error("Error updating model price:", error);
      alert(`Error updating price: ${error.message}`);
      return false;
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const handleLogout = () => {
    // Clear session and warning timeouts
    if (window.sessionTimeout) {
      clearTimeout(window.sessionTimeout);
    }
    if (window.warningTimeout) {
      clearTimeout(window.warningTimeout);
    }
    // Remove auth and navigate
    sessionStorage.removeItem("adminAuth");
    navigate("/", { replace: true });
  };

  const handleNavigateOutsideAdmin = (targetPath) => {
    showAdminLeavePrompt(
      () => {
        navigate(targetPath);
      },
      () => {
        if (window.sessionTimeout) {
          clearTimeout(window.sessionTimeout);
        }
        if (window.warningTimeout) {
          clearTimeout(window.warningTimeout);
        }
        sessionStorage.removeItem("adminAuth");
        navigate(targetPath, { replace: true });
      }
    );
  };

  // -------- SPARES HELPERS --------

  // Determine if color tracking is enabled for a spare
  const isColorTrackingEnabled = (spare) => {
    if (!spare) return false;
    if (spare.hasColors === true) return true;
    if (spare.hasColors === false) return false;
    return Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0;
  };

  // Safely parse purchase dates (supports dd/mm/yyyy and ISO strings)
  const parsePurchaseDate = (dateValue) => {
    if (!dateValue || typeof dateValue !== "string") return NaN;

    // Handle dd/mm/yyyy format
    if (dateValue.includes("/")) {
      const parts = dateValue.split("/");
      if (parts.length === 3) {
        const [dayStr, monthStr, yearStr] = parts;
        const day = parseInt(dayStr, 10);
        const month = parseInt(monthStr, 10);
        const year = parseInt(yearStr, 10);
        if (
          !Number.isNaN(day) &&
          !Number.isNaN(month) &&
          !Number.isNaN(year) &&
          day > 0 &&
          month > 0
        ) {
          return new Date(year, month - 1, day).getTime();
        }
      }
    }

    // Fallback to Date parsing for other formats (e.g., ISO)
    const timestamp = new Date(dateValue).getTime();
    return Number.isNaN(timestamp) ? NaN : timestamp;
  };

  // Get latest purchase date from both stockEntries and colorQuantity
  const getLastPurchaseDate = (spare) => {
    if (!spare) return "N/A";

    const allDates = [];

    if (Array.isArray(spare.stockEntries)) {
      spare.stockEntries.forEach((entry) => {
        if (entry && entry.purchaseDate) {
          allDates.push(entry.purchaseDate);
        }
      });
    }

    if (Array.isArray(spare.colorQuantity)) {
      spare.colorQuantity.forEach((cq) => {
        if (cq && cq.purchaseDate) {
          allDates.push(cq.purchaseDate);
        }
      });
    }

    if (allDates.length === 0) return "N/A";

    const dated = allDates
      .map((raw) => ({
        raw,
        time: parsePurchaseDate(raw),
      }))
      .filter((d) => !Number.isNaN(d.time));

    if (dated.length === 0) return "N/A";

    const latest = dated.reduce((max, curr) =>
      curr.time > max.time ? curr : max
    );

    return latest.raw;
  };

  // Total number of spares
  const totalSpares = useMemo(() => spares.length, [spares]);

  // Calculate total inventory value for spares: quantity × purchasePrice
  const totalSparesValue = useMemo(() => {
    if (!Array.isArray(spares) || spares.length === 0) return 0;

    return spares.reduce((sum, spare) => {
      // If color tracking is enabled, use colorQuantity purchase prices
      if (isColorTrackingEnabled(spare) && Array.isArray(spare.colorQuantity)) {
        const valueFromColors = spare.colorQuantity.reduce((subSum, cq) => {
          const qty = cq.quantity || 0;
          const price = cq.purchasePrice || 0;
          return subSum + qty * price;
        }, 0);
        if (valueFromColors > 0) return sum + valueFromColors;
      }

      // Otherwise, fall back to stockEntries
      if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
        const valueFromEntries = spare.stockEntries.reduce((subSum, entry) => {
          const qty = entry.quantity || 0;
          const price = entry.purchasePrice || 0;
          return subSum + qty * price;
        }, 0);
        return sum + valueFromEntries;
      }

      return sum;
    }, 0);
  }, [spares]);

  // Compute low-stock info for each spare
  const lowStockItems = useMemo(() => {
    if (!Array.isArray(spares) || spares.length === 0) return [];

    const items = [];

    spares.forEach((spare) => {
      const colorTracking = isColorTrackingEnabled(spare);

      if (colorTracking && Array.isArray(spare.colorQuantity)) {
        // Find colors that are below their individual min stock levels
        const lowColors = spare.colorQuantity.filter((cq) => {
          const qty = cq.quantity || 0;
          const minLevel = cq.minStockLevel || 0;
          return qty < minLevel;
        });

        if (lowColors.length === 0) return;

        const currentQty = lowColors.reduce(
          (total, cq) => total + (cq.quantity || 0),
          0
        );

        const colorDisplay = lowColors
          .map(
            (cq) =>
              `${cq.color || "N/A"} (${cq.quantity || 0}/${cq.minStockLevel || 0})`
          )
          .join(", ");

        const minStockDisplay = lowColors
          .map((cq) => cq.minStockLevel || 0)
          .join(", ");

        items.push({
          id: spare._id,
          name: spare.name,
          supplierName: spare.supplierName || "N/A",
          models:
            Array.isArray(spare.models) && spare.models.length > 0
              ? spare.models.join(", ")
              : "N/A",
          colorDisplay,
          currentQuantity: currentQty,
          minStockDisplay,
          sellingPrice: spare.sellingPrice || 0,
          status: "Low Stock (Colors)",
          lastPurchaseDate: getLastPurchaseDate(spare),
        });
      } else {
        // Non-color-tracked spare: compare total quantity to global minStockLevel
        let totalQuantity = 0;

        // Match main Spares table logic:
        // Prefer stored `quantity` when present; otherwise sum stockEntries.
        if (typeof spare.quantity === "number") {
          totalQuantity = spare.quantity;
        } else if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
          totalQuantity = spare.stockEntries.reduce(
            (sum, entry) => sum + (entry.quantity || 0),
            0
          );
        }

        const minLevel = spare.minStockLevel || 0;

        if (totalQuantity < minLevel && minLevel > 0) {
          items.push({
            id: spare._id,
            name: spare.name,
            supplierName: spare.supplierName || "N/A",
            models:
              Array.isArray(spare.models) && spare.models.length > 0
                ? spare.models.join(", ")
                : "N/A",
            colorDisplay: "N/A",
            currentQuantity: totalQuantity,
            minStockDisplay: String(minLevel),
            sellingPrice: spare.sellingPrice || 0,
            status: "Low Stock",
            lastPurchaseDate: getLastPurchaseDate(spare),
          });
        }
      }
    });

    return items;
  }, [spares]);

  const lowStockCount = useMemo(
    () => lowStockItems.length,
    [lowStockItems]
  );

  // Batteries admin summary
  const totalBatteryVarieties = useMemo(
    () => (Array.isArray(batteries) ? batteries.length : 0),
    [batteries]
  );

  // Total sets available (sum of totalSets)
  const totalBatterySetsAvailable = useMemo(() => {
    if (!Array.isArray(batteries) || batteries.length === 0) return 0;
    return batteries.reduce(
      (sum, b) => sum + (Number(b?.totalSets) || 0),
      0
    );
  }, [batteries]);

  const getBatteryLastPurchaseDate = (battery) => {
    if (!battery) return "N/A";
    const entries = Array.isArray(battery.stockEntries) ? battery.stockEntries : [];
    if (entries.length === 0) return battery.purchaseDate ? formatDate(battery.purchaseDate) : "N/A";

    const sorted = [...entries].sort(
      (a, b) => new Date(b.purchaseDate || 0) - new Date(a.purchaseDate || 0)
    );
    const latest = sorted[0]?.purchaseDate;
    return latest ? formatDate(latest) : "N/A";
  };

  const batteryLowStockItems = useMemo(() => {
    if (!Array.isArray(batteries) || batteries.length === 0) return [];

    return batteries
      .map((b) => {
        const currentSets = Number(b?.totalSets) || 0;
        const minSets = Number(b?.minStockLevel) || 0;
        if (minSets <= 0) return null;
        if (currentSets >= minSets) return null;

        return {
          id: b._id,
          name: b.name || "N/A",
          batteryType: b.batteryType || "N/A",
          ampereValue: b.ampereValue || "N/A",
          supplierName: b.supplierName || "N/A",
          currentSets,
          minSets,
          lastPurchaseDate: getBatteryLastPurchaseDate(b),
        };
      })
      .filter(Boolean);
  }, [batteries]);

  const batteryLowStockCount = useMemo(
    () => batteryLowStockItems.length,
    [batteryLowStockItems]
  );

  // -------- FINANCE (Profit) --------
  const normalizeDateLabel = (raw) => {
    if (!raw) return "";
    const s = String(raw).trim();
    if (!s) return "";
    if (s.includes("T")) return s.split("T")[0];
    return s;
  };

  const toYmd = (raw) => {
    const s = normalizeDateLabel(raw);
    if (!s) return "";
    // dd/mm/yyyy -> yyyy-mm-dd
    if (s.includes("/")) {
      const parts = s.split("/");
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        if (yyyy && mm && dd) {
          return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(
            2,
            "0"
          )}`;
        }
      }
    }
    return s;
  };

  const isSameDay = (raw, ymd) => toYmd(raw) === ymd;
  const isSameMonth = (raw, yyyyMm) => {
    const s = toYmd(raw);
    return s && s.startsWith(`${yyyyMm}-`);
  };

  const effectiveYmd =
    financeRangeMode === "day"
      ? financeSelectedDate
      : `${financeSelectedMonth}-01`;
  const effectiveMonth =
    financeRangeMode === "month"
      ? financeSelectedMonth
      : financeSelectedDate.slice(0, 7);

  /** Unit cost for profit math: purchase price from the latest dated stock row (not a weighted average). */
  const getSpareUnitCost = (spareId) => {
    if (!spareId) return 0;
    const spare = Array.isArray(spares)
      ? spares.find((s) => String(s._id) === String(spareId))
      : null;
    if (!spare) return 0;

    const rowPurchaseTime = (raw) => {
      if (raw == null || raw === "") return -Infinity;
      if (typeof raw === "string") {
        const t = parsePurchaseDate(raw);
        return Number.isNaN(t) ? -Infinity : t;
      }
      const x = new Date(raw).getTime();
      return Number.isNaN(x) ? -Infinity : x;
    };

    const latestPurchasePrice = (rows, dateKey, priceKey) => {
      if (!Array.isArray(rows) || rows.length === 0) return 0;
      let bestI = -1;
      let bestT = -Infinity;
      rows.forEach((row, i) => {
        if (!row) return;
        const t = rowPurchaseTime(row[dateKey]);
        if (t > bestT || (t === bestT && i > bestI)) {
          bestT = t;
          bestI = i;
        }
      });
      if (bestI >= 0 && bestT > -Infinity) {
        return Number(rows[bestI][priceKey]) || 0;
      }
      const last = rows[rows.length - 1];
      return Number(last?.[priceKey]) || 0;
    };

    if (Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0) {
      return latestPurchasePrice(
        spare.colorQuantity,
        "purchaseDate",
        "purchasePrice"
      );
    }

    if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
      return latestPurchasePrice(
        spare.stockEntries,
        "purchaseDate",
        "purchasePrice"
      );
    }

    return 0;
  };

  const getBatteryUnitCost = (batteryId) => {
    if (!batteryId) return 0;
    const b = Array.isArray(batteries)
      ? batteries.find((x) => String(x._id) === String(batteryId))
      : null;
    if (!b) return 0;
    const entries = Array.isArray(b.stockEntries) ? b.stockEntries : [];
    if (entries.length === 0) return 0;
    const sorted = [...entries].sort(
      (a, c) => new Date(c.purchaseDate || 0) - new Date(a.purchaseDate || 0)
    );
    const latest = sorted[0] || {};
    const perSet =
      latest.batteriesPerSet !== undefined && latest.batteriesPerSet !== null
        ? Number(latest.batteriesPerSet)
        : Number(b.batteriesPerSet) || 0;
    const pricePerSet = Number(latest.purchasePrice) || 0;
    return perSet > 0 ? pricePerSet / perSet : pricePerSet;
  };

  const getChargerUnitCost = (chargerId) => {
    if (!chargerId) return 0;
    const c = Array.isArray(chargers)
      ? chargers.find((x) => String(x._id) === String(chargerId))
      : null;
    if (!c) return 0;
    const entries = Array.isArray(c.stockEntries) ? c.stockEntries : [];
    if (entries.length === 0) return 0;
    const sorted = [...entries].sort(
      (a, b) => new Date(b.purchaseDate || 0) - new Date(a.purchaseDate || 0)
    );
    return Number(sorted[0]?.purchasePrice) || 0;
  };

  const getModelUnitCost = (modelId) => {
    if (!modelId) return 0;
    const m = Array.isArray(models)
      ? models.find((x) => String(x._id) === String(modelId))
      : null;
    if (!m) return 0;
    const direct = Number(m.purchasePrice) || 0;
    if (direct > 0) return direct;
    if (Array.isArray(m.stockEntries) && m.stockEntries.length > 0) {
      const totalQty = m.stockEntries.reduce(
        (sum, e) => sum + (Number(e.quantity) || 0),
        0
      );
      const totalVal = m.stockEntries.reduce((sum, e) => {
        const qty = Number(e.quantity) || 0;
        const price = Number(e.purchasePrice) || 0;
        return sum + qty * price;
      }, 0);
      return totalQty > 0 ? totalVal / totalQty : 0;
    }
    return 0;
  };

  const billRevenue = (bill) => Number(bill?.netAmount) || 0;

  const billEstimatedCost = (bill) => {
    if (!bill) return 0;
    let cost = 0;
    cost += getModelUnitCost(bill.modelId);

    if (bill.withBattery && bill.batteryId && bill.batteryId !== "custom") {
      const type = String(bill.batteryTypeForBill || "").toLowerCase();
      const v = String(bill.batteryVoltageForBill || "");
      const units =
        type === "lead"
          ? v.includes("72")
            ? 6
            : v.includes("60")
            ? 5
            : v.includes("48")
            ? 4
            : 0
          : 1;
      cost += (Number(units) || 0) * getBatteryUnitCost(bill.batteryId);
    }

    if (bill.withCharger && bill.chargerId && bill.chargerId !== "custom") {
      cost += getChargerUnitCost(bill.chargerId);
    }

    if (Array.isArray(bill.accessoryDetails) && bill.accessoryDetails.length > 0) {
      bill.accessoryDetails.forEach((a) => {
        const stored = Number(a?.unitPurchaseCost) || 0;
        cost += stored > 0 ? stored : getSpareUnitCost(a?.id) * 1;
      });
    }

    return cost;
  };

  // Jobcard profit rule (service only, for now):
  // profit = paidAmount - sum(purchaseCost of service spares)
  const buildJobcardServiceProfitDetail = (jc) => {
    const paidAmount = Number(jc?.paidAmount) || 0;
    const parts = Array.isArray(jc?.parts) ? jc.parts : [];
    const serviceParts = parts.filter(
      (p) => p && String(p.partType || "").toLowerCase() === "service"
    );

    const lines = serviceParts
      .map((p) => {
        const qty = Number(p.quantity) || 0;
        const spareId = p.spareId?._id || p.spareId;
        const storedFifo = Number(p.fifoLinePurchaseCost) || 0;
        let unitCost;
        let lineCost;
        if (storedFifo > 0) {
          lineCost = storedFifo;
          unitCost = qty > 0 ? storedFifo / qty : 0;
        } else {
          unitCost = getSpareUnitCost(spareId);
          lineCost = qty * unitCost;
        }
        return {
          name: p.spareName || "N/A",
          quantity: qty,
          unitCost,
          lineCost,
        };
      })
      .filter((l) => l.quantity > 0);

    const totalCost = lines.reduce((sum, l) => sum + (l.lineCost || 0), 0);
    const profit = paidAmount - totalCost;

    return {
      id: jc?._id,
      jobcardNumber: jc?.jobcardNumber || "N/A",
      date: jc?.date || "",
      customerName: jc?.customerName || "N/A",
      paidAmount,
      lines,
      totalCost,
      profit,
    };
  };

  const buildBillProfitDetail = (bill) => {
    const revenue = billRevenue(bill);
    const costBreakdown = [];

    const modelCost = getModelUnitCost(bill?.modelId);
    costBreakdown.push({
      label: bill?.modelPurchased ? `Model: ${bill.modelPurchased}` : "Model",
      cost: modelCost,
    });

    if (bill?.withBattery && bill?.batteryId && bill?.batteryId !== "custom") {
      const type = String(bill?.batteryTypeForBill || "").toLowerCase();
      const v = String(bill?.batteryVoltageForBill || "");
      const units =
        type === "lead"
          ? v.includes("72")
            ? 6
            : v.includes("60")
            ? 5
            : v.includes("48")
            ? 4
            : 0
          : 1;
      const unitCost = getBatteryUnitCost(bill.batteryId);
      costBreakdown.push({
        label: `Battery (${bill?.batteryName || "N/A"})`,
        cost: (Number(units) || 0) * unitCost,
      });
    }

    if (bill?.withCharger && bill?.chargerId && bill?.chargerId !== "custom") {
      costBreakdown.push({
        label: `Charger (${bill?.chargerName || "N/A"})`,
        cost: getChargerUnitCost(bill.chargerId),
      });
    }

    if (Array.isArray(bill?.accessoryDetails) && bill.accessoryDetails.length > 0) {
      bill.accessoryDetails.forEach((a) => {
        const stored = Number(a?.unitPurchaseCost) || 0;
        const lineCost = stored > 0 ? stored : getSpareUnitCost(a?.id) * 1;
        costBreakdown.push({
          label: `Accessory: ${a?.name || "N/A"}`,
          cost: lineCost,
        });
      });
    }

    const totalCost = costBreakdown.reduce((sum, x) => sum + (Number(x.cost) || 0), 0);
    const profit = revenue - totalCost;

    return {
      id: bill?._id,
      billNo: bill?.billNo || "N/A",
      billDate: bill?.billDate || "",
      customerName: bill?.customerName || "N/A",
      revenue,
      costBreakdown,
      totalCost,
      profit,
    };
  };

  const financeTotals = useMemo(() => {
    const billsForDay = (Array.isArray(bills) ? bills : []).filter((b) =>
      isSameDay(b?.billDate, effectiveYmd)
    );
    const billsForMonth = (Array.isArray(bills) ? bills : []).filter((b) =>
      isSameMonth(b?.billDate, effectiveMonth)
    );
    const jobcardsForDay = (Array.isArray(jobcards) ? jobcards : []).filter((j) =>
      isSameDay(j?.date, effectiveYmd)
    );
    const jobcardsForMonth = (Array.isArray(jobcards) ? jobcards : []).filter((j) =>
      isSameMonth(j?.date, effectiveMonth)
    );

    const billDetailsDay = billsForDay.map(buildBillProfitDetail);
    const billDetailsMonth = billsForMonth.map(buildBillProfitDetail);
    const jobcardDetailsDay = jobcardsForDay.map(buildJobcardServiceProfitDetail);
    const jobcardDetailsMonth = jobcardsForMonth.map(buildJobcardServiceProfitDetail);

    const sumProfit = (list) => list.reduce((sum, x) => sum + (Number(x.profit) || 0), 0);
    const sumRevenue = (list) => list.reduce((sum, x) => sum + (Number(x.revenue) || 0), 0);
    const sumPaid = (list) => list.reduce((sum, x) => sum + (Number(x.paidAmount) || 0), 0);

    return {
      bill: {
        day: {
          revenue: sumRevenue(billDetailsDay),
          profit: sumProfit(billDetailsDay),
          details: billDetailsDay,
        },
        month: {
          revenue: sumRevenue(billDetailsMonth),
          profit: sumProfit(billDetailsMonth),
          details: billDetailsMonth,
        },
      },
      jobcard: {
        day: {
          paid: sumPaid(jobcardDetailsDay),
          profit: sumProfit(jobcardDetailsDay),
          details: jobcardDetailsDay,
        },
        month: {
          paid: sumPaid(jobcardDetailsMonth),
          profit: sumProfit(jobcardDetailsMonth),
          details: jobcardDetailsMonth,
        },
      },
    };
  }, [
    bills,
    jobcards,
    spares,
    models,
    batteries,
    chargers,
    financeRangeMode,
    financeSelectedDate,
    financeSelectedMonth,
  ]);

  // Total inventory value across all batteries:
  // For each stock entry: (purchasePricePerSet / batteriesPerSet) * entry.quantity
  const totalBatteriesValue = useMemo(() => {
    if (!Array.isArray(batteries) || batteries.length === 0) return 0;

    const getPerSetForEntry = (battery, entry) => {
      const entryPerSet =
        entry?.batteriesPerSet !== undefined && entry?.batteriesPerSet !== null
          ? Number(entry.batteriesPerSet)
          : Number(battery?.batteriesPerSet);
      return Number.isFinite(entryPerSet) ? entryPerSet : 0;
    };

    return batteries.reduce((sum, battery) => {
      if (!battery) return sum;
      const entries = Array.isArray(battery.stockEntries)
        ? battery.stockEntries
        : [];
      if (entries.length === 0) return sum;

      const valueFromEntries = entries.reduce((subSum, entry) => {
        const qty = Number(entry?.quantity) || 0; // total batteries (pieces) in this entry
        const pricePerSet = Number(entry?.purchasePrice) || 0; // purchase price per set
        const perSet = getPerSetForEntry(battery, entry);
        const perBatteryPrice = perSet > 0 ? pricePerSet / perSet : pricePerSet;
        return subSum + qty * perBatteryPrice;
      }, 0);

      return sum + valueFromEntries;
    }, 0);
  }, [batteries]);

  const sidebarItems = [
    { id: "spares", name: "Spares", icon: FaTools, color: "#007bff" },
    {
      id: "batteries",
      name: "Batteries",
      icon: FaBatteryFull,
      color: "#28a745",
    },
    { id: "models", name: "Models", icon: FaMotorcycle, color: "#ffc107" },
    { id: "finance", name: "Finance", icon: FaMoneyBillWave, color: "#dc3545" },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "spares":
        return (
          <div className="admin-content">
            <h2>Spares Management</h2>

            {/* Summary cards */}
            <div className="admin-cards">
              <div className="admin-card">
                <h3>Total Spares</h3>
                <p className="card-number">
                  {sparesLoading ? "…" : totalSpares}
                </p>
                <small>Unique spare items</small>
              </div>
              <div className="admin-card">
                <h3>Low Stock</h3>
                <p
                  className="card-number"
                  style={{ color: lowStockCount > 0 ? "#dc2626" : "#16a34a" }}
                >
                  {sparesLoading ? "…" : lowStockCount}
                </p>
                <small>Items below minimum stock level</small>
              </div>
              <div className="admin-card">
                <h3>Total Value</h3>
                <p className="card-number">
                  ₹{sparesLoading ? "…" : totalSparesValue.toLocaleString()}
                </p>
                <small>Quantity × purchase price</small>
              </div>
            </div>

            {/* Actions */}
            <div className="admin-actions" style={{ marginBottom: "1.5rem" }}>
              <button
                className="btn btn-primary"
                onClick={() => handleNavigateOutsideAdmin("/spares/add")}
              >
                Add New Spare
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleNavigateOutsideAdmin("/spares/all")}
              >
                View All Spares
              </button>
              <button
                className="btn btn-info"
                onClick={() => setShowLowStockModal(true)}
                disabled={sparesLoading}
              >
                Low Stock Report
              </button>
            </div>

            {/* Error / loading state */}
            {sparesLoading && (
              <div
                style={{
                  padding: "1rem 0",
                  color: "#6b7280",
                  fontSize: "0.9rem",
                }}
              >
                Loading spares data…
              </div>
            )}
            {sparesError && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#fef2f2",
                  color: "#b91c1c",
                  fontSize: "0.875rem",
                }}
              >
                {sparesError}
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: "0.75rem", padding: "0.25rem 0.75rem" }}
                  onClick={fetchSparesForAdmin}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Low Stock Report Modal */}
            {showLowStockModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(15, 23, 42, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 50,
                }}
                onClick={() => setShowLowStockModal(false)}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "0.75rem",
                    maxWidth: "1100px",
                    width: "95%",
                    maxHeight: "80vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow:
                      "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: "1rem 1.5rem",
                      borderBottom: "1px solid #e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "1.125rem",
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        Low Stock Report
                      </h3>
                      <p
                        style={{
                          margin: "0.25rem 0 0 0",
                          fontSize: "0.875rem",
                          color: "#6b7280",
                        }}
                      >
                        Showing spares where quantity is below minimum stock
                        level.
                      </p>
                    </div>
                    <button
                      className="btn"
                      style={{
                        backgroundColor: "#ef4444",
                        color: "white",
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.875rem",
                      }}
                      onClick={() => setShowLowStockModal(false)}
                    >
                      Close
                    </button>
                  </div>

                  <div style={{ padding: "1rem 1.5rem", overflow: "auto" }}>
                    {lowStockItems.length === 0 ? (
                      <div
                        style={{
                          padding: "2rem",
                          textAlign: "center",
                          color: "#6b7280",
                          fontSize: "0.95rem",
                        }}
                      >
                        No items are currently below their minimum stock level.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "0.85rem",
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor: "#f9fafb",
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              {[
                                "Spare Name",
                                "Supplier",
                                "Models",
                                "Color (Low Stock)",
                                "Current Quantity",
                                "Min Stock Level",
                                "Selling Price",
                                "Last Purchase Date",
                                "Status",
                              ].map((header) => (
                                <th
                                  key={header}
                                  style={{
                                    padding: "0.75rem 0.75rem",
                                    textAlign: "left",
                                    fontWeight: 600,
                                    color: "#374151",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    borderRight: "1px solid #e5e7eb",
                                  }}
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lowStockItems.map((item) => (
                              <tr
                                key={item.id}
                                style={{
                                  borderBottom: "1px solid #f3f4f6",
                                  backgroundColor: "white",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    fontWeight: 600,
                                    color: "#111827",
                                  }}
                                >
                                  {item.name}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#4b5563",
                                  }}
                                >
                                  {item.supplierName}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#4b5563",
                                  }}
                                >
                                  {item.models}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#b91c1c",
                                    fontWeight: 500,
                                  }}
                                >
                                  {item.colorDisplay}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#b91c1c",
                                    fontWeight: 600,
                                  }}
                                >
                                  {item.currentQuantity}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#4b5563",
                                  }}
                                >
                                  {item.minStockDisplay}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#111827",
                                    fontWeight: 600,
                                  }}
                                >
                                  ₹{item.sellingPrice.toFixed(2)}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#4b5563",
                                  }}
                                >
                                  {item.lastPurchaseDate}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#b91c1c",
                                    fontWeight: 600,
                                  }}
                                >
                                  {item.status}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case "batteries":
        return (
          <div className="admin-content">
            <h2>Batteries Management</h2>
            <div className="admin-cards">
              <div className="admin-card">
                <h3>Battery Varieties</h3>
                <p className="card-number">
                  {batteriesLoading ? "…" : totalBatteryVarieties}
                </p>
                <small>Unique battery types</small>
              </div>
              <div className="admin-card">
                <h3>Total Sets Available</h3>
                <p className="card-number">
                  {batteriesLoading ? "…" : totalBatterySetsAvailable}
                </p>
                <small>Total sets in stock</small>
              </div>
              <div className="admin-card">
                <h3>Total Value</h3>
                <p className="card-number">
                  ₹
                  {batteriesLoading
                    ? "…"
                    : totalBatteriesValue.toLocaleString("en-IN")}
                </p>
                <small title="Calculated from battery stock entries using per-battery cost derived from each entry’s purchase price and batteries-per-set.">
                  Inventory value (stock entries)
                </small>
              </div>
            </div>
            {batteriesError && (
              <div style={{ color: "#dc2626", margin: "0.75rem 0" }}>
                {batteriesError}
              </div>
            )}
            <div className="admin-actions" style={{ marginBottom: "1.5rem" }}>
              <button
                className="btn btn-primary"
                onClick={() => handleNavigateOutsideAdmin("/batteries")}
              >
                Add New Battery
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleNavigateOutsideAdmin("/batteries")}
              >
                View All Batteries
              </button>
              <button
                className="btn btn-info"
                onClick={() => setShowBatteryLowStockModal(true)}
                disabled={batteriesLoading}
              >
                Low Stock Report{" "}
                {!batteriesLoading && batteryLowStockCount > 0
                  ? `(${batteryLowStockCount})`
                  : ""}
              </button>
            </div>

            {/* Battery Low Stock Report Modal */}
            {showBatteryLowStockModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(15, 23, 42, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 50,
                }}
                onClick={() => setShowBatteryLowStockModal(false)}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "0.75rem",
                    maxWidth: "1000px",
                    width: "95%",
                    maxHeight: "80vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow:
                      "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: "1rem 1.5rem",
                      borderBottom: "1px solid #e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "1.125rem",
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        Low Stock Report
                      </h3>
                      <p
                        style={{
                          margin: "0.25rem 0 0 0",
                          fontSize: "0.875rem",
                          color: "#6b7280",
                        }}
                      >
                        Showing batteries where sets are below minimum stock level.
                      </p>
                    </div>
                    <button
                      className="btn"
                      style={{
                        backgroundColor: "#ef4444",
                        color: "white",
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.875rem",
                      }}
                      onClick={() => setShowBatteryLowStockModal(false)}
                    >
                      Close
                    </button>
                  </div>

                  <div style={{ padding: "1rem 1.5rem", overflow: "auto" }}>
                    {batteryLowStockItems.length === 0 ? (
                      <div
                        style={{
                          padding: "2rem",
                          textAlign: "center",
                          color: "#6b7280",
                          fontSize: "0.95rem",
                        }}
                      >
                        No batteries are currently below their minimum stock level.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "0.85rem",
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor: "#f9fafb",
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              {[
                                "Battery Name",
                                "Type",
                                "Ampere",
                                "Supplier",
                                "Current Sets",
                                "Min Sets",
                                "Last Purchase Date",
                              ].map((header) => (
                                <th
                                  key={header}
                                  style={{
                                    padding: "0.75rem 0.75rem",
                                    textAlign: "left",
                                    fontWeight: 600,
                                    color: "#374151",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    borderRight: "1px solid #e5e7eb",
                                  }}
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {batteryLowStockItems.map((item) => (
                              <tr
                                key={item.id}
                                style={{
                                  borderBottom: "1px solid #f3f4f6",
                                  backgroundColor: "white",
                                }}
                              >
                                <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                                  {item.name}
                                </td>
                                <td style={{ padding: "0.75rem" }}>
                                  {item.batteryType}
                                </td>
                                <td style={{ padding: "0.75rem" }}>
                                  {item.ampereValue}
                                </td>
                                <td style={{ padding: "0.75rem" }}>
                                  {item.supplierName}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#b91c1c",
                                    fontWeight: 600,
                                  }}
                                >
                                  {item.currentSets}
                                </td>
                                <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                                  {item.minSets}
                                </td>
                                <td style={{ padding: "0.75rem" }}>
                                  {item.lastPurchaseDate}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case "models": {
        console.log("Rendering models section, models data:", models);
        const groupedModels = getModelsGroupedByNameAndCompany();
        const modelsTotalValue = groupedModels.reduce(
          (acc, group) => acc + (group.totalValue || 0),
          0
        );
        const hasMissingPrice = groupedModels.some(
          (group) => group.hasMissingPrice
        );

        return (
          <div className="admin-content">
            <h2>Models Management</h2>
            <div className="admin-cards">
              <div className="admin-card">
                <h3>Total Models</h3>
                <p className="card-number">{groupedModels.length}</p>
                <small>All vehicle models</small>
              </div>
              <div className="admin-card">
                <h3>Total Quantity</h3>
                <p className="card-number">
                  {groupedModels.reduce(
                    (sum, group) => sum + (group.totalQuantity || 0),
                    0
                  )}
                </p>
                <small>All vehicles in stock</small>
              </div>
              <div className="admin-card">
                <h3>Total Value</h3>
                <p className="card-number">
                  ₹{modelsTotalValue.toLocaleString("en-IN")}
                </p>
                <small>
                  {hasMissingPrice
                    ? "⚠️ Some stock entries are missing purchase price. Enter prices for best accuracy."
                    : "Inventory value (all stock entries up to date)."}
                </small>
              </div>
            </div>

            {/* Search and Filter Section */}
            <div
              className="admin-search-section"
              style={{
                background: "white",
                padding: "1.5rem",
                borderRadius: "8px",
                marginBottom: "2rem",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <h3 style={{ margin: "0 0 1rem 0", color: "#333" }}>
                Search & Filter Models
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                  gap: "1rem",
                  alignItems: "end",
                }}
              >
                {/* Search Input */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                      color: "#495057",
                    }}
                  >
                    Search Models:
                  </label>
                  <input
                    type="text"
                    placeholder="Search by name, company, or colour..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>

                {/* Company Filter */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                      color: "#495057",
                    }}
                  >
                    Company:
                  </label>
                  <select
                    value={filterCompany}
                    onChange={(e) => setFilterCompany(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <option value="all">All Companies</option>
                    {companies.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stock Filter */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                      color: "#495057",
                    }}
                  >
                    Stock Status:
                  </label>
                  <select
                    value={filterStock}
                    onChange={(e) => setFilterStock(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <option value="all">All Stock</option>
                    <option value="instock">In Stock</option>
                    <option value="outofstock">Out of Stock</option>
                  </select>
                </div>

                {/* Sort Options */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                      color: "#495057",
                    }}
                  >
                    Sort By:
                  </label>
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split("-");
                      setSortBy(field);
                      setSortOrder(order);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <option value="sellingPrice-asc">
                      Price (Low to High)
                    </option>
                    <option value="sellingPrice-desc">
                      Price (High to Low)
                    </option>
                  </select>
                </div>
              </div>

              {/* Results Summary */}
              <div
                style={{
                  marginTop: "1rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #dee2e6",
                }}
              >
                <span style={{ color: "#6c757d", fontSize: "0.9rem" }}>
                  Showing {groupedModels.length} model groups ({models.length}{" "}
                  total models)
                  {searchTerm && ` for "${searchTerm}"`}
                  {filterCompany !== "all" && ` in ${filterCompany}`}
                  {filterStock !== "all" &&
                    ` (${
                      filterStock === "instock" ? "in stock" : "out of stock"
                    })`}
                </span>
              </div>
            </div>

            {/* Models Table */}
            <div className="admin-table-container">
              <h3>Models Results (Grouped by Name & Company)</h3>
              {modelsLoading ? (
                <div style={{ padding: "2rem", textAlign: "center" }}>
                  <p>Loading models...</p>
                </div>
              ) : modelsError ? (
                <div
                  style={{
                    padding: "1rem",
                    color: "#dc3545",
                    backgroundColor: "#f8d7da",
                    borderRadius: "4px",
                    marginBottom: "1rem",
                  }}
                >
                  <strong>Error:</strong> {modelsError}
                  <button
                    className="btn btn-primary"
                    onClick={fetchModels}
                    style={{ marginLeft: "1rem" }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    background: "white",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    style={{
                      padding: "1.5rem",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <h3
                      style={{
                        margin: "0",
                        color: "#111827",
                        fontSize: "1.125rem",
                        fontWeight: "600",
                      }}
                    >
                      Models Inventory
                    </h3>
                    <p
                      style={{
                        margin: "0.5rem 0 0 0",
                        color: "#6b7280",
                        fontSize: "0.875rem",
                      }}
                    >
                      Grouped by model name and company with color variants
                    </p>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.875rem",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "#f9fafb",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                              borderRight: "1px solid #e5e7eb",
                            }}
                            onClick={() => handleSort("modelName")}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#f3f4f6")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "#f9fafb")
                            }
                          >
                            Model Name{" "}
                            {sortBy === "modelName" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </th>
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                              borderRight: "1px solid #e5e7eb",
                            }}
                            onClick={() => handleSort("company")}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#f3f4f6")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "#f9fafb")
                            }
                          >
                            Company{" "}
                            {sortBy === "company" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </th>
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              borderRight: "1px solid #e5e7eb",
                              width: "15%",
                            }}
                          >
                            Colors
                          </th>
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                              borderRight: "1px solid #e5e7eb",
                            }}
                            onClick={() => handleSort("quantity")}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#f3f4f6")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "transparent")
                            }
                          >
                            Quantity{" "}
                            {sortBy === "quantity" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </th>
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                              borderRight: "1px solid #e5e7eb",
                            }}
                            onClick={() => handleSort("sellingPrice")}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#f3f4f6")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "#f9fafb")
                            }
                          >
                            Selling Price{" "}
                            {sortBy === "sellingPrice" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </th>
                          {/* Unit Price, Total Value, and Warranty columns removed as requested */}
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              borderRight: "1px solid #e5e7eb",
                            }}
                          >
                            Stock Status
                          </th>
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              borderRight: "1px solid #e5e7eb",
                            }}
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedModels.length === 0 ? (
                          <tr>
                            <td
                              colSpan="7"
                              style={{
                                padding: "4rem 2rem",
                                textAlign: "center",
                                color: "#6b7280",
                                fontSize: "1rem",
                                backgroundColor: "#fafafa",
                              }}
                            >
                              <div
                                style={{
                                  marginBottom: "1rem",
                                  fontSize: "2rem",
                                }}
                              >
                                📦
                              </div>
                              <div
                                style={{
                                  marginBottom: "0.5rem",
                                  fontWeight: "600",
                                  fontSize: "1.125rem",
                                  color: "#374151",
                                }}
                              >
                                {searchTerm ||
                                filterCompany !== "all" ||
                                filterStock !== "all"
                                  ? "No models found matching your criteria"
                                  : "No models available"}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.875rem",
                                  color: "#9ca3af",
                                }}
                              >
                                {searchTerm ||
                                filterCompany !== "all" ||
                                filterStock !== "all"
                                  ? "Try adjusting your search or filters"
                                  : "Add your first model to get started"}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          groupedModels.map((group, index) => (
                            <tr
                              key={`${group.modelName}-${group.company}-${group.purchaseDate}-${group.purchasedInWarranty}`}
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                backgroundColor:
                                  index % 2 === 0 ? "#ffffff" : "#fafafa",
                                transition: "background-color 0.15s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#f9fafb")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  index % 2 === 0 ? "#ffffff" : "#fafafa")
                              }
                            >
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  fontWeight: "600",
                                  color: "#111827",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                <div>{group.modelName || "N/A"}</div>
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  color: "#374151",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                {group.company || "N/A"}
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.35rem",
                                    alignItems: "flex-start",
                                    lineHeight: "1.2",
                                  }}
                                >
                                  {group.descriptionColorMap &&
                                  Object.keys(group.descriptionColorMap)
                                    .length > 0
                                    ? // Show colours grouped by description tags
                                      Object.entries(
                                        group.descriptionColorMap
                                      ).map(([descLabel, coloursByDesc]) => (
                                        <div
                                          key={descLabel}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.4rem",
                                            flexWrap: "wrap",
                                            width: "100%",
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: "0.75rem",
                                              fontWeight: 600,
                                              color: "#374151",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {descLabel} -
                                          </span>
                                          <div
                                            style={{
                                              display: "flex",
                                              flexWrap: "wrap",
                                              gap: "0.25rem",
                                            }}
                                          >
                                            {Object.entries(
                                              coloursByDesc
                                            ).map(
                                              (
                                                [colourName, qty],
                                                colourIndex
                                              ) => (
                                                <div
                                                  key={`${descLabel}-${colourName}-${colourIndex}`}
                                                  style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.2rem",
                                                    backgroundColor: "#f8fafc",
                                                    padding: "0.25rem 0.35rem",
                                                    borderRadius: "999px",
                                                    border:
                                                      "1px solid #e2e8f0",
                                                    fontSize: "0.75rem",
                                                    lineHeight: "1",
                                                  }}
                                                  title={`${colourName || "N/A"}: ${
                                                    qty || 0
                                                  } units`}
                                                >
                                                  {colourName
                                                    ?.toLowerCase() ===
                                                  "white-black" ? (
                                                    <div
                                                      style={{
                                                        width: "14px",
                                                        height: "14px",
                                                        borderRadius: "50%",
                                                        border:
                                                          "1px solid #cbd5e1",
                                                        boxShadow:
                                                          "0 1px 2px rgba(0,0,0,0.1)",
                                                        flexShrink: 0,
                                                        position: "relative",
                                                        overflow: "hidden",
                                                      }}
                                                    >
                                                      <div
                                                        style={{
                                                          position: "absolute",
                                                          left: 0,
                                                          top: 0,
                                                          width: "50%",
                                                          height: "100%",
                                                          backgroundColor:
                                                            "#FFFFFF",
                                                        }}
                                                      />
                                                      <div
                                                        style={{
                                                          position: "absolute",
                                                          right: 0,
                                                          top: 0,
                                                          width: "50%",
                                                          height: "100%",
                                                          backgroundColor:
                                                            "#000000",
                                                        }}
                                                      />
                                                    </div>
                                                  ) : (
                                                    <div
                                                      style={{
                                                        width: "14px",
                                                        height: "14px",
                                                        borderRadius: "50%",
                                                        backgroundColor:
                                                          getColourDisplay(
                                                            colourName
                                                          ),
                                                        border:
                                                          colourName
                                                            ?.toLowerCase() ===
                                                          "white"
                                                            ? "1px solid #cbd5e1"
                                                            : "none",
                                                        boxShadow:
                                                          "0 1px 2px rgba(0,0,0,0.1)",
                                                        flexShrink: 0,
                                                      }}
                                                    />
                                                  )}
                                                  <span
                                                    style={{
                                                      fontSize: "0.75rem",
                                                      color: "#475569",
                                                      fontWeight: "500",
                                                    }}
                                                  >
                                                    {qty}
                                                  </span>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      ))
                                    : // Fallback: simple colour list when no descriptions available
                                      group.colours.map(
                                        (colourItem, colourIndex) => (
                                          <div
                                            key={colourIndex}
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "0.2rem",
                                              backgroundColor: "#f8fafc",
                                              padding: "0.3rem 0.4rem",
                                              borderRadius: "0.3rem",
                                              border: "1px solid #e2e8f0",
                                              transition: "all 0.15s",
                                              cursor: "default",
                                              fontSize: "0.8rem",
                                              lineHeight: "1",
                                              minWidth: "40px",
                                              justifyContent: "center",
                                            }}
                                            title={`${
                                              colourItem.colour || "N/A"
                                            }: ${colourItem.quantity} units`}
                                          >
                                            {colourItem.colour
                                              ?.toLowerCase() ===
                                            "white-black" ? (
                                              <div
                                                style={{
                                                  width: "16px",
                                                  height: "16px",
                                                  borderRadius: "50%",
                                                  border:
                                                    "1px solid #cbd5e1",
                                                  boxShadow:
                                                    "0 1px 2px rgba(0,0,0,0.1)",
                                                  flexShrink: 0,
                                                  position: "relative",
                                                  overflow: "hidden",
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    position: "absolute",
                                                    left: 0,
                                                    top: 0,
                                                    width: "50%",
                                                    height: "100%",
                                                    backgroundColor:
                                                      "#FFFFFF",
                                                  }}
                                                />
                                                <div
                                                  style={{
                                                    position: "absolute",
                                                    right: 0,
                                                    top: 0,
                                                    width: "50%",
                                                    height: "100%",
                                                    backgroundColor:
                                                      "#000000",
                                                  }}
                                                />
                                              </div>
                                            ) : (
                                              <div
                                                style={{
                                                  width: "16px",
                                                  height: "16px",
                                                  borderRadius: "50%",
                                                  backgroundColor:
                                                    getColourDisplay(
                                                      colourItem.colour
                                                    ),
                                                  border:
                                                    colourItem.colour?.toLowerCase() ===
                                                    "white"
                                                      ? "1px solid #cbd5e1"
                                                      : "none",
                                                  boxShadow:
                                                    "0 1px 2px rgba(0,0,0,0.1)",
                                                  flexShrink: 0,
                                                }}
                                              />
                                            )}
                                            <span
                                              style={{
                                                fontSize: "0.75rem",
                                                color: "#475569",
                                                fontWeight: "500",
                                              }}
                                            >
                                              {colourItem.quantity}
                                            </span>
                                          </div>
                                        )
                                      )}
                                  <button
                                    onClick={() => {
                                      if (group.models.length > 0) {
                                        handleNavigateOutsideAdmin(
                                          `/models/add?modelId=${group.models[0]._id}&admin=true`
                                        );
                                      }
                                    }}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "0.2rem",
                                      backgroundColor: "#10b981",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "0.25rem",
                                      cursor: "pointer",
                                      fontSize: "0.7rem",
                                      fontWeight: "500",
                                      padding: "0.2rem 0.4rem",
                                      transition: "all 0.15s",
                                      minWidth: "40px",
                                      height: "28px",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.backgroundColor =
                                        "#059669";
                                      e.target.style.transform =
                                        "translateY(-1px)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.backgroundColor =
                                        "#10b981";
                                      e.target.style.transform =
                                        "translateY(0)";
                                    }}
                                    title="Add more colors"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                {group.totalQuantity || 0}
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                  color: "#374151",
                                }}
                              >
                                {group.sellingPrice != null &&
                                group.sellingPrice !== ""
                                  ? `₹${parseFloat(
                                      group.sellingPrice
                                    ).toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                  : "—"}
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                <span
                                  style={{
                                    background:
                                      group.totalQuantity > 0
                                        ? "#10b981"
                                        : "#ef4444",
                                    color: "white",
                                    padding: "0.375rem 0.875rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.8125rem",
                                    fontWeight: "500",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.375rem",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: "4px",
                                      height: "4px",
                                      borderRadius: "50%",
                                      backgroundColor: "currentColor",
                                    }}
                                  />
                                  {group.totalQuantity > 0
                                    ? "In Stock"
                                    : "Out of Stock"}
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "0.5rem",
                                    justifyContent: "center",
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      // Navigate to edit page for the first model in this group
                                      if (group.models.length > 0) {
                                        handleNavigateOutsideAdmin(
                                          `/models/edit/${group.models[0]._id}?admin=true`
                                        );
                                      }
                                    }}
                                    style={{
                                      padding: "0.25rem 0.5rem",
                                      fontSize: "0.7rem",
                                      backgroundColor: "#3b82f6",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "0.25rem",
                                      cursor: "pointer",
                                      fontWeight: "400",
                                      transition: "all 0.15s",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      minWidth: "24px",
                                      height: "24px",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.backgroundColor =
                                        "#2563eb";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.backgroundColor =
                                        "#3b82f6";
                                    }}
                                    title="Edit model"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (group.models.length === 0) return;

                                      const confirmDelete = window.confirm(
                                        `Are you sure you want to delete ${group.models.length} model(s) for ${group.modelName} - ${group.company}? This action cannot be undone.`
                                      );

                                      if (!confirmDelete) return;

                                      try {
                                        let deletedCount = 0;
                                        for (const model of group.models) {
                                          const response = await fetch(
                                            `http://localhost:5000/api/models/${model._id}`,
                                            {
                                              method: "DELETE",
                                            }
                                          );

                                          if (response.ok) {
                                            deletedCount++;
                                          }
                                        }

                                        // Refresh the models list
                                        await fetchModels();

                                        alert(
                                          `Successfully deleted ${deletedCount} model(s) for ${group.modelName} - ${group.company}`
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Error deleting models:",
                                          error
                                        );
                                        alert(
                                          `Error deleting models: ${error.message}`
                                        );
                                      }
                                    }}
                                    style={{
                                      padding: "0.25rem 0.5rem",
                                      fontSize: "0.7rem",
                                      backgroundColor: "#ef4444",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "0.25rem",
                                      cursor: "pointer",
                                      fontWeight: "400",
                                      transition: "all 0.15s",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      minWidth: "24px",
                                      height: "24px",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.backgroundColor =
                                        "#dc2626";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.backgroundColor =
                                        "#ef4444";
                                    }}
                                    title="Delete model(s)"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Actions */}
            <div className="admin-actions">
              <button
                className="btn btn-primary"
                onClick={() => navigate("/models/add?admin=true")}
              >
                Add New Model
              </button>
            </div>
          </div>
        );
      }
      case "finance": {
        const billBucket =
          financeRangeMode === "day"
            ? financeTotals.bill.day
            : financeTotals.bill.month;
        const jobcardBucket =
          financeRangeMode === "day"
            ? financeTotals.jobcard.day
            : financeTotals.jobcard.month;
        const financePeriodLabel =
          financeRangeMode === "day"
            ? new Date(`${financeSelectedDate}T12:00:00`).toLocaleDateString(
                "en-IN",
                {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }
              )
            : new Date(`${financeSelectedMonth}-01T12:00:00`).toLocaleDateString(
                "en-IN",
                { month: "long", year: "numeric" }
              );
        const financeInputStyle = {
          padding: "0.5rem 0.75rem",
          borderRadius: "4px",
          border: "1px solid #ced4da",
          fontSize: "0.9rem",
          minWidth: "160px",
          fontFamily: "inherit",
        };

        return (
          <div className="admin-content">
            <h2>Finance Management</h2>

            {financeSubView !== null && (
              <div
                className="admin-actions"
                style={{
                  marginBottom: "1rem",
                  width: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => setFinanceSubView(null)}
                >
                  ← Back to finance
                </button>
              </div>
            )}

            {financeSubView !== null && (
              <div
                className="admin-actions"
                style={{
                  marginBottom: "1.5rem",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#666", fontSize: "0.9rem" }}>Period</span>
                <button
                  type="button"
                  className={
                    financeRangeMode === "day" ? "btn btn-primary" : "btn btn-secondary"
                  }
                  onClick={() => setFinanceRangeMode("day")}
                >
                  Date
                </button>
                <button
                  type="button"
                  className={
                    financeRangeMode === "month" ? "btn btn-primary" : "btn btn-secondary"
                  }
                  onClick={() => setFinanceRangeMode("month")}
                >
                  Month
                </button>
                {financeRangeMode === "day" ? (
                  <input
                    type="date"
                    value={financeSelectedDate}
                    onChange={(e) => setFinanceSelectedDate(e.target.value)}
                    aria-label="Select date"
                    style={financeInputStyle}
                  />
                ) : (
                  <input
                    type="month"
                    value={financeSelectedMonth}
                    onChange={(e) => setFinanceSelectedMonth(e.target.value)}
                    aria-label="Select month"
                    style={financeInputStyle}
                  />
                )}
              </div>
            )}

            {financeSubView === null && (
              <div className="admin-finance-landing">
                <div className="admin-finance-tile-grid">
                  <button
                    type="button"
                    className="admin-finance-tile"
                    onClick={() => setFinanceSubView("jobcards")}
                  >
                    Jobcard
                  </button>
                  <button
                    type="button"
                    className="admin-finance-tile"
                    onClick={() => setFinanceSubView("bills")}
                  >
                    Bills
                  </button>
                </div>
              </div>
            )}

            {/* Bills Profit (full section) */}
              {financeSubView === "bills" && (
                <div
                  className="admin-card"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    marginBottom: 0,
                  }}
                >
                <div
                  style={{
                    padding: "1rem 1.5rem",
                    borderBottom: "1px solid #e9ecef",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#333", fontSize: "1.05rem" }}>
                      Bills — profit breakdown
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                      {financePeriodLabel} · net revenue minus model, battery, charger, and
                      accessories cost
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.8rem", color: "#666" }}>Profit</div>
                    <div
                      className="card-number"
                      style={{
                        margin: 0,
                        fontSize: "1.65rem",
                        color:
                          (billBucket.profit || 0) >= 0 ? "#198754" : "#dc3545",
                      }}
                    >
                      ₹
                      {billsLoading
                        ? "…"
                        : (billBucket.profit || 0).toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.15rem" }}>
                      Net revenue ₹
                      {billsLoading
                        ? "…"
                        : (billBucket.revenue || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "1rem 1.5rem" }}>
                  {billsLoading ? (
                    <div style={{ color: "#6b7280" }}>Loading bills…</div>
                  ) : billBucket.details.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>
                      No bills in this{" "}
                      {financeRangeMode === "day" ? "day" : "month"}.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {billBucket.details.slice(0, 25).map((b) => (
                        <details
                          key={b.id}
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: "0.5rem",
                            padding: "0.75rem 0.9rem",
                            background: "#fafafa",
                          }}
                        >
                          <summary
                            style={{
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "1rem",
                              listStyle: "none",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: "#111827" }}>
                                Bill {b.billNo} • {b.billDate}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.85rem",
                                  color: "#6b7280",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {b.customerName}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                                Profit
                              </div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  color: b.profit >= 0 ? "#16a34a" : "#dc2626",
                                }}
                              >
                                ₹{(b.profit || 0).toLocaleString("en-IN")}
                              </div>
                            </div>
                          </summary>

                          <div style={{ marginTop: "0.75rem" }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 140px",
                                gap: "0.5rem 1rem",
                                fontSize: "0.9rem",
                              }}
                            >
                              <div style={{ color: "#374151", fontWeight: 700 }}>
                                Revenue (Net Amount)
                              </div>
                              <div style={{ textAlign: "right", fontWeight: 700 }}>
                                ₹{(b.revenue || 0).toLocaleString("en-IN")}
                              </div>

                              <div
                                style={{
                                  gridColumn: "1 / -1",
                                  height: "1px",
                                  background: "#e5e7eb",
                                  margin: "0.25rem 0",
                                }}
                              />

                              {b.costBreakdown.map((c, idx) => (
                                <div
                                  key={`${b.id}-c-${idx}`}
                                  style={{
                                    display: "contents",
                                  }}
                                >
                                  <div style={{ color: "#374151" }}>{c.label}</div>
                                  <div style={{ textAlign: "right", color: "#111827" }}>
                                    ₹{(Number(c.cost) || 0).toLocaleString("en-IN")}
                                  </div>
                                </div>
                              ))}

                              <div
                                style={{
                                  gridColumn: "1 / -1",
                                  height: "1px",
                                  background: "#e5e7eb",
                                  margin: "0.25rem 0",
                                }}
                              />

                              <div style={{ fontWeight: 800, color: "#111827" }}>
                                Total Cost
                              </div>
                              <div style={{ textAlign: "right", fontWeight: 800 }}>
                                ₹{(b.totalCost || 0).toLocaleString("en-IN")}
                              </div>

                              <div style={{ fontWeight: 900, color: "#111827" }}>
                                Profit
                              </div>
                              <div
                                style={{
                                  textAlign: "right",
                                  fontWeight: 900,
                                  color: b.profit >= 0 ? "#16a34a" : "#dc2626",
                                }}
                              >
                                ₹{(b.profit || 0).toLocaleString("en-IN")}
                              </div>
                            </div>
                          </div>
                        </details>
                      ))}
                      {billBucket.details.length > 25 && (
                        <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                          Showing 25 of {billBucket.details.length} bills.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Jobcards Profit (full section) */}
              {financeSubView === "jobcards" && (
                <div
                  className="admin-card"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    marginBottom: 0,
                  }}
                >
                <div
                  style={{
                    padding: "1rem 1.5rem",
                    borderBottom: "1px solid #e9ecef",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#333", fontSize: "1.05rem" }}>
                      Jobcards — service profit
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                      {financePeriodLabel} · finalized jobcards, service lines only: paid amount
                      minus spare purchase cost
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.8rem", color: "#666" }}>Profit</div>
                    <div
                      className="card-number"
                      style={{
                        margin: 0,
                        fontSize: "1.65rem",
                        color:
                          (jobcardBucket.profit || 0) >= 0 ? "#198754" : "#dc3545",
                      }}
                    >
                      ₹
                      {jobcardsLoading
                        ? "…"
                        : (jobcardBucket.profit || 0).toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.15rem" }}>
                      Total paid (jobcards) ₹
                      {jobcardsLoading
                        ? "…"
                        : (jobcardBucket.paid || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "1rem 1.5rem" }}>
                  {jobcardsLoading ? (
                    <div style={{ color: "#6b7280" }}>Loading jobcards…</div>
                  ) : jobcardBucket.details.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>
                      No finalized jobcards in this{" "}
                      {financeRangeMode === "day" ? "day" : "month"}.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {jobcardBucket.details
                        .slice(0, 25)
                        .map((j) => (
                          <details
                            key={j.id}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: "0.5rem",
                              padding: "0.75rem 0.9rem",
                              background: "#fafafa",
                            }}
                          >
                            <summary
                              style={{
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "1rem",
                                listStyle: "none",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: "#111827" }}>
                                  {j.jobcardNumber} • {j.date}
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.85rem",
                                    color: "#6b7280",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {j.customerName}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                                  Profit
                                </div>
                                <div
                                  style={{
                                    fontWeight: 800,
                                    color: j.profit >= 0 ? "#16a34a" : "#dc2626",
                                  }}
                                >
                                  ₹{(j.profit || 0).toLocaleString("en-IN")}
                                </div>
                              </div>
                            </summary>

                            <div style={{ marginTop: "0.75rem" }}>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 80px 120px 120px",
                                  gap: "0.35rem 0.75rem",
                                  fontSize: "0.9rem",
                                  alignItems: "center",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 800,
                                    color: "#374151",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  Item
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 800,
                                    color: "#374151",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    textAlign: "right",
                                  }}
                                >
                                  Qty
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 800,
                                    color: "#374151",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    textAlign: "right",
                                  }}
                                >
                                  Unit Cost
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 800,
                                    color: "#374151",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    textAlign: "right",
                                  }}
                                >
                                  Cost
                                </div>

                                {j.lines.length === 0 ? (
                                  <div style={{ gridColumn: "1 / -1", color: "#6b7280" }}>
                                    No service spares in this jobcard.
                                  </div>
                                ) : (
                                  j.lines.map((l, idx) => (
                                    <div
                                      key={`${j.id}-l-${idx}`}
                                      style={{ display: "contents" }}
                                    >
                                      <div style={{ color: "#111827" }}>{l.name}</div>
                                      <div style={{ textAlign: "right" }}>{l.quantity}</div>
                                      <div style={{ textAlign: "right" }}>
                                        ₹{(l.unitCost || 0).toFixed(2)}
                                      </div>
                                      <div style={{ textAlign: "right" }}>
                                        ₹{(l.lineCost || 0).toFixed(2)}
                                      </div>
                                    </div>
                                  ))
                                )}

                                <div
                                  style={{
                                    gridColumn: "1 / -1",
                                    height: "1px",
                                    background: "#e5e7eb",
                                    margin: "0.35rem 0",
                                  }}
                                />

                                <div style={{ fontWeight: 800, color: "#111827" }}>
                                  Paid Amount
                                </div>
                                <div />
                                <div />
                                <div style={{ textAlign: "right", fontWeight: 800 }}>
                                  ₹{(j.paidAmount || 0).toLocaleString("en-IN")}
                                </div>

                                <div style={{ fontWeight: 800, color: "#111827" }}>
                                  Service Cost
                                </div>
                                <div />
                                <div />
                                <div style={{ textAlign: "right", fontWeight: 800 }}>
                                  ₹{(j.totalCost || 0).toLocaleString("en-IN")}
                                </div>

                                <div style={{ fontWeight: 900, color: "#111827" }}>
                                  Profit
                                </div>
                                <div />
                                <div />
                                <div
                                  style={{
                                    textAlign: "right",
                                    fontWeight: 900,
                                    color: j.profit >= 0 ? "#16a34a" : "#dc2626",
                                  }}
                                >
                                  ₹{(j.profit || 0).toLocaleString("en-IN")}
                                </div>
                              </div>
                            </div>
                          </details>
                        ))}
                      {jobcardBucket.details.length > 25 && (
                        <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                          Showing 25 of {jobcardBucket.details.length} jobcards.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}
            {(billsError ||
              jobcardsError ||
              chargersError ||
              sparesError ||
              modelsError ||
              batteriesError) && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#fef2f2",
                  color: "#b91c1c",
                  fontSize: "0.875rem",
                }}
              >
                {[
                  billsError,
                  jobcardsError,
                  chargersError,
                  sparesError,
                  modelsError,
                  batteriesError,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            )}
          </div>
        );
      }
      default:
        return (
          <div className="admin-content">Select a section from the sidebar</div>
        );
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-left">
            <h1>Admin Dashboard</h1>
            <p>Dhawan E-Bikes Management System</p>
          </div>
          <div className="admin-header-right">
            <button
              className="btn btn-logout"
              onClick={handleLogout}
              title="Logout"
            >
              Logout
            </button>
            <button
              className="btn btn-back-home"
              onClick={() => handleNavigateOutsideAdmin("/")}
              title="Back to Home"
            >
              Home
            </button>
          </div>
        </div>
      </header>

      <div className="admin-layout">
        {/* Left Sidebar */}
        <aside className="admin-sidebar">
          <div className="sidebar-header">
            <h3>Management</h3>
          </div>
          <nav className="sidebar-nav">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`sidebar-item ${
                    activeSection === item.id ? "active" : ""
                  }`}
                  onClick={() => setActiveSection(item.id)}
                  style={{ borderLeftColor: item.color }}
                >
                  <Icon
                    className="sidebar-icon"
                    style={{ color: item.color }}
                  />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Working Area */}
        <main className="admin-main">{renderContent()}</main>
      </div>

      <style jsx>{`
        .admin-dashboard {
          min-height: 100vh;
          background: #f8f9fa;
        }

        .admin-header {
          background: white;
          border-bottom: 1px solid #dee2e6;
          padding: 1rem 0;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .admin-header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .admin-header-left h1 {
          margin: 0;
          color: #333;
          font-size: 1.5rem;
        }

        .admin-header-left p {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
        }

        .admin-header-right {
          display: flex;
          gap: 0.5rem;
        }

        .admin-layout {
          display: flex;
          width: 100%;
          min-height: calc(100vh - 80px);
        }

        .admin-sidebar {
          width: 250px;
          background: white;
          border-right: 1px solid #dee2e6;
          box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
        }

        .sidebar-header {
          padding: 1.5rem 1rem;
          border-bottom: 1px solid #dee2e6;
        }

        .sidebar-header h3 {
          margin: 0;
          color: #333;
          font-size: 1.1rem;
        }

        .sidebar-nav {
          padding: 1rem 0;
        }

        .sidebar-item {
          width: 100%;
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s;
          border-left: 3px solid transparent;
          gap: 0.75rem;
        }

        .sidebar-item:hover {
          background: #f8f9fa;
        }

        .sidebar-item.active {
          background: #f8f9fa;
          font-weight: 600;
        }

        .sidebar-icon {
          font-size: 1.1rem;
        }

        .admin-main {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
          max-height: calc(100vh - 80px);
        }

        .admin-content h2 {
          margin: 0 0 1.5rem 0;
          color: #333;
          font-size: 1.5rem;
        }

        .admin-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .admin-card {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          border-left: 4px solid #007bff;
        }

        .admin-card h3 {
          margin: 0 0 0.5rem 0;
          color: #666;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .card-number {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          font-weight: bold;
          color: #333;
        }

        .admin-card small {
          color: #999;
          font-size: 0.8rem;
        }

        .admin-actions {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover {
          background: #0056b3;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover {
          background: #545b62;
        }

        .btn-info {
          background: #17a2b8;
          color: white;
        }

        .btn-info:hover {
          background: #138496;
        }

        .btn-success {
          background: #28a745;
          color: white;
        }

        .btn-success:hover {
          background: #218838;
        }

        .btn-logout {
          background: #dc3545;
          color: white;
        }

        .btn-logout:hover {
          background: #c82333;
        }

        .btn-back-home {
          background: #28a745;
          color: white;
        }

        .btn-back-home:hover {
          background: #218838;
        }
      `}</style>
    </div>
  );
}
