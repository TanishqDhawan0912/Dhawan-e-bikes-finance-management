import React, { useEffect, useMemo, useState } from "react";
import { useSessionTimeout } from "../../hooks/useSessionTimeout";
import { formatDate, getTodayForInput } from "../../utils/dateUtils";
import DatePicker from "../../components/DatePicker";

export default function Scraps() {
  useSessionTimeout();

  const [quantity, setQuantity] = useState("");
  const [entryDate, setEntryDate] = useState(getTodayForInput());
  const [ratePerBattery, setRatePerBattery] = useState("");
  const [scraps, setScraps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editEntryDate, setEditEntryDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const getSourceLabel = (scrap) => {
    const src = String(scrap?.source || "").trim();
    if (src === "oldScooty" || scrap?.oldScootyId) return "Old scooty";
    if (src === "jobcard" || scrap?.jobcardNumber) return "Jobcard";
    return "Manual";
  };

  // Fetch existing scraps
  const fetchScraps = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/battery-scraps", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load scraps");
      }

      const data = await res.json();
      setScraps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching scraps:", err);
      setError(err.message || "Failed to load scrap entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScraps();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!quantity || Number(quantity) <= 0) {
      setError("Please enter a valid number of scrap batteries");
      return;
    }

    if (!entryDate) {
      setError("Please select a date of entry");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/battery-scraps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          quantity: Number(quantity),
          entryDate,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to add scrap entry");
      }

      // Prepend new entry (API already sorts, but we keep UI instant)
      setScraps((prev) => [data, ...prev]);
      setQuantity("");
      setEntryDate(entryDate);
    } catch (err) {
      console.error("Error adding scrap:", err);
      setError(err.message || "Failed to add scrap entry");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (scrap) => {
    if (!scrap?._id) return;
    const dateStr = scrap.entryDate
      ? new Date(scrap.entryDate).toISOString().split("T")[0]
      : getTodayForInput();
    setEditingId(scrap._id);
    setEditQuantity(String(scrap.quantity || ""));
    setEditEntryDate(dateStr);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQuantity("");
    setEditEntryDate("");
  };

  const saveEdit = async (scrapId) => {
    if (!scrapId) return;
    if (!editQuantity || Number(editQuantity) <= 0) {
      setError("Please enter a valid quantity");
      return;
    }
    if (!editEntryDate) {
      setError("Please select a valid date");
      return;
    }
    try {
      setSavingEdit(true);
      setError("");
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/battery-scraps/${scrapId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          quantity: Number(editQuantity),
          entryDate: editEntryDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to update scrap entry");
      }
      setScraps((prev) => prev.map((s) => (s._id === scrapId ? data : s)));
      cancelEdit();
    } catch (err) {
      console.error("Error updating scrap:", err);
      setError(err.message || "Failed to update scrap entry");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (scrap) => {
    if (!scrap?._id) return;
    const ok = window.confirm("Delete this scrap entry?");
    if (!ok) return;
    try {
      setDeletingId(scrap._id);
      setError("");
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/battery-scraps/${scrap._id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete scrap entry");
      }
      setScraps((prev) => prev.filter((s) => s._id !== scrap._id));
      if (editingId === scrap._id) cancelEdit();
    } catch (err) {
      console.error("Error deleting scrap:", err);
      setError(err.message || "Failed to delete scrap entry");
    } finally {
      setDeletingId(null);
    }
  };

  // Group scraps by date and sort within date by time (latest first)
  const groupedScraps = useMemo(() => {
    const groups = {};
    for (const scrap of scraps) {
      const dateKey = scrap.entryDate
        ? new Date(scrap.entryDate).toISOString().split("T")[0]
        : scrap.createdAt
        ? new Date(scrap.createdAt).toISOString().split("T")[0]
        : "Unknown";

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(scrap);
    }

    // Sort dates descending (latest first)
    const sortedDates = Object.keys(groups).sort((a, b) =>
      a < b ? 1 : a > b ? -1 : 0
    );

    return sortedDates.map((date) => {
      const entries = groups[date].slice().sort((a, b) => {
        const timeA = new Date(a.createdAt || a.entryDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.entryDate || 0).getTime();
        return timeB - timeA; // latest first
      });
      return { date, entries };
    });
  }, [scraps]);

  const totals = useMemo(() => {
    const totalScraps = scraps.reduce(
      (sum, scrap) => sum + (scrap.quantity || 0),
      0
    );
    const rate = Number(ratePerBattery) || 0;
    const totalValue = totalScraps * rate;
    return { totalScraps, totalValue, rate };
  }, [scraps, ratePerBattery]);

  return (
    <div className="form-container" style={{ maxWidth: "900px" }}>
      {/* Scrap entry form */}
      <form
        onSubmit={handleSubmit}
        style={{
          marginBottom: "1.5rem",
          padding: "1.5rem",
          borderRadius: "0.5rem",
          border: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <h2
          style={{
            margin: "0 0 1rem 0",
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "#111827",
          }}
        >
          Add Scrap Entry
        </h2>

        {error && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#374151",
              }}
            >
              No. of Scrap Batteries *
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              required
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#374151",
              }}
            >
              Date of Entry *
            </label>
            <DatePicker
              value={entryDate}
              onChange={(date) => setEntryDate(date || getTodayForInput())}
              placeholder="dd/mm/yyyy"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "9999px",
            border: "none",
            backgroundColor: submitting ? "#9ca3af" : "#111827",
            color: "white",
            fontSize: "0.9rem",
            fontWeight: 500,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Saving..." : "Add Scrap"}
        </button>
      </form>

      {/* Scrap entries list */}
      <div
        style={{
          maxHeight: "400px",
          overflowY: "auto",
          paddingRight: "0.25rem",
          marginBottom: "1rem",
        }}
      >
        {loading ? (
          <div style={{ padding: "1rem", textAlign: "center" }}>Loading...</div>
        ) : groupedScraps.length === 0 ? (
          <div
            style={{
              padding: "1rem",
              textAlign: "center",
              color: "#6b7280",
              fontSize: "0.9rem",
            }}
          >
            No scrap entries yet.
          </div>
        ) : (
          groupedScraps.map((group) => (
            <div key={group.date} style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  padding: "0.35rem 0.5rem",
                  backgroundColor: "#f3f4f6",
                  borderRadius: "0.375rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                {formatDate(group.date)}
              </div>
              <div
                style={{
                  marginTop: "0.5rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                }}
              >
                {group.entries.map((scrap, index) => (
                  <div
                    key={scrap._id || `${group.date}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.5rem 0.75rem",
                      backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, color: "#111827" }}>
                        {editingId === scrap._id ? (
                          <span style={{ display: "inline-flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <input
                              type="number"
                              min="1"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              style={{
                                width: "90px",
                                padding: "0.2rem 0.4rem",
                                borderRadius: "0.35rem",
                                border: "1px solid #d1d5db",
                                fontSize: "0.8rem",
                              }}
                            />
                            <div style={{ minWidth: "150px" }}>
                              <DatePicker
                                value={editEntryDate}
                                onChange={(date) =>
                                  setEditEntryDate(date || getTodayForInput())
                                }
                                placeholder="dd/mm/yyyy"
                                style={{
                                  padding: "0.2rem 0.4rem",
                                  borderRadius: "0.35rem",
                                  border: "1px solid #d1d5db",
                                  fontSize: "0.8rem",
                                }}
                              />
                            </div>
                          </span>
                        ) : (
                          <>
                            {scrap.quantity} scrap batteries
                            <span
                              style={{
                                marginLeft: "0.5rem",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                color:
                                  getSourceLabel(scrap) === "Old scooty"
                                    ? "#7c3aed"
                                    : getSourceLabel(scrap) === "Jobcard"
                                    ? "#1d4ed8"
                                    : "#6b7280",
                              }}
                            >
                              (From {getSourceLabel(scrap)})
                            </span>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        {editingId === scrap._id
                          ? "Editing..."
                          : new Date(scrap.createdAt || scrap.entryDate).toLocaleTimeString(
                              undefined,
                              { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                            )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      {editingId === scrap._id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(scrap._id)}
                            disabled={savingEdit}
                            style={{
                              padding: "0.3rem 0.55rem",
                              borderRadius: "0.35rem",
                              border: "1px solid #bbf7d0",
                              backgroundColor: "#f0fdf4",
                              color: "#166534",
                              fontSize: "0.75rem",
                              cursor: savingEdit ? "not-allowed" : "pointer",
                            }}
                          >
                            {savingEdit ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            style={{
                              padding: "0.3rem 0.55rem",
                              borderRadius: "0.35rem",
                              border: "1px solid #e5e7eb",
                              backgroundColor: "#fff",
                              color: "#374151",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(scrap)}
                            title="Edit entry"
                            style={{
                              padding: "0.3rem 0.55rem",
                              borderRadius: "0.35rem",
                              border: "1px solid #bfdbfe",
                              backgroundColor: "#eff6ff",
                              color: "#1d4ed8",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(scrap)}
                            disabled={deletingId === scrap._id}
                            title="Delete entry"
                            style={{
                              padding: "0.3rem 0.55rem",
                              borderRadius: "0.35rem",
                              border: "1px solid #fecaca",
                              backgroundColor:
                                deletingId === scrap._id
                                  ? "#f3f4f6"
                                  : "#fef2f2",
                              color:
                                deletingId === scrap._id
                                  ? "#9ca3af"
                                  : "#dc2626",
                              fontSize: "0.75rem",
                              cursor:
                                deletingId === scrap._id
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {deletingId === scrap._id ? "Deleting..." : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sticky totals */}
      <div
        style={{
          // Keep totals in normal flow so it never overlaps list rows.
          position: "relative",
          padding: "0.75rem 1rem",
          borderRadius: "0.5rem",
          backgroundColor: "#111827",
          color: "white",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          boxShadow: "0 -4px 6px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>Total Scraps</span>
          <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            {totals.totalScraps.toLocaleString()}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            minWidth: "220px",
          }}
        >
          <label
            style={{
              fontSize: "0.75rem",
              opacity: 0.8,
              marginBottom: "0.1rem",
            }}
          >
            Rate per Battery (₹)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="number"
              min="0"
              value={ratePerBattery}
              onChange={(e) => setRatePerBattery(e.target.value)}
              placeholder="Enter rate"
              style={{
                flex: "0 0 110px",
                padding: "0.35rem 0.5rem",
                borderRadius: "9999px",
                border: "1px solid #4b5563",
                backgroundColor: "#111827",
                color: "white",
                fontSize: "0.8rem",
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.1rem",
              }}
            >
              <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>Total Value</span>
              <span
                style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                ₹ {totals.totalValue.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
