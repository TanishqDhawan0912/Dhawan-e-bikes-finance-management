import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function EditColor() {
  const navigate = useNavigate();
  const { id } = useParams(); // Get model ID from URL (reference model)

  // Form state - only color and quantity are editable, rest comes from reference model
  const [formData, setFormData] = useState({
    modelName: "",
    company: "",
    colour: "",
    quantity: "",
    purchasedInWarranty: false,
    purchaseDate: "",
  });

  const [referenceModel, setReferenceModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Predefined color options with hex values
  const colorOptions = useMemo(
    () => [
      { value: "black", label: "Black", hex: "#000000" },
      { value: "blue", label: "Blue", hex: "#0000FF" },
      { value: "white", label: "White", hex: "#FFFFFF" },
      {
        value: "white-black",
        label: "White-Black",
        hex: "linear-gradient(45deg, #FFFFFF 50%, #000000 50%)",
      },
      { value: "peacock", label: "Peacock", hex: "#006994" },
      { value: "green", label: "Green", hex: "#006400" },
      { value: "cherry", label: "Cherry", hex: "#8B0000" },
      { value: "red", label: "Red", hex: "#FF0000" },
      { value: "grey", label: "Grey", hex: "#808080" },
      { value: "silver", label: "Silver", hex: "#C0C0C0" },
      { value: "yellow", label: "Yellow", hex: "#FFFF00" },
    ],
    []
  );

  // Fetch reference model data on component mount
  useEffect(() => {
    const fetchModel = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5000/api/models/${id}`);

        if (!response.ok) {
          throw new Error("Model not found");
        }

        const model = await response.json();

        // Store reference model data and pre-fill form
        setReferenceModel(model.data);

        // Pre-fill form with reference model data, but leave color and quantity empty
        setFormData({
          modelName: model.data.modelName,
          company: model.data.company,
          colour: "",
          quantity: "",
          purchasedInWarranty: model.data.purchasedInWarranty || false,
          purchaseDate: model.data.purchaseDate
            ? new Date(model.data.purchaseDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        });

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

  // Check for duplicate model with same color variant
  const checkDuplicateColorVariant = async () => {
    try {
      const colour =
        formData.colour === "other" ? formData.customColour : formData.colour;

      console.log("=== DUPLICATE CHECK COLOR VARIANT START ===");
      console.log("Checking duplicate for new color variant:", {
        modelName: formData.modelName,
        company: formData.company,
        colour: colour,
        purchaseDate: formData.purchaseDate,
        purchasedInWarranty: formData.purchasedInWarranty,
      });

      // First test if backend is accessible
      try {
        const testResponse = await fetch("http://localhost:5000/api/models");
        console.log("Backend connectivity test - status:", testResponse.status);
        if (testResponse.status !== 200) {
          throw new Error("Backend not responding correctly");
        }
      } catch (testErr) {
        console.error("Backend connectivity failed:", testErr);
        return { exists: false }; // Allow creation if check fails
      }

      const checkUrl = `http://localhost:5000/api/models/check-duplicate?modelName=${encodeURIComponent(
        formData.modelName || ""
      )}&company=${encodeURIComponent(
        formData.company || ""
      )}&colour=${encodeURIComponent(colour)}&purchaseDate=${encodeURIComponent(
        formData.purchaseDate || ""
      )}&purchasedInWarranty=${encodeURIComponent(
        formData.purchasedInWarranty || false
      )}`;

      console.log("Making duplicate check request to:", checkUrl);

      const response = await fetch(checkUrl);

      console.log("Duplicate check response status:", response.status);

      const data = await response.json();
      console.log("=== FULL API RESPONSE ===");
      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      console.log("Response data:", data);
      console.log("data.exists:", data.exists);
      console.log("=== END API RESPONSE ===");

      if (!response.ok) {
        console.error("Duplicate check failed:", data);
        return { exists: false }; // Allow creation if check fails
      }

      if (data.exists) {
        console.log("=== DUPLICATE FOUND - BLOCKING CREATION ===");
        console.log("Backend found duplicate");
        return {
          exists: true,
          message: `A model with the same details (Model: ${
            formData.modelName
          }, Company: ${
            formData.company
          }, Colour: ${colour}, Purchase Date: ${new Date(
            formData.purchaseDate
          ).toLocaleDateString()}) already exists. Each combination of name, company, colour, and purchase date should be unique.`,
        };
      }

      console.log("=== NO DUPLICATE FOUND - ALLOWING CREATION ===");
      return { exists: false };
    } catch (err) {
      console.error("=== DUPLICATE CHECK ERROR ===", err);
      setError(
        "Network error while checking duplicates. Please check your connection."
      );
      return { exists: false }; // Allow creation if check fails
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate color selection
    if (!formData.colour) {
      setError("Please select a colour");
      return;
    }

    if (formData.colour === "other" && !formData.customColour) {
      setError("Please enter a custom colour name");
      return;
    }

    // Validate quantity
    if (!formData.quantity || parseInt(formData.quantity) < 0) {
      setError("Please enter a valid quantity (0 or greater)");
      return;
    }

    // Check for duplicate model with same color variant
    const duplicateCheck = await checkDuplicateColorVariant();
    if (duplicateCheck.exists) {
      setError(duplicateCheck.message);
      return;
    }

    setIsSubmitting(true);

    try {
      // Create new model entry with same details but different color
      const response = await fetch("http://localhost:5000/api/models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelName: formData.modelName,
          company: formData.company,
          colour:
            formData.colour === "other"
              ? formData.customColour
              : formData.colour,
          quantity: parseInt(formData.quantity),
          purchasedInWarranty: formData.purchasedInWarranty,
          purchaseDate: formData.purchaseDate
            ? new Date(formData.purchaseDate)
            : new Date(),
          purchasePrice: referenceModel?.purchasePrice || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error creating color variant");
      }

      console.log("New color variant created successfully:", data);

      // Navigate back to admin models section
      navigate("/admin?section=models");
    } catch (err) {
      console.error("Error creating color variant:", err);
      setError(
        err.message || "Error creating color variant. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="model-container">
        <h2>Add Color Variant</h2>
        <div className="loading-state">
          <p>Loading model data...</p>
        </div>
      </div>
    );
  }

  if (error && !formData.modelName) {
    return (
      <div className="model-container">
        <h2>Add Color Variant</h2>
        <div
          className="error-state"
          style={{ color: "#dc2626", marginBottom: "1rem" }}
        >
          <p>{error}</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/admin?section=models")}
          >
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="model-container">
      <h2>Add Color Variant</h2>

      {/* Model Info Display */}
      <div className="form-section">
        <h3>Model Information (Read-only)</h3>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#f0f9ff",
            border: "1px solid #0ea5e9",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <strong>Model:</strong> {referenceModel?.modelName} (
          {referenceModel?.company})
          <br />
          <strong>Current Color:</strong> {referenceModel?.colour}
          <br />
          <strong>Current Quantity:</strong> {referenceModel?.quantity}
          <br />
          <strong>Purchase Date:</strong>{" "}
          {referenceModel?.purchaseDate
            ? new Date(referenceModel.purchaseDate).toLocaleDateString()
            : "N/A"}
          <br />
          <strong>Warranty Status:</strong>{" "}
          {referenceModel?.purchasedInWarranty
            ? "In Warranty"
            : "Out of Warranty"}
        </div>
      </div>

      {/* Edit Form - Color and Quantity Editable */}
      <div className="model-form">
        <div className="form-section">
          <h3>New Color Variant Details</h3>

          {/* Read-only fields */}
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
                disabled={true}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  backgroundColor: "#f5f5f5",
                  cursor: "not-allowed",
                }}
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
                disabled={true}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  backgroundColor: "#f5f5f5",
                  cursor: "not-allowed",
                }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Purchase Date</label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleInputChange}
                disabled={true}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  backgroundColor: "#f5f5f5",
                  cursor: "not-allowed",
                }}
              />
            </div>

            <div className="form-group">
              <label>Purchase Information</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  backgroundColor: "#f9f9f9",
                }}
              >
                <input
                  type="checkbox"
                  name="purchasedInWarranty"
                  checked={formData.purchasedInWarranty}
                  onChange={handleInputChange}
                  disabled={true}
                  style={{
                    width: "16px",
                    height: "16px",
                    cursor: "not-allowed",
                  }}
                />
                <label
                  htmlFor="purchasedInWarranty"
                  style={{
                    margin: 0,
                    cursor: "not-allowed",
                    fontSize: "0.9rem",
                    color: "#333",
                  }}
                >
                  Purchased in Warranty
                </label>
              </div>
            </div>
          </div>

          {/* Editable fields */}
          <div className="form-row">
            <div className="form-group">
              <label>Colour *</label>
              <select
                name="colour"
                value={formData.colour}
                onChange={handleInputChange}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              >
                <option value="">Select a colour</option>
                {colorOptions.map((color) => (
                  <option key={color.value} value={color.value}>
                    {color.label}
                  </option>
                ))}
                <option value="other">Other (specify)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Colour Preview</label>
              <div
                style={{
                  width: "100%",
                  height: "40px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* White-Black split background */}
                {formData.colour === "white-black" ? (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: "50%",
                        height: "100%",
                        backgroundColor: "#FFFFFF",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        width: "50%",
                        height: "100%",
                        backgroundColor: "#000000",
                      }}
                    />
                    <span
                      style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        height: "100%",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: "25%",
                          color: "#000",
                          fontWeight: "bold",
                          fontSize: "14px",
                        }}
                      >
                        W
                      </span>
                      <span
                        style={{
                          position: "absolute",
                          right: "25%",
                          color: "#fff",
                          fontWeight: "bold",
                          fontSize: "14px",
                        }}
                      >
                        B
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: "100%",
                        height: "100%",
                        backgroundColor:
                          formData.colour === "other" || !formData.colour
                            ? "#f5f5f5"
                            : colorOptions.find(
                                (c) => c.value === formData.colour
                              )?.hex || "#f5f5f5",
                      }}
                    />
                    <span
                      style={{
                        position: "relative",
                        zIndex: 1,
                        color:
                          formData.colour === "white" ||
                          formData.colour === "yellow"
                            ? "#000"
                            : "#fff",
                      }}
                    >
                      {formData.colour && formData.colour !== "other"
                        ? colorOptions.find((c) => c.value === formData.colour)
                            ?.label
                        : formData.colour === "other"
                        ? formData.customColour || "Custom"
                        : "No colour"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {formData.colour === "other" && (
            <div className="form-row">
              <div className="form-group">
                <label>Custom Colour *</label>
                <input
                  type="text"
                  name="customColour"
                  value={formData.customColour || ""}
                  onChange={handleInputChange}
                  placeholder="Enter custom colour name"
                  required={formData.colour === "other"}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Quantity (Numbers) *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="Enter quantity"
                min="0"
                required
                disabled={isSubmitting}
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
            {isSubmitting ? "Creating..." : "Add Color Variant"}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/admin?section=models")}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
