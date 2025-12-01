import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
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
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("purchasePrice");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [filterWarranty, setFilterWarranty] = useState("all");
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    // Check if user is authenticated
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

  // Fetch models data
  useEffect(() => {
    if (activeSection === "models") {
      fetchModels();
    }
  }, [activeSection]);

  const fetchModels = async () => {
    try {
      setModelsLoading(true);
      setModelsError("");
      const response = await fetch(
        "http://localhost:5000/api/models?limit=1000"
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

    // Apply warranty filter
    if (filterWarranty === "inwarranty") {
      filtered = filtered.filter((model) => model.purchasedInWarranty === true);
    } else if (filterWarranty === "nowarranty") {
      filtered = filtered.filter(
        (model) => model.purchasedInWarranty === false
      );
    }
    // "all" option shows all warranties (no filtering)

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle different data types
      if (sortBy === "quantity" || sortBy === "purchasePrice") {
        aValue = aValue || 0;
        bValue = bValue || 0;
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

  // Group models by all details except colour (each unique combination gets its own group)
  const getModelsGroupedByNameAndCompany = () => {
    const filtered = getFilteredAndSortedModels();
    const grouped = {};

    filtered.forEach((model) => {
      // Create a unique key using all details except colour
      const key = `${model.modelName}-${model.company}-${model.purchaseDate}-${model.purchasedInWarranty}`;

      if (!grouped[key]) {
        grouped[key] = {
          modelName: model.modelName,
          company: model.company,
          purchaseDate: model.purchaseDate,
          purchasedInWarranty: model.purchasedInWarranty,
          colours: [],
          totalQuantity: 0,
          totalValue: 0,
          inWarranty: false,
          models: [],
        };
      }

      // Add colour if not already present
      if (!grouped[key].colours.find((c) => c.colour === model.colour)) {
        grouped[key].colours.push({
          colour: model.colour,
          quantity: model.quantity,
          inWarranty: model.purchasedInWarranty,
          purchasePrice: model.purchasePrice,
        });
      }

      grouped[key].totalQuantity += model.quantity;
      grouped[key].totalValue += (model.purchasePrice || 0) * model.quantity;
      if (model.purchasedInWarranty) grouped[key].inWarranty = true;
      grouped[key].models.push(model);
    });

    // Convert to array and sort by average purchase price in ascending order
    const groupedArray = Object.values(grouped);
    groupedArray.sort((a, b) => {
      // Calculate average price for each group
      const avgPriceA = a.totalValue / a.totalQuantity || 0;
      const avgPriceB = b.totalValue / b.totalQuantity || 0;

      // Sort in ascending order
      return avgPriceA - avgPriceB;
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
    sessionStorage.removeItem("adminAuth");
    navigate("/", { replace: true });
  };

  // If not authenticated, don't render anything (will redirect)
  const isAdminAuth = sessionStorage.getItem("adminAuth");
  if (!isAdminAuth) {
    return null;
  }

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
            <div className="admin-cards">
              <div className="admin-card">
                <h3>Total Spares</h3>
                <p className="card-number">0</p>
                <small>Manage spare parts inventory</small>
              </div>
              <div className="admin-card">
                <h3>Low Stock</h3>
                <p className="card-number">0</p>
                <small>Items below minimum stock</small>
              </div>
              <div className="admin-card">
                <h3>Recent Additions</h3>
                <p className="card-number">0</p>
                <small>Added this week</small>
              </div>
            </div>
            <div className="admin-actions">
              <button
                className="btn btn-primary"
                onClick={() => navigate("/spares")}
              >
                Add New Spare
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate("/spares")}
              >
                View All Spares
              </button>
              <button
                className="btn btn-info"
                onClick={() => navigate("/spares")}
              >
                Stock Report
              </button>
            </div>
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
                onClick={() => navigate("/batteries")}
              >
                Add New Battery
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate("/batteries")}
              >
                View All Batteries
              </button>
              <button
                className="btn btn-info"
                onClick={() => navigate("/batteries")}
              >
                Warranty Report
              </button>
            </div>
          </div>
        );
      case "models": {
        console.log("Rendering models section, models data:", models);
        const groupedModels = getModelsGroupedByNameAndCompany();

        return (
          <div className="admin-content">
            <h2>Models Management</h2>
            <div className="admin-cards">
              <div className="admin-card">
                <h3>Total Models</h3>
                <p className="card-number">
                  {
                    new Set(
                      models.map(
                        (model) =>
                          `${model.modelName || ""}-${model.company || ""}`
                      )
                    ).size
                  }
                </p>
                <small>All vehicle models</small>
              </div>
              <div className="admin-card">
                <h3>Total Quantity</h3>
                <p className="card-number">
                  {models.reduce((sum, m) => sum + m.quantity, 0)}
                </p>
                <small>All vehicles in stock</small>
              </div>
              <div className="admin-card">
                <h3>In Warranty</h3>
                <p className="card-number">
                  {
                    new Set(
                      models
                        .filter((m) => m.purchasedInWarranty)
                        .map(
                          (model) =>
                            `${model.modelName || ""}-${model.company || ""}`
                        )
                    ).size
                  }
                </p>
                <small>Models with warranty coverage</small>
              </div>
              <div className="admin-card">
                <h3>No Warranty</h3>
                <p className="card-number">
                  {
                    new Set(
                      models
                        .filter((m) => !m.purchasedInWarranty)
                        .map(
                          (model) =>
                            `${model.modelName || ""}-${model.company || ""}`
                        )
                    ).size
                  }
                </p>
                <small>Models without warranty coverage</small>
              </div>
              <div className="admin-card">
                <h3>Total Value</h3>
                <p className="card-number">
                  ₹
                  {models
                    .reduce((sum, m) => sum + m.purchasePrice * m.quantity, 0)
                    .toLocaleString()}
                </p>
                <small>Inventory value</small>
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

                {/* Warranty Filter */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                      color: "#495057",
                    }}
                  >
                    Warranty Status:
                  </label>
                  <select
                    value={filterWarranty}
                    onChange={(e) => setFilterWarranty(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <option value="all">All Warranty</option>
                    <option value="inwarranty">In Warranty</option>
                    <option value="nowarranty">No Warranty</option>
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
                    <option value="modelName-asc">Name (A-Z)</option>
                    <option value="modelName-desc">Name (Z-A)</option>
                    <option value="company-asc">Company (A-Z)</option>
                    <option value="company-desc">Company (Z-A)</option>
                    <option value="quantity-asc">Quantity (Low to High)</option>
                    <option value="quantity-desc">
                      Quantity (High to Low)
                    </option>
                    <option value="purchasePrice-asc">
                      Price (Low to High)
                    </option>
                    <option value="purchasePrice-desc">
                      Price (High to Low)
                    </option>
                    <option value="purchasedInWarranty-asc">
                      Warranty (No → Yes)
                    </option>
                    <option value="purchasedInWarranty-desc">
                      Warranty (Yes → No)
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
                  {filterWarranty !== "all" &&
                    ` (${
                      filterWarranty === "inwarranty"
                        ? "in warranty"
                        : "no warranty"
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
                              width: "10%",
                            }}
                            onClick={() => handleSort("purchasePrice")}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#f3f4f6")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "#f9fafb")
                            }
                          >
                            Unit Price{" "}
                            {sortBy === "purchasePrice" &&
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
                            }}
                          >
                            Total Value
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
                            Warranty
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
                              colSpan="9"
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
                                <div>
                                  <div>{group.modelName || "N/A"}</div>
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      fontWeight: "400",
                                      color: "#6b7280",
                                      marginTop: "0.25rem",
                                    }}
                                  >
                                    {group.purchaseDate &&
                                      new Date(
                                        group.purchaseDate
                                      ).toLocaleDateString()}
                                    {group.purchasedInWarranty !==
                                      undefined && (
                                      <span
                                        style={{
                                          marginLeft: "0.5rem",
                                          padding: "0.125rem 0.375rem",
                                          borderRadius: "0.25rem",
                                          fontSize: "0.7rem",
                                          backgroundColor:
                                            group.purchasedInWarranty
                                              ? "#dcfce7"
                                              : "#fef2f2",
                                          color: group.purchasedInWarranty
                                            ? "#166534"
                                            : "#991b1b",
                                        }}
                                      >
                                        {group.purchasedInWarranty
                                          ? "In Warranty"
                                          : "No Warranty"}
                                      </span>
                                    )}
                                  </div>
                                </div>
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
                                    gap: "0.3rem",
                                    alignItems: "center",
                                    lineHeight: "1.2",
                                  }}
                                >
                                  {group.colours.map(
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
                                        {colourItem.colour?.toLowerCase() ===
                                        "white-black" ? (
                                          <div
                                            style={{
                                              width: "16px",
                                              height: "16px",
                                              borderRadius: "50%",
                                              border: "1px solid #cbd5e1",
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
                                          </div>
                                        ) : (
                                          <div
                                            style={{
                                              width: "16px",
                                              height: "16px",
                                              borderRadius: "50%",
                                              backgroundColor: getColourDisplay(
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
                                        navigate(
                                          `/models/edit-color/${group.models[0]._id}`
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
                                  borderLeft: "1px solid #e5e7eb",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "0.75rem",
                                  }}
                                >
                                  {group.models.length > 0 &&
                                  group.models[0].purchasePrice > 0 ? (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "baseline",
                                        gap: "0.5rem",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontWeight: "600",
                                          color: "#111827",
                                          fontSize: "0.9375rem",
                                        }}
                                      >
                                        ₹
                                        {group.models[0].purchasePrice.toLocaleString()}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "0.75rem",
                                          color: "#6b7280",
                                        }}
                                      >
                                        per unit
                                      </span>
                                    </div>
                                  ) : null}
                                  {group.models.length > 0 &&
                                  group.models[0].purchasePrice > 0 ? (
                                    <button
                                      onClick={async () => {
                                        const newPrice = prompt(
                                          `Update purchase price for all ${group.modelName} models in ${group.company}:`,
                                          group.models[0].purchasePrice
                                        );
                                        if (newPrice === null) return; // User cancelled

                                        const numPrice = parseFloat(newPrice);
                                        if (isNaN(numPrice)) {
                                          alert(
                                            "Please enter a valid number for the price."
                                          );
                                          return;
                                        }

                                        if (numPrice < 0) {
                                          alert(
                                            "Price cannot be negative. Please enter a valid price (0 or greater)."
                                          );
                                          return;
                                        }

                                        let successCount = 0;
                                        for (const model of group.models) {
                                          const success =
                                            await updateModelPrice(
                                              model._id,
                                              numPrice.toString()
                                            );
                                          if (success) successCount++;
                                        }
                                        if (
                                          successCount === group.models.length
                                        ) {
                                          alert(
                                            `Price updated to ₹${numPrice.toLocaleString()} for ${successCount} models`
                                          );
                                        } else {
                                          alert(
                                            `Price updated for ${successCount} of ${group.models.length} models`
                                          );
                                        }
                                      }}
                                      style={{
                                        padding: "0.375rem 0.75rem",
                                        fontSize: "0.75rem",
                                        backgroundColor: "#f59e0b",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "0.375rem",
                                        cursor: "pointer",
                                        fontWeight: "500",
                                        transition: "all 0.15s",
                                        boxShadow:
                                          "0 1px 2px rgba(245, 158, 11, 0.2)",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.backgroundColor =
                                          "#d97706";
                                        e.target.style.transform =
                                          "translateY(-1px)";
                                        e.target.style.boxShadow =
                                          "0 4px 6px rgba(245, 158, 11, 0.3)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.backgroundColor =
                                          "#f59e0b";
                                        e.target.style.transform =
                                          "translateY(0)";
                                        e.target.style.boxShadow =
                                          "0 1px 2px rgba(245, 158, 11, 0.2)";
                                      }}
                                      title="Update price for all models in this group"
                                    >
                                      ✏️
                                    </button>
                                  ) : (
                                    <button
                                      onClick={async () => {
                                        const newPrice = prompt(
                                          `Enter purchase price for all ${group.modelName} models in ${group.company}:`
                                        );
                                        if (newPrice === null) return; // User cancelled

                                        const numPrice = parseFloat(newPrice);
                                        if (isNaN(numPrice)) {
                                          alert(
                                            "Please enter a valid number for the price."
                                          );
                                          return;
                                        }

                                        if (numPrice < 0) {
                                          alert(
                                            "Price cannot be negative. Please enter a valid price (0 or greater)."
                                          );
                                          return;
                                        }

                                        let successCount = 0;
                                        for (const model of group.models) {
                                          const success =
                                            await updateModelPrice(
                                              model._id,
                                              numPrice.toString()
                                            );
                                          if (success) successCount++;
                                        }
                                        if (
                                          successCount === group.models.length
                                        ) {
                                          alert(
                                            `Price set to ₹${numPrice.toLocaleString()} for ${successCount} models`
                                          );
                                        } else {
                                          alert(
                                            `Price set for ${successCount} of ${group.models.length} models`
                                          );
                                        }
                                      }}
                                      style={{
                                        padding: "0.5rem 1rem",
                                        fontSize: "0.75rem",
                                        backgroundColor: "#10b981",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "0.375rem",
                                        cursor: "pointer",
                                        fontWeight: "500",
                                        transition: "all 0.15s",
                                        boxShadow:
                                          "0 1px 2px rgba(16, 185, 129, 0.2)",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.target.style.backgroundColor =
                                          "#059669";
                                        e.target.style.transform =
                                          "translateY(-1px)";
                                        e.target.style.boxShadow =
                                          "0 4px 6px rgba(16, 185, 129, 0.3)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.backgroundColor =
                                          "#10b981";
                                        e.target.style.transform =
                                          "translateY(0)";
                                        e.target.style.boxShadow =
                                          "0 1px 2px rgba(16, 185, 129, 0.2)";
                                      }}
                                      title="Add purchase price for all models in this group"
                                    >
                                      + Add Price
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  fontWeight: "600",
                                  color: "#059669",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "baseline",
                                    gap: "0.5rem",
                                  }}
                                >
                                  <span style={{ fontSize: "1rem" }}>
                                    ₹{group.totalValue.toLocaleString()}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#6b7280",
                                    }}
                                  >
                                    total
                                  </span>
                                </div>
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
                                    background: group.inWarranty
                                      ? "#3b82f6"
                                      : "#6b7280",
                                    color: "white",
                                    padding: "0.25rem 0.6rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.7rem",
                                    fontWeight: "500",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                  }}
                                >
                                  <span style={{ fontSize: "0.7rem" }}>
                                    {group.inWarranty ? "" : ""}
                                  </span>
                                  {group.inWarranty
                                    ? "In Warranty"
                                    : "No Warranty"}
                                </span>
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
                                    gap: "0.25rem",
                                    alignItems: "center",
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      // Navigate to edit page for the first model in this group
                                      if (group.models.length > 0) {
                                        navigate(
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
              onClick={() => navigate("/")}
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
