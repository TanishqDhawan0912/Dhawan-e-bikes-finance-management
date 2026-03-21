import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSessionTimeout } from "../../hooks/useSessionTimeout";
import { formatDate, getTodayForInput } from "../../utils/dateUtils";
import DatePicker from "../../components/DatePicker";

export default function OldChargers() {
  useSessionTimeout();

  const [voltage, setVoltage] = useState("48V");
  const [batteryType, setBatteryType] = useState("lead");
  const [ampere, setAmpere] = useState("3A");
  const [status, setStatus] = useState("notWorking");
  const [entryDate, setEntryDate] = useState(getTodayForInput());
  const [oldChargers, setOldChargers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Helper to compute per-voltage stats from current data
  const buildVoltageStats = (chargers) => {
    const voltages = ["48V", "60V", "72V", "Other"];
    const stats = {};

    voltages.forEach((v) => {
      stats[v] = { total: 0, working: 0, notWorking: 0 };
    });

    for (const charger of chargers) {
      let v = charger.voltage;
      if (!v || !stats[v]) {
        v = "Other";
      }
      stats[v].total += 1;
      if (charger.status === "working") {
        stats[v].working += 1;
      }
    }

    voltages.forEach((v) => {
      stats[v].notWorking = stats[v].total - stats[v].working;
    });

    return stats;
  };

  // Editable voltage-wise stats (loaded from API or computed from entries)
  const [voltageStats, setVoltageStats] = useState(() => ({
    "48V": { total: 0, working: 0, notWorking: 0 },
    "60V": { total: 0, working: 0, notWorking: 0 },
    "72V": { total: 0, working: 0, notWorking: 0 },
    Other: { total: 0, working: 0, notWorking: 0 },
  }));
  const skipSaveSummaryRef = useRef(true);

  /** Summary uses text + numeric mode (not type=number) so mouse wheel / trackpad never steps values. */
  const parseSummaryInt = (raw) =>
    Math.max(0, parseInt(String(raw ?? "").replace(/\D/g, ""), 10) || 0);

  // Editable numeric box handlers: Total = Work + Not; changing Total only changes Not
  const handleTotalChange = (v, e) => {
    const num = parseSummaryInt(e.target.value);
    setVoltageStats((prev) => {
      const s = prev[v] || { total: 0, working: 0, notWorking: 0 };
      const working = s.working ?? 0;
      const notWorking = Math.max(0, num - working);
      return { ...prev, [v]: { total: num, working, notWorking } };
    });
  };
  const handleWorkChange = (v, e) => {
    const num = parseSummaryInt(e.target.value);
    setVoltageStats((prev) => {
      const s = prev[v] || { total: 0, working: 0, notWorking: 0 };
      const notWorking = s.notWorking ?? 0;
      const total = num + notWorking;
      return { ...prev, [v]: { total, working: num, notWorking } };
    });
  };
  const handleNotChange = (v, e) => {
    const num = parseSummaryInt(e.target.value);
    setVoltageStats((prev) => {
      const s = prev[v] || { total: 0, working: 0, notWorking: 0 };
      const working = s.working ?? 0;
      const total = working + num;
      return { ...prev, [v]: { total, working, notWorking: num } };
    });
  };

  /** Step summary cells with keyboard (↑/↓) like native number inputs; wheel still does nothing (text fields). */
  const handleSummaryArrowKey = (field, v, e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const delta = e.key === "ArrowUp" ? 1 : -1;
    setVoltageStats((prev) => {
      const s = prev[v] || { total: 0, working: 0, notWorking: 0 };
      const working = s.working ?? 0;
      const notWorking = s.notWorking ?? 0;
      const total = s.total ?? 0;
      if (field === "total") {
        const num = Math.max(0, total + delta);
        const nw = Math.max(0, num - working);
        return { ...prev, [v]: { total: num, working, notWorking: nw } };
      }
      if (field === "work") {
        const num = Math.max(0, working + delta);
        const t = num + notWorking;
        return { ...prev, [v]: { total: t, working: num, notWorking } };
      }
      const num = Math.max(0, notWorking + delta);
      const t = working + num;
      return { ...prev, [v]: { total: t, working, notWorking: num } };
    });
  };

  const numInputStyle = (bg) => ({
    width: "2.5rem",
    padding: "0.2rem 0.35rem",
    border: "1px solid #d1d5db",
    borderRadius: "0.35rem",
    fontSize: "0.78rem",
    fontWeight: 600,
    textAlign: "right",
    backgroundColor: bg || "#f9fafb",
    color: "#111827",
  });

  // Fetch existing old charger entries
  const fetchOldChargers = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/old-chargers", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load old chargers");
      }

      const data = await res.json();
      setOldChargers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching old chargers:", err);
      setError(err.message || "Failed to load old charger entries");
    } finally {
      setLoading(false);
    }
  };

  const saveSummary = async (stats) => {
    try {
      const token = localStorage.getItem("token");
      await fetch("http://localhost:5000/api/old-chargers/summary", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ summary: stats }),
      });
    } catch (err) {
      console.error("Error saving old charger summary:", err);
    }
  };

  useEffect(() => {
    fetchOldChargers();
  }, []);

  // After initial load, fetch summary and set voltageStats (saved summary or computed from entries)
  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    fetch("http://localhost:5000/api/old-chargers/summary", {
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
    })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        const volts = ["48V", "60V", "72V", "Other"];
        const allZero = volts.every(
          (v) =>
            (data[v]?.total ?? 0) === 0 &&
            (data[v]?.working ?? 0) === 0 &&
            (data[v]?.notWorking ?? 0) === 0
        );
        if (allZero) {
          setVoltageStats(buildVoltageStats(oldChargers));
        } else {
          setVoltageStats({
            "48V": data["48V"] || { total: 0, working: 0, notWorking: 0 },
            "60V": data["60V"] || { total: 0, working: 0, notWorking: 0 },
            "72V": data["72V"] || { total: 0, working: 0, notWorking: 0 },
            Other: data.Other || { total: 0, working: 0, notWorking: 0 },
          });
        }
      })
      .catch(() => setVoltageStats(buildVoltageStats(oldChargers)));
  }, [loading]);

  // Persist table edits (debounced); skip first run so we don't save on initial load
  useEffect(() => {
    if (skipSaveSummaryRef.current) {
      skipSaveSummaryRef.current = false;
      return;
    }
    const t = setTimeout(() => saveSummary(voltageStats), 600);
    return () => clearTimeout(t);
  }, [voltageStats]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!voltage || !voltage.trim()) {
      setError("Please select voltage (48V, 60V, or 72V)");
      return;
    }

    if (!batteryType || !batteryType.trim()) {
      setError("Please select battery type (Lead or Lithium)");
      return;
    }

    if (!ampere || !ampere.trim()) {
      setError("Please select ampere (3A, 4A, or 5A)");
      return;
    }

    if (!status || !status.trim()) {
      setError("Please select status (Working or Not working)");
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
      
      // entryDate is already in yyyy-mm-dd format from DatePicker
      const res = await fetch("http://localhost:5000/api/old-chargers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          voltage: voltage.trim(),
          batteryType: batteryType.trim(),
          ampere: ampere.trim(),
          status: status.trim(),
          entryDate: entryDate,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to add old charger entry");
      }

      // Prepend new entry (API already sorts, but we keep UI instant)
      setOldChargers((prev) => [data, ...prev]);

      // Apply new entry to summary table (form → summary; reverse does not apply)
      const voltKey = data.voltage && ["48V", "60V", "72V"].includes(data.voltage) ? data.voltage : "Other";
      setVoltageStats((prev) => {
        const s = prev[voltKey] || { total: 0, working: 0, notWorking: 0 };
        const working = data.status === "working" ? (s.working || 0) + 1 : s.working || 0;
        const notWorking = data.status !== "working" ? (s.notWorking || 0) + 1 : s.notWorking || 0;
        const total = (s.total || 0) + 1;
        return { ...prev, [voltKey]: { total, working, notWorking } };
      });

      setVoltage("48V");
      setBatteryType("lead");
      setAmpere("3A");
      setStatus("notWorking");
      // Keep entryDate as today's date
      setEntryDate(getTodayForInput());
    } catch (err) {
      console.error("Error adding old charger:", err);
      setError(err.message || "Failed to add old charger entry");
    } finally {
      setSubmitting(false);
    }
  };

  const [deletingId, setDeletingId] = useState(null);
  const handleDeleteEntry = async (charger) => {
    if (!charger._id) return;
    try {
      setDeletingId(charger._id);
      setError("");
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/old-chargers/${charger._id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete entry");
      }
      setOldChargers((prev) => prev.filter((c) => c._id !== charger._id));
      // Apply delete to summary (entry → summary)
      const voltKey = charger.voltage && ["48V", "60V", "72V"].includes(charger.voltage) ? charger.voltage : "Other";
      setVoltageStats((prev) => {
        const s = prev[voltKey] || { total: 0, working: 0, notWorking: 0 };
        const total = Math.max(0, (s.total || 0) - 1);
        const working = charger.status === "working" ? Math.max(0, (s.working || 0) - 1) : (s.working || 0);
        const notWorking = charger.status !== "working" ? Math.max(0, (s.notWorking || 0) - 1) : (s.notWorking || 0);
        return { ...prev, [voltKey]: { total, working, notWorking } };
      });
    } catch (err) {
      console.error("Error deleting old charger:", err);
      setError(err.message || "Failed to delete entry");
    } finally {
      setDeletingId(null);
    }
  };

  // Group old chargers by date and sort within date by time (latest first)
  const groupedOldChargers = useMemo(() => {
    const groups = {};
    for (const charger of oldChargers) {
      const dateKey = charger.entryDate
        ? new Date(charger.entryDate).toISOString().split("T")[0]
        : charger.createdAt
        ? new Date(charger.createdAt).toISOString().split("T")[0]
        : "Unknown";

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(charger);
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
  }, [oldChargers]);

  const totals = useMemo(() => {
    const all = Object.values(voltageStats);
    const workingChargers = all.reduce((sum, s) => sum + s.working, 0);
    const notWorkingChargers = all.reduce((sum, s) => sum + s.notWorking, 0);
    const totalChargers = workingChargers + notWorkingChargers;
    return {
      totalChargers,
      workingChargers,
      notWorkingChargers,
      effectiveTotal: totalChargers,
    };
  }, [voltageStats]);

  return (
    <div className="form-container" style={{ maxWidth: "1100px" }}>
      {/* Form + Preview side by side */}
      <div
        style={{
          display: "flex",
          gap: "1.25rem",
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        {/* Old charger entry form */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: "1 1 400px",
            minWidth: 0,
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
          Add Old Charger Entry
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
              Voltage *
            </label>
            <select
              value={voltage}
              onChange={(e) => setVoltage(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
              }}
            >
              <option value="48V">48V</option>
              <option value="60V">60V</option>
              <option value="72V">72V</option>
            </select>
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
              Ampere *
            </label>
            <select
              value={ampere}
              onChange={(e) => setAmpere(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
              }}
            >
              <option value="3A">3A</option>
              <option value="4A">4A</option>
              <option value="5A">5A</option>
            </select>
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
              Batt. Type *
            </label>
            <select
              value={batteryType}
              onChange={(e) => setBatteryType(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
              }}
            >
              <option value="lead">Lead</option>
              <option value="lithium">Lithium</option>
            </select>
          </div>

          <div>
            <span
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#374151",
              }}
            >
              Status *
            </span>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
                <input
                  type="radio"
                  name="status"
                  value="working"
                  checked={status === "working"}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ width: "1rem", height: "1rem", accentColor: "#059669" }}
                />
                Working
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
                <input
                  type="radio"
                  name="status"
                  value="notWorking"
                  checked={status === "notWorking"}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ width: "1rem", height: "1rem", accentColor: "#dc2626" }}
                />
                Not working
              </label>
            </div>
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
              Entry Date *
            </label>
            <DatePicker
              value={entryDate}
              onChange={(date) => {
                setEntryDate(date || getTodayForInput());
              }}
              placeholder="dd/mm/yyyy"
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
          {submitting ? "Saving..." : "Add Old Charger"}
        </button>
      </form>

        {/* Preview totals aside */}
        <div
          style={{
            flex: "0 0 auto",
            width: "270px",
            padding: "1rem 1.1rem",
            borderRadius: "0.75rem",
            border: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb",
            color: "#111827",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            boxShadow: "0 10px 18px rgba(15,23,42,0.08)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
              }}
            >
              Old chargers summary
            </div>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "0.15rem 0.5rem",
                borderRadius: "999px",
                backgroundColor: "#111827",
                color: "#f9fafb",
                fontWeight: 500,
              }}
            >
              Today
            </span>
          </div>

          {/* Overall total from table */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.85rem",
              padding: "0.3rem 0.4rem",
              borderRadius: "0.5rem",
              backgroundColor: "#eef2ff",
            }}
          >
            <span style={{ color: "#4f46e5", fontWeight: 500 }}>Overall total</span>
            <span
              style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {totals.effectiveTotal.toLocaleString()}
            </span>
          </div>

          {/* Per-voltage breakdown */}
          <div
            style={{
              marginTop: "0.25rem",
              paddingTop: "0.45rem",
              borderTop: "1px solid #e5e7eb",
              fontSize: "0.8rem",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                columnGap: "0.4rem",
                marginBottom: "0.3rem",
                color: "#6b7280",
                fontSize: "0.75rem",
              }}
            >
              <span>Volt</span>
              <span style={{ textAlign: "right" }}>Total</span>
              <span style={{ textAlign: "right" }}>Work</span>
              <span style={{ textAlign: "right" }}>Not</span>
            </div>

            {["48V", "60V", "72V", "Other"].map((v) => {
              const stats = voltageStats[v] || {
                total: 0,
                working: 0,
                notWorking: 0,
              };
              const hasData = stats.total > 0;
              const totalVal = stats.total || 0;
              const workVal = stats.working || 0;
              const notVal = stats.notWorking || 0;
              return (
                <div
                  key={v}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    columnGap: "0.4rem",
                    marginBottom: "0.2rem",
                    fontSize: "0.78rem",
                    padding: hasData ? "0.25rem 0.3rem" : "0.15rem 0.3rem",
                    borderRadius: "0.35rem",
                    backgroundColor: hasData ? "#ffffff" : "transparent",
                    border: hasData ? "1px solid #e5e7eb" : "1px solid transparent",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{v}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={`${v} total`}
                    value={String(totalVal)}
                    onChange={(e) => handleTotalChange(v, e)}
                    onKeyDown={(e) => handleSummaryArrowKey("total", v, e)}
                    style={{ ...numInputStyle("#f9fafb") }}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={`${v} working`}
                    value={String(workVal)}
                    onChange={(e) => handleWorkChange(v, e)}
                    onKeyDown={(e) => handleSummaryArrowKey("work", v, e)}
                    style={{ ...numInputStyle("rgba(34,197,94,0.15)"), color: "#166534" }}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={`${v} not working`}
                    value={String(notVal)}
                    onChange={(e) => handleNotChange(v, e)}
                    onKeyDown={(e) => handleSummaryArrowKey("not", v, e)}
                    style={{ ...numInputStyle("rgba(239,68,68,0.15)"), color: "#991b1b" }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Old charger entries list */}
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
        ) : groupedOldChargers.length === 0 ? (
          <div
            style={{
              padding: "1rem",
              textAlign: "center",
              color: "#6b7280",
              fontSize: "0.9rem",
            }}
          >
            No old charger entries yet.
          </div>
        ) : (
          groupedOldChargers.map((group) => (
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
                {group.entries.map((charger, index) => (
                  <div
                    key={charger._id || `${group.date}-${index}`}
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
                        {charger.voltage}{charger.ampere ? ` - ${charger.ampere}` : ""} - {charger.batteryType ? charger.batteryType.charAt(0).toUpperCase() + charger.batteryType.slice(1) : charger.batteryType}
                        {charger.status && (
                          <span style={{ marginLeft: "0.5rem", fontWeight: 600, color: charger.status === "working" ? "#059669" : "#dc2626" }}>
                            • {charger.status === "working" ? "Working" : "Not working"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        {new Date(charger.createdAt || charger.entryDate).toLocaleTimeString(
                          undefined,
                          { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(charger)}
                      disabled={deletingId === charger._id}
                      title="Delete entry"
                      style={{
                        padding: "0.35rem 0.6rem",
                        border: "1px solid #e5e7eb",
                        borderRadius: "0.375rem",
                        backgroundColor: deletingId === charger._id ? "#f3f4f6" : "#fff",
                        color: "#dc2626",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        cursor: deletingId === charger._id ? "not-allowed" : "pointer",
                      }}
                    >
                      {deletingId === charger._id ? "..." : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

