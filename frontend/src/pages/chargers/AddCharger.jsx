import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getTodayForInput } from "../../utils/dateUtils";
import DatePicker from "../../components/DatePicker";

import { API_BASE } from "../../config/api";
export default function AddCharger() {
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState(() => ({
    name: "",
    batteryType: "",
    voltage: "",
    purchaseDate: getTodayForInput(),
    supplierName: "",
    sellingPrice: "",
    minStockLevel: "",
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
  const [batteryTypeSuggestions, setBatteryTypeSuggestions] = useState([]);
  const [voltageSuggestions, setVoltageSuggestions] = useState([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [showBatteryTypeSuggestions, setShowBatteryTypeSuggestions] = useState(false);
  const [showVoltageSuggestions, setShowVoltageSuggestions] = useState(false);
  const [selectedNameIndex, setSelectedNameIndex] = useState(-1);
  const [selectedSupplierIndex, setSelectedSupplierIndex] = useState(-1);
  const [selectedBatteryTypeIndex, setSelectedBatteryTypeIndex] = useState(-1);
  const [selectedVoltageIndex, setSelectedVoltageIndex] = useState(-1);
  const nameInputRef = useRef(null);
  const supplierInputRef = useRef(null);
  const batteryTypeInputRef = useRef(null);
  const voltageInputRef = useRef(null);
  const nameTimeoutRef = useRef(null);
  const supplierTimeoutRef = useRef(null);
  const batteryTypeTimeoutRef = useRef(null);
  const voltageTimeoutRef = useRef(null);

  // Fetch Charger Name suggestions
  const fetchNameSuggestions = async (query) => {
    if (!query.trim()) {
      setNameSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/chargers/suggestions/name?q=${encodeURIComponent(
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
        `${API_BASE}/chargers/suggestions/supplier?q=${encodeURIComponent(
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

  // Fetch battery type suggestions
  const fetchBatteryTypeSuggestions = async (query) => {
    if (!query.trim()) {
      setBatteryTypeSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/chargers/suggestions/batteryType?q=${encodeURIComponent(
          query
        )}`
      );
      if (response.ok) {
        const data = await response.json();
        setBatteryTypeSuggestions(data || []);
      }
    } catch (err) {
      console.error("Error fetching battery type suggestions:", err);
    }
  };

  // Fetch voltage suggestions
  const fetchVoltageSuggestions = async (query) => {
    if (!query.trim()) {
      setVoltageSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/chargers/suggestions/voltage?q=${encodeURIComponent(
          query
        )}`
      );
      if (response.ok) {
        const data = await response.json();
        setVoltageSuggestions(data || []);
      }
    } catch (err) {
      console.error("Error fetching voltage suggestions:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

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

    // Handle suggestions for voltage
    if (name === "voltage") {
      setSelectedVoltageIndex(-1);
      if (voltageTimeoutRef.current) {
        clearTimeout(voltageTimeoutRef.current);
      }
      voltageTimeoutRef.current = setTimeout(() => {
        fetchVoltageSuggestions(value);
        setShowVoltageSuggestions(true);
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

    // Check for duplicates when name or supplierName changes
    if (name === "name" || name === "supplierName") {
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

  const handleBatteryTypeSelect = (suggestion) => {
    setFormData((prev) => ({ ...prev, batteryType: suggestion }));
    setBatteryTypeSuggestions([]);
    setShowBatteryTypeSuggestions(false);
    setSelectedBatteryTypeIndex(-1);
  };

  const handleVoltageSelect = (suggestion) => {
    setFormData((prev) => ({ ...prev, voltage: suggestion }));
    setVoltageSuggestions([]);
    setShowVoltageSuggestions(false);
    setSelectedVoltageIndex(-1);
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
      if (selectedNameIndex >= 0 && selectedNameIndex < nameSuggestions.length) {
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

  const handleBatteryTypeKeyDown = (e) => {
    if (!showBatteryTypeSuggestions || batteryTypeSuggestions.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedBatteryTypeIndex((prev) =>
        prev < batteryTypeSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedBatteryTypeIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        selectedBatteryTypeIndex >= 0 &&
        selectedBatteryTypeIndex < batteryTypeSuggestions.length
      ) {
        handleBatteryTypeSelect(batteryTypeSuggestions[selectedBatteryTypeIndex]);
      } else {
        setShowBatteryTypeSuggestions(false);
        setSelectedBatteryTypeIndex(-1);
      }
    } else if (e.key === "Escape") {
      setShowBatteryTypeSuggestions(false);
      setSelectedBatteryTypeIndex(-1);
    }
  };

  const handleVoltageKeyDown = (e) => {
    if (!showVoltageSuggestions || voltageSuggestions.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedVoltageIndex((prev) =>
        prev < voltageSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedVoltageIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        selectedVoltageIndex >= 0 &&
        selectedVoltageIndex < voltageSuggestions.length
      ) {
        handleVoltageSelect(voltageSuggestions[selectedVoltageIndex]);
      } else {
        setShowVoltageSuggestions(false);
        setSelectedVoltageIndex(-1);
      }
    } else if (e.key === "Escape") {
      setShowVoltageSuggestions(false);
      setSelectedVoltageIndex(-1);
    }
  };

  const checkDuplicate = useCallback(async () => {
    const name = formData.name?.trim();
    const batteryType = formData.batteryType?.trim();
    const voltage = formData.voltage?.trim();
    const supplierName = formData.supplierName?.trim();

    if (!name || !supplierName) {
      setIsDuplicate(false);
      setDuplicateMessage("");
      return;
    }

    setIsCheckingDuplicate(true);
    try {
      let url = `${API_BASE}/chargers/check-duplicate?name=${encodeURIComponent(
        name
      )}&supplierName=${encodeURIComponent(supplierName)}`;
      if (batteryType) {
        url += `&batteryType=${encodeURIComponent(batteryType)}`;
      }
      if (voltage) {
        url += `&voltage=${encodeURIComponent(voltage)}`;
      }
      
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
        const isDuplicateFound = data.exists === true || data.exists === "true" || (data.success && data.exists);
        console.log("isDuplicateFound:", isDuplicateFound);
        
        if (isDuplicateFound) {
          console.log("✅ DUPLICATE DETECTED - Setting isDuplicate to true");
          setIsDuplicate(true);
          setDuplicateMessage(data.message || "Duplicate charger found");
          // Force a re-render by logging state
          setTimeout(() => {
            console.log("State after setting duplicate - isDuplicate should be true");
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
  }, [formData.name, formData.supplierName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Perform a final duplicate check before submission
    const name = formData.name?.trim();
    const batteryType = formData.batteryType?.trim();
    const voltage = formData.voltage?.trim();
    const supplierName = formData.supplierName?.trim();

    if (name && supplierName) {
      // Force a synchronous duplicate check before allowing submission
      try {
        let url = `${API_BASE}/chargers/check-duplicate?name=${encodeURIComponent(
          name
        )}&supplierName=${encodeURIComponent(supplierName)}`;
        if (batteryType) {
          url += `&batteryType=${encodeURIComponent(batteryType)}`;
        }
        if (voltage) {
          url += `&voltage=${encodeURIComponent(voltage)}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.exists === true || data.exists === "true" || (data.success && data.exists)) {
            setIsDuplicate(true);
            setDuplicateMessage(data.message || "Duplicate charger found");
            setError(data.message || "Duplicate charger found. Please change the name or supplier name.");
            return;
          }
        }
      } catch (err) {
        console.error("Final duplicate check failed:", err);
      }
    }

    // Check for duplicate before submission
    if (isDuplicate) {
      setError(duplicateMessage || "Duplicate charger found. Please change the name, ampere value, or supplier name.");
      return;
    }

    // Validate required fields
    if (!formData.name || !formData.sellingPrice) {
      setError("Charger Name and selling price are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const chargerData = {
        name: formData.name,
        batteryType: formData.batteryType || "",
        voltage: formData.voltage || "",
        purchaseDate: formData.purchaseDate || null,
        supplierName: formData.supplierName || "",
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        minStockLevel: parseFloat(formData.minStockLevel) || 0,
      };

      const response = await fetch(`${API_BASE}/chargers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chargerData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error saving charger");
      }

      const savedCharger = await response.json();
      console.log("Charger saved successfully:", savedCharger);

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent("chargerDataUpdated"));

      // Navigate to Add More Stock section for this charger
      navigate(`/chargers/add-more/${savedCharger._id}`);
    } catch (err) {
      console.error("Error saving charger:", err);
      setError(err.message || "Error saving charger. Please try again.");
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
  }, [formData.name, formData.supplierName, checkDuplicate]);

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
      <form onSubmit={handleSubmit} className="spare-form" autoComplete="off" noValidate>
        {/* Fake hidden field to prevent browser autocomplete */}
        <input
          type="text"
          name="fake-field"
          autoComplete="off"
          style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}
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
          <h3>Charger Information</h3>
          <div className="form-row">
            <div
              className="form-group"
              ref={nameInputRef}
              style={{ position: "relative" }}
            >
              <label>
                Charger Name *
                {formData.name && formData.supplierName && (
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
                  if (formData.name && formData.supplierName) {
                    checkDuplicate();
                  }
                }}
                placeholder="Enter Charger Name"
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
                        backgroundColor: selectedNameIndex === idx ? "#e5e7eb" : "white",
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

            <div className="form-group">
              <label>Batt. Type</label>
              <select
                name="batteryType"
                value={formData.batteryType}
                onChange={handleInputChange}
                disabled={isDuplicate}
              >
                <option value="">Select battery type</option>
                <option value="lead">Lead</option>
                <option value="lithium">Lithium</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div
              className="form-group"
              ref={voltageInputRef}
              style={{ position: "relative" }}
            >
              <label>Voltage-Ampere</label>
              <input
                type="text"
                name="voltage"
                value={formData.voltage}
                onChange={handleInputChange}
                onKeyDown={handleVoltageKeyDown}
                placeholder="e.g., 48V-20A"
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
              />
              {showVoltageSuggestions && voltageSuggestions.length > 0 && (
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
                  {voltageSuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleVoltageSelect(suggestion)}
                      onMouseEnter={() => {
                        setSelectedVoltageIndex(idx);
                      }}
                      style={{
                        padding: "0.75rem 1rem",
                        cursor: "pointer",
                        backgroundColor:
                          selectedVoltageIndex === idx ? "#e5e7eb" : "white",
                        borderBottom:
                          idx !== voltageSuggestions.length - 1
                            ? "1px solid #f3f4f6"
                            : "none",
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
                  if (formData.name && formData.supplierName) {
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
                        backgroundColor: selectedSupplierIndex === idx ? "#e5e7eb" : "white",
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
              <label>Selling Price (Warranty) (₹) *</label>
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
              <label>Minimum Stock Level</label>
              <input
                type="number"
                name="minStockLevel"
                value={formData.minStockLevel}
                onChange={handleInputChange}
                placeholder="Enter minimum stock level"
                min="0"
                onWheel={(e) => e.target.blur()}
                disabled={isDuplicate}
                autoComplete="off"
                data-lpignore="true"
              />
              <small style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                Alert when stock falls below this level
              </small>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/chargers/all")}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || isDuplicate}
          >
            {isSubmitting ? "Saving..." : "Add Charger"}
          </button>
        </div>
      </form>
    </div>
  );
}

