import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getTodayFormatted, formatDate } from "../../utils/dateUtils";

import { fetchWithRetry } from "../../config/api";
export default function EditModel() {
  const navigate = useNavigate();
  const { id } = useParams(); // Get model ID from URL
  const [searchParams] = useSearchParams();
  const isAdminEdit = searchParams.get("admin") === "true";

  // Form state
  const [formData, setFormData] = useState({
    modelName: "",
    company: "",
    sellingPrice: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [lastPurchaseDate, setLastPurchaseDate] = useState("");


  // Fetch model data on component mount
  useEffect(() => {
    const fetchModel = async () => {
      try {
        setLoading(true);
        const response = await fetchWithRetry(`/models/${id}`);

        if (!response.ok) {
          throw new Error("Model not found");
        }

        const model = await response.json();

        // Pre-fill form with model data
        setFormData({
          modelName: model.data.modelName,
          company: model.data.company,
          sellingPrice: model.data.sellingPrice ? model.data.sellingPrice.toString() : "",
        });

        // Calculate total quantity from stock entries (source of truth).
        // IMPORTANT: if stockEntries exist, a total of 0 is valid and should NOT
        // fall back to legacy fields (which can be stale).
        const hasStockEntries =
          model.data.stockEntries && Array.isArray(model.data.stockEntries);
        const hasColorQuantities =
          model.data.colorQuantities && Array.isArray(model.data.colorQuantities);

        let calculatedTotalQuantity = 0;
        if (hasStockEntries) {
          model.data.stockEntries.forEach((entry) => {
            if (entry.colorQuantities && Array.isArray(entry.colorQuantities)) {
              entry.colorQuantities.forEach((cq) => {
                calculatedTotalQuantity += parseInt(cq.quantity) || 0;
              });
            }
          });
        } else if (hasColorQuantities) {
          calculatedTotalQuantity = model.data.colorQuantities.reduce(
            (sum, cq) => sum + (parseInt(cq.quantity) || 0),
            0
          );
        } else {
          calculatedTotalQuantity = model.data.quantity || 0;
        }
        setTotalQuantity(calculatedTotalQuantity);

        // Get last purchase date from stock entries (most recent)
        let lastDate = "";
        if (model.data.stockEntries && Array.isArray(model.data.stockEntries) && model.data.stockEntries.length > 0) {
          // Sort entries by date (most recent first)
          const sortedEntries = [...model.data.stockEntries].sort((a, b) => {
            // Parse dd/mm/yyyy format
            const parseEntryDate = (dateStr) => {
              if (!dateStr) return new Date(0);
              if (typeof dateStr === "string" && dateStr.includes("/")) {
                const [day, month, year] = dateStr.split("/");
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              }
              return new Date(dateStr);
            };
            const dateA = parseEntryDate(a.purchaseDate);
            const dateB = parseEntryDate(b.purchaseDate);
            return dateB - dateA;
          });
          if (sortedEntries[0] && sortedEntries[0].purchaseDate) {
            // If already in dd/mm/yyyy format, use it directly; otherwise format it
            const dateStr = sortedEntries[0].purchaseDate;
            if (typeof dateStr === "string" && dateStr.includes("/")) {
              lastDate = dateStr;
            } else {
              lastDate = formatDate(dateStr);
            }
          }
        }
        // Fallback to model purchase date
        if (!lastDate && model.data.purchaseDate) {
          lastDate = formatDate(model.data.purchaseDate);
        }
        setLastPurchaseDate(lastDate || "N/A");

        setError("");
      } catch (err) {
        setError(err.message || "Error fetching model data");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchModel();
    } else {
      setError("No model ID provided");
      setLoading(false);
    }
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!formData.modelName || !formData.company) {
      setError("Model name and company are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isAdminEdit
        ? `/models/${id}?admin=true&applyToGroup=true`
        : `/models/${id}`;
      const response = await fetchWithRetry(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelName: formData.modelName,
          company: formData.company,
          sellingPrice: formData.sellingPrice ? parseFloat(formData.sellingPrice) : 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error updating model");
      }

      console.log("Model updated successfully:", data);

      // Navigate to appropriate page after successful update
      if (isAdminEdit) {
        navigate("/admin?section=models");
      } else {
        navigate("/models/all");
      }
    } catch (err) {
      console.error("Error updating model:", err);
      setError(err.message || "Error updating model. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="model-container">
        <h2>Edit a Model</h2>
        <div className="loading-state">
          <p>Loading model data...</p>
        </div>
      </div>
    );
  }

  // Hide form if no valid model data is loaded
  if (!formData.modelName && !formData.company) {
    return (
      <div className="model-container">
        <h2>Edit a Model</h2>
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
            No Model Data Found
          </h3>
          <p
            style={{
              margin: "0 0 1.5rem 0",
              color: "#92400e",
              fontSize: "0.875rem",
            }}
          >
            No valid model data was found. Please navigate to a model from the
            list to edit.
          </p>
          <button
            type="button"
            onClick={() =>
              isAdminEdit
                ? navigate("/admin?section=models")
                : navigate("/models/all")
            }
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
            {isAdminEdit ? "Back to Admin" : "Back to All Models"}
          </button>
        </div>
      </div>
    );
  }

  if (error && !formData.modelName) {
    return (
      <div className="model-container">
        <h2>Edit a Model</h2>
        <div
          className="error-state"
          style={{ color: "#dc2626", marginBottom: "1rem" }}
        >
          <p>{error}</p>
          <button
            className="btn btn-primary"
            onClick={() =>
              isAdminEdit
                ? navigate("/admin?section=models")
                : navigate("/models/all")
            }
          >
            {isAdminEdit ? "Back to Admin" : "Back to Models"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="model-container">
      <h2>Edit a Model</h2>

      {/* Model Info Display */}
      <div className="form-section">
        <h3>Model Information</h3>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#f0f9ff",
            border: "1px solid #0ea5e9",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <strong>Editing Model:</strong> {formData.modelName} (
          {formData.company})
        </div>
      </div>

      {/* Edit Form */}
      <div className="model-form">
        {/* Model Details */}
        <div className="form-section">
          <h3>Model Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Model Name *</label>
              <input
                type="text"
                name="modelName"
                value={formData.modelName}
                onChange={handleInputChange}
                placeholder="Enter model name"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label>Company *</label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                placeholder="Enter company name"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Total Quantity</label>
              <input
                type="text"
                value={totalQuantity.toLocaleString("en-IN")}
                readOnly
                disabled
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  border: "2px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  color: "#374151",
                  backgroundColor: "#f9fafb",
                  cursor: "not-allowed",
                }}
              />
            </div>

            <div className="form-group">
              <label>Last Purchase Date</label>
              <input
                type="text"
                value={lastPurchaseDate}
                readOnly
                disabled
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  border: "2px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  color: "#374151",
                  backgroundColor: "#f9fafb",
                  cursor: "not-allowed",
                }}
              />
            </div>
          </div>

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
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  border: "2px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  color: "#374151",
                }}
                onWheel={(e) => e.target.blur()}
              />
            </div>
          </div>
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
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Update Model"}
          </button>


          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              isAdminEdit
                ? navigate("/admin?section=models")
                : navigate("/models/all")
            }
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
