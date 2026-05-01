import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { formatDate } from "../../utils/dateUtils";
import { useSessionTimeout } from "../../hooks/useSessionTimeout";

// Add CSS animation for moving line
import { fetchWithRetry } from "../../config/api";
import { getFetchErrorMessage } from "../../utils/apiError";
import {
  isPurchasePriceMissing,
  pendingPurchaseDateKey,
  sortPendingDateKeys,
  formatPendingPurchaseDatesJoined,
} from "../../utils/purchasePriceStatus";
const style = document.createElement("style");
style.textContent = `
  @keyframes moveLine {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(100%);
    }
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  
  @keyframes dash {
    0% {
      stroke-dasharray: 1, 150;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -35;
    }
    100% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -124;
    }
  }
`;
document.head.appendChild(style);

function AllModels() {
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initialize session timeout for admin users
  useSessionTimeout();
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchLoading, setSearchLoading] = useState(false); // Search timer state
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [filterColor, setFilterColor] = useState("all");
  const [sortPrice, setSortPrice] = useState("lowToHigh"); // default: price low to high
  const [companies, setCompanies] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 1000, // Increased limit to show all data
    total: 0,
    pages: 0,
  });
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const searchInputRef = useRef(null);

  // Color order for sorting (same as dropdown order)
  const colorOrder = [
    "black",
    "blue",
    "white",
    "white-black",
    "peacock",
    "green",
    "cherry",
    "red",
    "grey",
    "silver",
    "yellow",
  ];

  // Simple search effect - client-side only
  useEffect(() => {
    // Search is now handled client-side in getModelsGroupedByNameAndCompany
    // No need for debounced API calls or complex effects
  }, [searchTerm]);

  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        t: String(Date.now()), // cache-bust so stock edits reflect immediately
      });

      // Removed debouncedSearchTerm to prevent auto-refresh on search
      // Search is now handled client-side in getModelsGroupedByNameAndCompany

      if (filterCompany && filterCompany !== "all") {
        queryParams.append("company", filterCompany);
      }

      if (filterStock && filterStock !== "all") {
        queryParams.append("stockStatus", filterStock);
      }

      const response = await fetchWithRetry(
        `/models?${queryParams}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error fetching models");
      }

      console.log("Models fetched successfully:", data);
      console.log("First model sample:", data.data?.[0]);
      console.log(
        "First model colorQuantities:",
        data.data?.[0]?.colorQuantities
      );
      setModels(data.data);
      setPagination(data.pagination);
      setCompanies(data.filters?.companies || []);
      setError("");
    } catch (err) {
      console.error("Error fetching models:", err);
      setError(err.message || "Error fetching models. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    // Removed debouncedSearchTerm to prevent auto-refresh on search
    filterCompany,
    filterStock,
    filterColor,
  ]);

  // Refresh when returning from Add/Edit stock, or when tab regains focus.
  useEffect(() => {
    const onFocus = () => {
      fetchModels();
    };
    const onModelUpdated = () => {
      fetchModels();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("modelDataUpdated", onModelUpdated);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("modelDataUpdated", onModelUpdated);
    };
  }, [fetchModels]);

  // Group models by name and company
  const getModelsGroupedByNameAndCompany = () => {
    let filteredModels = [...models];

    // Apply search filter
    if (searchTerm) {
      filteredModels = filteredModels.filter(
        (model) =>
          model.modelName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          model.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          model.colour?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply company filter
    if (filterCompany !== "all") {
      filteredModels = filteredModels.filter(
        (model) => model.company === filterCompany
      );
    }

    // Apply stock filter
    if (filterStock === "instock") {
      filteredModels = filteredModels.filter((model) => model.quantity > 0);
    } else if (filterStock === "outofstock") {
      filteredModels = filteredModels.filter((model) => model.quantity === 0);
    }

    // Apply color filter (supports colour field, colorQuantities and stockEntries.colorQuantities)
    if (filterColor !== "all") {
      const normalizedFilterColor = filterColor.toLowerCase();
      filteredModels = filteredModels.filter((model) => {
        // 1) Legacy single colour field
        if (
          model.colour &&
          model.colour.toString().toLowerCase() === normalizedFilterColor
        ) {
          return true;
        }

        // 2) Aggregated colorQuantities on the model
        if (
          Array.isArray(model.colorQuantities) &&
          model.colorQuantities.some(
            (cq) =>
              cq &&
              cq.color &&
              cq.color.toString().toLowerCase() === normalizedFilterColor
          )
        ) {
          return true;
        }

        // 3) Colors inside stockEntries.colorQuantities
        if (
          Array.isArray(model.stockEntries) &&
          model.stockEntries.some(
            (entry) =>
              Array.isArray(entry?.colorQuantities) &&
              entry.colorQuantities.some(
                (cq) =>
                  cq &&
                  cq.color &&
                  cq.color.toString().toLowerCase() ===
                    normalizedFilterColor
              )
          )
        ) {
          return true;
        }

        return false;
      });
    }

    // Group by name and company with custom sorting
    const grouped = {};

    // First, sort the filtered models with custom logic
    filteredModels.sort((a, b) => {
      // 1. Sort by purchase date (ascending - oldest first)
      const dateA = new Date(a.purchaseDate || a.createdAt);
      const dateB = new Date(b.purchaseDate || b.createdAt);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }

      // 2. Sort by warranty status (non-warranty first, then warranty)
      const warrantyA = a.purchasedInWarranty ? 1 : 0;
      const warrantyB = b.purchasedInWarranty ? 1 : 0;
      if (warrantyA !== warrantyB) {
        return warrantyA - warrantyB;
      }

      // 3. Sort by color according to dropdown order
      const colorIndexA = colorOrder.indexOf(a.colour);
      const colorIndexB = colorOrder.indexOf(b.colour);

      // Handle colors not in the predefined order
      const finalIndexA = colorIndexA === -1 ? colorOrder.length : colorIndexA;
      const finalIndexB = colorIndexB === -1 ? colorOrder.length : colorIndexB;

      return finalIndexA - finalIndexB;
    });

    const normalizeDateOnly = (value) => {
      if (!value) return "";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      return d.toISOString().split("T")[0];
    };

    filteredModels.forEach((model) => {
      // Grouping MUST include warranty, otherwise different warranty buckets
      // get merged and the UI can show stale/non-matching totals after stock edits.
      const key = `${model.modelName}-${model.company}-${
        model.purchasedInWarranty ? "w" : "nw"
      }`;
      if (!grouped[key]) {
        grouped[key] = {
          modelName: model.modelName,
          company: model.company,
          colours: [],
          totalQuantity: 0,
          totalValue: 0,
          inWarranty: false,
          models: [],
          lowestPrice: null, // Track lowest price > 0
          sellingPrice: null, // Store selling price
        };
      }

      // Store selling price from model
      if (!grouped[key].sellingPrice && model.sellingPrice) {
        grouped[key].sellingPrice = model.sellingPrice;
      }

      // Update lowest price (only consider prices > 0)
      if (model.purchasePrice && model.purchasePrice > 0) {
        if (
          grouped[key].lowestPrice === null ||
          model.purchasePrice < grouped[key].lowestPrice
        ) {
          grouped[key].lowestPrice = model.purchasePrice;
        }
      }

      const addColorToGroup = (colour, quantity, descriptionTags = []) => {
        const normalizedColour = (colour || "").toString().trim();
        const quantityToAdd = parseInt(quantity, 10) || 0;
        if (!normalizedColour) return;

        let existingColor = grouped[key].colours.find(
          (c) => c.colour === normalizedColour
        );
        if (!existingColor) {
          existingColor = {
            colour: normalizedColour,
            quantity: 0,
            descriptionQty: {},
          };
          grouped[key].colours.push(existingColor);
        }

        existingColor.quantity += quantityToAdd;
        grouped[key].totalQuantity += quantityToAdd;

        const cleanedTags = Array.isArray(descriptionTags)
          ? descriptionTags
              .map((tag) => String(tag || "").trim())
              .filter(Boolean)
          : [];

        if (cleanedTags.length > 0) {
          const descriptionKey = cleanedTags.join(" • ");
          existingColor.descriptionQty[descriptionKey] =
            (existingColor.descriptionQty[descriptionKey] || 0) + quantityToAdd;
        }
      };

      // Build per-model color totals with description-wise quantities.
      // Prefer stockEntries (live layer data). If absent, fall back to model.colorQuantities,
      // then legacy (model.colour + model.quantity).
      const hasStockEntries =
        Array.isArray(model.stockEntries) && model.stockEntries.length > 0;

      if (hasStockEntries) {
        model.stockEntries.forEach((entry) => {
          const entryDescription = Array.isArray(entry?.description)
            ? entry.description
            : [];
          if (Array.isArray(entry?.colorQuantities)) {
            entry.colorQuantities.forEach((cq) => {
              addColorToGroup(cq?.color, cq?.quantity, entryDescription);
            });
          }
        });
      } else if (Array.isArray(model.colorQuantities) && model.colorQuantities.length > 0) {
        const modelDescription = Array.isArray(model.description)
          ? model.description
          : [];
        model.colorQuantities.forEach((cq) => {
          addColorToGroup(cq?.color, cq?.quantity, modelDescription);
        });
      } else if (model.colour && model.colour.trim() !== "") {
        const modelDescription = Array.isArray(model.description)
          ? model.description
          : [];
        addColorToGroup(model.colour, model.quantity || 0, modelDescription);
      }

      grouped[key].totalValue +=
        (model.purchasePrice || 0) * (model.quantity || 0);
      if (model.purchasedInWarranty) grouped[key].inWarranty = true;
      grouped[key].models.push(model);
    });

    // Sort grouped models: by price filter first, then by lowest price as default
    const groupedArray = Object.values(grouped);
    if (sortPrice === "lowToHigh" || sortPrice === "highToLow") {
      groupedArray.sort((a, b) => {
        const priceA = parseFloat(a.sellingPrice) || 0;
        const priceB = parseFloat(b.sellingPrice) || 0;
        if (sortPrice === "lowToHigh") return priceA - priceB;
        return priceB - priceA;
      });
    } else {
      groupedArray.sort((a, b) => {
        // Groups with no price go to the end
        if (a.lowestPrice === null && b.lowestPrice === null) return 0;
        if (a.lowestPrice === null) return 1;
        if (b.lowestPrice === null) return -1;

        // Sort by lowest price ascending
        return a.lowestPrice - b.lowestPrice;
      });
    }

    return groupedArray;
  };

  const getGroupPriceStatus = (group) => {
    const pendingDatesSet = new Set();

    if (group && Array.isArray(group.models)) {
      group.models.forEach((model) => {
        if (!model) return;

        if (Array.isArray(model.stockEntries) && model.stockEntries.length > 0) {
          model.stockEntries.forEach((entry) => {
            if (!isPurchasePriceMissing(entry?.purchasePrice)) return;
            pendingDatesSet.add(pendingPurchaseDateKey(entry?.purchaseDate));
          });
        } else {
          const qty = Number(model.quantity) || 0;
          if (qty > 0 && isPurchasePriceMissing(model.purchasePrice)) {
            pendingDatesSet.add(
              pendingPurchaseDateKey(model.purchaseDate ?? model.createdAt)
            );
          }
        }
      });
    }

    const pendingDates = sortPendingDateKeys(Array.from(pendingDatesSet));

    return {
      hasPending: pendingDates.length > 0,
      pendingDates,
    };
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

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Remove focus from search input when user scrolls
  useEffect(() => {
    const handleScroll = () => {
      // If search input is focused, remove focus when user scrolls
      if (
        searchInputRef.current &&
        document.activeElement === searchInputRef.current
      ) {
        searchInputRef.current.blur();
      }
    };

    // Add scroll event listener
    window.addEventListener("scroll", handleScroll);

    // Cleanup
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Focus management disabled to prevent edit/delete button interference
  // useEffect(() => {
  //   // This effect was causing scroll-to-top issues with edit/delete buttons
  //   // Completely disabled until we can find a better solution
  // }, [searchTerm]); // Removed isDeleting from commented dependencies

  const handleEdit = (modelId) => {
    // Navigate immediately without any focus interference
    navigate(`/models/edit/${modelId}`);
  };

  const handleAddMoreStock = (modelId) => {
    // Navigate to Add More Stock page for this model
    navigate(`/models/add-more/${modelId}`);
  };

  const handleDelete = async (event, modelId) => {
    // Prevent any default behavior that might cause scroll
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    console.log("handleDelete called with ID:", modelId);

    try {
      if (window.confirm("Are you sure you want to delete this model?")) {
        console.log("User confirmed delete");

        // Optimistically remove the model from the UI immediately
        setModels((prevModels) => {
          console.log("Current models count:", prevModels.length);
          const newModels = prevModels.filter((m) => m._id !== modelId);
          console.log("New models count:", newModels.length);
          return newModels;
        });

        // Optimistically update pagination count
        setPagination((prev) => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
        }));

        const response = await fetchWithRetry(
          `/models/${modelId}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          const msg = await getFetchErrorMessage(response, "Error deleting model");
          console.error("Delete failed:", msg);
          await fetchModels();
          throw new Error(msg);
        }

        const data = await response.json().catch(() => ({}));
        console.log("Delete API response:", data);

        console.log("Delete successful (optimistic update should persist)");
        // Do NOT fetch models immediately after success to avoid race condition
      }
    } catch (err) {
      console.error("Error deleting model:", err);
      setError(err.message || "Error deleting model. Please try again.");
      // Re-fetch models in case of error to restore state
      fetchModels();
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    console.log("=== SEARCH CHANGE DEBUG ===");
    console.log("Search value:", value);
    console.log("Value trimmed:", value.trim());

    // Show search timer for 1 second when user types
    if (value.trim()) {
      console.log("Setting searchLoading to TRUE");
      setSearchLoading(true);
      setTimeout(() => {
        console.log("Setting searchLoading to FALSE after 1 second");
        setSearchLoading(false);
      }, 1000); // Exactly 1 second timer
    } else {
      console.log("Setting searchLoading to FALSE (empty input)");
      setSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  if (loading) {
    return (
      <div className="model-container">
        <h2>All Models</h2>
        <p>Loading models...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="model-container">
        <h2>All Models</h2>
        <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
        <button className="btn btn-primary" onClick={fetchModels}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="model-container">
      <h2>All Models</h2>

      {/* Search and Filters */}
      <div className="search-filters">
        <form onSubmit={(e) => e.preventDefault()} className="search-form">
          <div className="search-input-group">
            <div className="search-box">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search models by name, company, or colour..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="search-input"
                style={{ position: "relative", zIndex: 1 }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="clear-search-btn"
                  title="Clear search"
                  onMouseDown={(e) => {
                    // Prevent default to maintain focus
                    e.preventDefault();
                  }}
                >
                  ✕
                </button>
              )}

              {/* Loading Icon - Right Side */}
              {searchLoading && (
                <div
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: "1001",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{
                      animation: "spin 1s linear infinite",
                      color: "#007bff",
                    }}
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="31.416"
                      strokeDashoffset="31.416"
                      style={{
                        animation: "dash 1.5s ease-in-out infinite",
                      }}
                    />
                  </svg>
                </div>
              )}

              {/* Moving Line Theme Design - Direct child of search-box */}
              {searchLoading && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "0px",
                    left: "0",
                    right: "0",
                    height: "4px",
                    background: "#e9ecef",
                    overflow: "hidden",
                    borderRadius: "0 0 4px 4px",
                    zIndex: "1000",
                    border: "1px solid #007bff",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: "100%",
                      background: "#007bff",
                      animation: "moveLine 1s linear",
                      boxShadow: "0 0 4px rgba(0, 123, 255, 0.5)",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="filters-group">
            <div className="filter-item">
              <label htmlFor="company-filter" className="filter-label">
                Company:
              </label>
              <select
                id="company-filter"
                value={filterCompany}
                className="filter-select"
                onChange={(e) => {
                  setFilterCompany(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page on filter
                  // Return focus to search input after filter change
                  if (searchInputRef.current) {
                    searchInputRef.current.focus();
                  }
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

            <div className="filter-item">
              <label htmlFor="stock-filter" className="filter-label">
                Stock Status:
              </label>
              <select
                id="stock-filter"
                value={filterStock}
                className="filter-select"
                onChange={(e) => {
                  setFilterStock(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page on filter
                  // Return focus to search input after filter change
                  if (searchInputRef.current) {
                    searchInputRef.current.focus();
                  }
                }}
              >
                <option value="all">All Stock</option>
                <option value="instock">In Stock</option>
                <option value="outofstock">Out of Stock</option>
              </select>
            </div>

            <div className="filter-item">
              <label htmlFor="color-filter" className="filter-label">
                Colour:
              </label>
              <select
                id="color-filter"
                value={filterColor}
                className="filter-select"
                onChange={(e) => {
                  setFilterColor(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page on filter
                  // Return focus to search input after filter change
                  if (searchInputRef.current) {
                    searchInputRef.current.focus();
                  }
                }}
              >
                <option value="all">All Colours</option>
                <option value="black">Black</option>
                <option value="blue">Blue</option>
                <option value="white">White</option>
                <option value="white-black">White-Black</option>
                <option value="peacock">Peacock</option>
                <option value="green">Green</option>
                <option value="cherry">Cherry</option>
                <option value="red">Red</option>
                <option value="grey">Grey</option>
                <option value="silver">Silver</option>
                <option value="yellow">Yellow</option>
              </select>
            </div>

            <div className="filter-item">
              <label htmlFor="price-sort" className="filter-label">
                Sort by price:
              </label>
              <select
                id="price-sort"
                value={sortPrice}
                className="filter-select"
                onChange={(e) => {
                  setSortPrice(e.target.value);
                  if (searchInputRef.current) {
                    searchInputRef.current.focus();
                  }
                }}
              >
                <option value="none">Default</option>
                <option value="lowToHigh">Low to High</option>
                <option value="highToLow">High to Low</option>
              </select>
            </div>

            <div className="filter-item">
              <span className="results-count">
                {`${pagination.total} item${
                  pagination.total !== 1 ? "s" : ""
                } found`}
              </span>
            </div>
          </div>
        </form>
      </div>

      {/* Models Table */}
      <div style={{ width: "100%", overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#f8fafc",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <th
                style={{
                  padding: "1rem 1.25rem",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#374151",
                  fontSize: "0.875rem",
                  borderBottom: "1px solid #e5e7eb",
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                Model Name
              </th>
              <th
                style={{
                  padding: "1rem 1.25rem",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#374151",
                  fontSize: "0.875rem",
                  borderBottom: "1px solid #e5e7eb",
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                Company
              </th>
              <th
                style={{
                  padding: "1rem 1.25rem",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#374151",
                  fontSize: "0.875rem",
                  borderBottom: "1px solid #e5e7eb",
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                Colour
              </th>
              <th
                style={{
                  padding: "1rem 1.25rem",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#374151",
                  fontSize: "0.875rem",
                  borderBottom: "1px solid #e5e7eb",
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                Quantity
              </th>
              <th
                style={{
                  padding: "1rem 1.25rem",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#374151",
                  fontSize: "0.875rem",
                  borderBottom: "1px solid #e5e7eb",
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: "1rem 1.25rem",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#374151",
                  fontSize: "0.875rem",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Selling Price
              </th>
            </tr>
          </thead>
          <tbody>
            {models.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  style={{
                    padding: "3rem 1.25rem",
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "0.875rem",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  {searchTerm || filterCompany !== "all"
                    ? "No models found matching your criteria."
                    : "No models available. Add your first model to get started."}
                </td>
              </tr>
            ) : (
              getModelsGroupedByNameAndCompany().map((group) => {
                const priceStatus = getGroupPriceStatus(group);
                return (
                <React.Fragment
                  key={`${group.modelName}-${group.company}-${
                    group.inWarranty ? "w" : "nw"
                  }`}
                >
                  {/* Group Header */}
                  <tr>
                    <td
                      colSpan="6"
                      style={{
                        backgroundColor: "#f8fafc",
                        fontWeight: "600",
                        padding: "0.75rem 1.25rem",
                        borderBottom: "2px solid #dee2e6",
                        color: "#374151",
                        fontSize: "0.875rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "1rem",
                          }}
                        >
                          <div>
                            {group.modelName} ({group.company}) -{" "}
                            {group.totalQuantity} units total
                          </div>
                          <button
                            onClick={() =>
                              handleAddMoreStock(group.models[0]._id)
                            }
                            style={{
                              background:
                                "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              color: "white",
                              border: "none",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              fontSize: "0.7rem",
                              fontWeight: "500",
                              cursor: "pointer",
                              transition:
                                "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              boxShadow:
                                "0 1px 2px rgba(0, 0, 0, 0.08), 0 1px 1px rgba(0, 0, 0, 0.04)",
                              position: "relative",
                              whiteSpace: "nowrap",
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background =
                                "linear-gradient(135deg, #059669 0%, #047857 100%)";
                              e.target.style.boxShadow =
                                "0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)";
                              e.target.style.transform = "translateY(-1px)";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background =
                                "linear-gradient(135deg, #10b981 0%, #059669 100%)";
                              e.target.style.boxShadow =
                                "0 1px 2px rgba(0, 0, 0, 0.08), 0 1px 1px rgba(0, 0, 0, 0.04)";
                              e.target.style.transform = "translateY(0)";
                            }}
                            onMouseDown={(e) => {
                              e.target.style.transform = "translateY(0)";
                              e.target.style.boxShadow =
                                "0 1px 2px rgba(0, 0, 0, 0.08), 0 1px 1px rgba(0, 0, 0, 0.04)";
                            }}
                            title={`Add more stock to ${group.modelName} (${group.company})`}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{
                                display: "inline-block",
                                flexShrink: 0,
                              }}
                            >
                              <path d="M12 2v20M2 12h20"></path>
                            </svg>
                            Add More Stock
                          </button>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            alignItems: "center",
                          }}
                        >
                          <button
                            onClick={() => handleEdit(group.models[0]._id)}
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: "500",
                              padding: "0.375rem 0.75rem",
                              backgroundColor: "#3b82f6",
                              color: "white",
                              border: "1px solid #2563eb",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              minWidth: "55px",
                              height: "32px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = "#2563eb";
                              e.target.style.transform = "translateY(-1px)";
                              e.target.style.boxShadow =
                                "0 2px 4px rgba(59, 130, 246, 0.3)";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = "#3b82f6";
                              e.target.style.transform = "translateY(0)";
                              e.target.style.boxShadow = "none";
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) =>
                              handleDelete(e, group.models[0]._id)
                            }
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: "500",
                              padding: "0.375rem 0.75rem",
                              backgroundColor: "#ef4444",
                              color: "white",
                              border: "1px solid #dc2626",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              minWidth: "55px",
                              height: "32px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = "#dc2626";
                              e.target.style.transform = "translateY(-1px)";
                              e.target.style.boxShadow =
                                "0 2px 4px rgba(239, 68, 68, 0.3)";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = "#ef4444";
                              e.target.style.transform = "translateY(0)";
                              e.target.style.boxShadow = "none";
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: "0.35rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          fontSize: "0.75rem",
                        }}
                      >
                        <span
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "999px",
                            backgroundColor: priceStatus.hasPending
                              ? "#f59e0b"
                              : "#16a34a",
                            boxShadow: priceStatus.hasPending
                              ? "0 0 0 3px rgba(245, 158, 11, 0.25)"
                              : "0 0 0 3px rgba(22, 163, 74, 0.25)",
                          }}
                        />
                        {priceStatus.hasPending ? (
                          <span style={{ color: "#92400e" }}>
                            Price listing pending for{" "}
                            {formatPendingPurchaseDatesJoined(
                              priceStatus.pendingDates
                            )}
                          </span>
                        ) : (
                          <span style={{ color: "#166534" }}>
                            All price entries up to date
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Individual Models in Group - Show aggregated colors from all stock entries */}
                  {group.colours.length > 0 ? (
                    group.colours.map((colorEntry, colorIndex) => (
                      <tr
                        key={`${group.modelName}-${group.company}-${
                          group.inWarranty ? "w" : "nw"
                        }-${colorIndex}`}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          transition: "background-color 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f8fafc";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "white";
                        }}
                      >
                        <td
                          style={{
                            padding: "1rem 1.25rem",
                            borderBottom: "1px solid #f3f4f6",
                            borderRight: "1px solid #f3f4f6",
                            color: "#374151",
                            verticalAlign: "middle",
                          }}
                        >
                          <div style={{ fontWeight: "500" }}>
                            {group.modelName}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "1rem 1.25rem",
                            borderBottom: "1px solid #f3f4f6",
                            borderRight: "1px solid #f3f4f6",
                            color: "#374151",
                            verticalAlign: "middle",
                          }}
                        >
                          {group.company}
                        </td>
                        <td
                          style={{
                            padding: "1rem 1.25rem",
                            borderBottom: "1px solid #f3f4f6",
                            borderRight: "1px solid #f3f4f6",
                            color: "#374151",
                            verticalAlign: "middle",
                          }}
                        >
                          {colorEntry.colour === "white-black" ? (
                            <div
                              style={{
                                width: "60px",
                                height: "24px",
                                border: "1px solid #ccc",
                                borderRadius: "0.25rem",
                                position: "relative",
                                overflow: "hidden",
                                display: "inline-block",
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  top: 0,
                                  width: "50%",
                                  height: "100%",
                                  backgroundColor: "#FFFFFF",
                                }}
                              />
                              <div
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: 0,
                                  width: "50%",
                                  height: "100%",
                                  backgroundColor: "#000000",
                                }}
                              />
                              <span
                                style={{
                                  position: "absolute",
                                  top: "50%",
                                  left: "50%",
                                  transform: "translate(-50%, -50%)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "100%",
                                  height: "100%",
                                  zIndex: 1,
                                }}
                              >
                                <span
                                  style={{
                                    position: "absolute",
                                    left: "25%",
                                    color: "#000",
                                    fontWeight: "bold",
                                    fontSize: "0.6rem",
                                  }}
                                >
                                  W
                                </span>
                                <span
                                  style={{
                                    position: "absolute",
                                    right: "25%",
                                    color: "#fff",
                                    fontWeight: "bold",
                                    fontSize: "0.6rem",
                                  }}
                                >
                                  B
                                </span>
                              </span>
                            </div>
                          ) : (
                            <span
                              style={{
                                backgroundColor: getColourDisplay(
                                  colorEntry.colour
                                ),
                                color:
                                  colorEntry.colour?.toLowerCase() ===
                                    "white" ||
                                  colorEntry.colour?.toLowerCase() === "yellow"
                                    ? "#000000"
                                    : "white",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                fontSize: "0.75rem",
                                textTransform: "capitalize",
                                border:
                                  colorEntry.colour?.toLowerCase() === "white"
                                    ? "1px solid #d1d5db"
                                    : "none",
                              }}
                            >
                              {colorEntry.colour}
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "1rem 1.25rem",
                            borderBottom: "1px solid #f3f4f6",
                            borderRight: "1px solid #f3f4f6",
                            color: "#374151",
                            verticalAlign: "middle",
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: "#f3f4f6",
                              color: "#374151",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              fontSize: "0.75rem",
                              fontWeight: "500",
                            }}
                          >
                            {colorEntry.quantity || 0}
                          </span>
                          {colorEntry.descriptionQty &&
                            Object.keys(colorEntry.descriptionQty).length > 0 && (
                              <div
                                style={{
                                  marginTop: "0.5rem",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.25rem",
                                }}
                              >
                                {Object.entries(colorEntry.descriptionQty)
                                  .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                                  .map(([desc, qty]) => (
                                    <div
                                      key={`${colorEntry.colour}-${desc}`}
                                      style={{
                                        fontSize: "0.72rem",
                                        color: "#6b7280",
                                        lineHeight: 1.25,
                                      }}
                                    >
                                      {desc}: <strong>{qty || 0}</strong>
                                    </div>
                                  ))}
                              </div>
                            )}
                        </td>
                        <td
                          style={{
                            padding: "1rem 1.25rem",
                            borderBottom: "1px solid #f3f4f6",
                            borderRight: "1px solid #f3f4f6",
                            color: "#374151",
                            verticalAlign: "middle",
                          }}
                        >
                          <span
                            style={{
                              background:
                                (colorEntry.quantity || 0) > 0
                                  ? "#10b981"
                                  : "#ef4444",
                              color: "white",
                              padding: "0.375rem 0.75rem",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.375rem",
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: "currentColor",
                              }}
                            />
                            {(colorEntry.quantity || 0) > 0
                              ? "In Stock"
                              : "Out of Stock"}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "1rem 1.25rem",
                            borderBottom: "1px solid #f3f4f6",
                            color: "#374151",
                            verticalAlign: "middle",
                          }}
                        >
                          {group.sellingPrice
                            ? `₹${parseFloat(group.sellingPrice).toLocaleString(
                                "en-IN",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}`
                            : "₹0.00"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    // Fallback: single row for models without colors
                    <tr
                      key={`${group.modelName}-${group.company}-${
                        group.inWarranty ? "w" : "nw"
                      }-fallback`}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "white";
                      }}
                    >
                      <td
                        style={{
                          padding: "1rem 1.25rem",
                          borderBottom: "1px solid #f3f4f6",
                          borderRight: "1px solid #f3f4f6",
                          color: "#374151",
                          verticalAlign: "middle",
                        }}
                      >
                        <div style={{ fontWeight: "500" }}>
                          {group.modelName}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "1rem 1.25rem",
                          borderBottom: "1px solid #f3f4f6",
                          borderRight: "1px solid #f3f4f6",
                          color: "#374151",
                          verticalAlign: "middle",
                        }}
                      >
                        {group.company}
                      </td>
                      <td
                        style={{
                          padding: "1rem 1.25rem",
                          borderBottom: "1px solid #f3f4f6",
                          borderRight: "1px solid #f3f4f6",
                          color: "#374151",
                          verticalAlign: "middle",
                        }}
                      >
                        {group.models[0]?.colour &&
                        group.models[0].colour.trim() !== "" ? (
                          group.models[0].colour.toLowerCase() ===
                          "white-black" ? (
                            <div
                              style={{
                                width: "60px",
                                height: "24px",
                                border: "1px solid #ccc",
                                borderRadius: "0.25rem",
                                position: "relative",
                                overflow: "hidden",
                                display: "inline-block",
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  top: 0,
                                  width: "50%",
                                  height: "100%",
                                  backgroundColor: "#FFFFFF",
                                }}
                              />
                              <div
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: 0,
                                  width: "50%",
                                  height: "100%",
                                  backgroundColor: "#000000",
                                }}
                              />
                              <span
                                style={{
                                  position: "absolute",
                                  top: "50%",
                                  left: "50%",
                                  transform: "translate(-50%, -50%)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "100%",
                                  height: "100%",
                                  zIndex: 1,
                                }}
                              >
                                <span
                                  style={{
                                    position: "absolute",
                                    left: "25%",
                                    color: "#000",
                                    fontWeight: "bold",
                                    fontSize: "0.6rem",
                                  }}
                                >
                                  W
                                </span>
                                <span
                                  style={{
                                    position: "absolute",
                                    right: "25%",
                                    color: "#fff",
                                    fontWeight: "bold",
                                    fontSize: "0.6rem",
                                  }}
                                >
                                  B
                                </span>
                              </span>
                            </div>
                          ) : (
                            <span
                              style={{
                                backgroundColor: getColourDisplay(
                                  group.models[0].colour
                                ),
                                color:
                                  group.models[0].colour.toLowerCase() ===
                                    "white" ||
                                  group.models[0].colour.toLowerCase() ===
                                    "yellow"
                                    ? "#000000"
                                    : "white",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                fontSize: "0.75rem",
                                textTransform: "capitalize",
                                border:
                                  group.models[0].colour.toLowerCase() ===
                                  "white"
                                    ? "1px solid #d1d5db"
                                    : "none",
                              }}
                            >
                              {group.models[0].colour}
                            </span>
                          )
                        ) : (
                          <span
                            style={{
                              backgroundColor: "#f3f4f6",
                              color: "#6b7280",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              fontSize: "0.75rem",
                            }}
                          >
                            N/A
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "1rem 1.25rem",
                          borderBottom: "1px solid #f3f4f6",
                          borderRight: "1px solid #f3f4f6",
                          color: "#374151",
                          verticalAlign: "middle",
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: "#f3f4f6",
                            color: "#374151",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.25rem",
                            fontSize: "0.75rem",
                            fontWeight: "500",
                          }}
                        >
                          {group.totalQuantity}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "1rem 1.25rem",
                          borderBottom: "1px solid #f3f4f6",
                          borderRight: "1px solid #f3f4f6",
                          color: "#374151",
                          verticalAlign: "middle",
                        }}
                      >
                        <span
                          style={{
                            background:
                              group.totalQuantity > 0 ? "#10b981" : "#ef4444",
                            color: "white",
                            padding: "0.375rem 0.75rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.375rem",
                          }}
                        >
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
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
                          padding: "1rem 1.25rem",
                          borderBottom: "1px solid #f3f4f6",
                          color: "#374151",
                          verticalAlign: "middle",
                        }}
                      >
                        {group.sellingPrice
                          ? `₹${parseFloat(group.sellingPrice).toLocaleString(
                              "en-IN",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}`
                          : "₹0.00"}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(AllModels);
