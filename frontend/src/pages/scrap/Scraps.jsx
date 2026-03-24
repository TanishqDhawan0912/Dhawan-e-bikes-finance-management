import React, { useEffect, useMemo, useState } from "react";
import { useSessionTimeout } from "../../hooks/useSessionTimeout";
import { formatDate } from "../../utils/dateUtils";

export default function Scraps() {
  useSessionTimeout();

  const [quantity, setQuantity] = useState("");
  const [entryDate, setEntryDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [ratePerBattery, setRatePerBattery] = useState("");
  const [scraps, setScraps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
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
                        {scrap.quantity} scrap batteries
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        {new Date(scrap.createdAt || scrap.entryDate).toLocaleTimeString(
                          undefined,
                          { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                        )}
                      </div>
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
