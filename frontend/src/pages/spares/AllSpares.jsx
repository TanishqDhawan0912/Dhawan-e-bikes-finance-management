import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithRetry } from "../../config/api";
import { getTextColorForBackground } from "../../utils/themeUtils";
import { getFetchErrorMessage } from "../../utils/apiError";
import {
  collectPendingPurchaseDateKeys,
  formatPendingPurchaseDatesJoined,
} from "../../utils/purchasePriceStatus";

/** Same piece count as Add More Stock "Total Stock": layers first, then legacy quantity. */
function getSpareTotalStockPieces(spare) {
  if (!spare) return 0;
  if (Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0) {
    return spare.colorQuantity.reduce(
      (sum, cq) => sum + parseInt(cq.quantity || 0, 10),
      0
    );
  }
  if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
    return spare.stockEntries.reduce(
      (sum, entry) => sum + parseInt(entry.quantity || 0, 10),
      0
    );
  }
  const q = spare.quantity;
  if (typeof q === "number" && !Number.isNaN(q)) return q;
  const parsed = parseInt(q, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function AllSpares() {
  const navigate = useNavigate();
  const [spares, setSpares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchModel, setSearchModel] = useState("");
  const [searchSupplier, setSearchSupplier] = useState("");
  const [sortOption, setSortOption] = useState("latest");

  const fetchSpares = useCallback(async () => {
    try {
      console.log("AllSpares: Starting to fetch spares data...");

      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const response = await fetchWithRetry(
        `/spares?t=${timestamp}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error fetching spares");
      }

      const sparesData = await response.json();
      console.log("AllSpares: Fetched fresh spares data:", sparesData);

      // Log specific spare quantities to verify they're updated
      sparesData.forEach((spare) => {
        console.log(
          `AllSpares: Spare "${spare.name}" has quantity: ${spare.quantity} (ID: ${spare._id})`
        );
      });

      console.log("AllSpares: About to update React state with new data");
      setSpares(sparesData);
      setError("");
    } catch (err) {
      console.error("AllSpares: Error fetching spares:", err);
      setError(err.message || "Error fetching spares. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpares();
  }, [fetchSpares]);

  // Refresh data when window gains focus (when user navigates back from EditSpare/AddMoreStock)
  useEffect(() => {
    const handleWindowFocus = () => {
      console.log("AllSpares: Window focused, refreshing data...");
      fetchSpares();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [fetchSpares]);

  // Listen for spare data updates from other components
  useEffect(() => {
    const handleSpareDataUpdated = () => {
      console.log("AllSpares: Received spare data update event, refreshing...");
      fetchSpares();
    };

    const handleSpareQuantityChanged = (event) => {
      console.log(
        "AllSpares: Received specific quantity change event:",
        event.detail
      );
      console.log(
        "AllSpares: New quantity from event:",
        event.detail.newQuantity
      );

      const { spareId, newQuantity } = event.detail;

      // Immediately update the local state with the new quantity
      setSpares((prevSpares) =>
        prevSpares.map((spare) =>
          spare._id === spareId ? { ...spare, quantity: newQuantity } : spare
        )
      );

      console.log(
        "AllSpares: Updated local state immediately with new quantity"
      );

      // Still fetch from database to ensure consistency
      setTimeout(() => {
        console.log("AllSpares: Fetching from database to confirm update...");
        fetchSpares();
      }, 500);
    };

    window.addEventListener("spareDataUpdated", handleSpareDataUpdated);
    window.addEventListener("spareQuantityChanged", handleSpareQuantityChanged);

    return () => {
      window.removeEventListener("spareDataUpdated", handleSpareDataUpdated);
      window.removeEventListener(
        "spareQuantityChanged",
        handleSpareQuantityChanged
      );
    };
  }, [fetchSpares]);

  // Optimize filtering with useMemo
  const filteredSpares = useMemo(() => {
    const filtered = spares.filter((spare) => {
      const nameMatch =
        !searchName.trim() ||
        (spare.name || "").toLowerCase().includes(searchName.toLowerCase());

      const modelMatch =
        !searchModel.trim() ||
        (spare.models &&
          spare.models.some((model) =>
            model.toLowerCase().includes(searchModel.toLowerCase())
          ));

      const supplierMatch =
        !searchSupplier.trim() ||
        (spare.supplierName || "")
          .toLowerCase()
          .includes(searchSupplier.toLowerCase());

      return nameMatch && modelMatch && supplierMatch;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortOption === "name_asc") {
        return String(a?.name || "").localeCompare(
          String(b?.name || ""),
          undefined,
          { sensitivity: "base" }
        );
      }
      if (sortOption === "name_desc") {
        return String(b?.name || "").localeCompare(
          String(a?.name || ""),
          undefined,
          { sensitivity: "base" }
        );
      }
      if (sortOption === "price_low_high") {
        return (Number(a?.sellingPrice) || 0) - (Number(b?.sellingPrice) || 0);
      }
      if (sortOption === "price_high_low") {
        return (Number(b?.sellingPrice) || 0) - (Number(a?.sellingPrice) || 0);
      }
      if (sortOption === "oldest") {
        return (
          new Date(a?.createdAt || 0).getTime() -
          new Date(b?.createdAt || 0).getTime()
        );
      }
      // Default: latest added
      return (
        new Date(b?.createdAt || 0).getTime() -
        new Date(a?.createdAt || 0).getTime()
      );
    });
    return sorted;
  }, [spares, searchName, searchModel, searchSupplier, sortOption]);

  // Debug: Log current state
  console.log("Debug - Spares:", spares.length);
  console.log("Debug - Filtered:", filteredSpares.length);
  console.log("Debug - Search states:", {
    searchName,
    searchModel,
    searchSupplier,
  });

  const handleEdit = (spareId) => {
    navigate(`/spares/edit/${spareId}`);
  };

  const handleDelete = async (spareId) => {
    if (!window.confirm("Are you sure you want to delete this spare?")) {
      return;
    }

    try {
      const response = await fetchWithRetry(
        `/spares/${spareId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          await getFetchErrorMessage(response, "Error deleting spare")
        );
      }

      // Remove from local state
      setSpares(spares.filter((spare) => spare._id !== spareId));
    } catch (err) {
      console.error("Error deleting spare:", err);
      setError(err.message || "Error deleting spare. Please try again.");
    }
  };

  const handleAddMore = (spareId) => {
    navigate(`/spares/add-more/${spareId}`);
  };

  // Helper: safely parse purchase dates (supports dd/mm/yyyy and ISO strings)
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

  // Helper: get latest purchase date from both stockEntries and colorQuantity
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

    // Show the date string exactly as stored (already in display format)
    return latest.raw;
  };

  const getSparePriceStatus = (spare) => {
    const pendingDates = collectPendingPurchaseDateKeys(
      spare?.stockEntries,
      spare?.colorQuantity
    );
    return {
      hasPending: pendingDates.length > 0,
      pendingDates,
    };
  };

  if (loading) {
    return (
      <div className="page-content">
        <h2>All Spares</h2>
        <p>Loading spares...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <h2>All Spares</h2>
        <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
        <button className="btn btn-primary" onClick={fetchSpares}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header-row">
        <h2 style={{ margin: 0 }}>All Spares</h2>
        <button
          className="btn btn-primary page-header-action"
          onClick={() => navigate("/spares/add")}
        >
          + Add Spare
        </button>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <h3
          style={{
            marginBottom: "1rem",
            fontSize: "1.125rem",
            fontWeight: "500",
          }}
        >
          Search Filters
        </h3>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: "1", minWidth: "200px" }}>
            <label
              style={{
                fontSize: "0.875rem",
                fontWeight: "500",
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Spare Name:
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search by spare name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  width: "100%",
                }}
              />
            </div>
          </div>

          <div style={{ flex: "1", minWidth: "200px" }}>
            <label
              style={{
                fontSize: "0.875rem",
                fontWeight: "500",
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Sort:
            </label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              style={{
                padding: "0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                width: "100%",
                backgroundColor: "#fff",
              }}
            >
              <option value="latest">Latest Added</option>
              <option value="oldest">Oldest Added</option>
              <option value="name_asc">Name (A to Z)</option>
              <option value="name_desc">Name (Z to A)</option>
              <option value="price_low_high">Price (Low to High)</option>
              <option value="price_high_low">Price (High to Low)</option>
            </select>
          </div>

          <div style={{ flex: "1", minWidth: "200px" }}>
            <label
              style={{
                fontSize: "0.875rem",
                fontWeight: "500",
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Model:
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search by model..."
                value={searchModel}
                onChange={(e) => setSearchModel(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  width: "100%",
                }}
              />
            </div>
          </div>

          <div style={{ flex: "1", minWidth: "200px" }}>
            <label
              style={{
                fontSize: "0.875rem",
                fontWeight: "500",
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Supplier Name:
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search by supplier..."
                value={searchSupplier}
                onChange={(e) => setSearchSupplier(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  width: "100%",
                }}
              />
            </div>
          </div>

          <div>
            <button
              onClick={() => {
                setSearchName("");
                setSearchModel("");
                setSearchSupplier("");
                setSortOption("latest");
              }}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        {(searchName || searchModel || searchSupplier) && (
          <div
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              color: "#6b7280",
            }}
          >
            Active filters:
            {searchName && (
              <span style={{ marginLeft: "0.5rem" }}>Name: "{searchName}"</span>
            )}
            {searchModel && (
              <span style={{ marginLeft: "0.5rem" }}>
                Model: "{searchModel}"
              </span>
            )}
            {searchSupplier && (
              <span style={{ marginLeft: "0.5rem" }}>
                Supplier: "{searchSupplier}"
              </span>
            )}
            <span style={{ marginLeft: "0.5rem", fontWeight: "500" }}>
              ({filteredSpares.length} results)
            </span>
          </div>
        )}
      </div>

      {filteredSpares.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <p>
            {spares.length === 0
              ? "No spares found. Add your first spare part!"
              : "No spares found matching your search."}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/spares/add")}
            style={{ marginTop: "1rem" }}
          >
            Add Spare
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table
            className="simple-table"
            style={{
              border: "1px solid #e5e7eb",
              borderCollapse: "collapse",
              width: "100%",
              borderRadius: "0.5rem",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "0.75rem",
                    backgroundColor: "#f9fafb",
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                >
                  Name
                </th>
                <th
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "0.75rem",
                    backgroundColor: "#f9fafb",
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                >
                  Models
                </th>
                <th
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "0.75rem",
                    backgroundColor: "#f9fafb",
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                >
                  Total Quantity
                </th>
                <th
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "0.75rem",
                    backgroundColor: "#f9fafb",
                    width: "120px",
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                >
                  Color with Quantity
                </th>
                <th
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "0.75rem",
                    backgroundColor: "#f9fafb",
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                >
                  Selling Price
                </th>
                <th
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "0.75rem",
                    backgroundColor: "#f9fafb",
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                >
                  Supplier Name
                </th>
                <th
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "0.75rem",
                    backgroundColor: "#f9fafb",
                    width: "150px",
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                >
                  Last Purchase Date
                </th>
                <th
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "0.75rem",
                    backgroundColor: "#f9fafb",
                    width: "280px",
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSpares.map((spare) => (
                <tr key={spare._id}>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "0.75rem",
                      verticalAlign: "middle",
                      textAlign: "center",
                      fontWeight: "600",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <div>{spare.name}</div>
                      {(() => {
                        const priceStatus = getSparePriceStatus(spare);
                        return (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              fontSize: "0.75rem",
                              marginTop: "-0.05rem",
                              justifyContent: "center",
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
                        );
                      })()}
                    </div>
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "0.75rem",
                      verticalAlign: "middle",
                      textAlign: "center",
                      fontWeight: "600",
                    }}
                  >
                    {spare.models && spare.models.length > 0
                      ? spare.models.join(", ")
                      : "N/A"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "0.75rem",
                      verticalAlign: "middle",
                      textAlign: "center",
                      fontWeight: "600",
                    }}
                  >
                    {getSpareTotalStockPieces(spare)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "0.75rem",
                      verticalAlign: "middle",
                      textAlign: "center",
                      fontWeight: "600",
                    }}
                  >
                    {spare.colorQuantity && spare.colorQuantity.length > 0
                      ? (() => {
                          // Group colors by name (case-insensitive) and sum quantities
                          const colorMap = new Map();
                          spare.colorQuantity.forEach((cq) => {
                            const colorKey = (cq.color || "")
                              .toLowerCase()
                              .trim();
                            const existing = colorMap.get(colorKey);
                            if (existing) {
                              colorMap.set(colorKey, {
                                color: cq.color, // Keep original case for display
                                quantity:
                                  existing.quantity +
                                  (parseInt(cq.quantity) || 0),
                              });
                            } else {
                              colorMap.set(colorKey, {
                                color: cq.color,
                                quantity: parseInt(cq.quantity) || 0,
                              });
                            }
                          });
                          const groupedColors = Array.from(colorMap.values());
                          return groupedColors.map((cq, index) => (
                          <div
                            key={index}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              marginBottom:
                                  index < groupedColors.length - 1
                                  ? "0.25rem"
                                  : "0",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                fontSize: "0.75rem",
                                fontWeight: "500",
                                color: getTextColorForBackground(
                                  cq.color.toLowerCase() === "red"
                                    ? "#dc2626"
                                    : cq.color.toLowerCase() === "blue"
                                    ? "#2563eb"
                                    : cq.color.toLowerCase() === "green"
                                    ? "#16a34a"
                                    : cq.color.toLowerCase() === "yellow"
                                    ? "#ca8a04"
                                    : cq.color.toLowerCase() === "black"
                                    ? "#000000"
                                    : cq.color.toLowerCase() === "white"
                                    ? "#ffffff"
                                    : cq.color.toLowerCase() === "orange"
                                    ? "#ea580c"
                                    : cq.color.toLowerCase() === "purple"
                                    ? "#9333ea"
                                    : cq.color.toLowerCase() === "pink"
                                    ? "#ec4899"
                                    : cq.color.toLowerCase() === "gray" ||
                                      cq.color.toLowerCase() === "grey"
                                    ? "#6b7280"
                                    : cq.color.toLowerCase() === "brown"
                                    ? "#92400e"
                                    : cq.color.toLowerCase() === "silver"
                                    ? "#94a3b8"
                                    : cq.color.toLowerCase() === "gold"
                                    ? "#eab308"
                                    : "#6b7280" // default gray for unknown colors
                                ),
                                backgroundColor:
                                  cq.color.toLowerCase() === "red"
                                    ? "#dc2626"
                                    : cq.color.toLowerCase() === "blue"
                                    ? "#2563eb"
                                    : cq.color.toLowerCase() === "green"
                                    ? "#16a34a"
                                    : cq.color.toLowerCase() === "yellow"
                                    ? "#ca8a04"
                                    : cq.color.toLowerCase() === "black"
                                    ? "#000000"
                                    : cq.color.toLowerCase() === "white"
                                    ? "#ffffff"
                                    : cq.color.toLowerCase() === "orange"
                                    ? "#ea580c"
                                    : cq.color.toLowerCase() === "purple"
                                    ? "#9333ea"
                                    : cq.color.toLowerCase() === "pink"
                                    ? "#ec4899"
                                    : cq.color.toLowerCase() === "gray" ||
                                      cq.color.toLowerCase() === "grey"
                                    ? "#6b7280"
                                    : cq.color.toLowerCase() === "brown"
                                    ? "#92400e"
                                    : cq.color.toLowerCase() === "silver"
                                    ? "#94a3b8"
                                    : cq.color.toLowerCase() === "gold"
                                    ? "#eab308"
                                    : "#6b7280", // default gray for unknown colors
                                border:
                                  cq.color.toLowerCase() === "white"
                                    ? "1px solid #d1d5db"
                                    : "none",
                                textShadow:
                                  cq.color.toLowerCase() === "white" ||
                                  cq.color.toLowerCase() === "yellow"
                                    ? "1px 1px 2px rgba(0,0,0,0.5)"
                                    : "none",
                              }}
                            >
                              {cq.color}: {cq.quantity}
                            </span>
                          </div>
                          ));
                        })()
                      : "N/A"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "0.75rem",
                      verticalAlign: "middle",
                      textAlign: "center",
                      fontWeight: "600",
                    }}
                  >
                    ₹{spare.sellingPrice?.toFixed(2) || "0.00"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "0.75rem",
                      verticalAlign: "middle",
                      textAlign: "center",
                      fontWeight: "600",
                    }}
                  >
                    {spare.supplierName || "N/A"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "0.75rem",
                      verticalAlign: "middle",
                      textAlign: "center",
                      fontWeight: "600",
                    }}
                  >
                    {getLastPurchaseDate(spare)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "0.75rem",
                      verticalAlign: "middle",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: "0.5rem",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        className="btn"
                        style={{
                          padding: "0.25rem 0.75rem",
                          fontSize: "0.875rem",
                        }}
                        onClick={() => handleEdit(spare._id)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn"
                        style={{
                          backgroundColor: "#fee2e2",
                          color: "#dc2626",
                          padding: "0.25rem 0.75rem",
                          fontSize: "0.875rem",
                        }}
                        onClick={() => handleDelete(spare._id)}
                      >
                        Delete
                      </button>
                      <button
                        className="btn"
                        style={{
                          backgroundColor: "#dbeafe",
                          color: "#1d4ed8",
                          padding: "0.25rem 0.75rem",
                          fontSize: "0.875rem",
                        }}
                        onClick={() => handleAddMore(spare._id)}
                      >
                        Add More
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default React.memo(AllSpares);
