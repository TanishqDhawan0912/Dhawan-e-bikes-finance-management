import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTextColorForBackground } from "../../utils/themeUtils";

import { API_BASE } from "../../config/api";
export default function EditSpare() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [formData, setFormData] = useState({
    name: "",
    sellingPrice: "",
    supplierName: "",
    minStockLevel: "",
    models: [],
    colorQuantity: [],
    hasColors: false,
  });
  const [allModels, setAllModels] = useState([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newModel, setNewModel] = useState("");
  const [enableColorTracking, setEnableColorTracking] = useState(false);
  const [spareDetails, setSpareDetails] = useState(null);

  // Track initial color tracking state for comparison on save
  const [initialColorTrackingState, setInitialColorTrackingState] =
    useState(false);

  // Track if form has been submitted to prevent state reset
  const [formSubmitted, setFormSubmitted] = useState(false);

  // State for quantity confirmation dialog
  const [showQuantityConfirm, setShowQuantityConfirm] = useState(false);
  const [totalColorQuantity, setTotalColorQuantity] = useState(0);
  const [hasShownColorDisableConfirm, setHasShownColorDisableConfirm] =
    useState(false);
  const [quantityFieldEditable, setQuantityFieldEditable] = useState(false);

  const fetchSpare = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/spares/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Spare not found");
      }

      const spare = await response.json();
      setSpareDetails(spare);
      setFormData({
        name: spare.name || "",
        sellingPrice: spare.sellingPrice?.toString() || "",
        supplierName: spare.supplierName || "",
        minStockLevel: spare.minStockLevel?.toString() || "",
        models: spare.models || [],
        colorQuantity: spare.colorQuantity || [],
        hasColors:
          !!spare.hasColors ||
          (spare.colorQuantity && spare.colorQuantity.length > 0),
      });

      // Only set color tracking checkbox based on database if form hasn't been submitted yet
      if (!formSubmitted) {
        const hasColors =
          !!spare.hasColors ||
          (spare.colorQuantity && spare.colorQuantity.length > 0);
        setEnableColorTracking(hasColors);
        setInitialColorTrackingState(hasColors);
      }

      // Calculate total color quantity for potential confirmation
      const total =
        spare.colorQuantity?.reduce((sum, cq) => sum + cq.quantity, 0) || 0;
      setTotalColorQuantity(total);
    } catch (err) {
      console.error("Error fetching spare:", err);
      setError(err.message || "Error fetching spare. Please try again.");
    }
  }, [id, formSubmitted]);

  // Handle quantity confirmation dialog
  const handleKeepColorQuantity = () => {
    // Keep the total from colors as the main quantity
    setFormData((prev) => ({
      ...prev,
      quantity: totalColorQuantity.toString(),
    }));
    setFormData((prev) => ({ ...prev, colorQuantity: [] })); // Clear color quantities
    setShowQuantityConfirm(false);
    performSubmit();
  };

  const handleSetDifferentQuantity = () => {
    // Keep the current quantity field value and clear colors
    setFormData((prev) => ({ ...prev, colorQuantity: [] })); // Clear color quantities
    setEnableColorTracking(false); // Uncheck the color checkbox
    setShowQuantityConfirm(false);
    // Set quantity field as editable after confirmation
    setQuantityFieldEditable(true);
    // Focus on the quantity input field
    setTimeout(() => {
      const quantityInput = document.getElementById("quantity");
      if (quantityInput) {
        quantityInput.focus();
        quantityInput.select();
      }
    }, 100);
    // Don't submit here - let the user change the quantity and submit manually
  };

  const handleCancelQuantityConfirm = () => {
    setShowQuantityConfirm(false);
  };

  const fetchAllModels = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/models`);
      if (response.ok) {
        const models = await response.json();
        setAllModels(models);
      }
    } catch (err) {
      console.error("Error fetching models:", err);
    }
  }, []);

  useEffect(() => {
    fetchSpare();
    fetchAllModels();
  }, [fetchSpare, fetchAllModels]);

  // Keep browser tab title consistent app-wide (set in index.html)

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleColorTrackingChange = (e) => {
    const isChecked = e.target.checked;
    setEnableColorTracking(isChecked);
    setFormData((prev) => ({ ...prev, hasColors: !!isChecked }));

    if (isChecked) {
      // Reset the confirmation flag when re-enabling color tracking
      setHasShownColorDisableConfirm(false);
      // Reset quantity field editable state when re-enabling color tracking
      setQuantityFieldEditable(false);
    } else {
      // Do not clear color quantities on toggle; wait until user submits and confirms
      // Allow editing the main quantity field while keeping existing color data in memory
      setQuantityFieldEditable(true);
    }
  };

  const addModel = () => {
    if (newModel.trim() && !formData.models.includes(newModel.trim())) {
      setFormData((prev) => ({
        ...prev,
        models: [...prev.models, newModel.trim()],
      }));
      setNewModel("");
    }
  };

  const removeModel = (modelToRemove) => {
    setFormData((prev) => ({
      ...prev,
      models: prev.models.filter((model) => model !== modelToRemove),
    }));
  };

  const toggleModel = (model) => {
    if (formData.models.includes(model)) {
      removeModel(model);
    } else {
      setFormData((prev) => ({
        ...prev,
        models: [...prev.models, model],
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log(
      "EditSpare: handleSubmit called - color tracking:",
      enableColorTracking,
      "quantityFieldEditable:",
      quantityFieldEditable
    );
    setError("");

    const toggled = initialColorTrackingState !== enableColorTracking;
    const hasStockEntries = Array.isArray(spareDetails?.stockEntries)
      ? spareDetails.stockEntries.some((e) => parseInt(e?.quantity || 0) > 0)
      : false;
    const hasColorQuantities = Array.isArray(spareDetails?.colorQuantity)
      ? spareDetails.colorQuantity.some((cq) => parseInt(cq?.quantity || 0) > 0)
      : false;

    if (toggled && (hasStockEntries || hasColorQuantities)) {
      const msg = enableColorTracking
        ? "Enabling color tracking will remove all existing stock entries. Continue?"
        : "Disabling color tracking will remove all existing color quantities. Continue?";
      setShowEntriesConfirm(true);
      setEntriesConfirmMessage(msg);
      return;
    }

    await performSubmit();
  };

  const performSubmit = async () => {
    console.log(
      "EditSpare: performSubmit called - color tracking:",
      enableColorTracking,
      "quantityFieldEditable:",
      quantityFieldEditable
    );

    // Validate required fields
    if (!formData.name || !formData.sellingPrice || !formData.supplierName) {
      setError("Spare name, selling price, and supplier name are required");
      return;
    }

    setIsSubmitting(true);

    try {
      // If no models are selected, automatically add "Universal"
      const modelsToSave =
        formData.models.length > 0 ? formData.models : ["Universal"];

      const spareData = {
        name: formData.name,
        sellingPrice: parseFloat(formData.sellingPrice),
        supplierName: formData.supplierName,
        minStockLevel: enableColorTracking
          ? 0
          : parseInt(formData.minStockLevel) || 0,
        models: modelsToSave,
        hasColors: !!enableColorTracking,
      };

      console.log("Complete data being sent to API:", spareData);

      const response = await fetch(`${API_BASE}/spares/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(spareData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log("API Error Response:", errorData);
        throw new Error(errorData.message || "Error updating spare");
      }

      const responseData = await response.json();
      console.log("API Success Response:", responseData);

      // Wait a moment for database to fully commit the changes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trigger immediate refresh for AllSpares table with fresh data
      console.log(
        "EditSpare: Triggering immediate refresh for AllSpares with fresh data..."
      );

      // Force a fresh API call to get the latest data
      const freshResponse = await fetch(
        `${API_BASE}/spares/${id}`
      );
      if (freshResponse.ok) {
        const freshData = await freshResponse.json();
        console.log("EditSpare: Fetched fresh data after update:", freshData);
      }

      // Trigger multiple refresh events to ensure AllSpares and AllModels update
      console.log("EditSpare: About to dispatch events to AllSpares table");
      console.log("EditSpare: spareDataUpdated event dispatching...");
      window.dispatchEvent(new Event("spareDataUpdated"));

      console.log("EditSpare: Events dispatched successfully");

      // Mark form as submitted to prevent state reset
      setFormSubmitted(true);

      // After updating a spare, go back to All Spares
      navigate("/spares/all");
    } catch (err) {
      console.error("Error updating spare:", err);
      setError(err.message || "Error updating spare. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [showEntriesConfirm, setShowEntriesConfirm] = useState(false);
  const [entriesConfirmMessage, setEntriesConfirmMessage] = useState("");

  const handleConfirmClearEntries = async () => {
    try {
      const modelsToSave =
        formData.models.length > 0 ? formData.models : ["Universal"];
      const body = {
        name: formData.name,
        sellingPrice: parseFloat(formData.sellingPrice),
        supplierName: formData.supplierName,
        minStockLevel: enableColorTracking
          ? 0
          : parseInt(formData.minStockLevel) || 0,
        models: modelsToSave,
        hasColors: !!enableColorTracking,
        stockEntries: [],
        colorQuantity: [],
      };
      const response = await fetch(`${API_BASE}/spares/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error updating spare");
      }
      setShowEntriesConfirm(false);
      navigate("/spares/all");
    } catch (err) {
      setError(err.message || "Error updating spare. Please try again.");
      setShowEntriesConfirm(false);
    }
  };

  const handleCancelClearEntries = () => {
    setShowEntriesConfirm(false);
  };

  // Hide form if no valid spare data is loaded
  if (!formData.name && !formData.quantity && !formData.sellingPrice) {
    return (
      <div className="spare-container">
        <h2>Edit a Spare</h2>
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
            No Spare Data Found
          </h3>
          <p
            style={{
              margin: "0 0 1.5rem 0",
              color: "#92400e",
              fontSize: "0.875rem",
            }}
          >
            No valid spare data was found. Please navigate to a spare from the
            list to edit.
          </p>
          <button
            type="button"
            onClick={() => navigate("/spares/all")}
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
            Back to All Spares
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="spare-container">
      <h2>Edit Spares Here</h2>
      <form onSubmit={handleSubmit} className="spare-form">
        <div className="form-group">
          <label htmlFor="name">Spare Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter spare name"
            required
          />
        </div>

        {/* Quantity field removed to match Add Spare simplification */}

        {!enableColorTracking && (
          <div className="form-group">
            <label htmlFor="minStockLevel">Minimum Stock Level</label>
            <input
              type="number"
              id="minStockLevel"
              name="minStockLevel"
              value={formData.minStockLevel}
              onChange={handleInputChange}
              placeholder="Enter minimum stock level"
              min="0"
              style={{ backgroundColor: "#ffffff", cursor: "text" }}
            />
            <small style={{ color: "#6b7280", fontSize: "0.875rem" }}>
              Alert when stock falls below this level
            </small>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="sellingPrice">Selling Price</label>
          <input
            type="number"
            id="sellingPrice"
            name="sellingPrice"
            value={formData.sellingPrice}
            onChange={handleInputChange}
            placeholder="Enter selling price"
            required
            step="0.01"
          />
        </div>

        {/* Supplier Information */}
        <div className="form-section">
          <h3>Supplier Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Supplier Name</label>
              <input
                type="text"
                name="supplierName"
                value={formData.supplierName}
                onChange={handleInputChange}
                placeholder="Enter supplier name"
              />
            </div>
          </div>
        </div>

        {/* Color with Quantity Section */}
        <div className="form-section">
          <h3>Color Tracking</h3>
          <div className="form-row">
            <div className="form-group">
              <label
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <input
                  type="checkbox"
                  name="hasColors"
                  checked={enableColorTracking}
                  onChange={handleColorTrackingChange}
                  style={{ width: "auto" }}
                />
                This spare has color options
              </label>
              <small style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                Enable if you want to track stock by color
              </small>
            </div>
          </div>
        </div>

        {/* Models Section */}
        <div className="form-section">
          <h3>Compatible Models</h3>

          {/* Current Models */}
          <div className="form-group">
            <label>Currently Linked Models</label>
            <div style={{ marginBottom: "1rem" }}>
              {formData.models.length > 0 ? (
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
                >
                  {formData.models.map((model, index) => (
                    <span
                      key={index}
                      style={{
                        backgroundColor: "#3b82f6",
                        color: getTextColorForBackground("#3b82f6"),
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.875rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      {model}
                      <button
                        type="button"
                        onClick={() => removeModel(model)}
                        style={{
                          backgroundColor: "#3b82f6",
                          color: getTextColorForBackground("#3b82f6"),
                          border: "none",
                          borderRadius: "0.25rem",
                          cursor: "pointer",
                          padding: "0.125rem 0.375rem",
                          fontSize: "0.875rem",
                          fontWeight: "bold",
                          minWidth: "1.5rem",
                          height: "1.5rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = "#2563eb";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = "#3b82f6";
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#6b7280", fontStyle: "italic" }}>
                  No models linked
                </p>
              )}
            </div>
          </div>

          {/* Add Custom Model */}
          <div className="form-group">
            <label>Add Custom Model</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="Enter model name"
                onKeyPress={(e) => e.key === "Enter" && addModel()}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                }}
              />
              <button
                type="button"
                onClick={addModel}
                disabled={!newModel.trim()}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: newModel.trim() ? "#3b82f6" : "#9ca3af",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: newModel.trim() ? "pointer" : "not-allowed",
                }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Available Models from Database */}
          {allModels.length > 0 && (
            <div className="form-group">
              <label>Available Models from Database</label>
              <div
                style={{
                  maxHeight: "200px",
                  overflowY: "auto",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  padding: "0.5rem",
                }}
              >
                {Array.isArray(allModels) &&
                  allModels.map((model) => (
                    <div
                      key={model._id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "0.25rem",
                        cursor: "pointer",
                        borderRadius: "0.25rem",
                        backgroundColor: formData.models.includes(
                          model.modelName
                        )
                          ? "#dbeafe"
                          : "transparent",
                      }}
                      onClick={() => toggleModel(model.modelName)}
                    >
                      <input
                        type="checkbox"
                        checked={formData.models.includes(model.modelName)}
                        onChange={() => toggleModel(model.modelName)}
                        style={{ marginRight: "0.5rem" }}
                      />
                      <span>
                        {model.modelName} ({model.company})
                      </span>
                    </div>
                  ))}
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
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              fontSize: "0.95rem",
              fontWeight: "500",
            }}
          >
            {isSubmitting ? "Updating..." : "Update Spare"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/spares/all")}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "white",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.95rem",
              fontWeight: "500",
            }}
          >
            Cancel
          </button>
        </div>
      </form>

      {showEntriesConfirm && (
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
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "2rem",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
              maxWidth: "420px",
              width: "90%",
            }}
          >
            <h3
              style={{
                margin: "0 0 1rem 0",
                color: "#1f2937",
                fontSize: "1.25rem",
                fontWeight: "600",
              }}
            >
              Confirmation
            </h3>
            <p
              style={{
                margin: "0 0 1.5rem 0",
                color: "#6b7280",
                fontSize: "0.875rem",
                lineHeight: "1.5",
              }}
            >
              {entriesConfirmMessage}
            </p>
            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={handleCancelClearEntries}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearEntries}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                }}
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
