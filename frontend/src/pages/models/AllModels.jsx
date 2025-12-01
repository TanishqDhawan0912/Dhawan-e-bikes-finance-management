import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

// Add CSS animation for moving line
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

export default function AllModels() {
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchLoading, setSearchLoading] = useState(false); // Search timer state
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [filterColor, setFilterColor] = useState("all");
  const [filterWarranty, setFilterWarranty] = useState("all");
  const [companies, setCompanies] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 1000, // Increased limit to show all data
    total: 0,
    pages: 0,
  });
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const scrollPositionRef = useRef(0);
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
      });

      // Removed debouncedSearchTerm to prevent auto-refresh on search
      // Search is now handled client-side in getModelsGroupedByNameAndCompany

      if (filterCompany && filterCompany !== "all") {
        queryParams.append("company", filterCompany);
      }

      if (filterStock && filterStock !== "all") {
        queryParams.append("stockStatus", filterStock);
      }

      if (filterColor && filterColor !== "all") {
        queryParams.append("colour", filterColor);
      }

      if (filterWarranty && filterWarranty !== "all") {
        queryParams.append("warranty", filterWarranty);
      }

      const response = await fetch(
        `http://localhost:5000/api/models?${queryParams}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error fetching models");
      }

      console.log("Models fetched successfully:", data);
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
    filterWarranty,
  ]);

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

    // Apply color filter
    if (filterColor !== "all") {
      filteredModels = filteredModels.filter(
        (model) => model.colour === filterColor
      );
    }

    // Apply warranty filter
    if (filterWarranty === "inwarranty") {
      filteredModels = filteredModels.filter(
        (model) => model.purchasedInWarranty === true
      );
    } else if (filterWarranty === "nowarranty") {
      filteredModels = filteredModels.filter(
        (model) => model.purchasedInWarranty === false
      );
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

    filteredModels.forEach((model) => {
      const key = `${model.modelName}-${model.company}`;
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
        };
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

      // Add colour if not already present
      if (!grouped[key].colours.find((c) => c.colour === model.colour)) {
        grouped[key].colours.push({
          colour: model.colour,
          quantity: model.quantity,
          inWarranty: model.purchasedInWarranty,
          purchasePrice: model.purchasePrice,
          purchaseDate: model.purchaseDate,
        });
      }

      grouped[key].totalQuantity += model.quantity;
      grouped[key].totalValue += (model.purchasePrice || 0) * model.quantity;
      if (model.purchasedInWarranty) grouped[key].inWarranty = true;
      grouped[key].models.push(model);
    });

    // Sort grouped models by lowest price (ascending)
    const groupedArray = Object.values(grouped);
    groupedArray.sort((a, b) => {
      // Groups with no price go to the end
      if (a.lowestPrice === null && b.lowestPrice === null) return 0;
      if (a.lowestPrice === null) return 1;
      if (b.lowestPrice === null) return -1;

      // Sort by lowest price ascending
      return a.lowestPrice - b.lowestPrice;
    });

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

  const handleDelete = async (event, modelId) => {
    // Prevent any default behavior that might cause scroll
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Save current scroll position
    const currentScrollPosition =
      window.pageYOffset || document.documentElement.scrollTop;
    scrollPositionRef.current = currentScrollPosition;

    try {
      if (window.confirm("Are you sure you want to delete this model?")) {
        const response = await fetch(
          `http://localhost:5000/api/models/${modelId}`,
          {
            method: "DELETE",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Error deleting model");
        }

        // Refresh the models list
        await fetchModels();

        // Force scroll position to stay immediately
        window.scrollTo(0, currentScrollPosition);
        document.documentElement.scrollTop = currentScrollPosition;
        document.body.scrollTop = currentScrollPosition;

        // Additional restoration attempts with different timing
        setTimeout(() => {
          window.scrollTo(0, currentScrollPosition);
          document.documentElement.scrollTop = currentScrollPosition;
          document.body.scrollTop = currentScrollPosition;
        }, 100);

        setTimeout(() => {
          window.scrollTo(0, currentScrollPosition);
        }, 300);
      }
    } catch (err) {
      console.error("Error deleting model:", err);
      setError(err.message || "Error deleting model. Please try again.");
    } finally {
      // No focus management to resume since we disabled it
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
              <label htmlFor="warranty-filter" className="filter-label">
                Warranty:
              </label>
              <select
                id="warranty-filter"
                value={filterWarranty}
                className="filter-select"
                onChange={(e) => {
                  setFilterWarranty(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page on filter
                  // Return focus to search input after filter change
                  if (searchInputRef.current) {
                    searchInputRef.current.focus();
                  }
                }}
              >
                <option value="all">All Warranty</option>
                <option value="inwarranty">In Warranty</option>
                <option value="nowarranty">No Warranty</option>
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
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => {
                  if (sortField === "warranty") {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortField("warranty");
                    setSortOrder("asc");
                  }
                }}
              >
                Warranty{" "}
                {sortField === "warranty" && (sortOrder === "asc" ? "↑" : "↓")}
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
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                Purchase Date
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
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {models.length === 0 ? (
              <tr>
                <td
                  colSpan="8"
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
              getModelsGroupedByNameAndCompany().map((group) => (
                <React.Fragment key={`${group.modelName}-${group.company}`}>
                  {/* Group Header */}
                  <tr>
                    <td
                      colSpan="8"
                      style={{
                        backgroundColor: "#f8fafc",
                        fontWeight: "600",
                        padding: "0.75rem 1.25rem",
                        borderBottom: "2px solid #dee2e6",
                        color: "#374151",
                        fontSize: "0.875rem",
                      }}
                    >
                      {group.modelName} ({group.company}) -{" "}
                      {group.totalQuantity} units total
                    </td>
                  </tr>

                  {/* Individual Models in Group */}
                  {group.models.map((model) => (
                    <tr
                      key={model._id}
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
                          {model.modelName}
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
                        {model.company}
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
                        {model.colour.toLowerCase() === "white-black" ? (
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
                              backgroundColor: getColourDisplay(model.colour),
                              color:
                                model.colour.toLowerCase() === "white" ||
                                model.colour.toLowerCase() === "yellow"
                                  ? "#000000"
                                  : "white",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              fontSize: "0.75rem",
                              textTransform: "capitalize",
                              border:
                                model.colour.toLowerCase() === "white"
                                  ? "1px solid #d1d5db"
                                  : "none",
                            }}
                          >
                            {model.colour || "N/A"}
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
                          {model.quantity}
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
                            background: model.purchasedInWarranty
                              ? "#007bff"
                              : "#6c757d",
                            color: "white",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.25rem",
                            fontSize: "0.75rem",
                            fontWeight: "500",
                            display: "inline-block",
                          }}
                        >
                          {model.purchasedInWarranty ? "🛡️ Yes" : "📄 No"}
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
                              model.quantity > 0 ? "#10b981" : "#ef4444",
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
                          {model.quantity > 0 ? "In Stock" : "Out of Stock"}
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
                        {model.purchaseDate
                          ? new Date(model.purchaseDate)
                              .toISOString()
                              .split("T")[0]
                          : new Date(model.createdAt)
                              .toISOString()
                              .split("T")[0]}
                      </td>
                      <td
                        style={{
                          padding: "1rem 1.25rem",
                          borderBottom: "1px solid #f3f4f6",
                          color: "#374151",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            gap: "0.5rem",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <button
                            onClick={() => handleEdit(model._id)}
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
                            onClick={(e) => handleDelete(e, model._id)}
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
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
