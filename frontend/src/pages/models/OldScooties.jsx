import React, { useEffect, useRef, useState } from "react";
import { useSessionTimeout } from "../../hooks/useSessionTimeout";
import {
  formatDate,
  formatDateForInput,
  getTodayForInput,
} from "../../utils/dateUtils";
import DatePicker from "../../components/DatePicker";
import { fetchWithRetry } from "../../config/api";

const OLD_SCOOTIES_API = "/old-scooties";

/** Spare id from API may be an ObjectId string or a populated `{ _id }` ref. */
const normalizeOldScootySpareId = (raw) => {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object" && raw._id != null) return raw._id;
  return raw;
};

export default function OldScooties() {
  useSessionTimeout();

  const [name, setName] = useState("");
  const [pmcNo, setPmcNo] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [withBattery, setWithBattery] = useState(false);
  const [batteryType, setBatteryType] = useState("Lead"); // "Lead" or "Lithium"
  const [batteryCount, setBatteryCount] = useState("1");
  const [withCharger, setWithCharger] = useState(false);
  const [chargerType, setChargerType] = useState("Lead"); // "Lead" or "Lithium"
  const [chargerVoltageAmpere, setChargerVoltageAmpere] = useState("");
  const [chargerWorking, setChargerWorking] = useState("working"); // "working" | "notWorking"
  const [entryDate, setEntryDate] = useState(getTodayForInput());
  const [status, setStatus] = useState("not-ready"); // "ready" | "not-ready"
  const [oldScooties, setOldScooties] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [oldScootySpares, setOldScootySpares] = useState([]); // [{ spareId, name, quantity, color? }]
  const [allSparesForOldScooty, setAllSparesForOldScooty] = useState([]);
  const [oldScootySpareName, setOldScootySpareName] = useState("");
  const [oldScootySpareQty, setOldScootySpareQty] = useState("1");
  const [oldScootySpareColor, setOldScootySpareColor] = useState("");
  const [oldScootySpareSuggestions, setOldScootySpareSuggestions] = useState([]);
  const [showOldScootySpareSuggestions, setShowOldScootySpareSuggestions] =
    useState(false);
  const [oldScootySpareSelectedIndex, setOldScootySpareSelectedIndex] =
    useState(-1);
  const [selectedSpareForOldScooty, setSelectedSpareForOldScooty] =
    useState(null);
  const oldScootySpareSuggestionsRef = useRef(null);

  const normalizePmc = (v) =>
    String(v || "")
      .trim()
      .toLowerCase()
      .replace(/^pmc-?/i, "")
      .replace(/\s+/g, "");

  const normalizeVoltageText = (raw) => {
    const s = String(raw || "").trim();
    if (!s) return "";
    // If user entered only digits (e.g. "60"), show/store as "60V".
    if (/^\d{2,3}$/.test(s)) return `${s}V`;
    // If user entered like "60 v" or "60V", normalize to "60V".
    const compact = s.replace(/\s+/g, "").toUpperCase();
    const m = compact.match(/^(\d{2,3})V?$/);
    if (m) return `${m[1]}V`;
    // Otherwise keep as-is (supports "60V3A", "72V", etc.).
    return s;
  };

  const pmcKey = normalizePmc(pmcNo);
  const duplicatePmc =
    pmcKey &&
    oldScooties.some((s) => {
      if (!s) return false;
      if (editingId && s._id === editingId) return false;
      return normalizePmc(s.pmcNo) === pmcKey;
    });

  const fetchOldScooties = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetchWithRetry(OLD_SCOOTIES_API, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load old scooties");
      }
      const data = await res.json();
      setOldScooties(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching old scooties:", err);
      setError(err.message || "Failed to load old scooties");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOldScooties();
  }, []);

  // Fetch spares (shared source with jobcard old scooty sales)
  useEffect(() => {
    const fetchSpares = async () => {
      try {
        const response = await fetchWithRetry(`/spares`);
        if (!response.ok) throw new Error("Failed to fetch spares");
        const data = await response.json();
        setAllSparesForOldScooty(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching spares for old scooty master:", err);
        setAllSparesForOldScooty([]);
      }
    };
    fetchSpares();
  }, []);

  // Filter spare suggestions when user types in spare name
  useEffect(() => {
    const term = oldScootySpareName.trim().toLowerCase();
    if (!term) {
      setOldScootySpareSuggestions([]);
      setShowOldScootySpareSuggestions(false);
      return;
    }
    const filtered = allSparesForOldScooty.filter(
      (s) =>
        s.name?.toLowerCase().includes(term) ||
        s.supplierName?.toLowerCase().includes(term)
    );
    const sliced = filtered.slice(0, 3);
    setOldScootySpareSuggestions(sliced);
    const exactMatch = sliced.some(
      (s) => s.name?.trim().toLowerCase() === term
    );
    setShowOldScootySpareSuggestions(sliced.length > 0 && !exactMatch);
    setOldScootySpareSelectedIndex(-1);
  }, [oldScootySpareName, allSparesForOldScooty]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        oldScootySpareSuggestionsRef.current &&
        !oldScootySpareSuggestionsRef.current.contains(e.target)
      ) {
        setShowOldScootySpareSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resetForm = () => {
    setName("");
    setPmcNo("");
    setPurchasePrice("");
    setWithBattery(false);
    setBatteryType("Lead");
    setBatteryCount("1");
    setWithCharger(false);
    setChargerType("Lead");
    setChargerVoltageAmpere("");
    setChargerWorking("working");
    setEntryDate(getTodayForInput());
    setStatus("not-ready");
    setEditingId(null);
    setError("");
    setOldScootySpares([]);
    setOldScootySpareName("");
    setOldScootySpareQty("1");
    setOldScootySpareColor("");
    setSelectedSpareForOldScooty(null);
    setOldScootySpareSuggestions([]);
    setShowOldScootySpareSuggestions(false);
    setOldScootySpareSelectedIndex(-1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !name.trim()) {
      setError("Please enter model name");
      return;
    }
    if (duplicatePmc) {
      setError("PMC No. already exists");
      return;
    }
    if (!entryDate) {
      setError("Please select purchase date");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const payload = {
        name: name.trim(),
        pmcNo: pmcNo.trim(),
        purchasePrice: purchasePrice ? Number(purchasePrice) : 0,
        withBattery,
        batteryType: withBattery ? batteryType.trim() : "",
        batteryCount: withBattery ? parseInt(batteryCount, 10) || 0 : 0,
        withCharger,
        chargerType: withCharger ? chargerType.trim() : "",
        chargerVoltageAmpere: withCharger ? chargerVoltageAmpere.trim() : "",
        chargerWorking: withCharger ? chargerWorking : "working",
        entryDate: entryDate,
        status,
        sparesUsed: oldScootySpares.map((s) => ({
          spareId: normalizeOldScootySpareId(s.spareId),
          name: s.name,
          quantity:
            typeof s.quantity === "number"
              ? s.quantity
              : parseInt(s.quantity, 10) || 1,
          color: s.color ? String(s.color).trim() : "",
        })),
      };

      const url = editingId
        ? `${OLD_SCOOTIES_API}/${editingId}`
        : OLD_SCOOTIES_API;
      const method = editingId ? "PUT" : "POST";

      const res = await fetchWithRetry(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.message ||
            (editingId ? "Failed to update old scooty" : "Failed to add old scooty")
        );
      }

      if (editingId) {
        setOldScooties((prev) =>
          prev.map((item) => (item._id === editingId ? data : item))
        );
      } else {
        setOldScooties((prev) => [data, ...prev]);
      }

      resetForm();
    } catch (err) {
      console.error("Error adding old scooty:", err);
      setError(
        err.message ||
          (editingId ? "Failed to update old scooty" : "Failed to add old scooty")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const normalizedQuery = String(searchQuery || "").trim().toLowerCase();
  const filteredOldScooties = normalizedQuery
    ? oldScooties.filter((item) => {
        const name = String(item?.name || "").toLowerCase();
        const pmc = String(item?.pmcNo || "").toLowerCase();
        return name.includes(normalizedQuery) || pmc.includes(normalizedQuery);
      })
    : oldScooties;

  // Group by entry date (date only)
  const groupedByDate = filteredOldScooties.reduce((acc, item) => {
    const dateKey = item.entryDate
      ? new Date(item.entryDate).toISOString().split("T")[0]
      : item.createdAt
      ? new Date(item.createdAt).toISOString().split("T")[0]
      : "Unknown";
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  const sortedDateKeys = Object.keys(groupedByDate).sort(
    (a, b) => new Date(b) - new Date(a)
  );

  const getPurchaseDateDisplay = (item, dateKey) => {
    const purchaseDateRaw = item.entryDate || item.createdAt || dateKey;
    return formatDate(purchaseDateRaw) || "—";
  };

  const totalCount = oldScooties.length;
  const readyCount = oldScooties.filter((item) => item.status === "ready").length;
  const notReadyCount = totalCount - readyCount;

  const startEdit = (item) => {
    setName(item.name || "");
    setPmcNo(item.pmcNo || "");
    setPurchasePrice(
      typeof item.purchasePrice === "number" ? String(item.purchasePrice) : ""
    );
    setWithBattery(Boolean(item.withBattery));
    setBatteryType(item.batteryType || "Lead");
    setBatteryCount(
      typeof item.batteryCount === "number"
        ? String(item.batteryCount)
        : item.batteryCount || "1"
    );
    setWithCharger(Boolean(item.withCharger));
    setChargerType(item.chargerType || "Lead");
    setChargerVoltageAmpere(item.chargerVoltageAmpere || "");
    setChargerWorking(item.chargerWorking || "working");
    setEntryDate(formatDateForInput(item.entryDate || item.createdAt));
    setStatus(item.status === "ready" ? "ready" : "not-ready");
    setOldScootySpares(
      Array.isArray(item.sparesUsed)
        ? item.sparesUsed.map((s) => ({
            spareId: normalizeOldScootySpareId(s.spareId),
            name: s.name || "",
            quantity:
              typeof s.quantity === "number"
                ? s.quantity
                : parseInt(s.quantity, 10) || 1,
            color: s.color ? String(s.color).trim() : "",
          }))
        : []
    );
    setEditingId(item._id);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!id) return;
    const confirmed = window.confirm("Are you sure you want to delete this old scooty entry?");
    if (!confirmed) return;
    try {
      setDeletingId(id);
      const res = await fetchWithRetry(`${OLD_SCOOTIES_API}/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete old scooty");
      setOldScooties((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      console.error("Error deleting old scooty:", err);
      alert(err.message || "Failed to delete old scooty");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelEdit = () => {
    resetForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddOldScootySpare = () => {
    const name = oldScootySpareName.trim();
    if (!name) return;
    const qty = parseInt(oldScootySpareQty, 10) || 1;
    if (qty <= 0) return;
    const spareId = normalizeOldScootySpareId(
      selectedSpareForOldScooty?._id ?? null
    );
    const hasColors = selectedSpareForOldScooty?.hasColors && (selectedSpareForOldScooty?.colorQuantity?.length || 0) > 0;
    const color = hasColors ? (oldScootySpareColor || "") : "";
    setOldScootySpares((prev) => [
      ...prev,
      { spareId, name, quantity: qty, color },
    ]);
    setOldScootySpareName("");
    setOldScootySpareQty("1");
    setOldScootySpareColor("");
    setSelectedSpareForOldScooty(null);
  };

  const selectOldScootySpareSuggestion = (spare) => {
    setOldScootySpareName(spare.name || "");
    setSelectedSpareForOldScooty(spare);
    const firstColor = spare?.hasColors && spare?.colorQuantity?.length ? (spare.colorQuantity[0]?.color || "") : "";
    setOldScootySpareColor(firstColor);
    setShowOldScootySpareSuggestions(false);
    setOldScootySpareSuggestions([]);
    setOldScootySpareSelectedIndex(-1);
  };

  const handleOldScootySpareKeyDown = (e) => {
    if (!showOldScootySpareSuggestions || oldScootySpareSuggestions.length === 0) return;
    const len = oldScootySpareSuggestions.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOldScootySpareSelectedIndex((prev) => (prev < len - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOldScootySpareSelectedIndex((prev) => (prev > 0 ? prev - 1 : len - 1));
    } else if (e.key === "Enter" && oldScootySpareSelectedIndex >= 0 && oldScootySpareSuggestions[oldScootySpareSelectedIndex]) {
      e.preventDefault();
      selectOldScootySpareSuggestion(oldScootySpareSuggestions[oldScootySpareSelectedIndex]);
    }
  };

  const handleRemoveOldScootySpare = (index) => {
    setOldScootySpares((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="old-scooties-page" style={{ maxWidth: "1100px" }}>
      <section
        style={{
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: "1rem",
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "#111827",
          }}
        >
          {editingId ? "Edit Old Scooty" : "Add New Old Scooty"}
        </h2>
        <div
          style={{
            display: "flex",
            gap: "5%",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              flex: "0 0 60%",
              padding: "1.5rem",
              backgroundColor: "#f9fafb",
              borderRadius: "0.5rem",
              border: "1px solid #e5e7eb",
            }}
          >
            <form onSubmit={handleSubmit}>
              {error && (
                <div
                  style={{
                    marginBottom: "1rem",
                    padding: "0.75rem",
                    backgroundColor: "#fef2f2",
                    color: "#dc2626",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                  }}
                >
                  {error}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1fr 1fr",
                  gap: "1rem",
                  alignItems: "flex-end",
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
                    Model name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. single light"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
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
                    PMC No.
                  </label>
                  <input
                    type="text"
                    value={pmcNo}
                    onChange={(e) => setPmcNo(e.target.value)}
                    placeholder="e.g. PMC-001"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      border: duplicatePmc ? "1px solid #ef4444" : "1px solid #d1d5db",
                      fontSize: "0.875rem",
                    }}
                  />
                  {duplicatePmc && (
                    <p
                      style={{
                        margin: "0.35rem 0 0 0",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#dc2626",
                      }}
                    >
                      This PMC No. already exists.
                    </p>
                  )}
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
                    Purchase price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #d1d5db",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginTop: "1rem",
                  alignItems: "flex-start",
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
                    Purchase date <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <DatePicker
                    value={entryDate}
                    onChange={(val) => setEntryDate(val || getTodayForInput())}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
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
                    Status
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      fontSize: "0.875rem",
                      color: "#374151",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="oldScootyStatus"
                        value="ready"
                        checked={status === "ready"}
                        onChange={(e) => setStatus(e.target.value)}
                      />
                      <span
                        style={{
                          fontWeight: 700,
                          color: "#16a34a",
                          textDecoration:
                            status === "ready" ? "underline" : "none",
                        }}
                      >
                        Ready
                      </span>
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="oldScootyStatus"
                        value="not-ready"
                        checked={status === "not-ready"}
                        onChange={(e) => setStatus(e.target.value)}
                      />
                      <span
                        style={{
                          fontWeight: 700,
                          color: "#dc2626",
                          textDecoration:
                            status === "not-ready" ? "underline" : "none",
                        }}
                      >
                        Not ready
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: "1rem",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 2fr)",
                  gap: "0.75rem",
                  fontSize: "0.875rem",
                  color: "#374151",
                }}
              >
                {/* With battery / With charger */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={withBattery}
                      onChange={(e) => setWithBattery(e.target.checked)}
                      style={{ width: "1rem", height: "1rem" }}
                    />
                    <span>With battery</span>
                  </label>
                  {withBattery && (
                    <>
                      <select
                        value={batteryType}
                        onChange={(e) => setBatteryType(e.target.value)}
                        style={{
                          width: "160px",
                          padding: "0.4rem 0.5rem",
                          borderRadius: "0.375rem",
                          border: "1px solid #d1d5db",
                          fontSize: "0.8125rem",
                          backgroundColor: "#fff",
                        }}
                      >
                        <option value="Lead">Lead</option>
                        <option value="Lithium">Lithium</option>
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={batteryCount}
                        onChange={(e) => setBatteryCount(e.target.value)}
                        placeholder="No. of batteries"
                        style={{
                          width: "150px",
                          padding: "0.4rem 0.5rem",
                          borderRadius: "0.375rem",
                          border: "1px solid #d1d5db",
                          fontSize: "0.8125rem",
                        }}
                      />
                    </>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={withCharger}
                      onChange={(e) => setWithCharger(e.target.checked)}
                      style={{ width: "1rem", height: "1rem" }}
                    />
                    <span>With charger</span>
                  </label>
                  {withCharger && (
                    <>
                      <select
                        value={chargerType}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          setChargerType(nextType);
                          // For lead chargers, constrain voltage to supported options.
                          if (nextType.toLowerCase() === "lead") {
                            const current = normalizeVoltageText(chargerVoltageAmpere);
                            if (!["48V", "60V", "72V"].includes(current)) {
                              setChargerVoltageAmpere("48V");
                            } else {
                              setChargerVoltageAmpere(current);
                            }
                          }
                        }}
                        style={{
                          width: "160px",
                          padding: "0.4rem 0.5rem",
                          borderRadius: "0.375rem",
                          border: "1px solid #d1d5db",
                          fontSize: "0.8125rem",
                          backgroundColor: "#fff",
                        }}
                      >
                        <option value="Lead">Lead</option>
                        <option value="Lithium">Lithium</option>
                      </select>
                      {String(chargerType || "").toLowerCase() === "lead" ? (
                        <select
                          value={
                            ["48V", "60V", "72V"].includes(
                              normalizeVoltageText(chargerVoltageAmpere)
                            )
                              ? normalizeVoltageText(chargerVoltageAmpere)
                              : "48V"
                          }
                          onChange={(e) => setChargerVoltageAmpere(e.target.value)}
                          style={{
                            width: "150px",
                            padding: "0.4rem 0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.8125rem",
                            backgroundColor: "#fff",
                          }}
                        >
                          <option value="48V">48V</option>
                          <option value="60V">60V</option>
                          <option value="72V">72V</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={chargerVoltageAmpere}
                          onChange={(e) => setChargerVoltageAmpere(e.target.value)}
                          onBlur={() =>
                            setChargerVoltageAmpere((prev) =>
                              normalizeVoltageText(prev)
                            )
                          }
                          placeholder="Voltage / Ampere"
                          style={{
                            width: "150px",
                            padding: "0.4rem 0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.8125rem",
                          }}
                        />
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginLeft: "0.25rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            cursor: "pointer",
                            fontSize: "0.8125rem",
                            fontWeight: 700,
                            color: "#16a34a",
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyChargerWorking"
                            value="working"
                            checked={chargerWorking === "working"}
                            onChange={(e) => setChargerWorking(e.target.value)}
                          />
                          Working
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            cursor: "pointer",
                            fontSize: "0.8125rem",
                            fontWeight: 700,
                            color: "#dc2626",
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyChargerWorking"
                            value="notWorking"
                            checked={chargerWorking === "notWorking"}
                            onChange={(e) => setChargerWorking(e.target.value)}
                          />
                          Not working
                        </label>
                      </div>
                    </>
                  )}
                </div>

                {/* Spares used to get it ready - only when status is Ready */}
                {status === "ready" && (
                  <div
                    style={{
                      marginTop: "0.25rem",
                      paddingTop: "0.5rem",
                      borderTop: "1px solid #e5e7eb",
                    }}
                  >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "#374151",
                      }}
                    >
                      Spares used to get it ready
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#6b7280",
                      }}
                    >
                      (same spare list as jobcard)
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1, position: "relative" }} ref={oldScootySpareSuggestionsRef}>
                      <input
                        type="text"
                        value={oldScootySpareName}
                        onChange={(e) => setOldScootySpareName(e.target.value)}
                        onKeyDown={handleOldScootySpareKeyDown}
                        placeholder="Search spare name"
                        style={{
                          width: "100%",
                          padding: "0.45rem 0.5rem",
                          borderRadius: "0.375rem",
                          border: "1px solid #d1d5db",
                          fontSize: "0.8125rem",
                        }}
                      />
                      {showOldScootySpareSuggestions &&
                        oldScootySpareSuggestions.length > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              marginTop: "0.125rem",
                              backgroundColor: "#ffffff",
                              borderRadius: "0.375rem",
                              border: "1px solid #e5e7eb",
                              boxShadow:
                                "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
                              zIndex: 20,
                              maxHeight: "180px",
                              overflowY: "auto",
                            }}
                          >
                            {oldScootySpareSuggestions.map((s, idx) => (
                              <button
                                key={s._id || s.name || idx}
                                type="button"
                                onClick={() => selectOldScootySpareSuggestion(s)}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  textAlign: "left",
                                  padding: "0.4rem 0.5rem",
                                  fontSize: "0.8125rem",
                                  backgroundColor:
                                    idx === oldScootySpareSelectedIndex
                                      ? "#eff6ff"
                                      : "#ffffff",
                                  border: "none",
                                  borderBottom:
                                    idx === oldScootySpareSuggestions.length - 1
                                      ? "none"
                                      : "1px solid #e5e7eb",
                                  cursor: "pointer",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 500,
                                    color: "#111827",
                                  }}
                                >
                                  {s.name}
                                </div>
                                {s.supplierName && (
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#6b7280",
                                    }}
                                  >
                                    {s.supplierName}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={oldScootySpareQty}
                      onChange={(e) => setOldScootySpareQty(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      style={{
                        width: "80px",
                        padding: "0.45rem 0.5rem",
                        borderRadius: "0.375rem",
                        border: "1px solid #d1d5db",
                        fontSize: "0.8125rem",
                      }}
                    />
                    {selectedSpareForOldScooty?.hasColors &&
                      Array.isArray(selectedSpareForOldScooty?.colorQuantity) &&
                      selectedSpareForOldScooty.colorQuantity.length > 0 && (
                        <select
                          value={oldScootySpareColor}
                          onChange={(e) => setOldScootySpareColor(e.target.value)}
                          style={{
                            minWidth: "100px",
                            padding: "0.45rem 0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.8125rem",
                            backgroundColor: "#fff",
                          }}
                        >
                          {selectedSpareForOldScooty.colorQuantity.map((cq) => (
                            <option key={cq.color || ""} value={cq.color || ""}>
                              {cq.color || "—"}
                            </option>
                          ))}
                        </select>
                      )}
                    <button
                      type="button"
                      onClick={handleAddOldScootySpare}
                      disabled={!oldScootySpareName.trim()}
                      style={{
                        padding: "0.45rem 0.75rem",
                        fontSize: "0.8125rem",
                        backgroundColor: oldScootySpareName.trim()
                          ? "#7c3aed"
                          : "#c4b5fd",
                        color: "white",
                        border: "none",
                        borderRadius: "0.375rem",
                        cursor: oldScootySpareName.trim()
                          ? "pointer"
                          : "not-allowed",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Add spare
                    </button>
                  </div>
                    {oldScootySpares.length > 0 && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 500,
                            color: "#6b7280",
                          }}
                        >
                          Added spares (total:{" "}
                          {oldScootySpares.reduce(
                            (sum, s) =>
                              sum +
                              (typeof s.quantity === "number"
                                ? s.quantity
                                : parseInt(s.quantity, 10) || 0),
                            0
                          )}
                          )
                        </span>
                        {oldScootySpares.map((s, idx) => (
                          <div
                            key={`${s.spareId || s.name}-${idx}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "0.375rem 0.5rem",
                              backgroundColor: "#ffffff",
                              borderRadius: "0.25rem",
                              border: "1px solid #e2e8f0",
                              fontSize: "0.875rem",
                            }}
                          >
                          <span>
                            <span style={{ fontWeight: 500 }}>{s.name}</span>
                            {s.color ? (
                              <span style={{ marginLeft: "0.25rem", color: "#6b7280" }}>({s.color})</span>
                            ) : null}{" "}
                            × {typeof s.quantity === "number"
                              ? s.quantity
                              : parseInt(s.quantity, 10) || 1}
                          </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOldScootySpare(idx)}
                              style={{
                                padding: "0.25rem 0.5rem",
                                fontSize: "0.75rem",
                                color: "#dc2626",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 500,
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: "1rem",
                  display: "flex",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="submit"
                  disabled={submitting || duplicatePmc}
                  style={{
                    padding: "0.5rem 1.25rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "white",
                    backgroundColor:
                      submitting || duplicatePmc ? "#9ca3af" : "#10b981",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor:
                      submitting || duplicatePmc ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting
                    ? editingId
                      ? "Saving…"
                      : "Adding…"
                    : editingId
                    ? "Save Changes"
                    : "Add Old Scooty"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={submitting}
                    style={{
                      padding: "0.5rem 1.25rem",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "#111827",
                      backgroundColor: "#d1d5db",
                      border: "none",
                      borderRadius: "0.375rem",
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
          <div
            style={{
              flex: "0 0 35%",
              minWidth: "0",
              padding: "1.5rem",
              borderRadius: "0.75rem",
              border: "1px solid #d1d5db",
              background:
                "linear-gradient(135deg, #eef2ff, #ecfdf5)",
              color: "#111827",
              fontSize: "1.15rem",
              boxShadow:
                "0 10px 15px -3px rgba(15,23,42,0.08), 0 4px 6px -4px rgba(15,23,42,0.08)",
            }}
          >
            <div
              style={{
                fontSize: "1.05rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#4b5563",
                marginBottom: "0.75rem",
                fontWeight: 600,
              }}
            >
              Overview
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 600,
                }}
              >
                <span style={{ color: "#111827", fontSize: "1.1rem" }}>
                  Total scooties:{" "}
                  <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                    {totalCount}
                  </span>
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#16a34a",
                  fontWeight: 500,
                }}
              >
                <span>
                  Ready:{" "}
                  <span
                    style={{
                      fontWeight: 600,
                      color: "#166534",
                      fontSize: "1rem",
                    }}
                  >
                    {readyCount}
                  </span>
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#b45309",
                  fontWeight: 500,
                }}
              >
                <span>
                  Not ready:{" "}
                  <span
                    style={{
                      fontWeight: 600,
                      color: "#92400e",
                      fontSize: "1rem",
                    }}
                  >
                    {notReadyCount}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2
          style={{
            marginBottom: "1rem",
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "#111827",
          }}
        >
          All Old Scooties
        </h2>
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            marginBottom: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search model name or PMC no…"
            style={{
              flex: "1 1 260px",
              maxWidth: "520px",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                backgroundColor: "#ffffff",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#374151",
              }}
            >
              Clear
            </button>
          ) : null}
          <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Showing{" "}
            <strong style={{ color: "#111827" }}>
              {filteredOldScooties.length}
            </strong>{" "}
            of{" "}
            <strong style={{ color: "#111827" }}>{oldScooties.length}</strong>
          </span>
        </div>
        {loading ? (
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Loading…
          </p>
        ) : filteredOldScooties.length === 0 ? (
          <p
            style={{
              padding: "1.5rem",
              backgroundColor: "#f9fafb",
              borderRadius: "0.5rem",
              border: "1px solid #e5e7eb",
              color: "#6b7280",
              fontSize: "0.875rem",
            }}
          >
            No matching old scooty found.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {sortedDateKeys.map((dateKey) => (
              <div
                key={dateKey}
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#f3f4f6",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#374151",
                  }}
                >
                  {formatDate(dateKey) || dateKey}
                </div>
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
                        backgroundColor: "#f9fafb",
                        color: "#4b5563",
                        textAlign: "left",
                      }}
                    >
                      <th style={{ padding: "0.5rem 1rem", fontWeight: 600 }}>
                        Purchase date
                      </th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 600 }}>
                        Model name
                      </th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 600 }}>
                        PMC No.
                      </th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 600 }}>
                        Purchase (₹)
                      </th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 600 }}>
                        Battery
                      </th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 600 }}>
                        Charger
                      </th>
                      <th style={{ padding: "0.5rem 0.5rem", fontWeight: 600 }}>
                        Status
                      </th>
                      <th
                        style={{
                          padding: "0.5rem 1rem",
                          fontWeight: 600,
                          textAlign: "right",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedByDate[dateKey].map((item) => {
                      const purchaseDate = getPurchaseDateDisplay(item, dateKey);
                      const purchasePriceValue =
                        typeof item.purchasePrice === "number"
                          ? item.purchasePrice
                          : 0;
                      return (
                        <tr
                          key={item._id}
                          style={{
                            borderTop: "1px solid #f3f4f6",
                          }}
                        >
                          <td
                            style={{
                              padding: "0.6rem 1rem",
                              whiteSpace: "nowrap",
                              color: "#4b5563",
                            }}
                          >
                            {purchaseDate}
                          </td>
                          <td
                            style={{
                              padding: "0.6rem 0.5rem",
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            {item.name}
                          </td>
                          <td
                            style={{
                              padding: "0.6rem 0.5rem",
                              whiteSpace: "nowrap",
                              color: "#4b5563",
                            }}
                          >
                            {item.pmcNo
                              ? `PMC-${String(item.pmcNo).replace(/^PMC-?/i, "")}`
                              : "—"}
                          </td>
                          <td
                            style={{
                              padding: "0.6rem 0.5rem",
                              whiteSpace: "nowrap",
                              color: "#4b5563",
                            }}
                          >
                            ₹{purchasePriceValue.toFixed(2)}
                          </td>
                          <td
                            style={{
                              padding: "0.6rem 0.5rem",
                              color: "#4b5563",
                            }}
                          >
                            {item.withBattery ? (
                              <>
                                <span style={{ fontWeight: 600 }}>
                                  {typeof item.batteryCount === "number" &&
                                  item.batteryCount > 0
                                    ? `${item.batteryCount} pcs`
                                    : "1 pcs"}
                                </span>
                                {item.batteryType && (
                                  <span style={{ marginLeft: "0.25rem" }}>
                                    [{item.batteryType}]
                                  </span>
                                )}
                              </>
                            ) : (
                              <span>N/A</span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "0.6rem 0.5rem",
                              color: "#4b5563",
                            }}
                          >
                            {item.withCharger ? (
                              <>
                                {item.chargerVoltageAmpere && (
                                  <span style={{ fontWeight: 600 }}>
                                    {normalizeVoltageText(item.chargerVoltageAmpere)}
                                  </span>
                                )}
                                {item.chargerType && (
                                  <span style={{ marginLeft: "0.25rem" }}>
                                    [{item.chargerType}]
                                  </span>
                                )}
                                {!item.chargerVoltageAmpere && !item.chargerType && (
                                  <span style={{ fontWeight: 600 }}>N/A</span>
                                )}
                              </>
                            ) : (
                              <span>N/A</span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "0.6rem 0.5rem",
                              color:
                                item.status === "ready" ? "#16a34a" : "#dc2626",
                              fontWeight: 600,
                            }}
                          >
                            {item.status === "ready" ? "Ready" : "Not ready"}
                          </td>
                          <td
                            style={{
                              padding: "0.6rem 1rem",
                              textAlign: "right",
                              display: "flex",
                              justifyContent: "flex-end",
                              gap: "0.5rem",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              style={{
                                padding: "0.25rem 0.75rem",
                                fontSize: "0.75rem",
                                borderRadius: "9999px",
                                border: "1px solid #bfdbfe",
                                backgroundColor: "#dbeafe",
                                color: "#1d4ed8",
                                cursor: "pointer",
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item._id)}
                              disabled={deletingId === item._id}
                              style={{
                                padding: "0.25rem 0.75rem",
                                fontSize: "0.75rem",
                                borderRadius: "9999px",
                                border: "1px solid #fecaca",
                                backgroundColor:
                                  deletingId === item._id ? "#fca5a5" : "#fee2e2",
                                color: "#b91c1c",
                                cursor:
                                  deletingId === item._id ? "not-allowed" : "pointer",
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {deletingId === item._id ? "Deleting…" : "Delete"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
            <p
              style={{
                fontSize: "0.8125rem",
                color: "#6b7280",
                marginTop: "0.5rem",
              }}
            >
              Total: {oldScooties.length} old scooty entries
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
