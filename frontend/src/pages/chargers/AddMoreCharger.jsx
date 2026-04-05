import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getTodayForInput,
  formatDate,
  formatDateForInput,
} from "../../utils/dateUtils";
import { API_BASE } from "../../config/api";
import DatePicker from "../../components/DatePicker";

/** Batch size when bought; unchanged when jobcards deduct stock (FIFO). */
function chargerLayerPurchasedQty(entry) {
  if (!entry) return 0;
  const o = entry.originalQuantity;
  if (o !== undefined && o !== null && o !== "" && !Number.isNaN(Number(o))) {
    return Math.max(0, Math.floor(Number(o)));
  }
  return Math.max(0, Math.floor(Number(entry.quantity) || 0));
}

/** Remaining pieces in this batch after jobcard/bill sales. */
function chargerLayerLeftQty(entry) {
  return Math.max(0, Math.floor(Number(entry?.quantity) || 0));
}

export default function AddMoreCharger() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [charger, setcharger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newEntry, setNewEntry] = useState({
    quantity: "",
    originalQuantity: "", // edit mode: purchased batch size (separate from left)
    purchasePrice: "",
    purchaseDate: getTodayForInput(), // yyyy-mm-dd for the date picker
    warrantyStatus: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [isPriceVerified, setIsPriceVerified] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [pendingEditIndex, setPendingEditIndex] = useState(null);
  const [duplicateError, setDuplicateError] = useState("");
  const stockEntryFormRef = useRef(null);

  const fetchcharger = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/chargers/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error fetching charger");
      }
      const data = await res.json();
      setcharger(data);
      setError("");
    } catch (err) {
      console.error("Error fetching charger:", err);
      setError(err.message || "Error fetching charger");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // If this charger has no stock entries yet but has total quantity from creation,
  // create an initial stock entry so it appears in "All Stock Entries"
  useEffect(() => {
    const initializeFromTotals = async () => {
      if (!charger || !id) return;

      const hasEntries =
        Array.isArray(charger.stockEntries) && charger.stockEntries.length > 0;
      if (hasEntries) return;

      const totalQuantity = charger.quantity || 0;

      if (totalQuantity <= 0) return;

      try {
        const res = await fetch(`${API_BASE}/chargers/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stockEntries: [
              {
                quantity: totalQuantity,
                originalQuantity: totalQuantity,
                purchasePrice: 0,
                purchaseDate:
                  charger.purchaseDate ||
                  new Date().toISOString().split("T")[0],
              },
            ],
          }),
        });

        if (!res.ok) {
          console.error("Failed to initialize charger stock entries");
          return;
        }

        await res.json();
        await fetchcharger();
      } catch (err) {
        console.error("Error initializing charger stock entries:", err);
      }
    };

    initializeFromTotals();
  }, [charger, id, fetchcharger]);

  useEffect(() => {
    if (id) {
      fetchcharger();
    }
  }, [id, fetchcharger]);

  const handleNewEntryChange = (e) => {
    const { name, value } = e.target;
    setNewEntry((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear duplicate error when purchase date or warranty status changes
    if (
      name === "purchaseDate" ||
      name === "warrantyStatus" ||
      name === "originalQuantity"
    ) {
      setDuplicateError("");
    }
  };

  const handleClear = () => {
    setNewEntry({
      quantity: "",
      originalQuantity: "",
      purchasePrice: "",
      purchaseDate: getTodayForInput(),
      warrantyStatus: false,
    });
    setEditingIndex(null);
    setDuplicateError("");
  };

  const handleVerifyPassword = async () => {
    if (!password.trim()) {
      setPasswordError("Please enter admin password");
      return;
    }

    setPasswordLoading(true);
    setPasswordError("");

    try {
      const response = await fetch(`${API_BASE}/admin/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ securityKey: password }),
      });

      const data = await response.json();

      if (data.success) {
        setIsPriceVerified(true);
        setShowPasswordModal(false);
        setPassword("");
        setPasswordError("");
        // Store in sessionStorage for this session
        sessionStorage.setItem("chargerPriceAuth", "true");

        // If there was a pending edit, execute it now
        if (pendingEditIndex !== null) {
          const indexToEdit = pendingEditIndex;
          setPendingEditIndex(null);
          // Small delay to ensure state is updated
          setTimeout(() => {
            startEditEntryAfterAuth(indexToEdit);
          }, 100);
        }
      } else {
        setPasswordError("Invalid password");
      }
    } catch (err) {
      console.error("Password verification error:", err);
      setPasswordError("Verification failed. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRequestPriceAccess = () => {
    // Check if already verified in this session
    if (sessionStorage.getItem("chargerPriceAuth") === "true") {
      setIsPriceVerified(true);
      return;
    }
    setShowPasswordModal(true);
  };

  // Check session storage on mount
  useEffect(() => {
    if (sessionStorage.getItem("chargerPriceAuth") === "true") {
      setIsPriceVerified(true);
    }

    // Reset admin security when tab is hidden or page is unloaded
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sessionStorage.removeItem("chargerPriceAuth");
        setIsPriceVerified(false);
      }
    };

    const handleBeforeUnload = () => {
      sessionStorage.removeItem("chargerPriceAuth");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // Component is unmounting (e.g. navigating to another page)
      // or effect is being cleaned up: reset security and listeners
      sessionStorage.removeItem("chargerPriceAuth");
      setIsPriceVerified(false);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const handleAddEntry = async () => {
    if (!charger) return;

    const leftNum = Math.max(0, Math.floor(parseFloat(newEntry.quantity) || 0));
    const purchasedNum =
      editingIndex !== null
        ? Math.max(0, Math.floor(parseFloat(newEntry.originalQuantity) || 0))
        : leftNum;
    const priceNum = parseFloat(newEntry.purchasePrice) || 0;

    if (editingIndex !== null) {
      if (purchasedNum <= 0 || leftNum > purchasedNum || !newEntry.purchaseDate) {
        alert(
          "Purchased must be at least 1, left cannot exceed purchased, and date is required."
        );
        return;
      }
      if (priceNum < 0) {
        alert("Please enter a valid purchase price.");
        return;
      }
    } else if (leftNum <= 0 || priceNum < 0 || !newEntry.purchaseDate) {
      alert("Please enter valid quantity, price and date.");
      return;
    }

    const existingEntries = Array.isArray(charger.stockEntries)
      ? charger.stockEntries
      : [];

    // Check for duplicate entry (same purchase date and warranty status)
    const newPurchaseDate = newEntry.purchaseDate;
    const newWarrantyStatus = Boolean(newEntry.warrantyStatus);
    
    // Normalize dates for comparison (convert both to yyyy-mm-dd format)
    const normalizeDate = (date) => {
      if (!date) return null;
      if (typeof date === 'string') {
        // If already in yyyy-mm-dd format
        if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return date;
        }
        // If in dd/mm/yyyy format, convert
        if (date.includes('/')) {
          const [day, month, year] = date.split('/');
          if (day && month && year) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }
      }
      // If Date object, convert to yyyy-mm-dd
      if (date instanceof Date || (date && date.toString && !isNaN(Date.parse(date)))) {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
      }
      return date;
    };

    const normalizedNewDate = normalizeDate(newPurchaseDate);
    
    const isDuplicate = existingEntries.some((entry, idx) => {
      // Skip the entry being edited
      if (editingIndex !== null && idx === editingIndex) {
        return false;
      }
      
      const entryDate = normalizeDate(entry.purchaseDate);
      const entryWarrantyStatus = Boolean(entry.warrantyStatus);
      
      return entryDate === normalizedNewDate && entryWarrantyStatus === newWarrantyStatus;
    });

    if (isDuplicate) {
      const displayDate = formatDate(newPurchaseDate);
      setDuplicateError(`A stock entry with the same Purchase Date (${displayDate}) and Warranty Status (${newWarrantyStatus ? 'Warranty' : 'No Warranty'}) already exists.`);
      return;
    }

    // Clear duplicate error if no duplicate found
    setDuplicateError("");

    const updatedEntries =
      editingIndex !== null
        ? existingEntries.map((entry, idx) => {
            if (idx !== editingIndex) return entry;
            return {
              quantity: leftNum,
              originalQuantity: purchasedNum,
              purchasePrice: priceNum,
              purchaseDate: newEntry.purchaseDate,
              warrantyStatus: Boolean(newEntry.warrantyStatus),
            };
          })
        : [
            ...existingEntries,
            {
              quantity: leftNum,
              originalQuantity: leftNum,
              purchasePrice: priceNum,
              purchaseDate: newEntry.purchaseDate,
              warrantyStatus: Boolean(newEntry.warrantyStatus),
            },
          ];

    // Recalculate total quantity from all entries
    const totalQuantity = updatedEntries.reduce(
      (sum, entry) => sum + (entry.quantity || 0),
      0
    );

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/chargers/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity: totalQuantity,
          stockEntries: updatedEntries,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error updating charger stock");
      }

      // Ensure UI always reflects what is stored in the database
      await res.json();
      await fetchcharger();
      handleClear();
      setEditingIndex(null);
      setDuplicateError("");

      // Notify other views to refresh
      window.dispatchEvent(new CustomEvent("chargerDataUpdated"));
    } catch (err) {
      console.error("Error updating charger stock:", err);
      alert(err.message || "Error updating charger stock");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditEntryAfterAuth = (index) => {
    if (!charger || !Array.isArray(charger.stockEntries)) return;
    const entry = charger.stockEntries[index];
    if (!entry) return;

    const left = chargerLayerLeftQty(entry);
    const purchased = chargerLayerPurchasedQty(entry);

    setNewEntry({
      quantity: left ? String(left) : "",
      originalQuantity: purchased ? String(purchased) : "",
      purchasePrice:
        entry.purchasePrice !== undefined && entry.purchasePrice !== null
          ? String(entry.purchasePrice)
          : "",
      purchaseDate: entry.purchaseDate
        ? formatDateForInput(entry.purchaseDate)
        : getTodayForInput(),
      warrantyStatus: entry.warrantyStatus || false,
    });
    setEditingIndex(index);
    // After paint, scroll the add/edit form at the top into view (long list of entries).
    requestAnimationFrame(() => {
      setTimeout(() => {
        stockEntryFormRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    });
  };

  const startEditEntry = (index) => {
    if (!charger || !Array.isArray(charger.stockEntries)) return;
    const entry = charger.stockEntries[index];
    if (!entry) return;

    startEditEntryAfterAuth(index);
  };

  const getTotalQuantity = () => {
    if (!charger || !Array.isArray(charger.stockEntries)) return 0;
    return charger.stockEntries.reduce(
      (sum, entry) => sum + (entry.quantity || 0),
      0
    );
  };

  const getTotalValue = () => {
    if (!charger || !Array.isArray(charger.stockEntries)) return 0;

    return charger.stockEntries.reduce((sum, entry) => {
      const quantity = entry.quantity || 0;
      const purchasePrice = entry.purchasePrice || 0;
      return sum + quantity * purchasePrice;
    }, 0);
  };

  const handleDeleteEntry = async (indexToDelete) => {
    if (!charger || !Array.isArray(charger.stockEntries)) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this stock entry?"
    );
    if (!confirmed) return;

    const existingEntries = charger.stockEntries;
    const updatedEntries = existingEntries.filter(
      (_, idx) => idx !== indexToDelete
    );

    // Recalculate total quantity based on remaining entries
    const totalQuantity = updatedEntries.reduce(
      (sum, entry) => sum + (entry.quantity || 0),
      0
    );

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/chargers/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity: totalQuantity,
          stockEntries: updatedEntries,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error deleting stock entry");
      }

      await res.json();
      await fetchcharger();

      // If the deleted entry was being edited, clear the form
      if (editingIndex === indexToDelete) {
        handleClear();
        setEditingIndex(null);
      }

      window.dispatchEvent(new CustomEvent("chargerDataUpdated"));
    } catch (err) {
      console.error("Error deleting stock entry:", err);
      alert(err.message || "Error deleting stock entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <h2>Add More Stock</h2>
        <p>Loading charger...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <h2>Add More Stock</h2>
        <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
        <button className="btn btn-primary" onClick={fetchcharger}>
          Retry
        </button>
      </div>
    );
  }

  if (!charger) {
    return (
      <div className="page-content">
        <h2>Add More Stock</h2>
        <p>charger not found.</p>
      </div>
    );
  }

  const totalQuantity = getTotalQuantity();
  const totalValue = getTotalValue();

  return (
    <div className="page-content">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h2>Add More Stock</h2>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/chargers/all")}
        >
          Back to Chargers
        </button>
      </div>

      {/* charger details */}
      <div
        style={{
          background: "white",
          borderRadius: "0.75rem",
          border: "1px solid #e5e7eb",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "1rem",
            fontSize: "1.125rem",
            fontWeight: 600,
          }}
        >
          charger Details
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          <div>
            <label style={{ fontSize: "0.75rem", color: "#6b7280" }}>
              Charger Name
            </label>
            <div style={{ fontWeight: 600 }}>{charger.name}</div>
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "#6b7280" }}>
              Batt. Type
            </label>
            <div style={{ fontWeight: 600 }}>
              {charger.batteryType || "N/A"}
            </div>
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "#6b7280" }}>
              Voltage-Ampere
            </label>
            <div style={{ fontWeight: 600 }}>
              {charger.voltage || "N/A"}
            </div>
          </div>
        </div>
      </div>

      {/* Add new stock entry / edit (scroll target when editing from list below) */}
      <div
        ref={stockEntryFormRef}
        style={{
          background: "white",
          borderRadius: "0.75rem",
          border: "1px solid #e5e7eb",
          padding: "1.5rem",
          marginBottom: "2rem",
          scrollMarginTop: "1rem",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "1rem",
            fontSize: "1rem",
            fontWeight: 550,
          }}
        >
          {editingIndex !== null ? "Edit Stock Entry" : "Add New Stock Entry"}
        </h3>
        {duplicateError && (
          <div
            style={{
              color: "#dc2626",
              marginBottom: "1rem",
              padding: "0.75rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
            }}
          >
            ⚠️ {duplicateError}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            columnGap: "1rem",
            rowGap: "0.5rem",
            alignItems: "flex-end",
          }}
        >
          {editingIndex !== null ? (
            <>
              <div>
                <label
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    marginBottom: "0.25rem",
                    display: "block",
                  }}
                >
                  Purchased (this batch) *
                </label>
                <input
                  type="number"
                  name="originalQuantity"
                  value={newEntry.originalQuantity}
                  onChange={handleNewEntryChange}
                  placeholder="Pieces bought in this entry"
                  min="1"
                  onWheel={(e) => e.target.blur()}
                  style={{
                    padding: "0.5rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                    width: "100%",
                  }}
                />
                <small
                  style={{
                    display: "block",
                    marginTop: "0.35rem",
                    fontSize: "0.72rem",
                    color: "#64748b",
                    lineHeight: 1.35,
                  }}
                >
                  Book quantity when this batch was added. Increase only if the
                  initial entry was wrong.
                </small>
              </div>
              <div>
                <label
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    marginBottom: "0.25rem",
                    display: "block",
                  }}
                >
                  Left in stock (this entry) *
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={newEntry.quantity}
                  onChange={handleNewEntryChange}
                  placeholder="Pieces still in this batch"
                  min="0"
                  onWheel={(e) => e.target.blur()}
                  style={{
                    padding: "0.5rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                    width: "100%",
                  }}
                />
                <small
                  style={{
                    display: "block",
                    marginTop: "0.35rem",
                    fontSize: "0.72rem",
                    color: "#64748b",
                    lineHeight: 1.35,
                  }}
                >
                  Remaining after jobcard sales (FIFO by purchase date), like
                  batteries and spares.
                </small>
              </div>
            </>
          ) : (
            <div>
              <label
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  marginBottom: "0.25rem",
                  display: "block",
                }}
              >
                Quantity (this batch) *
              </label>
              <input
                type="number"
                name="quantity"
                value={newEntry.quantity}
                onChange={handleNewEntryChange}
                placeholder="Pieces purchased"
                min="0"
                onWheel={(e) => e.target.blur()}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  width: "100%",
                }}
              />
              <small
                style={{
                  display: "block",
                  marginTop: "0.35rem",
                  fontSize: "0.72rem",
                  color: "#64748b",
                  lineHeight: 1.35,
                }}
              >
                Jobcard sales reduce &quot;left&quot; per batch (oldest purchase
                date first), like batteries and spares.
              </small>
            </div>
          )}
          {isPriceVerified ? (
            <div>
              <label
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  marginBottom: "0.25rem",
                  display: "block",
                }}
              >
                Purchase Price *
              </label>
              <input
                type="number"
                name="purchasePrice"
                value={newEntry.purchasePrice}
                onChange={handleNewEntryChange}
                placeholder="Enter purchase price"
                min="0"
                step="0.01"
                onWheel={(e) => e.target.blur()}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  width: "100%",
                }}
              />
            </div>
          ) : (
            <div>
              <label
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  marginBottom: "0.25rem",
                  display: "block",
                }}
              >
                Purchase Price *
              </label>
              <button
                type="button"
                onClick={handleRequestPriceAccess}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  width: "100%",
                  backgroundColor: "#f3f4f6",
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                🔒 Click to enter purchase price
              </button>
            </div>
          )}
          <div>
            <label
              style={{
                fontSize: "0.8rem",
                fontWeight: 500,
                marginBottom: "0.25rem",
                display: "block",
              }}
            >
              Purchase Date *
            </label>
            <DatePicker
              value={newEntry.purchaseDate}
              onChange={(date) => {
                setNewEntry((prev) => ({
                  ...prev,
                  purchaseDate: date || "",
                }));
                setDuplicateError("");
              }}
              placeholder="dd/mm/yyyy"
            />
          </div>
          <div>
            <label
              style={{
                fontSize: "0.8rem",
                fontWeight: 500,
                marginBottom: "0.25rem",
                display: "block",
              }}
            >
              Warranty Status
            </label>
            <select
              name="warrantyStatus"
              value={newEntry.warrantyStatus ? "warranty" : "no-warranty"}
              onChange={(e) => {
                setNewEntry((prev) => ({
                  ...prev,
                  warrantyStatus: e.target.value === "warranty",
                }));
                setDuplicateError("");
              }}
              style={{
                padding: "0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                width: "100%",
              }}
            >
              <option value="no-warranty">No Warranty</option>
              <option value="warranty">Warranty</option>
            </select>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              justifyContent: "flex-end",
              gridColumn: "1 / -1",
            }}
          >
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: "0.55rem 1.2rem",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "999px",
                fontSize: "0.78rem",
                fontWeight: 500,
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
              disabled={isSubmitting}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleAddEntry}
              disabled={isSubmitting}
              style={{
                padding: "0.55rem 1.2rem",
                backgroundColor: isSubmitting ? "#9ca3af" : "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "999px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontSize: "0.78rem",
                fontWeight: 500,
              }}
            >
              {isSubmitting
                ? editingIndex !== null
                  ? "Updating..."
                  : "Adding..."
                : editingIndex !== null
                ? "Update Entry"
                : "Add Stock Entry"}
            </button>
          </div>
        </div>
      </div>

      {/* All stock entries */}
      <div
        style={{
          background: "white",
          borderRadius: "0.75rem",
          border: "1px solid #e5e7eb",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "1rem",
            fontSize: "1.125rem",
            fontWeight: 600,
          }}
        >
          All Stock Entries
        </h3>

        {(!charger.stockEntries || charger.stockEntries.length === 0) && (
          <div
            style={{
              padding: "1.5rem",
              textAlign: "center",
              color: "#6b7280",
              fontSize: "0.9rem",
            }}
          >
            No stock entries yet.
          </div>
        )}

        {charger.stockEntries && charger.stockEntries.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: "1rem",
            }}
          >
            {[...charger.stockEntries].reverse().map((entry, reversedIndex) => {
              // Calculate original index for edit/delete operations
              const originalIndex =
                charger.stockEntries.length - 1 - reversedIndex;
              const purchased = chargerLayerPurchasedQty(entry);
              const left = chargerLayerLeftQty(entry);

              return (
                <div
                  key={originalIndex}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.75rem",
                    padding: "1rem 1.25rem",
                    background:
                      reversedIndex % 2 === 0
                        ? "#f9fafb"
                        : "linear-gradient(to right,#eff6ff,#ffffff)",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "1rem",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "1.25rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6b7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Purchased
                      </div>
                      <div
                        style={{
                          fontSize: "1.25rem",
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        {purchased}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6b7280",
                        }}
                      >
                        pieces
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6b7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Left in stock
                      </div>
                      <div
                        style={{
                          fontSize: "1.25rem",
                          fontWeight: 700,
                          color: "#0f766e",
                        }}
                      >
                        {left}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6b7280",
                        }}
                      >
                        pieces
                      </div>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#6b7280",
                        textTransform: "uppercase",
                      }}
                    >
                      Purchase Date
                    </div>
                    <div
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        color: "#111827",
                      }}
                    >
                      {formatDate(entry.purchaseDate)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#6b7280",
                        textTransform: "uppercase",
                      }}
                    >
                      Warranty Status
                    </div>
                    <div
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        color: "#111827",
                      }}
                    >
                      {entry.warrantyStatus ? "Warranty" : "No Warranty"}
                    </div>
                  </div>
                  {isPriceVerified ? (
                    <div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6b7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Purchase Price
                      </div>
                      <div
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        ₹{entry.purchasePrice?.toFixed(2) || "0.00"}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6b7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Purchase Price
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestPriceAccess}
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "#6b7280",
                          backgroundColor: "#f3f4f6",
                          border: "1px solid #d1d5db",
                          borderRadius: "0.375rem",
                          padding: "0.25rem 0.5rem",
                          cursor: "pointer",
                        }}
                      >
                        🔒 View
                      </button>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gridColumn: "1 / -1",
                      gap: "0.5rem",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(originalIndex)}
                      style={{
                        padding: "0.35rem 0.9rem",
                        backgroundColor: "#fee2e2",
                        color: "#b91c1c",
                        border: "none",
                        borderRadius: "999px",
                        fontSize: "0.78rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditEntry(originalIndex)}
                      style={{
                        padding: "0.35rem 0.9rem",
                        backgroundColor: "#e5e7eb",
                        color: "#111827",
                        border: "none",
                        borderRadius: "999px",
                        fontSize: "0.78rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      <div
        style={{
          borderRadius: "0.75rem",
          border: "1px solid #60a5fa",
          background: "#eff6ff",
          padding: "1.25rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1.5rem",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#1d4ed8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Total left stock
          </div>
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#111827",
            }}
          >
            {totalQuantity}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
            pieces (sum of batch leftovers)
          </div>
        </div>
        <div
          style={{
            width: "1px",
            alignSelf: "stretch",
            background:
              "linear-gradient(to bottom, transparent, #93c5fd, transparent)",
          }}
        />
        {isPriceVerified ? (
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "0.8rem",
                color: "#1d4ed8",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Total Value
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#16a34a",
              }}
            >
              ₹{totalValue.toFixed(2)}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
              inventory value
            </div>
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "0.8rem",
                color: "#1d4ed8",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Total Value
            </div>
            <button
              type="button"
              onClick={handleRequestPriceAccess}
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#6b7280",
                backgroundColor: "#f3f4f6",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                padding: "0.5rem 1rem",
                cursor: "pointer",
              }}
            >
              🔒 Click to view value
            </button>
          </div>
        )}
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => {
            setShowPasswordModal(false);
            setPassword("");
            setPasswordError("");
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: "1rem",
                fontSize: "1.25rem",
                fontWeight: 600,
              }}
            >
              Admin Password Required
            </h3>
            <p style={{ marginBottom: "1.5rem", color: "#6b7280" }}>
              Enter admin password to access purchase price field
            </p>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Enter admin password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleVerifyPassword();
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "0.75rem 2.5rem 0.75rem 0.75rem",
                    border: passwordError
                      ? "1px solid #dc2626"
                      : "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "0.5rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#6b7280",
                    padding: "0.25rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "4px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)";
                    e.currentTarget.style.color = "#374151";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#6b7280";
                  }}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <div
                  style={{
                    color: "#dc2626",
                    fontSize: "0.875rem",
                    marginTop: "0.5rem",
                  }}
                >
                  {passwordError}
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword("");
                  setPasswordError("");
                }}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyPassword}
                disabled={passwordLoading}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: passwordLoading ? "#9ca3af" : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: passwordLoading ? "not-allowed" : "pointer",
                }}
              >
                {passwordLoading ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

