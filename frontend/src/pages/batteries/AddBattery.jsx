import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getTodayForInput } from "../../utils/dateUtils";
import DatePicker from "../../components/DatePicker";

export default function AddBattery() {
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState(() => ({
    name: "",
    ampereValue: "",
    batteriesPerSet: "",
    totalSets: "",
    openBatteries: "",
    totalBatteries: "",
    warrantyStatus: false,
    sellingPrice: "",
    supplierName: "",
    minStockLevel: "",
    // Default purchase date to today's date for the HTML date picker (yyyy-mm-dd)
    purchaseDate: getTodayForInput(),
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState("");
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const duplicateCheckTimeoutRef = useRef(null);

  // Suggestions state
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [ampereSuggestions, setAmpereSuggestions] = useState([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [showAmpereSuggestions, setShowAmpereSuggestions] = useState(false);
  const [selectedNameIndex, setSelectedNameIndex] = useState(-1);
  const [selectedSupplierIndex, setSelectedSupplierIndex] = useState(-1);
  const [selectedAmpereIndex, setSelectedAmpereIndex] = useState(-1);
  const nameInputRef = useRef(null);
  const supplierInputRef = useRef(null);
  const ampereInputRef = useRef(null);
  const nameTimeoutRef = useRef(null);
  const supplierTimeoutRef = useRef(null);
  const ampereTimeoutRef = useRef(null);

  // Fetch battery name suggestions
  const fetchNameSuggestions = async (query) => {
    if (!query.trim()) {
      setNameSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/batteries/suggestions/name?q=${encodeURIComponent(
          query
        )}`
      );
      if (response.ok) {
        const data = await response.json();
        setNameSuggestions(data || []);
      }
    } catch (err) {
      console.error("Error fetching name suggestions:", err);
    }
  };

  // Fetch supplier name suggestions
  const fetchSupplierSuggestions = async (query) => {
    if (!query.trim()) {
      setSupplierSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/batteries/suggestions/supplier?q=${encodeURIComponent(
          query
        )}`
      );
      if (response.ok) {
        const data = await response.json();
        setSupplierSuggestions(data || []);
      }
    } catch (err) {
      console.error("Error fetching supplier suggestions:", err);
    }
  };

  // Fetch ampere value suggestions
  const fetchAmpereSuggestions = async (query) => {
    // Remove any non-numeric characters for the query
    const numericQuery = query.replace(/[^0-9.]/g, "");
    if (!numericQuery.trim()) {
      setAmpereSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/batteries/suggestions/ampere?q=${encodeURIComponent(
          numericQuery
        )}`
      );
      if (response.ok) {
        const data = await response.json();
        setAmpereSuggestions(data || []);
      }
    } catch (err) {
      console.error("Error fetching ampere suggestions:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Handle ampereValue - only accept numeric values
    if (name === "ampereValue") {
      // Remove any non-numeric characters (except decimal point)
      const numericValue = value.replace(/[^0-9.]/g, "");
      // Prevent multiple decimal points
      const parts = numericValue.split(".");
      const cleanValue =
        parts.length > 2
          ? parts[0] + "." + parts.slice(1).join("")
          : numericValue;

      setFormData((prev) => ({
        ...prev,
        [name]: cleanValue,
      }));

      // Fetch suggestions for ampere value
      setSelectedAmpereIndex(-1);
      if (ampereTimeoutRef.current) {
        clearTimeout(ampereTimeoutRef.current);
      }
      ampereTimeoutRef.current = setTimeout(() => {
        fetchAmpereSuggestions(cleanValue);
        setShowAmpereSuggestions(true);
      }, 200);

      // Check for duplicates when ampereValue changes
      if (duplicateCheckTimeoutRef.current) {
        clearTimeout(duplicateCheckTimeoutRef.current);
      }
      duplicateCheckTimeoutRef.current = setTimeout(() => {
        checkDuplicate();
      }, 500);
      return;
    }

    // Auto-calculate TOTAL BATTERIES from:
    // totalBatteries = batteriesPerSet * totalSets + openBatteries
    if (
      name === "batteriesPerSet" ||
      name === "totalSets" ||
      name === "openBatteries"
    ) {
      const inputNumber = parseFloat(value) || 0;

      const batteriesPerSet =
        name === "batteriesPerSet"
          ? inputNumber
          : parseFloat(formData.batteriesPerSet) || 0;
      const totalSets =
        name === "totalSets"
          ? inputNumber
          : parseFloat(formData.totalSets) || 0;
      const openBatteries =
        name === "openBatteries"
          ? inputNumber
          : parseFloat(formData.openBatteries) || 0;

      const totalBatteries = batteriesPerSet * totalSets + openBatteries;

      setFormData((prev) => ({
        ...prev,
        [name]: value,
        totalBatteries: totalBatteries > 0 ? totalBatteries.toString() : "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Handle suggestions for name
    if (name === "name") {
      setSelectedNameIndex(-1);
      if (nameTimeoutRef.current) {
        clearTimeout(nameTimeoutRef.current);
      }
      nameTimeoutRef.current = setTimeout(() => {
        fetchNameSuggestions(value);
        setShowNameSuggestions(true);
      }, 200);
    }

    // Handle suggestions for supplier
    if (name === "supplierName") {
      setSelectedSupplierIndex(-1);
      if (supplierTimeoutRef.current) {
        clearTimeout(supplierTimeoutRef.current);
      }
      supplierTimeoutRef.current = setTimeout(() => {
        fetchSupplierSuggestions(value);
        setShowSupplierSuggestions(true);
      }, 200);
    }

    // Check for duplicates when name, ampereValue, or supplierName changes
    if (name === "name" || name === "ampereValue" || name === "supplierName") {
      if (duplicateCheckTimeoutRef.current) {
        clearTimeout(duplicateCheckTimeoutRef.current);
      }
      duplicateCheckTimeoutRef.current = setTimeout(() => {
        checkDuplicate();
      }, 500);
    }
  };

  const handleNameSelect = (suggestion) => {
    setFormData((prev) => ({ ...prev, name: suggestion }));
    setNameSuggestions([]);
    setShowNameSuggestions(false);
    setSelectedNameIndex(-1);
  };

  const handleSupplierSelect = (suggestion) => {
    setFormData((prev) => ({ ...prev, supplierName: suggestion }));
    setSupplierSuggestions([]);
    setShowSupplierSuggestions(false);
    setSelectedSupplierIndex(-1);
  };

  const handleAmpereSelect = (suggestion) => {
    setFormData((prev) => ({ ...prev, ampereValue: suggestion }));
    setAmpereSuggestions([]);
    setShowAmpereSuggestions(false);
    setSelectedAmpereIndex(-1);
  };

  const handleNameKeyDown = (e) => {
    if (!showNameSuggestions || nameSuggestions.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedNameIndex((prev) =>
        prev < nameSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedNameIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        selectedNameIndex >= 0 &&
        selectedNameIndex < nameSuggestions.length
      ) {
        handleNameSelect(nameSuggestions[selectedNameIndex]);
      } else {
        // Close dropdown even if no item is selected
        setShowNameSuggestions(false);
        setSelectedNameIndex(-1);
      }
    } else if (e.key === "Escape") {
      setShowNameSuggestions(false);
      setSelectedNameIndex(-1);
    }
  };

  const handleSupplierKeyDown = (e) => {
    if (!showSupplierSuggestions || supplierSuggestions.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSupplierIndex((prev) =>
        prev < supplierSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSupplierIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        selectedSupplierIndex >= 0 &&
        selectedSupplierIndex < supplierSuggestions.length
      ) {
        handleSupplierSelect(supplierSuggestions[selectedSupplierIndex]);
      } else {
        // Close dropdown even if no item is selected
        setShowSupplierSuggestions(false);
        setSelectedSupplierIndex(-1);
      }
    } else if (e.key === "Escape") {
      setShowSupplierSuggestions(false);
      setSelectedSupplierIndex(-1);
    }
  };

  const handleAmpereKeyDown = (e) => {
    if (!showAmpereSuggestions || ampereSuggestions.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedAmpereIndex((prev) =>
        prev < ampereSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedAmpereIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        selectedAmpereIndex >= 0 &&
        selectedAmpereIndex < ampereSuggestions.length
      ) {
        handleAmpereSelect(ampereSuggestions[selectedAmpereIndex]);
      } else {
        // Close dropdown even if no item is selected
        setShowAmpereSuggestions(false);
        setSelectedAmpereIndex(-1);
      }
    } else if (e.key === "Escape") {
      setShowAmpereSuggestions(false);
      setSelectedAmpereIndex(-1);
    }
  };

  const checkDuplicate = useCallback(async () => {
    const name = formData.name?.trim();
    const ampereValue = formData.ampereValue?.trim();
    const supplierName = formData.supplierName?.trim();

    if (!name || !ampereValue || !supplierName) {
      setIsDuplicate(false);
      setDuplicateMessage("");
      return;
    }

    console.log("=== DUPLICATE CHECK STARTED ===");
    console.log("Checking duplicate for:", { name, ampereValue, supplierName });
    setIsCheckingDuplicate(true);
    try {
      const url = `http://localhost:5000/api/batteries/check-duplicate?name=${encodeURIComponent(
        name
      )}&ampereValue=${encodeURIComponent(
        ampereValue
      )}&supplierName=${encodeURIComponent(supplierName)}`;

      console.log("Duplicate check URL:", url);
      const response = await fetch(url);
      console.log("Response status:", response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log("=== DUPLICATE CHECK RESPONSE ===");
        console.log("Full response data:", JSON.stringify(data, null, 2));
        console.log("data.exists:", data.exists, "type:", typeof data.exists);
        console.log("data.success:", data.success);

        // Check for duplicate - handle both boolean true and truthy values
        const isDuplicateFound =
          data.exists === true ||
          data.exists === "true" ||
          (data.success && data.exists);
        console.log("isDuplicateFound:", isDuplicateFound);

        if (isDuplicateFound) {
          console.log("✅ DUPLICATE DETECTED - Setting isDuplicate to true");
          setIsDuplicate(true);
          setDuplicateMessage(data.message || "Duplicate battery found");
          // Force a re-render by logging state
          setTimeout(() => {
            console.log(
              "State after setting duplicate - isDuplicate should be true"
            );
          }, 100);
        } else {
          console.log("❌ No duplicate found - Setting isDuplicate to false");
          setIsDuplicate(false);
          setDuplicateMessage("");
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Duplicate check error response:", errorData);
        setIsDuplicate(false);
        setDuplicateMessage("");
      }
    } catch (err) {
      console.error("Duplicate check failed:", err);
      setIsDuplicate(false);
      setDuplicateMessage("");
    } finally {
      setIsCheckingDuplicate(false);
      console.log("=== DUPLICATE CHECK COMPLETED ===");
    }
  }, [formData.name, formData.ampereValue, formData.supplierName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Perform a final duplicate check before submission
    const name = formData.name?.trim();
    const ampereValue = formData.ampereValue?.trim();
    const supplierName = formData.supplierName?.trim();

    if (name && ampereValue && supplierName) {
      // Force a synchronous duplicate check before allowing submission
      try {
        const url = `http://localhost:5000/api/batteries/check-duplicate?name=${encodeURIComponent(
          name
        )}&ampereValue=${encodeURIComponent(
          ampereValue
        )}&supplierName=${encodeURIComponent(supplierName)}`;

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (
            data.exists === true ||
            data.exists === "true" ||
            (data.success && data.exists)
          ) {
            setIsDuplicate(true);
            setDuplicateMessage(data.message || "Duplicate battery found");
            setError(
              data.message ||
                "Duplicate battery found. Please change the name, ampere value, or supplier name."
            );
            return;
          }
        }
      } catch (err) {
        console.error("Final duplicate check failed:", err);
      }
    }

    // Check for duplicate before submission
    if (isDuplicate) {
      setError(
        duplicateMessage ||
          "Duplicate battery found. Please change the name, ampere value, or supplier name."
      );
      return;
    }

    // Validate required fields
    if (!formData.name || !formData.sellingPrice) {
      setError("Battery name and selling price are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const batteryData = {
        name: formData.name,
        ampereValue: formData.ampereValue || "",
        batteriesPerSet: parseFloat(formData.batteriesPerSet) || 0,
        totalSets: parseFloat(formData.totalSets) || 0,
        openBatteries: parseFloat(formData.openBatteries) || 0,
        warrantyStatus: formData.warrantyStatus || false,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        supplierName: formData.supplierName || "",
        minStockLevel: parseFloat(formData.minStockLevel) || 0,
        purchaseDate: formData.purchaseDate || null,
      };

      const response = await fetch("http://localhost:5000/api/batteries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batteryData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error saving battery");
      }

      const savedBattery = await response.json();
      console.log("Battery saved successfully:", savedBattery);

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent("batteryDataUpdated"));

      navigate("/batteries/all");
    } catch (err) {
      console.error("Error saving battery:", err);
      setError(err.message || "Error saving battery. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check for duplicates whenever all three key fields are filled
  useEffect(() => {
    const name = formData.name?.trim();
    const ampereValue = formData.ampereValue?.trim();
    const supplierName = formData.supplierName?.trim();

    // Only check if all three fields have values
    if (name && ampereValue && supplierName) {
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
    }

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (duplicateCheckTimeoutRef.current) {
        clearTimeout(duplicateCheckTimeoutRef.current);
      }
    };
  }, [
    formData.name,
    formData.ampereValue,
    formData.supplierName,
    checkDuplicate,
  ]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        nameInputRef.current &&
        !nameInputRef.current.contains(event.target)
      ) {
        setShowNameSuggestions(false);
      }
      if (
        supplierInputRef.current &&
        !supplierInputRef.current.contains(event.target)
      ) {
        setShowSupplierSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="spare-container">
      <form
        onSubmit={handleSubmit}
        className="spare-form"
        autoComplete="off"
        noValidate
      >
        {/* Fake hidden field to prevent browser autocomplete */}
        <input
          type="text"
          name="fake-field"
          autoComplete="off"
          style={{
            position: "absolute",
            left: "-9999px",
            opacity: 0,
            pointerEvents: "none",
          }}
          tabIndex="-1"
        />
        {error && (
          <div
            className="error-message"
            style={{
              color: "#dc2626",
              marginBottom: "1rem",
              padding: "0.75rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.375rem",
              fontWeight: "500",
            }}
          >
            {error}
          </div>
        )}

        <div className="form-section">
          <h3>Battery Information</h3>
          <div className="form-row">
            <div
              className="form-group"
              ref={nameInputRef}
              style={{ position: "relative" }}
            >
              <label>
                Battery Name *
                {formData.name &&
                  formData.ampereValue &&
                  formData.supplierName && (
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
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                onKeyDown={handleNameKeyDown}
                onBlur={() => {
                  // Trigger duplicate check when field loses focus
                  if (
                    formData.name &&
                    formData.ampereValue &&
                    formData.supplierName
                  ) {
                    checkDuplicate();
                  }
                }}
                placeholder="Enter battery name"
                required
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
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
              {showNameSuggestions && nameSuggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                    zIndex: 10000,
                    maxHeight: "200px",
                    overflowY: "auto",
                    marginTop: "4px",
                  }}
                >
                  {nameSuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleNameSelect(suggestion)}
                      style={{
                        padding: "0.75rem 1rem",
                        cursor: "pointer",
                        backgroundColor:
                          selectedNameIndex === idx ? "#e5e7eb" : "white",
                        borderBottom:
                          idx !== nameSuggestions.length - 1
                            ? "1px solid #f3f4f6"
                            : "none",
                      }}
                      onMouseEnter={() => {
                        setSelectedNameIndex(idx);
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="form-group"
              ref={ampereInputRef}
              style={{ position: "relative" }}
            >
              <label>Ampere Value</label>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  name="ampereValue"
                  value={formData.ampereValue}
                  onChange={handleInputChange}
                  onKeyDown={handleAmpereKeyDown}
                  onBlur={() => {
                    // Trigger duplicate check when field loses focus
                    if (
                      formData.name &&
                      formData.ampereValue &&
                      formData.supplierName
                    ) {
                      checkDuplicate();
                    }
                  }}
                  placeholder="e.g., 20"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  style={{ paddingRight: "1.5rem", width: "100%" }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    color: "#6b7280",
                    fontWeight: "500",
                    pointerEvents: "none",
                  }}
                >
                  A
                </span>
              </div>
              {showAmpereSuggestions && ampereSuggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                    zIndex: 10000,
                    maxHeight: "200px",
                    overflowY: "auto",
                    marginTop: "4px",
                  }}
                >
                  {ampereSuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleAmpereSelect(suggestion)}
                      onMouseEnter={() => {
                        setSelectedAmpereIndex(idx);
                      }}
                      style={{
                        padding: "0.75rem",
                        cursor: "pointer",
                        backgroundColor:
                          selectedAmpereIndex === idx ? "#e5e7eb" : "white",
                        borderBottom:
                          idx < ampereSuggestions.length - 1
                            ? "1px solid #f3f4f6"
                            : "none",
                      }}
                    >
                      {suggestion}A
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div
              className="form-group"
              ref={supplierInputRef}
              style={{ position: "relative" }}
            >
              <label>Supplier Name</label>
              <input
                type="text"
                name="supplierName"
                value={formData.supplierName}
                onChange={handleInputChange}
                onKeyDown={handleSupplierKeyDown}
                onBlur={() => {
                  // Trigger duplicate check when field loses focus
                  if (
                    formData.name &&
                    formData.ampereValue &&
                    formData.supplierName
                  ) {
                    checkDuplicate();
                  }
                }}
                placeholder="Enter supplier name"
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
              />
              {showSupplierSuggestions && supplierSuggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                    zIndex: 10000,
                    maxHeight: "200px",
                    overflowY: "auto",
                    marginTop: "4px",
                  }}
                >
                  {supplierSuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSupplierSelect(suggestion)}
                      style={{
                        padding: "0.75rem 1rem",
                        cursor: "pointer",
                        backgroundColor:
                          selectedSupplierIndex === idx ? "#e5e7eb" : "white",
                        borderBottom:
                          idx !== supplierSuggestions.length - 1
                            ? "1px solid #f3f4f6"
                            : "none",
                      }}
                      onMouseEnter={() => {
                        setSelectedSupplierIndex(idx);
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Batteries Per Set</label>
              <input
                type="number"
                name="batteriesPerSet"
                value={formData.batteriesPerSet}
                onChange={handleInputChange}
                placeholder="Enter batteries per set"
                min="1"
                onWheel={(e) => e.target.blur()}
                disabled={isDuplicate}
                autoComplete="off"
                data-lpignore="true"
              />
            </div>

            <div className="form-group">
              <label>Total Batteries</label>
              <input
                type="number"
                name="totalBatteries"
                value={formData.totalBatteries}
                readOnly
                placeholder="Auto-calculated"
                min="0"
                onWheel={(e) => e.target.blur()}
                autoComplete="off"
                data-form-type="other"
                style={{ backgroundColor: "#f3f4f6", cursor: "not-allowed" }}
              />
              <small style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                Auto calculated as: Batteries per set × Total sets + Open
                batteries
              </small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Total Sets</label>
              <input
                type="number"
                name="totalSets"
                value={formData.totalSets}
                onChange={handleInputChange}
                placeholder="Enter total sets"
                min="0"
                onWheel={(e) => e.target.blur()}
                disabled={isDuplicate}
                autoComplete="off"
                data-lpignore="true"
              />
            </div>

            <div className="form-group">
              <label>Open Batteries</label>
              <input
                type="number"
                name="openBatteries"
                value={formData.openBatteries}
                onChange={handleInputChange}
                placeholder="Enter open batteries"
                min="0"
                onWheel={(e) => e.target.blur()}
                disabled={isDuplicate}
                autoComplete="off"
                data-lpignore="true"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Warranty Status</label>
              <select
                name="warrantyStatus"
                value={formData.warrantyStatus ? "warranty" : "no-warranty"}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    warrantyStatus: e.target.value === "warranty",
                  }))
                }
                disabled={isDuplicate}
              >
                <option value="no-warranty">No Warranty</option>
                <option value="warranty">Warranty</option>
              </select>
            </div>
            <div className="form-group">
              <label>Purchase Date</label>
              <DatePicker
                value={formData.purchaseDate}
                onChange={(date) => {
                  setFormData((prev) => ({
                    ...prev,
                    purchaseDate: date || "",
                  }));
                }}
                placeholder="dd/mm/yyyy"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Pricing & Stock Levels</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Selling Price (₹) *</label>
              <input
                type="number"
                name="sellingPrice"
                value={formData.sellingPrice}
                onChange={handleInputChange}
                placeholder="Enter selling price"
                min="0"
                step="0.01"
                required
                onWheel={(e) => e.target.blur()}
                disabled={isDuplicate}
                autoComplete="off"
                data-lpignore="true"
              />
            </div>
            <div className="form-group">
              <label>Minimum Stock Level (Sets)</label>
              <input
                type="number"
                name="minStockLevel"
                value={formData.minStockLevel}
                onChange={handleInputChange}
                placeholder="Enter minimum stock level in sets"
                min="0"
                onWheel={(e) => e.target.blur()}
                disabled={isDuplicate}
                autoComplete="off"
                data-lpignore="true"
              />
              <small style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                Alert when stock falls below this number of sets
              </small>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/batteries/all")}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || isDuplicate}
          >
            {isSubmitting ? "Saving..." : "Add Battery"}
          </button>
        </div>
      </form>
    </div>
  );
}
