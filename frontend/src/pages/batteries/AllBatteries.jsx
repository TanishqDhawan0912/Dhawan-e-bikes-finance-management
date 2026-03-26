import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { formatDate } from "../../utils/dateUtils";

export default function AllBatteries() {
  const navigate = useNavigate();
  const [batteries, setBatteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchSupplier, setSearchSupplier] = useState("");
  const [searchBatteryType, setSearchBatteryType] = useState(""); // "" | "lead" | "lithium"

  const fetchBatteries = useCallback(async () => {
    try {
      console.log("AllBatteries: Starting to fetch batteries data...");

      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(
        `http://localhost:5000/api/batteries?t=${timestamp}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error fetching batteries");
      }

      const batteriesData = await response.json();
      console.log("AllBatteries: Fetched fresh batteries data:", batteriesData);

      setBatteries(batteriesData);
      setError("");
    } catch (err) {
      console.error("AllBatteries: Error fetching batteries:", err);
      setError(err.message || "Error fetching batteries. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatteries();
  }, [fetchBatteries]);

  // Refresh data when window gains focus (when user navigates back from EditBattery/AddBattery)
  useEffect(() => {
    const handleWindowFocus = () => {
      console.log("AllBatteries: Window focused, refreshing data...");
      fetchBatteries();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [fetchBatteries]);

  // Listen for battery data updates from other components
  useEffect(() => {
    const handleBatteryDataUpdated = () => {
      console.log(
        "AllBatteries: Received battery data update event, refreshing..."
      );
      fetchBatteries();
    };

    window.addEventListener("batteryDataUpdated", handleBatteryDataUpdated);

    return () => {
      window.removeEventListener(
        "batteryDataUpdated",
        handleBatteryDataUpdated
      );
    };
  }, [fetchBatteries]);

  // Filter batteries based on search
  const filteredBatteries = batteries.filter((battery) => {
    const nameMatch =
      !searchName.trim() ||
      (battery.name || "").toLowerCase().includes(searchName.toLowerCase());

    const supplierMatch =
      !searchSupplier.trim() ||
      (battery.supplierName || "")
        .toLowerCase()
        .includes(searchSupplier.toLowerCase());

    const batteryTypeMatch =
      !searchBatteryType ||
      (battery.batteryType || "") === searchBatteryType;

    return nameMatch && supplierMatch && batteryTypeMatch;
  });

  // Helper: detect missing purchase price in any stock entry (by purchaseDate)
  // We show a warning only when at least one entry has missing/<=0 purchasePrice.
  const getBatteryPriceStatus = (battery) => {
    const pendingDatesSet = new Set();

    const normalizeDateLabel = (raw) => {
      if (!raw) return "";
      const s = String(raw).trim();
      // If ISO like 2026-02-27T00:00:00.000Z, keep only YYYY-MM-DD
      if (s.includes("T")) return s.split("T")[0];
      return s;
    };

    const isMissing = (v) => {
      if (v === undefined || v === null) return true;
      if (typeof v === "string") return v.trim() === "" || Number(v) <= 0;
      const n = Number(v);
      return Number.isNaN(n) || n <= 0;
    };

    if (battery && Array.isArray(battery.stockEntries)) {
      battery.stockEntries.forEach((entry) => {
        const dateLabel = normalizeDateLabel(entry?.purchaseDate || "");
        if (!dateLabel) return;
        if (isMissing(entry?.purchasePrice)) {
          pendingDatesSet.add(dateLabel);
        }
      });
    }

    const pendingDates = Array.from(pendingDatesSet);

    return {
      hasPending: pendingDates.length > 0,
      pendingDates,
    };
  };

  const handleEdit = (batteryId) => {
    navigate(`/batteries/edit/${batteryId}`);
  };

  const handleAddMore = (batteryId) => {
    navigate(`/batteries/add-more/${batteryId}`);
  };

  const handleDelete = async (batteryId) => {
    if (!window.confirm("Are you sure you want to delete this battery?")) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/batteries/${batteryId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error deleting battery");
      }

      // Remove from local state
      setBatteries(batteries.filter((battery) => battery._id !== batteryId));
    } catch (err) {
      console.error("Error deleting battery:", err);
      setError(err.message || "Error deleting battery. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <h2>All Batteries</h2>
        <p>Loading batteries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <h2>All Batteries</h2>
        <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
        <button className="btn btn-primary" onClick={fetchBatteries}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h2>All Batteries</h2>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/batteries/add")}
        >
          + Add Battery
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
              Battery Name:
            </label>
            <input
              type="text"
              placeholder="Search by battery name..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              style={{
                padding: "0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                width: "100%",
              }}
            />
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
            <input
              type="text"
              placeholder="Search by supplier..."
              value={searchSupplier}
              onChange={(e) => setSearchSupplier(e.target.value)}
              style={{
                padding: "0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                width: "100%",
              }}
            />
          </div>

          <div style={{ flex: "1", minWidth: "140px" }}>
            <label
              style={{
                fontSize: "0.875rem",
                fontWeight: "500",
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Battery Type:
            </label>
            <select
              value={searchBatteryType}
              onChange={(e) => setSearchBatteryType(e.target.value)}
              style={{
                padding: "0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                width: "100%",
              }}
            >
              <option value="">All</option>
              <option value="lead">Lead</option>
              <option value="lithium">Lithium</option>
            </select>
          </div>

          <div>
            <button
              onClick={() => {
                setSearchName("");
                setSearchSupplier("");
                setSearchBatteryType("");
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

        {(searchName || searchSupplier || searchBatteryType) && (
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
            {searchSupplier && (
              <span style={{ marginLeft: "0.5rem" }}>
                Supplier: "{searchSupplier}"
              </span>
            )}
            {searchBatteryType && (
              <span style={{ marginLeft: "0.5rem" }}>
                Type: {searchBatteryType === "lead" ? "Lead" : "Lithium"}
              </span>
            )}
            <span style={{ marginLeft: "0.5rem", fontWeight: "500" }}>
              ({filteredBatteries.length} results)
            </span>
          </div>
        )}
      </div>

      {filteredBatteries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <p>
            {batteries.length === 0
              ? "No batteries found. Add your first battery!"
              : "No batteries found matching your search."}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/batteries/add")}
            style={{ marginTop: "1rem" }}
          >
            Add Battery
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
                  Ampere Value
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
                  Battery Type
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
                  Total Sets
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
                  Total Batteries
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
                  Warranty Status
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
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                >
                  Min Stock Level (Sets)
                </th>
                <th
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "0.75rem",
                    backgroundColor: "#f9fafb",
                    width: "200px",
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredBatteries.map((battery) => (
                <tr key={battery._id}>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "0.75rem",
                      verticalAlign: "middle",
                      textAlign: "center",
                      fontWeight: "600",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div>{battery.name}</div>
                      {(() => {
                        const priceStatus = getBatteryPriceStatus(battery);
                        return (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              fontSize: "0.75rem",
                              marginTop: "0.35rem",
                            }}
                            title={
                              priceStatus.hasPending
                                ? "Some battery stock entries have missing purchase price. Please update purchase price."
                                : "All battery price entries are up to date."
                            }
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
                                {priceStatus.pendingDates.join(", ")}
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
                    {battery.ampereValue
                      ? battery.ampereValue.toString().endsWith("A")
                        ? battery.ampereValue
                        : `${battery.ampereValue}A`
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
                    {battery.batteryType
                      ? battery.batteryType.charAt(0).toUpperCase() +
                        battery.batteryType.slice(1)
                      : "—"}
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
                    {battery.totalSets || 0}
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
                    {battery.batteryType === "lithium"
                      ? battery.totalSets || 0
                      : (battery.batteriesPerSet || 0) * (battery.totalSets || 0) +
                        (battery.openBatteries || 0)}
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
                    {battery.warrantyStatus ? "Warranty" : "No Warranty"}
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
                    ₹{battery.sellingPrice?.toFixed(2) || "0.00"}
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
                    {battery.supplierName || "N/A"}
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
                    {battery.stockEntries && battery.stockEntries.length > 0
                      ? (() => {
                          const sorted = [...battery.stockEntries].sort(
                            (a, b) =>
                              new Date(b.purchaseDate) -
                              new Date(a.purchaseDate)
                          );
                          return formatDate(sorted[0].purchaseDate);
                        })()
                      : battery.purchaseDate
                      ? formatDate(battery.purchaseDate)
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
                    {battery.minStockLevel || 0}
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
                        onClick={() => handleEdit(battery._id)}
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
                        onClick={() => handleDelete(battery._id)}
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
                        onClick={() => handleAddMore(battery._id)}
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
