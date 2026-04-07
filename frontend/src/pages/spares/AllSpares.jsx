import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../config/api";
import { createPortal } from "react-dom";
import { getTextColorForBackground } from "../../utils/themeUtils";
import { getFetchErrorMessage } from "../../utils/apiError";

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

// Suggestions Portal Component
function SuggestionsPortal({
  suggestions,
  selectedIndex,
  onSelect,
  position,
  inputName,
}) {
  if (!position || suggestions.length === 0) return null;

  const style = {
    position: "fixed",
    top: position.bottom + 6,
    left: position.left,
    width: position.width,
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    zIndex: 10000,
    boxShadow: "0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05)",
    maxHeight: 280,
    overflowY: "auto",
    overflowX: "hidden",
    animation: "slideDown 0.2s ease-out",
  };

  return (
    <div style={style} data-suggestions-portal="true" data-suggestions-input={inputName || ""}>
      {suggestions.map((suggestion, idx) => (
        <div
          key={`${inputName}-${
            suggestion.loading ? "loading" : suggestion
          }-${idx}`}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!suggestion.loading) {
              onSelect(suggestion);
            }
          }}
          style={{
            padding: "0.75rem 1rem",
            cursor: suggestion.loading ? "default" : "pointer",
            backgroundColor:
              idx === selectedIndex && !suggestion.loading
                ? "#3b82f6"
                : "white",
            borderBottom:
              idx !== suggestions.length - 1 ? "1px solid #f1f5f9" : "none",
            transition: "all 0.15s ease",
            transform:
              idx === selectedIndex && !suggestion.loading
                ? "translateX(4px)"
                : "translateX(0)",
          }}
          onMouseEnter={(e) => {
            if (!suggestion.loading) {
              e.currentTarget.style.backgroundColor =
                idx === selectedIndex ? "#3b82f6" : "#f8fafc";
              e.currentTarget.style.transform = "translateX(2px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!suggestion.loading) {
              e.currentTarget.style.backgroundColor =
                idx === selectedIndex ? "#3b82f6" : "white";
              e.currentTarget.style.transform = "translateX(0)";
            }
          }}
        >
          <div
            style={{
              fontWeight:
                idx === selectedIndex && !suggestion.loading ? 600 : 500,
              color:
                idx === selectedIndex && !suggestion.loading
                  ? "white"
                  : "#1f2937",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              width: "100%",
            }}
          >
            {suggestion.loading ? (
              <>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #e5e7eb",
                    borderTop: "2px solid #3b82f6",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                ></div>
                Loading suggestions...
              </>
            ) : (
              <>
                {idx === selectedIndex ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#3b82f6",
                      flexShrink: 0,
                    }}
                  ></div>
                )}
                <span>{suggestion}</span>
                {inputName && (
                  <span
                    style={{
                      marginLeft: "auto",
                      padding: "0.25rem 0.5rem",
                      backgroundColor:
                        idx === selectedIndex && !suggestion.loading
                          ? "rgba(255, 255, 255, 0.2)"
                          : "#f1f5f9",
                      color:
                        idx === selectedIndex && !suggestion.loading
                          ? "white"
                          : "#6b7280",
                      borderRadius: "0.375rem",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                    }}
                  >
                    {inputName === "modelName"
                      ? "Model"
                      : inputName === "company"
                      ? "Company"
                      : inputName === "name"
                      ? "Spare"
                      : inputName === "modelSearch"
                      ? "Model"
                      : inputName === "supplierName"
                      ? "Supplier"
                      : inputName}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

function AllSpares() {
  const navigate = useNavigate();
  const [spares, setSpares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchModel, setSearchModel] = useState("");
  const [searchSupplier, setSearchSupplier] = useState("");

  // Suggestions state for each field
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);

  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);

  const [selectedNameIndex, setSelectedNameIndex] = useState(-1);
  const [selectedModelIndex, setSelectedModelIndex] = useState(-1);
  const [selectedSupplierIndex, setSelectedSupplierIndex] = useState(-1);

  const [namePosition, setNamePosition] = useState(null);
  const [modelPosition, setModelPosition] = useState(null);
  const [supplierPosition, setSupplierPosition] = useState(null);

  const nameInputRef = useRef(null);
  const modelInputRef = useRef(null);
  const supplierInputRef = useRef(null);

  const nameTimeoutRef = useRef(null);
  const modelTimeoutRef = useRef(null);
  const supplierTimeoutRef = useRef(null);

  // Dismiss suggestions on scroll / outside click / focus change
  useEffect(() => {
    const closeAll = () => {
      setShowNameSuggestions(false);
      setShowModelSuggestions(false);
      setShowSupplierSuggestions(false);
      setNameSuggestions([]);
      setModelSuggestions([]);
      setSupplierSuggestions([]);
      setSelectedNameIndex(-1);
      setSelectedModelIndex(-1);
      setSelectedSupplierIndex(-1);
    };

    const isInSuggestionsUI = (target) => {
      if (!target) return false;
      if (nameInputRef.current && nameInputRef.current.contains(target)) return true;
      if (modelInputRef.current && modelInputRef.current.contains(target)) return true;
      if (supplierInputRef.current && supplierInputRef.current.contains(target)) return true;
      return !!target.closest?.('[data-suggestions-portal="true"]');
    };

    const onMouseDown = (e) => {
      if (!isInSuggestionsUI(e.target)) closeAll();
    };
    const onTouchStart = (e) => {
      if (!isInSuggestionsUI(e.target)) closeAll();
    };
    const onFocusIn = (e) => {
      if (!isInSuggestionsUI(e.target)) closeAll();
    };
    const onScroll = () => closeAll();

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("touchstart", onTouchStart, true);
    document.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("focusin", onFocusIn, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  const fetchSpares = useCallback(async () => {
    try {
      console.log("AllSpares: Starting to fetch spares data...");

      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(
        `${API_BASE}/spares?t=${timestamp}`
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
    if (!searchName.trim() && !searchModel.trim() && !searchSupplier.trim()) {
      return spares;
    }

    return spares.filter((spare) => {
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
  }, [spares, searchName, searchModel, searchSupplier]);

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
      const response = await fetch(
        `${API_BASE}/spares/${spareId}`,
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

  // Helper: detect missing purchase price in any stock entry/color entry
  // Matches Models-style UI: show a dot + pending dates list.
  const getSparePriceStatus = (spare) => {
    const pendingDatesSet = new Set();

    const isMissing = (v) => {
      if (v === undefined || v === null) return true;
      if (typeof v === "string") return v.trim() === "" || Number(v) <= 0;
      const n = Number(v);
      return Number.isNaN(n) || n <= 0;
    };

    if (spare) {
      if (Array.isArray(spare.stockEntries)) {
        spare.stockEntries.forEach((entry) => {
          const rawDate = entry?.purchaseDate || "";
          const dateLabel = rawDate.toString().trim();
          if (isMissing(entry?.purchasePrice) && dateLabel) {
            pendingDatesSet.add(dateLabel);
          }
        });
      }

      if (Array.isArray(spare.colorQuantity)) {
        spare.colorQuantity.forEach((cq) => {
          const rawDate = cq?.purchaseDate || "";
          const dateLabel = rawDate.toString().trim();
          if (isMissing(cq?.purchasePrice) && dateLabel) {
            pendingDatesSet.add(dateLabel);
          }
        });
      }
    }

    const pendingDates = Array.from(pendingDatesSet);

    return {
      hasPending: pendingDates.length > 0,
      pendingDates,
    };
  };

  // Fetch suggestions for names
  const fetchNameSuggestions = async (searchStr) => {
    try {
      const response = await fetch(
        `${API_BASE}/spares/suggestions/names?search=${encodeURIComponent(
          searchStr
        )}`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Error fetching suggestions");
      setNameSuggestions((data.suggestions || []).slice(0, 2)); // Limit to 2 suggestions
      setShowNameSuggestions(data.suggestions?.length > 0);

      if (data.suggestions?.length > 0 && nameInputRef.current) {
        const rect = nameInputRef.current.getBoundingClientRect();
        setNamePosition({
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
        });
      } else {
        setNamePosition(null);
      }
    } catch (err) {
      console.error("Error fetching name suggestions:", err);
      setNameSuggestions([]);
      setShowNameSuggestions(false);
      setNamePosition(null);
    }
  };

  // Fetch suggestions for models
  const fetchModelSuggestions = async (searchStr) => {
    try {
      const response = await fetch(
        `${API_BASE}/spares/suggestions/models?search=${encodeURIComponent(
          searchStr
        )}`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Error fetching suggestions");
      setModelSuggestions((data.suggestions || []).slice(0, 2)); // Limit to 2 suggestions
      setShowModelSuggestions(data.suggestions?.length > 0);

      if (data.suggestions?.length > 0 && modelInputRef.current) {
        const rect = modelInputRef.current.getBoundingClientRect();
        setModelPosition({
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
        });
      } else {
        setModelPosition(null);
      }
    } catch (err) {
      console.error("Error fetching model suggestions:", err);
      setModelSuggestions([]);
      setShowModelSuggestions(false);
      setModelPosition(null);
    }
  };

  // Fetch suggestions for suppliers
  const fetchSupplierSuggestions = async (searchStr) => {
    try {
      const response = await fetch(
        `${API_BASE}/spares/suggestions/suppliers?search=${encodeURIComponent(
          searchStr
        )}`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Error fetching suggestions");
      setSupplierSuggestions((data.suggestions || []).slice(0, 2)); // Limit to 2 suggestions
      setShowSupplierSuggestions(data.suggestions?.length > 0);

      if (data.suggestions?.length > 0 && supplierInputRef.current) {
        const rect = supplierInputRef.current.getBoundingClientRect();
        setSupplierPosition({
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
        });
      } else {
        setSupplierPosition(null);
      }
    } catch (err) {
      console.error("Error fetching supplier suggestions:", err);
      setSupplierSuggestions([]);
      setShowSupplierSuggestions(false);
      setSupplierPosition(null);
    }
  };

  const handleNameInputChange = (e) => {
    const value = e.target.value;
    setSearchName(value);
    setSelectedNameIndex(-1);

    // If fully backspaced, clear all filters and show all spares
    if (!value.trim()) {
      setSearchName("");
      setSearchModel("");
      setSearchSupplier("");
      setNameSuggestions([]);
      setShowNameSuggestions(false);
      setNamePosition(null);
      setModelSuggestions([]);
      setShowModelSuggestions(false);
      setModelPosition(null);
      setSupplierSuggestions([]);
      setShowSupplierSuggestions(false);
      setSupplierPosition(null);
      return;
    }

    if (nameTimeoutRef.current) {
      clearTimeout(nameTimeoutRef.current);
      nameTimeoutRef.current = null;
    }

    nameTimeoutRef.current = setTimeout(() => {
      fetchNameSuggestions(value.trim());
    }, 200);
  };

  const handleModelInputChange = (e) => {
    const value = e.target.value;
    setSearchModel(value);
    setSelectedModelIndex(-1);

    // If fully backspaced, clear all filters and show all spares
    if (!value.trim()) {
      setSearchName("");
      setSearchModel("");
      setSearchSupplier("");
      setNameSuggestions([]);
      setShowNameSuggestions(false);
      setNamePosition(null);
      setModelSuggestions([]);
      setShowModelSuggestions(false);
      setModelPosition(null);
      setSupplierSuggestions([]);
      setShowSupplierSuggestions(false);
      setSupplierPosition(null);
      return;
    }

    if (modelTimeoutRef.current) {
      clearTimeout(modelTimeoutRef.current);
      modelTimeoutRef.current = null;
    }

    modelTimeoutRef.current = setTimeout(() => {
      fetchModelSuggestions(value.trim());
    }, 200);
  };

  const handleSupplierInputChange = (e) => {
    const value = e.target.value;
    setSearchSupplier(value);
    setSelectedSupplierIndex(-1);

    // If fully backspaced, clear all filters and show all spares
    if (!value.trim()) {
      setSearchName("");
      setSearchModel("");
      setSearchSupplier("");
      setNameSuggestions([]);
      setShowNameSuggestions(false);
      setNamePosition(null);
      setModelSuggestions([]);
      setShowModelSuggestions(false);
      setModelPosition(null);
      setSupplierSuggestions([]);
      setShowSupplierSuggestions(false);
      setSupplierPosition(null);
      return;
    }

    if (supplierTimeoutRef.current) {
      clearTimeout(supplierTimeoutRef.current);
      supplierTimeoutRef.current = null;
    }

    supplierTimeoutRef.current = setTimeout(() => {
      fetchSupplierSuggestions(value.trim());
    }, 200);
  };

  const selectNameSuggestion = (name) => {
    setSearchName(name);
    setNameSuggestions([]);
    setShowNameSuggestions(false);
    setNamePosition(null);
    setSelectedNameIndex(-1);
  };

  const selectModelSuggestion = (model) => {
    setSearchModel(model);
    setModelSuggestions([]);
    setShowModelSuggestions(false);
    setModelPosition(null);
    setSelectedModelIndex(-1);
  };

  const selectSupplierSuggestion = (supplier) => {
    setSearchSupplier(supplier);
    setSupplierSuggestions([]);
    setShowSupplierSuggestions(false);
    setSupplierPosition(null);
    setSelectedSupplierIndex(-1);
  };

  // Handle keyboard navigation for name suggestions
  const handleNameKeyDown = (e) => {
    if (showNameSuggestions && nameSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next =
          selectedNameIndex >= nameSuggestions.length - 1
            ? 0
            : selectedNameIndex + 1;
        setSelectedNameIndex(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev =
          selectedNameIndex <= 0
            ? nameSuggestions.length - 1
            : selectedNameIndex - 1;
        setSelectedNameIndex(prev);
      } else if (e.key === "Enter" && selectedNameIndex >= 0) {
        e.preventDefault();
        const picked = nameSuggestions[selectedNameIndex];
        if (picked) selectNameSuggestion(picked);
      } else if (e.key === "Escape") {
        setShowNameSuggestions(false);
        setNameSuggestions([]);
        setSelectedNameIndex(-1);
      }
    }
  };

  // Handle keyboard navigation for model suggestions
  const handleModelKeyDown = (e) => {
    if (showModelSuggestions && modelSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next =
          selectedModelIndex >= modelSuggestions.length - 1
            ? 0
            : selectedModelIndex + 1;
        setSelectedModelIndex(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev =
          selectedModelIndex <= 0
            ? modelSuggestions.length - 1
            : selectedModelIndex - 1;
        setSelectedModelIndex(prev);
      } else if (e.key === "Enter" && selectedModelIndex >= 0) {
        e.preventDefault();
        const picked = modelSuggestions[selectedModelIndex];
        if (picked) selectModelSuggestion(picked);
      } else if (e.key === "Escape") {
        setShowModelSuggestions(false);
        setModelSuggestions([]);
        setSelectedModelIndex(-1);
      }
    }
  };

  // Handle keyboard navigation for supplier suggestions
  const handleSupplierKeyDown = (e) => {
    if (showSupplierSuggestions && supplierSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next =
          selectedSupplierIndex >= supplierSuggestions.length - 1
            ? 0
            : selectedSupplierIndex + 1;
        setSelectedSupplierIndex(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev =
          selectedSupplierIndex <= 0
            ? supplierSuggestions.length - 1
            : selectedSupplierIndex - 1;
        setSelectedSupplierIndex(prev);
      } else if (e.key === "Enter" && selectedSupplierIndex >= 0) {
        e.preventDefault();
        const picked = supplierSuggestions[selectedSupplierIndex];
        if (picked) selectSupplierSuggestion(picked);
      } else if (e.key === "Escape") {
        setShowSupplierSuggestions(false);
        setSupplierSuggestions([]);
        setSelectedSupplierIndex(-1);
      }
    }
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h2>All Spares</h2>
        <button
          className="btn btn-primary"
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
                onChange={handleNameInputChange}
                onKeyDown={handleNameKeyDown}
                ref={nameInputRef}
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
              {showNameSuggestions &&
                nameSuggestions.length > 0 &&
                namePosition &&
                createPortal(
                  <SuggestionsPortal
                    suggestions={nameSuggestions}
                    selectedIndex={selectedNameIndex}
                    onSelect={selectNameSuggestion}
                    position={namePosition}
                    inputName="name"
                  />,
                  document.body
                )}
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
              Model:
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search by model..."
                value={searchModel}
                onChange={handleModelInputChange}
                onKeyDown={handleModelKeyDown}
                ref={modelInputRef}
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
              {showModelSuggestions &&
                modelSuggestions.length > 0 &&
                modelPosition &&
                createPortal(
                  <SuggestionsPortal
                    suggestions={modelSuggestions}
                    selectedIndex={selectedModelIndex}
                    onSelect={selectModelSuggestion}
                    position={modelPosition}
                    inputName="model"
                  />,
                  document.body
                )}
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
                onChange={handleSupplierInputChange}
                onKeyDown={handleSupplierKeyDown}
                ref={supplierInputRef}
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
              {showSupplierSuggestions &&
                supplierSuggestions.length > 0 &&
                supplierPosition &&
                createPortal(
                  <SuggestionsPortal
                    suggestions={supplierSuggestions}
                    selectedIndex={selectedSupplierIndex}
                    onSelect={selectSupplierSuggestion}
                    position={supplierPosition}
                    inputName="supplier"
                  />,
                  document.body
                )}
            </div>
          </div>

          <div>
            <button
              onClick={() => {
                setSearchName("");
                setSearchModel("");
                setSearchSupplier("");
                // Clear all suggestions
                setNameSuggestions([]);
                setModelSuggestions([]);
                setSupplierSuggestions([]);
                setShowNameSuggestions(false);
                setShowModelSuggestions(false);
                setShowSupplierSuggestions(false);
                setNamePosition(null);
                setModelPosition(null);
                setSupplierPosition(null);
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
