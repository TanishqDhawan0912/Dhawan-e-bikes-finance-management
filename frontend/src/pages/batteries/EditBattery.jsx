import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Check if ID is a valid MongoDB ObjectId (24 hex characters)
import { API_BASE } from "../../config/api";
const isValidObjectId = (id) => {
  return id && /^[0-9a-fA-F]{24}$/.test(id);
};

export default function EditBattery() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    ampereValue: "",
    batteriesPerSet: "",
    totalSets: "",
    openBatteries: "",
    totalBatteries: "",
    warrantyStatus: false,
    sellingPrice: "",
    supplierName: "",
    batteryType: "",
    minStockLevel: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Suggestions state
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const nameInputRef = useRef(null);
  const supplierInputRef = useRef(null);
  const nameTimeoutRef = useRef(null);
  const supplierTimeoutRef = useRef(null);

  // Fetch battery data
  useEffect(() => {
    if (!id || !isValidObjectId(id)) {
      setLoading(false);
      return;
    }

    const fetchBattery = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/batteries/${id}`
        );
        if (!response.ok) {
          throw new Error("Battery not found");
        }
        const battery = await response.json();

        // Calculate total batteries for display
        const totalBatteries =
          (battery.batteriesPerSet || 0) * (battery.totalSets || 0) +
          (battery.openBatteries || 0);

        setFormData({
          name: battery.name || "",
          ampereValue: battery.ampereValue
            ? battery.ampereValue.toString().replace(/[^0-9.]/g, "")
            : "",
          batteriesPerSet: battery.batteriesPerSet?.toString() || "",
          totalSets: battery.totalSets?.toString() || "",
          openBatteries: battery.openBatteries?.toString() || "",
          totalBatteries: totalBatteries.toString(),
          warrantyStatus: battery.warrantyStatus || false,
          sellingPrice: battery.sellingPrice?.toString() || "",
          supplierName: battery.supplierName || "",
          batteryType: battery.batteryType || "",
          minStockLevel: battery.minStockLevel?.toString() || "",
        });
      } catch (err) {
        console.error("Error fetching battery:", err);
        setError(err.message || "Error fetching battery");
      } finally {
        setLoading(false);
      }
    };

    fetchBattery();
  }, [id]);

  // Fetch battery name suggestions
  const fetchNameSuggestions = async (query) => {
    if (!query.trim()) {
      setNameSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/batteries/suggestions/name?q=${encodeURIComponent(
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
        `${API_BASE}/batteries/suggestions/supplier?q=${encodeURIComponent(
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
      if (supplierTimeoutRef.current) {
        clearTimeout(supplierTimeoutRef.current);
      }
      supplierTimeoutRef.current = setTimeout(() => {
        fetchSupplierSuggestions(value);
        setShowSupplierSuggestions(true);
      }, 200);
    }
  };

  const handleNameSelect = (suggestion) => {
    setFormData((prev) => ({ ...prev, name: suggestion }));
    setNameSuggestions([]);
    setShowNameSuggestions(false);
  };

  const handleSupplierSelect = (suggestion) => {
    setFormData((prev) => ({ ...prev, supplierName: suggestion }));
    setSupplierSuggestions([]);
    setShowSupplierSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!formData.name || !formData.sellingPrice) {
      setError("Battery name and selling price are required");
      return;
    }

    if (!id || !isValidObjectId(id)) {
      setError("Invalid battery ID");
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
        batteryType:
          formData.batteryType === "lead" || formData.batteryType === "lithium"
            ? formData.batteryType
            : "",
        minStockLevel: parseFloat(formData.minStockLevel) || 0,
      };

      const response = await fetch(
        `${API_BASE}/batteries/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(batteryData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error updating battery");
      }

      const updatedBattery = await response.json();
      console.log("Battery updated successfully:", updatedBattery);

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent("batteryDataUpdated"));

      navigate("/batteries/all");
    } catch (err) {
      console.error("Error updating battery:", err);
      setError(err.message || "Error updating battery. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // Show message if no battery ID is provided or ID is invalid
  if (
    !id ||
    !isValidObjectId(id) ||
    id === "add" ||
    id === "all" ||
    id === "edit"
  ) {
    return (
      <div className="form-container">
        <div
          style={{
            padding: "2rem",
            backgroundColor: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "0.375rem",
            textAlign: "center",
            margin: "2rem 0",
          }}
        >
          <h3
            style={{
              margin: "0 0 1rem 0",
              color: "#92400e",
              fontSize: "1.125rem",
            }}
          >
            No Battery Selected
          </h3>
          <p
            style={{
              margin: "0 0 1.5rem 0",
              color: "#92400e",
              fontSize: "0.875rem",
            }}
          >
            Please select a battery from the list to edit.
          </p>
          <button
            type="button"
            onClick={() => navigate("/batteries/all")}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#f59e0b",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: "500",
            }}
          >
            Go to All Batteries
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="form-container">
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Edit Battery</h2>
          <p>Loading battery data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="spare-container">
      <form onSubmit={handleSubmit} className="spare-form">
        {error && (
          <div
            className="error-message"
            style={{ color: "red", marginBottom: "1rem" }}
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
              <label>Battery Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter battery name"
                required
              />
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
                    zIndex: 1000,
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
                        borderBottom:
                          idx !== nameSuggestions.length - 1
                            ? "1px solid #f3f4f6"
                            : "none",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "#f3f4f6";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "white";
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
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
                  placeholder="e.g., 20"
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
                disabled={formData.batteryType === "lithium"}
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
                disabled={formData.batteryType === "lithium"}
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
              >
                <option value="no-warranty">No Warranty</option>
                <option value="warranty">Warranty</option>
              </select>
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
                placeholder="Enter supplier name"
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
                    zIndex: 1000,
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
                        borderBottom:
                          idx !== supplierSuggestions.length - 1
                            ? "1px solid #f3f4f6"
                            : "none",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "#f3f4f6";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "white";
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
              <label>Battery type</label>
              <select
                name="batteryType"
                value={formData.batteryType}
                onChange={handleInputChange}
              >
                <option value="">— Select type —</option>
                <option value="lead">Lead</option>
                <option value="lithium">Lithium</option>
              </select>
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
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Update Battery"}
          </button>
        </div>
      </form>
    </div>
  );
}
