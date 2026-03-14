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

        if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
          totalQuantity = spare.stockEntries.reduce(
            (sum, entry) => sum + (entry.quantity || 0),
            0
          );
        } else if (typeof spare.quantity === "number") {
          totalQuantity = spare.quantity;
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
                <h3>Total Batteries</h3>
                <p className="card-number">0</p>
                <small>All battery types</small>
              </div>
              <div className="admin-card">
                <h3>In Stock</h3>
                <p className="card-number">0</p>
                <small>Available batteries</small>
              </div>
              <div className="admin-card">
                <h3>Under Warranty</h3>
                <p className="card-number">0</p>
                <small>Warranty active</small>
              </div>
            </div>
            <div className="admin-actions">
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
                onClick={() => handleNavigateOutsideAdmin("/batteries")}
              >
                Warranty Report
              </button>
            </div>
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
      case "finance":
        return (
          <div className="admin-content">
            <h2>Finance Management</h2>
            <div className="admin-cards">
              <div className="admin-card">
                <h3>Total Loans</h3>
                <p className="card-number">0</p>
                <small>Active loans</small>
              </div>
              <div className="admin-card">
                <h3>Monthly Revenue</h3>
                <p className="card-number">₹0</p>
                <small>This month</small>
              </div>
              <div className="admin-card">
                <h3>Pending Payments</h3>
                <p className="card-number">0</p>
                <small>Overdue payments</small>
              </div>
            </div>
            <div className="admin-actions">
              <button
                className="btn btn-primary"
                onClick={() => navigate("/finance")}
              >
                New Loan
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate("/finance")}
              >
                View All Loans
              </button>
              <button
                className="btn btn-info"
                onClick={() => navigate("/finance")}
              >
                Finance Report
              </button>
            </div>
          </div>
        );
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
