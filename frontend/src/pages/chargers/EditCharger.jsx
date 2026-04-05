import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDateForInput } from "../../utils/dateUtils";
import DatePicker from "../../components/DatePicker";

// Check if ID is a valid MongoDB ObjectId (24 hex characters)
import { API_BASE } from "../../config/api";
const isValidObjectId = (id) => {
  return id && /^[0-9a-fA-F]{24}$/.test(id);
};

export default function EditCharger() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    batteryType: "",
    voltage: "",
    quantity: "",
    warrantyStatus: false,
    purchaseDate: "",
    supplierName: "",
    sellingPrice: "",
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

  // Fetch Charger data
  useEffect(() => {
    if (!id || !isValidObjectId(id)) {
      setLoading(false);
      return;
    }

    const fetchCharger = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/chargers/${id}`
        );
        if (!response.ok) {
          throw new Error("Charger not found");
        }
        const Charger = await response.json();

        setFormData({
          name: Charger.name || "",
          batteryType: Charger.batteryType || "",
          voltage: Charger.voltage || "",
          quantity: Charger.quantity?.toString() || "",
          warrantyStatus: Charger.warrantyStatus || false,
          purchaseDate: Charger.purchaseDate ? formatDateForInput(Charger.purchaseDate) : "",
          supplierName: Charger.supplierName || "",
          sellingPrice: Charger.sellingPrice?.toString() || "",
          minStockLevel: Charger.minStockLevel?.toString() || "",
        });
      } catch (err) {
        console.error("Error fetching charger:", err);
        setError(err.message || "Error fetching charger");
      } finally {
        setLoading(false);
      }
    };

    fetchCharger();
  }, [id]);

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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

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
      setError("Charger Name and selling price are required");
      return;
    }

    if (!id || !isValidObjectId(id)) {
      setError("Invalid Charger ID");
      return;
    }

    setIsSubmitting(true);

    try {
      const ChargerData = {
        name: formData.name,
        batteryType: formData.batteryType || "",
        voltage: formData.voltage || "",
        quantity: parseFloat(formData.quantity) || 0,
        warrantyStatus: formData.warrantyStatus || false,
        purchaseDate: formData.purchaseDate || null,
        supplierName: formData.supplierName || "",
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        minStockLevel: parseFloat(formData.minStockLevel) || 0,
      };

      const response = await fetch(
        `${API_BASE}/chargers/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(ChargerData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error updating charger");
      }

      const updatedCharger = await response.json();
      console.log("Charger updated successfully:", updatedCharger);

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent("chargerDataUpdated"));

      navigate("/chargers/all");
    } catch (err) {
      console.error("Error updating charger:", err);
      setError(err.message || "Error updating charger. Please try again.");
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

  // Show message if no Charger ID is provided or ID is invalid
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
            No Charger Selected
          </h3>
          <p
            style={{
              margin: "0 0 1.5rem 0",
              color: "#92400e",
              fontSize: "0.875rem",
            }}
          >
            Please select a Charger from the list to edit.
          </p>
          <button
            type="button"
            onClick={() => navigate("/chargers/all")}
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
            Go to All chargers
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="form-container">
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Edit Charger</h2>
          <p>Loading Charger data...</p>
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
          <h3>Charger Information</h3>
          <div className="form-row">
            <div
              className="form-group"
              ref={nameInputRef}
              style={{ position: "relative" }}
            >
              <label>Charger Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter Charger Name"
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
              <label>Batt. Type</label>
              <select
                name="batteryType"
                value={formData.batteryType}
                onChange={handleInputChange}
              >
                <option value="">Select battery type</option>
                <option value="lead">Lead</option>
                <option value="lithium">Lithium</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Voltage-Ampere</label>
              <input
                type="text"
                name="voltage"
                value={formData.voltage}
                onChange={handleInputChange}
                placeholder="e.g., 48V-20A"
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
              />
            </div>

            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="Enter quantity"
                min="0"
                onWheel={(e) => e.target.blur()}
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
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Update Charger"}
          </button>
        </div>
      </form>
    </div>
  );
}

