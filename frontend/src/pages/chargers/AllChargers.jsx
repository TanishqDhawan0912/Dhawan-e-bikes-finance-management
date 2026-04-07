import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { formatDate } from "../../utils/dateUtils";

import { API_BASE } from "../../config/api";
import { getFetchErrorMessage } from "../../utils/apiError";
export default function AllChargers() {
  const navigate = useNavigate();
  const [chargers, setchargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchSupplier, setSearchSupplier] = useState("");

  const fetchchargers = useCallback(async () => {
    try {
      console.log("AllChargers: Starting to fetch chargers data...");

      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(
        `${API_BASE}/chargers?t=${timestamp}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error fetching chargers");
      }

      const chargersData = await response.json();
      console.log("AllChargers: Fetched fresh chargers data:", chargersData);

      setchargers(chargersData);
      setError("");
    } catch (err) {
      console.error("AllChargers: Error fetching chargers:", err);
      setError(err.message || "Error fetching chargers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchchargers();
  }, [fetchchargers]);

  // Refresh data when window gains focus (when user navigates back from EditCharger/AddCharger)
  useEffect(() => {
    const handleWindowFocus = () => {
      console.log("AllChargers: Window focused, refreshing data...");
      fetchchargers();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [fetchchargers]);

  // Listen for Charger data updates from other components
  useEffect(() => {
    const handleChargerDataUpdated = () => {
      console.log(
        "AllChargers: Received Charger data update event, refreshing..."
      );
      fetchchargers();
    };

    window.addEventListener("chargerDataUpdated", handleChargerDataUpdated);

    return () => {
      window.removeEventListener(
        "chargerDataUpdated",
        handleChargerDataUpdated
      );
    };
  }, [fetchchargers]);

  // Filter chargers based on search
  const filteredchargers = chargers.filter((Charger) => {
    const nameMatch =
      !searchName.trim() ||
      (Charger.name || "").toLowerCase().includes(searchName.toLowerCase());

    const supplierMatch =
      !searchSupplier.trim() ||
      (Charger.supplierName || "")
        .toLowerCase()
        .includes(searchSupplier.toLowerCase());

    return nameMatch && supplierMatch;
  });

  // Helper: detect missing purchase price in any charger stock entry
  // Collects purchaseDate for which purchasePrice is missing/empty/<= 0.
  const getChargerPriceStatus = (Charger) => {
    const pendingDatesSet = new Set();

    const normalizeDateLabel = (raw) => {
      if (!raw) return "";
      const s = String(raw).trim();
      // If ISO like 2026-02-27T00:00:00.000Z, keep only YYYY-MM-DD
      if (s.includes("T")) return s.split("T")[0];
      return s;
    };

    const formatPendingDate = (raw) => {
      const s = normalizeDateLabel(raw);
      if (!s) return "";

      // Expect YYYY-MM-DD -> DD/MM/YY
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        const yy = m[1].slice(2);
        return `${m[3]}/${m[2]}/${yy}`;
      }

      // If already in dd/mm/yyyy, convert to dd/mm/yy
      const parts = s.split("/");
      if (parts.length === 3) {
        const [dd, mm, yyyyOrYy] = parts;
        if (typeof yyyyOrYy === "string" && yyyyOrYy.length === 4) {
          return `${dd}/${mm}/${yyyyOrYy.slice(2)}`;
        }
      }

      return s;
    };

    const isMissing = (v) => {
      if (v === undefined || v === null) return true;
      if (typeof v === "string") return v.trim() === "" || Number(v) <= 0;
      const n = Number(v);
      return Number.isNaN(n) || n <= 0;
    };

    if (Charger && Array.isArray(Charger.stockEntries)) {
      Charger.stockEntries.forEach((entry) => {
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
      formatPendingDate,
    };
  };

  const handleEdit = (ChargerId) => {
    navigate(`/chargers/edit/${ChargerId}`);
  };

  const handleAddMore = (ChargerId) => {
    navigate(`/chargers/add-more/${ChargerId}`);
  };

  const handleDelete = async (ChargerId) => {
    if (!window.confirm("Are you sure you want to delete this Charger?")) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/chargers/${ChargerId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          await getFetchErrorMessage(response, "Error deleting Charger")
        );
      }

      // Remove from local state
      setchargers(chargers.filter((Charger) => Charger._id !== ChargerId));
    } catch (err) {
      console.error("Error deleting Charger:", err);
      setError(err.message || "Error deleting Charger. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <h2>All chargers</h2>
        <p>Loading chargers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <h2>All chargers</h2>
        <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
        <button className="btn btn-primary" onClick={fetchchargers}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header-row">
        <h2 style={{ margin: 0 }}>All chargers</h2>
        <button
          className="btn btn-primary page-header-action"
          onClick={() => navigate("/chargers/add")}
        >
          + Add Charger
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
              Charger Name:
            </label>
            <input
              type="text"
              placeholder="Search by Charger name..."
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

          <div>
            <button
              onClick={() => {
                setSearchName("");
                setSearchSupplier("");
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

        {(searchName || searchSupplier) && (
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
            <span style={{ marginLeft: "0.5rem", fontWeight: "500" }}>
              ({filteredchargers.length} results)
            </span>
          </div>
        )}
      </div>

      {filteredchargers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <p>
            {chargers.length === 0
              ? "No chargers found. Add your first Charger!"
              : "No chargers found matching your search."}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/chargers/add")}
            style={{ marginTop: "1rem" }}
          >
            Add Charger
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
                  Batt. Type
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
                  Voltage-Ampere
                </th>
                <th
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "0.75rem",
                    backgroundColor: "#f9fafb",
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                  title="Units currently available (after sales)"
                >
                  Left in stock
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
                  Selling Price (Warranty)
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
                  Min Stock Level
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
              {filteredchargers.map((Charger) => (
                <tr key={Charger._id}>
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
                      <div>{Charger.name}</div>
                      {(() => {
                        const priceStatus = getChargerPriceStatus(Charger);
                        return (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              fontSize: "0.75rem",
                              marginTop: "0.35rem",
                              justifyContent: "center",
                            }}
                            title={
                              priceStatus.hasPending
                                ? "Some charger stock entries have missing purchase price. Please update purchase price."
                                : "All charger price entries are up to date."
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
                                {priceStatus.pendingDates
                                  .map((d) => priceStatus.formatPendingDate(d))
                                  .filter(Boolean)
                                  .join(", ")}
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
                    {Charger.batteryType || "N/A"}
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
                    {Charger.voltage || "N/A"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "0.75rem",
                      verticalAlign: "middle",
                      textAlign: "center",
                      fontWeight: "700",
                      fontSize: "1.05rem",
                      color:
                        (Number(Charger.quantity) || 0) <=
                        (Number(Charger.minStockLevel) || 0)
                          ? "#b45309"
                          : "#059669",
                    }}
                    title="Current quantity available to sell"
                  >
                    {Number(Charger.quantity) || 0}
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
                    ₹{Charger.sellingPrice?.toFixed(2) || "0.00"}
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
                    {Charger.supplierName || "N/A"}
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
                    {Charger.stockEntries && Charger.stockEntries.length > 0
                      ? (() => {
                          const sorted = [...Charger.stockEntries].sort(
                            (a, b) =>
                              new Date(b.purchaseDate) -
                              new Date(a.purchaseDate)
                          );
                          return formatDate(sorted[0].purchaseDate);
                        })()
                      : Charger.purchaseDate
                      ? formatDate(Charger.purchaseDate)
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
                    {Charger.minStockLevel || 0}
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
                        onClick={() => handleEdit(Charger._id)}
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
                        onClick={() => handleDelete(Charger._id)}
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
                        onClick={() => handleAddMore(Charger._id)}
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

