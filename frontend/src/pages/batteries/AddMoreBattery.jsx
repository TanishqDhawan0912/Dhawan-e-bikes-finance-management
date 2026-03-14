import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getTodayForInput,
  formatDate,
  formatDateForInput,
} from "../../utils/dateUtils";

export default function AddMoreBattery() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [battery, setBattery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newEntry, setNewEntry] = useState({
    batteriesPerSet: "",
    totalSets: "",
    openBatteries: "",
    totalQuantity: "",
    purchasePrice: "",
    purchaseDate: getTodayForInput(), // yyyy-mm-dd for the date picker
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
  const datePickerRef = useRef(null);

  const fetchBattery = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/batteries/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error fetching battery");
      }
      const data = await res.json();
      setBattery(data);
      setError("");
    } catch (err) {
      console.error("Error fetching battery:", err);
      setError(err.message || "Error fetching battery");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // If this battery has no stock entries yet but has total quantity from creation,
  // create an initial stock entry so it appears in "All Stock Entries"
  useEffect(() => {
    const initializeFromTotals = async () => {
      if (!battery || !id) return;

      const hasEntries =
        Array.isArray(battery.stockEntries) && battery.stockEntries.length > 0;
      if (hasEntries) return;

      const totalQuantity =
        (battery.batteriesPerSet || 0) * (battery.totalSets || 0) +
        (battery.openBatteries || 0);

      if (totalQuantity <= 0) return;

      try {
        const res = await fetch(`http://localhost:5000/api/batteries/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stockEntries: [
              {
                quantity: totalQuantity,
                purchasePrice: 0,
                purchaseDate:
                  battery.purchaseDate ||
                  new Date().toISOString().split("T")[0],
                batteriesPerSet: battery.batteriesPerSet || undefined,
              },
            ],
          }),
        });

        if (!res.ok) {
          console.error("Failed to initialize battery stock entries");
          return;
        }

        await res.json();
        await fetchBattery();
      } catch (err) {
        console.error("Error initializing battery stock entries:", err);
      }
    };

    initializeFromTotals();
  }, [battery, id, fetchBattery]);

  useEffect(() => {
    if (id) {
      fetchBattery();
    }
  }, [id, fetchBattery]);

  // Initialize batteriesPerSet only once when battery is first loaded
  const [batteriesPerSetInitialized, setBatteriesPerSetInitialized] =
    useState(false);

  useEffect(() => {
    if (battery && battery.batteriesPerSet && !batteriesPerSetInitialized) {
      setNewEntry((prev) => ({
        ...prev,
        batteriesPerSet:
          prev.batteriesPerSet === ""
            ? String(battery.batteriesPerSet)
            : prev.batteriesPerSet,
      }));
      setBatteriesPerSetInitialized(true);
    }
  }, [battery, batteriesPerSetInitialized]);

  const handleNewEntryChange = (e) => {
    const { name, value } = e.target;
    // Auto-calculate TOTAL QUANTITY from:
    // totalQuantity = batteriesPerSet * totalSets + openBatteries
    if (
      name === "batteriesPerSet" ||
      name === "totalSets" ||
      name === "openBatteries"
    ) {
      // Use form value if provided, empty string counts as 0
      const formPerSet =
        name === "batteriesPerSet" ? value : newEntry.batteriesPerSet;
      const perSet = formPerSet === "" ? 0 : parseFloat(formPerSet) || 0;
      const sets =
        name === "totalSets"
          ? parseFloat(value) || 0
          : parseFloat(newEntry.totalSets) || 0;
      const open =
        name === "openBatteries"
          ? parseFloat(value) || 0
          : parseFloat(newEntry.openBatteries) || 0;

      const totalQuantity = perSet > 0 ? perSet * sets + open : sets + open;

      setNewEntry((prev) => ({
        ...prev,
        [name]: value,
        totalQuantity: totalQuantity > 0 ? String(totalQuantity) : "",
      }));
      return;
    }

    // Handle purchase date - text input expects dd/mm/yyyy, convert to yyyy-mm-dd for storage
    if (name === "purchaseDate") {
      let isoValue = "";
      if (value) {
        if (value.includes("/")) {
          // Convert dd/mm/yyyy -> yyyy-mm-dd
          const [day, month, year] = value.split("/");
          if (
            day &&
            month &&
            year &&
            day.length === 2 &&
            month.length === 2 &&
            year.length === 4
          ) {
            isoValue = `${year}-${month}-${day}`;
          } else {
            // Invalid format, keep as is for now
            isoValue = value;
          }
        } else if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Already in yyyy-mm-dd format (from date picker)
          isoValue = value;
        } else {
          isoValue = value;
        }
      }
      setNewEntry((prev) => ({
        ...prev,
        purchaseDate: isoValue,
      }));
      return;
    }

    setNewEntry((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBatteriesPerSetBlur = (e) => {
    const value = e.target.value;
    if (value === "" || value === null || value === undefined) {
      const sets = parseFloat(newEntry.totalSets) || 0;
      const open = parseFloat(newEntry.openBatteries) || 0;
      const totalQuantity = sets + open; // perSet is 0, so just sets + open

      setNewEntry((prev) => ({
        ...prev,
        batteriesPerSet: "0",
        totalQuantity: totalQuantity > 0 ? String(totalQuantity) : "",
      }));
    }
  };

  const handleDatePickerChange = (e) => {
    const dateValue = e.target.value; // yyyy-mm-dd format from date picker
    if (dateValue) {
      setNewEntry((prev) => ({
        ...prev,
        purchaseDate: dateValue, // Store in yyyy-mm-dd format
      }));
    }
  };

  const handleClear = () => {
    setNewEntry({
      batteriesPerSet: battery?.batteriesPerSet || "",
      totalSets: "",
      openBatteries: "",
      totalQuantity: "",
      purchasePrice: "",
      purchaseDate: getTodayForInput(),
    });
    setEditingIndex(null);
  };

  const handleVerifyPassword = async () => {
    if (!password.trim()) {
      setPasswordError("Please enter admin password");
      return;
    }

    setPasswordLoading(true);
    setPasswordError("");

    try {
      const response = await fetch("http://localhost:5000/api/admin/auth", {
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
        sessionStorage.setItem("batteryPriceAuth", "true");

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
    if (sessionStorage.getItem("batteryPriceAuth") === "true") {
      setIsPriceVerified(true);
      return;
    }
    setShowPasswordModal(true);
  };

  // Check session storage on mount
  useEffect(() => {
    if (sessionStorage.getItem("batteryPriceAuth") === "true") {
      setIsPriceVerified(true);
    }

    // Reset admin security when tab is hidden or page is unloaded
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sessionStorage.removeItem("batteryPriceAuth");
        setIsPriceVerified(false);
      }
    };

    const handleBeforeUnload = () => {
      sessionStorage.removeItem("batteryPriceAuth");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // Component is unmounting (e.g. navigating to another page)
      // or effect is being cleaned up: reset security and listeners
      sessionStorage.removeItem("batteryPriceAuth");
      setIsPriceVerified(false);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const handleAddEntry = async () => {
    if (!battery) return;

    const quantityNum = parseFloat(newEntry.totalQuantity) || 0;
    const priceNum = parseFloat(newEntry.purchasePrice) || 0;

    if (quantityNum <= 0 || priceNum < 0 || !newEntry.purchaseDate) {
      alert("Please enter valid quantity, price and date.");
      return;
    }

    const existingEntries = Array.isArray(battery.stockEntries)
      ? battery.stockEntries
      : [];

    // Get batteriesPerSet from form, or fall back to battery's value
    const entryBatteriesPerSet =
      newEntry.batteriesPerSet !== "" && newEntry.batteriesPerSet !== undefined
        ? parseFloat(newEntry.batteriesPerSet) || battery.batteriesPerSet || 0
        : battery.batteriesPerSet || 0;

    const updatedEntries =
      editingIndex !== null
        ? existingEntries.map((entry, idx) =>
            idx === editingIndex
              ? {
                  quantity: quantityNum,
                  purchasePrice: priceNum,
                  purchaseDate: newEntry.purchaseDate,
                  batteriesPerSet: entryBatteriesPerSet,
                }
              : entry
          )
        : [
            ...existingEntries,
            {
              quantity: quantityNum,
              purchasePrice: priceNum,
              purchaseDate: newEntry.purchaseDate,
              batteriesPerSet: entryBatteriesPerSet,
            },
          ];

    // Recalculate total sets and open batteries from all entries
    const totalQuantity = updatedEntries.reduce(
      (sum, entry) => sum + (entry.quantity || 0),
      0
    );
    // Always use the battery's batteriesPerSet, not the form value
    // The form value is only for display/calculation purposes
    const perSet = battery.batteriesPerSet || 0;
    const totalSets =
      perSet > 0 ? Math.floor(totalQuantity / perSet) : battery.totalSets || 0;
    const openBatteries =
      perSet > 0 ? totalQuantity % perSet : battery.openBatteries || 0;

    setIsSubmitting(true);
    try {
      const res = await fetch(`http://localhost:5000/api/batteries/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batteriesPerSet: battery.batteriesPerSet, // Keep the original value, don't update it
          totalSets,
          openBatteries,
          stockEntries: updatedEntries,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error updating battery stock");
      }

      // Ensure UI always reflects what is stored in the database
      await res.json();
      await fetchBattery();
      handleClear();
      setEditingIndex(null);

      // Notify other views to refresh
      window.dispatchEvent(new CustomEvent("batteryDataUpdated"));
    } catch (err) {
      console.error("Error updating battery stock:", err);
      alert(err.message || "Error updating battery stock");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditEntryAfterAuth = (index) => {
    if (!battery || !Array.isArray(battery.stockEntries)) return;
    const entry = battery.stockEntries[index];
    if (!entry) return;

    const qty = entry.quantity || 0;
    // Use entry's batteriesPerSet if available, otherwise fall back to battery's
    const perSet =
      entry.batteriesPerSet !== undefined && entry.batteriesPerSet !== null
        ? entry.batteriesPerSet
        : battery.batteriesPerSet || 0;
    const sets = perSet > 0 ? Math.floor(qty / perSet) : 0;
    const open = perSet > 0 ? qty % perSet : qty;

    setNewEntry({
      batteriesPerSet: perSet ? String(perSet) : "",
      totalSets: sets ? String(sets) : "",
      openBatteries: open ? String(open) : "",
      totalQuantity: qty ? String(qty) : "",
      purchasePrice:
        entry.purchasePrice !== undefined && entry.purchasePrice !== null
          ? String(entry.purchasePrice)
          : "",
      purchaseDate: entry.purchaseDate
        ? formatDateForInput(entry.purchaseDate)
        : getTodayForInput(),
    });
    setEditingIndex(index);
  };

  const startEditEntry = (index) => {
    if (!battery || !Array.isArray(battery.stockEntries)) return;
    const entry = battery.stockEntries[index];
    if (!entry) return;

    startEditEntryAfterAuth(index);
  };

  const getTotalQuantity = () => {
    if (!battery || !Array.isArray(battery.stockEntries)) return 0;
    return battery.stockEntries.reduce(
      (sum, entry) => sum + (entry.quantity || 0),
      0
    );
  };

  const getTotalValue = () => {
    if (!battery || !Array.isArray(battery.stockEntries)) return 0;
    const perSet = battery.batteriesPerSet || 0;

    return battery.stockEntries.reduce((sum, entry) => {
      const quantity = entry.quantity || 0; // total batteries
      const purchasePricePerSet = entry.purchasePrice || 0;

      // If batteriesPerSet is defined, interpret purchasePrice as "per set"
      // and convert it to per-battery price for total value calculation.
      const perBatteryPrice =
        perSet > 0 ? purchasePricePerSet / perSet : purchasePricePerSet;

      return sum + quantity * perBatteryPrice;
    }, 0);
  };

  const handleDeleteEntry = async (indexToDelete) => {
    if (!battery || !Array.isArray(battery.stockEntries)) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this stock entry?"
    );
    if (!confirmed) return;

    const existingEntries = battery.stockEntries;
    const updatedEntries = existingEntries.filter(
      (_, idx) => idx !== indexToDelete
    );

    // Recalculate totals based on remaining entries
    const totalQuantity = updatedEntries.reduce(
      (sum, entry) => sum + (entry.quantity || 0),
      0
    );
    const perSet = battery.batteriesPerSet || 0;
    const totalSets =
      perSet > 0 ? Math.floor(totalQuantity / perSet) : battery.totalSets || 0;
    const openBatteries =
      perSet > 0 ? totalQuantity % perSet : battery.openBatteries || 0;

    setIsSubmitting(true);
    try {
      const res = await fetch(`http://localhost:5000/api/batteries/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batteriesPerSet: battery.batteriesPerSet,
          totalSets,
          openBatteries,
          stockEntries: updatedEntries,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error deleting stock entry");
      }

      await res.json();
      await fetchBattery();

      // If the deleted entry was being edited, clear the form
      if (editingIndex === indexToDelete) {
        handleClear();
        setEditingIndex(null);
      }

      window.dispatchEvent(new CustomEvent("batteryDataUpdated"));
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
        <p>Loading battery...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <h2>Add More Stock</h2>
        <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
        <button className="btn btn-primary" onClick={fetchBattery}>
          Retry
        </button>
      </div>
    );
  }

  if (!battery) {
    return (
      <div className="page-content">
        <h2>Add More Stock</h2>
        <p>Battery not found.</p>
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
          onClick={() => navigate("/batteries/all")}
        >
          Back to Batteries
        </button>
      </div>

      {/* Battery details */}
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
          Battery Details
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
              Battery Name
            </label>
            <div style={{ fontWeight: 600 }}>{battery.name}</div>
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "#6b7280" }}>
              Supplier Name
            </label>
            <div style={{ fontWeight: 600 }}>
              {battery.supplierName || "N/A"}
            </div>
          </div>
        </div>
      </div>

      {/* Add new stock entry */}
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
            fontSize: "1rem",
            fontWeight: 550,
          }}
        >
          {editingIndex !== null ? "Edit Stock Entry" : "Add New Stock Entry"}
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            columnGap: "1rem",
            rowGap: "0.5rem",
            alignItems: "flex-end",
          }}
        >
          <div>
            <label
              style={{
                fontSize: "0.8rem",
                fontWeight: 500,
                marginBottom: "0.25rem",
                display: "block",
              }}
            >
              Batteries Per Set
            </label>
            <input
              type="number"
              name="batteriesPerSet"
              value={newEntry.batteriesPerSet}
              onChange={handleNewEntryChange}
              onBlur={handleBatteriesPerSetBlur}
              placeholder="Enter batteries per set"
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
              Sets
            </label>
            <input
              type="number"
              name="totalSets"
              value={newEntry.totalSets}
              onChange={handleNewEntryChange}
              placeholder="Enter sets"
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
              Open Batteries
            </label>
            <input
              type="number"
              name="openBatteries"
              value={newEntry.openBatteries}
              onChange={handleNewEntryChange}
              placeholder="Enter open batteries"
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
              Total Quantity
            </label>
            <input
              type="number"
              name="totalQuantity"
              value={newEntry.totalQuantity}
              readOnly
              placeholder="Auto-calculated"
              min="0"
              onWheel={(e) => e.target.blur()}
              style={{
                padding: "0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                width: "100%",
                backgroundColor: "#f3f4f6",
                cursor: "not-allowed",
              }}
            />
          </div>
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
                Purchase Price Set *
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
                Purchase Price Set *
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
            <div style={{ position: "relative", width: "100%" }}>
              <input
                type="text"
                name="purchaseDate"
                value={
                  newEntry.purchaseDate ? formatDate(newEntry.purchaseDate) : ""
                }
                onChange={handleNewEntryChange}
                placeholder="dd/mm/yyyy"
                style={{
                  padding: "0.5rem",
                  paddingRight: "2.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  width: "100%",
                }}
              />
              <button
                type="button"
                onClick={() =>
                  datePickerRef.current?.showPicker?.() ||
                  datePickerRef.current?.click()
                }
                style={{
                  position: "absolute",
                  right: "0.5rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  fontSize: "1rem",
                  cursor: "pointer",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1,
                }}
              >
                📅
              </button>
              <input
                ref={datePickerRef}
                type="date"
                value={
                  newEntry.purchaseDate
                    ? formatDateForInput(newEntry.purchaseDate)
                    : ""
                }
                onChange={handleDatePickerChange}
                style={{
                  position: "absolute",
                  right: "0.5rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "1.5rem",
                  height: "1.5rem",
                  opacity: 0,
                  cursor: "pointer",
                  zIndex: 2,
                }}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              justifyContent: "flex-end",
              gridColumn: "5 / -1",
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

        {(!battery.stockEntries || battery.stockEntries.length === 0) && (
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

        {battery.stockEntries && battery.stockEntries.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: "1rem",
            }}
          >
            {[...battery.stockEntries].reverse().map((entry, reversedIndex) => {
              // Calculate original index for edit/delete operations
              const originalIndex =
                battery.stockEntries.length - 1 - reversedIndex;
              const qty = entry.quantity || 0;
              // Use entry's batteriesPerSet if available, otherwise fall back to battery's
              const perSet =
                entry.batteriesPerSet !== undefined &&
                entry.batteriesPerSet !== null
                  ? entry.batteriesPerSet
                  : battery.batteriesPerSet || 0;
              const sets = perSet > 0 ? Math.floor(qty / perSet) : 0;
              const open = perSet > 0 ? qty % perSet : qty;

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
                  <div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#6b7280",
                        textTransform: "uppercase",
                      }}
                    >
                      Batteries Per Set
                    </div>
                    <div
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {perSet}
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
                      Sets
                    </div>
                    <div
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {sets}
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
                      Open Batteries
                    </div>
                    <div
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {open}
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
                      Total Quantity
                    </div>
                    <div
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {qty}
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
                  {isPriceVerified ? (
                    <div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#6b7280",
                          textTransform: "uppercase",
                        }}
                      >
                        Purchase Price (Set)
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
                        Purchase Price (Set)
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
            Total Stock
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
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>pieces</div>
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
