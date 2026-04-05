import React, { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
// dateUtils not used on add spare

// displayDate helper removed; no date UI on add spare

// Separate component for portal suggestions to avoid Babel parser issues
import { API_BASE } from "../../config/api";
function SuggestionsPortal({
  suggestions,
  selectedIndex,
  onSelect,
  position,
  inputName,
}) {
  if (!position) return null;

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
    animation: "slideDown 0.2s ease-out",
  };

  return (
    <div style={style}>
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

function AddSpare() {
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    sellingPrice: "",
    supplierName: "",
    minStockLevel: "",
    hasColors: false,
    colors: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState("");
  const duplicateCheckTimeoutRef = useRef(null);

  // Date picker state removed along with stock entries UI

  const handleInputChange = (e) => {
    const { name, value, checked } = e.target;

    // Stock and per-color inputs removed

    // Handle checkbox for hasColors
    if (name === "hasColors") {
      handleHasColorsChange(checked);
      return;
    }

    // Handle regular form inputs (excluding name which has its own handler)
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Date picker helpers removed

  // Handle model input change with suggestions
  const handleModelInputChange = (e) => {
    const value = e.target.value;
    setModelSearch(value);
    setSelectedSuggestionIndex(-1);

    if (modelTimeoutRef.current) {
      clearTimeout(modelTimeoutRef.current);
      modelTimeoutRef.current = null;
    }

    modelTimeoutRef.current = setTimeout(() => {
      fetchModelSuggestions(value.trim());
    }, 200);
  };

  // Handle name input change with suggestions
  const handleNameInputChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, name: value }));
    setSelectedNameIndex(-1);

    if ((formData.name || "").length > value.length || !value.trim()) {
      setFormData((prev) => ({
        ...prev,
        sellingPrice: "",
        minStockLevel: "",
        hasColors: false,
        colors: [],
      }));
    }

    if (nameTimeoutRef.current) {
      clearTimeout(nameTimeoutRef.current);
      nameTimeoutRef.current = null;
    }

    nameTimeoutRef.current = setTimeout(() => {
      fetchNameSuggestions(value.trim());
    }, 200);
    if (dupCheckTimeoutRef.current) {
      clearTimeout(dupCheckTimeoutRef.current);
      dupCheckTimeoutRef.current = null;
    }
    dupCheckTimeoutRef.current = setTimeout(() => {
      const nameVal = value.trim();
      const supplierVal = formData.supplierName?.trim();
      if (nameVal && supplierVal && selectedModels.length > 0) {
        checkDuplicate();
      } else {
        setIsDuplicate(false);
        setError("");
      }
    }, 200);
  };

  // Spare name suggestions state
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [selectedNameIndex, setSelectedNameIndex] = useState(-1);
  const [namePosition, setNamePosition] = useState(null);
  const nameInputRef = useRef(null);

  // Supplier name suggestions state
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [supplierPosition, setSupplierPosition] = useState(null);
  const [selectedSupplierIndex, setSelectedSupplierIndex] = useState(-1);
  const supplierInputRef = useRef(null);
  const supplierTimeoutRef = useRef(null);

  // Model name suggestions (same logic style as models section)
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [suggestionPosition, setSuggestionPosition] = useState(null);
  const modelInputRef = useRef(null);

  const nameTimeoutRef = useRef(null);
  const modelTimeoutRef = useRef(null);
  const dupCheckTimeoutRef = useRef(null);

  // Multi-model selection state
  const [modelSearch, setModelSearch] = useState("");
  const [selectedModels, setSelectedModels] = useState([]);

  const addModel = (name) => {
    if (!name) return;
    setSelectedModels((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setModelSearch("");
    setShowSuggestions(false);
    setModelSuggestions([]);
    setSelectedSuggestionIndex(-1);
    setSuggestionPosition(null);
    if (dupCheckTimeoutRef.current) {
      clearTimeout(dupCheckTimeoutRef.current);
      dupCheckTimeoutRef.current = null;
    }
    dupCheckTimeoutRef.current = setTimeout(() => {
      const nameVal = formData.name?.trim();
      const supplierVal = formData.supplierName?.trim();
      if (nameVal && supplierVal && selectedModels.length + 1 > 0) {
        checkDuplicate();
      } else {
        setIsDuplicate(false);
        setError("");
      }
    }, 200);
  };

  const removeModel = (name) => {
    setSelectedModels((prev) => prev.filter((n) => n !== name));
    setFormData((prev) => ({
      ...prev,
      sellingPrice: "",
      minStockLevel: "",
      hasColors: false,
      colors: [],
    }));
    if (dupCheckTimeoutRef.current) {
      clearTimeout(dupCheckTimeoutRef.current);
      dupCheckTimeoutRef.current = null;
    }
    dupCheckTimeoutRef.current = setTimeout(() => {
      const nameVal = formData.name?.trim();
      const supplierVal = formData.supplierName?.trim();
      const modelsLen = selectedModels.length - 1; // after removal
      if (nameVal && supplierVal && modelsLen > 0) {
        checkDuplicate();
      } else {
        setIsDuplicate(false);
        setError("");
      }
    }, 200);
  };

  const handleHasColorsChange = (checked) => {
    setFormData((prev) => ({
      ...prev,
      hasColors: checked,
      colors: [],
    }));
  };
  // Per-color fields removed; no auto-quantity handling

  const selectSupplierSuggestion = (supplier) => {
    setFormData((prev) => ({ ...prev, supplierName: supplier }));
    setSupplierSuggestions([]);
    setShowSupplierSuggestions(false);
    setSupplierPosition(null);
  };

  const selectNameSuggestion = (name) => {
    setFormData((prev) => ({ ...prev, name: name }));
    setNameSuggestions([]);
    setShowNameSuggestions(false);
    setNamePosition(null);
    setSelectedNameIndex(-1);
  };

  // Fetch suggestions for names
  const fetchNameSuggestions = async (searchStr) => {
    if (!searchStr.trim()) {
      setNameSuggestions([]);
      setShowNameSuggestions(false);
      setNamePosition(null);
      return;
    }

    // Set position immediately before showing loading
    if (nameInputRef.current) {
      const rect = nameInputRef.current.getBoundingClientRect();
      setNamePosition({
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }

    setShowNameSuggestions(true);
    setNameSuggestions([{ loading: true }]); // Show loading indicator

    // Add a small delay to ensure loading state is visible
    await new Promise((resolve) => setTimeout(resolve, 300));

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
    } catch (err) {
      console.error("Error fetching name suggestions:", err);
      setNameSuggestions([]);
      setShowNameSuggestions(false);
      setNamePosition(null);
    }
  };

  // Fetch suggestions for models from models database
  const fetchModelSuggestions = async (searchStr) => {
    if (!searchStr.trim()) {
      setModelSuggestions([]);
      setShowSuggestions(false);
      setSuggestionPosition(null);
      return;
    }

    // Set position immediately before showing loading
    if (modelInputRef.current) {
      const rect = modelInputRef.current.getBoundingClientRect();
      setSuggestionPosition({
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }

    setShowSuggestions(true);
    setModelSuggestions([{ loading: true }]); // Show loading indicator

    // Add a small delay to ensure loading state is visible
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const response = await fetch(
        `${API_BASE}/models/suggestions?search=${encodeURIComponent(
          searchStr
        )}`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Error fetching model suggestions");
      setModelSuggestions((data.suggestions || []).slice(0, 2)); // Limit to 2 suggestions
      setShowSuggestions(data.suggestions?.length > 0);
    } catch (err) {
      console.error("Error fetching model suggestions:", err);
      setModelSuggestions([]);
      setShowSuggestions(false);
      setSuggestionPosition(null);
    }
  };

  const fetchSupplierSuggestions = async (searchStr) => {
    if (!searchStr.trim()) {
      setSupplierSuggestions([]);
      setShowSupplierSuggestions(false);
      setSupplierPosition(null);
      return;
    }

    if (supplierInputRef.current) {
      const rect = supplierInputRef.current.getBoundingClientRect();
      setSupplierPosition({
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }

    setShowSupplierSuggestions(true);
    setSupplierSuggestions([{ loading: true }]);

    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const response = await fetch(
        `${API_BASE}/spares/suggestions/suppliers?search=${encodeURIComponent(
          searchStr
        )}`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Error fetching supplier suggestions");
      setSupplierSuggestions((data.suggestions || []).slice(0, 2));
      setShowSupplierSuggestions(data.suggestions?.length > 0);
    } catch (err) {
      console.error("Error fetching supplier suggestions:", err);
      setSupplierSuggestions([]);
      setShowSupplierSuggestions(false);
      setSupplierPosition(null);
    }
  };

  const checkDuplicate = useCallback(async () => {
    const name = formData.name?.trim();
    const supplier = formData.supplierName?.trim();
    if (!name || !supplier || selectedModels.length === 0) {
      setIsDuplicate(false);
      setDuplicateMessage("");
      return false;
    }

    console.log("=== SPARE DUPLICATE CHECK STARTED ===");
    console.log("Checking duplicate for:", { name, models: selectedModels, supplier });
    setIsCheckingDuplicate(true);
    
    try {
      const modelsParam = JSON.stringify(selectedModels);
      const url = `${API_BASE}/spares/check-duplicate?name=${encodeURIComponent(
        name
      )}&models=${encodeURIComponent(modelsParam)}&supplierName=${encodeURIComponent(supplier)}`;
      
      console.log("Duplicate check URL:", url);
      const response = await fetch(url);
      console.log("Response status:", response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log("=== DUPLICATE CHECK RESPONSE ===");
        console.log("Full response data:", JSON.stringify(data, null, 2));
        console.log("data.exists:", data.exists, "type:", typeof data.exists);
        
        const isDuplicateFound = data.exists === true || data.exists === "true" || (data.success && data.exists);
        console.log("isDuplicateFound:", isDuplicateFound);
        
        if (isDuplicateFound) {
          console.log("✅ DUPLICATE DETECTED - Setting isDuplicate to true");
          setIsDuplicate(true);
          setDuplicateMessage(data.message || "Duplicate spare found");
          setError(data.message || "Duplicate spare found");
        return true;
        } else {
          console.log("❌ No duplicate found - Setting isDuplicate to false");
          setIsDuplicate(false);
          setDuplicateMessage("");
          setError("");
          return false;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Duplicate check error response:", errorData);
        setIsDuplicate(false);
        setDuplicateMessage("");
      setError("");
      return false;
      }
    } catch (err) {
      console.error("Duplicate check failed:", err);
      setIsDuplicate(false);
      setDuplicateMessage("");
      setError("");
      return false;
    } finally {
      setIsCheckingDuplicate(false);
      console.log("=== DUPLICATE CHECK COMPLETED ===");
    }
  }, [formData.name, formData.supplierName, selectedModels]);

  // Handle keyboard navigation for name suggestions
  const handleNameKeyDown = (e) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      setFormData((prev) => ({
        ...prev,
        sellingPrice: "",
        minStockLevel: "",
        hasColors: false,
        colors: [],
      }));
    }
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

  // Handle keyboard navigation for supplier suggestions
  const handleSupplierKeyDown = (e) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      setFormData((prev) => ({
        ...prev,
        sellingPrice: "",
        minStockLevel: "",
        hasColors: false,
        colors: [],
      }));
    }
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

  const handleSupplierInputChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, supplierName: value }));
    setSelectedSupplierIndex(-1);

    if ((formData.supplierName || "").length > value.length || !value.trim()) {
      setFormData((prev) => ({
        ...prev,
        sellingPrice: "",
        minStockLevel: "",
        hasColors: false,
        colors: [],
      }));
    }

    if (supplierTimeoutRef.current) {
      clearTimeout(supplierTimeoutRef.current);
      supplierTimeoutRef.current = null;
    }

    supplierTimeoutRef.current = setTimeout(() => {
      fetchSupplierSuggestions(value.trim());
    }, 200);

    if (dupCheckTimeoutRef.current) {
      clearTimeout(dupCheckTimeoutRef.current);
      dupCheckTimeoutRef.current = null;
    }
    dupCheckTimeoutRef.current = setTimeout(() => {
      const nameVal = formData.name?.trim();
      const supplierVal = value.trim();
      if (nameVal && supplierVal && selectedModels.length > 0) {
        checkDuplicate();
      } else {
        setIsDuplicate(false);
        setError("");
      }
    }, 200);
  };

  // Check for duplicates whenever all three key fields are filled
  useEffect(() => {
    const name = formData.name?.trim();
    const supplier = formData.supplierName?.trim();

    // Only check if all three fields have values (name, supplier, and at least one model)
    if (name && supplier && selectedModels.length > 0) {
      // Clear any existing timeout
      if (duplicateCheckTimeoutRef.current) {
        clearTimeout(duplicateCheckTimeoutRef.current);
      }
      // Debounce the duplicate check
      duplicateCheckTimeoutRef.current = setTimeout(() => {
        checkDuplicate();
      }, 500);
    } else {
      // If any field is empty, clear duplicate state
      setIsDuplicate(false);
      setDuplicateMessage("");
      setError("");
    }

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (duplicateCheckTimeoutRef.current) {
        clearTimeout(duplicateCheckTimeoutRef.current);
      }
    };
  }, [formData.name, formData.supplierName, selectedModels, checkDuplicate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!formData.name || !formData.sellingPrice || !formData.supplierName) {
      setError("Spare name, selling price, and supplier name are required");
      return;
    }

    // No per-color validation; checkbox only

    // Perform a final duplicate check before submission
    const isDuplicate = await checkDuplicate();
    if (isDuplicate) {
      return;
    }

    setIsSubmitting(true);

    try {
      // If no models are selected, automatically add "Universal"
      const modelsToSave =
        selectedModels.length > 0 ? selectedModels : ["Universal"];

      const spareData = {
        name: formData.name,
        sellingPrice: parseFloat(formData.sellingPrice),
        supplierName: formData.supplierName,
        minStockLevel: parseInt(formData.minStockLevel) || 0,
        models: modelsToSave,
        hasColors: !!formData.hasColors,
        colorQuantity: [],
        stockEntries: [],
      };

      const response = await fetch(`${API_BASE}/spares`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(spareData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error saving spare");
      }

      const savedSpare = await response.json();
      console.log("Spare saved successfully:", savedSpare);

      // Redirect to Add More Stock to add stock entries or color quantities
      const spareId = savedSpare?._id || savedSpare?.id;
      if (spareId) {
        navigate(`/spares/add-more/${spareId}`);
      } else {
        navigate("/spares/all");
      }
    } catch (err) {
      console.error("Error saving spare:", err);
      setError(err.message || "Error saving spare. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="spare-container">
        <h2>Add New Spare</h2>

        <form onSubmit={handleSubmit} className="spare-form">
          <div className="form-section">
            <h3>Spare Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>
                  Spare Name *
                  {formData.name && formData.supplierName && selectedModels.length > 0 && (
                    <span style={{ marginLeft: "0.5rem" }}>
                      {isCheckingDuplicate ? (
                        <span style={{ color: "#6b7280" }}>⏳</span>
                      ) : isDuplicate ? (
                        <span style={{ color: "#dc2626" }}>✗</span>
                      ) : (
                        <span style={{ color: "#16a34a" }}>✓</span>
                      )}
                    </span>
                  )}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleNameInputChange}
                    onKeyDown={handleNameKeyDown}
                    onBlur={() => {
                      // Trigger duplicate check when field loses focus
                      if (formData.name && formData.supplierName && selectedModels.length > 0) {
                        checkDuplicate();
                      }
                    }}
                    placeholder="Enter spare name"
                    required
                    ref={nameInputRef}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    style={{
                      borderColor: isDuplicate ? "#dc2626" : undefined,
                    }}
                  />
                  {isCheckingDuplicate && (
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "0.875rem",
                        marginTop: "0.25rem",
                        fontWeight: "500",
                      }}
                    >
                      ⏳ Checking for duplicates...
                    </div>
                  )}
                  {!isCheckingDuplicate && isDuplicate && duplicateMessage && (
                    <div
                      style={{
                        color: "#dc2626",
                        fontSize: "0.875rem",
                        marginTop: "0.25rem",
                        fontWeight: "500",
                        padding: "0.5rem",
                        backgroundColor: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: "0.375rem",
                      }}
                    >
                      ⚠️ {duplicateMessage}
                    </div>
                  )}
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
              <div className="form-group">
                <label>Models *</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    name="modelSearch"
                    value={modelSearch}
                    onChange={handleModelInputChange}
                    placeholder="Type to search model names, press Enter to add"
                    autoComplete="off"
                    autoCorrect="off"
                    disabled={isDuplicate}
                    style={{
                      borderColor: isDuplicate ? "#dc2626" : undefined,
                    }}
                    spellCheck="false"
                    ref={modelInputRef}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" || e.key === "Delete") {
                        setFormData((prev) => ({
                          ...prev,
                          sellingPrice: "",
                          minStockLevel: "",
                          hasColors: false,
                          colors: [],
                        }));
                      }
                      if (showSuggestions && modelSuggestions.length > 0) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          const next =
                            selectedSuggestionIndex >=
                            modelSuggestions.length - 1
                              ? 0
                              : selectedSuggestionIndex + 1;
                          setSelectedSuggestionIndex(next);
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          const prev =
                            selectedSuggestionIndex <= 0
                              ? modelSuggestions.length - 1
                              : selectedSuggestionIndex - 1;
                          setSelectedSuggestionIndex(prev);
                        } else if (
                          e.key === "Enter" &&
                          selectedSuggestionIndex >= 0
                        ) {
                          e.preventDefault();
                          const picked =
                            modelSuggestions[selectedSuggestionIndex];
                          if (picked) {
                            addModel(picked);
                          }
                        }
                      }
                      // Allow Enter to add exact typed name when no suggestions
                      if (e.key === "Enter" && modelSuggestions.length === 0) {
                        e.preventDefault();
                        const typed = modelSearch.trim();
                        if (typed) {
                          addModel(typed);
                        }
                      }
                    }}
                  />
                  {selectedModels.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      {selectedModels.map((name) => (
                        <div
                          key={name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: "#f3f4f6",
                            border: "1px solid #e5e7eb",
                            borderRadius: 16,
                            padding: "4px 8px",
                          }}
                        >
                          <span
                            style={{ fontSize: "0.85rem", color: "#111827" }}
                          >
                            {name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeModel(name)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#6b7280",
                              cursor: "pointer",
                              fontSize: "0.9rem",
                              lineHeight: 1,
                            }}
                            aria-label={`Remove ${name}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {showSuggestions &&
                    modelSuggestions.length > 0 &&
                    suggestionPosition &&
                    createPortal(
                      <SuggestionsPortal
                        suggestions={modelSuggestions}
                        selectedIndex={selectedSuggestionIndex}
                        onSelect={addModel}
                        position={suggestionPosition}
                        inputName="model"
                      />,
                      document.body
                    )}
                </div>
              </div>
              <div className="form-group">
                <label>Supplier Name *</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    name="supplierName"
                    value={formData.supplierName}
                    onChange={handleSupplierInputChange}
                    onKeyDown={handleSupplierKeyDown}
                    onBlur={() => {
                      // Trigger duplicate check when field loses focus
                      if (formData.name && formData.supplierName && selectedModels.length > 0) {
                        checkDuplicate();
                      }
                    }}
                    placeholder="Enter supplier name"
                    required
                    ref={supplierInputRef}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{
                      borderColor: isDuplicate ? "#dc2626" : undefined,
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
            </div>
          </div>

          <div className="form-section">
            <h3>Color Tracking</h3>
            <div className="form-row">
              <div className="form-group">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <input
                    type="checkbox"
                    name="hasColors"
                    checked={formData.hasColors}
                    onChange={handleInputChange}
                    disabled={isDuplicate}
                    style={{
                      width: "auto",
                      ...(isDuplicate ? { cursor: "not-allowed" } : {}),
                    }}
                  />
                  This spare has color options
                </label>
                <small style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                  Enable if you want to track stock by color
                </small>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Pricing & Stock Levels</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Selling Price *</label>
                <input
                  type="number"
                  name="sellingPrice"
                  value={formData.sellingPrice}
                  onChange={handleInputChange}
                  placeholder="Enter selling price"
                  min="0"
                  step="0.01"
                  required
                  disabled={isDuplicate}
                  onWheel={(e) => e.target.blur()}
                  style={{
                    ...(isDuplicate
                      ? { backgroundColor: "#f3f4f6", cursor: "not-allowed" }
                      : {}),
                  }}
                />
              </div>
            </div>
            {!formData.hasColors && (
              <div className="form-row">
                <div className="form-group">
                  <label>Minimum Stock Level</label>
                  <input
                    type="number"
                    name="minStockLevel"
                    value={formData.minStockLevel}
                    onChange={handleInputChange}
                    placeholder="Enter minimum stock level"
                    min="0"
                    disabled={isDuplicate}
                    onWheel={(e) => e.target.blur()}
                    style={{
                      ...(isDuplicate
                        ? { backgroundColor: "#f3f4f6", cursor: "not-allowed" }
                        : {}),
                    }}
                  />
                  <small style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                    Alert when stock falls below this level
                  </small>
                </div>
              </div>
            )}
          </div>

          <div className="form-actions">
            {error && (
              <div
                className="error-message"
                style={{ color: "#dc2626", marginBottom: "1rem" }}
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || isDuplicate}
            >
              {isSubmitting ? "Saving..." : "Save Spare"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate("/spares/all")}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default AddSpare;
