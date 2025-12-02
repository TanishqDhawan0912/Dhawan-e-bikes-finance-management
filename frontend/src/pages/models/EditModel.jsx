import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getTodayFormatted } from "../../utils/dateUtils";

export default function EditModel() {
  const navigate = useNavigate();
  const { id } = useParams(); // Get model ID from URL
  const [searchParams] = useSearchParams();
  const isAdminEdit = searchParams.get("admin") === "true";

  // Form state
  const [formData, setFormData] = useState({
    modelName: "",
    company: "",
    colour: "",
    quantity: "",
    purchasedInWarranty: false,
    purchaseDate: getTodayFormatted(), // Default to today's date in dd/mm/yyyy format
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPurchasePrice, setHasPurchasePrice] = useState(false);

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

  // Fetch model data on component mount
  useEffect(() => {
    const fetchModel = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5000/api/models/${id}`);

        if (!response.ok) {
          throw new Error("Model not found");
        }

        const model = await response.json();

        // Pre-fill form with model data
        const modelColour = model.data.colour;
        const isPredefinedColor = colorOptions.some(
          (c) => c.value === modelColour
        );

        setFormData({
          modelName: model.data.modelName,
          company: model.data.company,
          colour: isPredefinedColor ? modelColour : "other",
          customColour: isPredefinedColor ? "" : modelColour,
          quantity: model.data.quantity.toString(),
          purchasedInWarranty: model.data.purchasedInWarranty || false,
          purchaseDate: model.data.purchaseDate
            ? getTodayFormatted()
            : getTodayFormatted(),
        });

        // Check if model has purchase price
        setHasPurchasePrice(
          model.data.purchasePrice && model.data.purchasePrice > 0
        );

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
  }, [id, colorOptions]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Check for duplicate model with same details (excluding current model)
  const checkDuplicateEdit = async () => {
    try {
      const colour =
        formData.colour === "other" ? formData.customColour : formData.colour;

      console.log("=== DUPLICATE CHECK EDIT START ===");
      console.log("Checking duplicate for edit:", {
        modelName: formData.modelName,
        company: formData.company,
        colour: colour,
        purchaseDate: formData.purchaseDate,
        excludeId: id,
      });
      console.log("Original formData.colour:", formData.colour);
      console.log("formData.customColour:", formData.customColour);
      console.log("Final colour being checked:", colour);

      // First test if backend is accessible
      try {
        const testResponse = await fetch("http://localhost:5000/api/models");
        console.log("Backend connectivity test - status:", testResponse.status);
        if (testResponse.status !== 200) {
          throw new Error("Backend not responding correctly");
        }
      } catch (testErr) {
        console.error("Backend connectivity failed:", testErr);
        return { exists: false }; // Allow edit if check fails
      }

      const checkUrl = `http://localhost:5000/api/models/check-duplicate-edit?modelName=${encodeURIComponent(
        formData.modelName
      )}&company=${encodeURIComponent(
        formData.company
      )}&colour=${encodeURIComponent(colour)}&purchaseDate=${encodeURIComponent(
        formData.purchaseDate
      )}&purchasedInWarranty=${encodeURIComponent(
        formData.purchasedInWarranty
      )}&excludeId=${encodeURIComponent(id)}`;

      console.log("Making duplicate check request to:", checkUrl);
      console.log("- modelName:", formData.modelName);
      console.log("- company:", formData.company);
      console.log("- colour:", colour);
      console.log("- purchaseDate:", formData.purchaseDate);
      console.log("- purchasedInWarranty:", formData.purchasedInWarranty);
      console.log("- excludeId:", id);

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
        return { exists: false }; // Allow edit if check fails
      }

      if (data.exists) {
        console.log("=== DUPLICATE FOUND - BLOCKING EDIT ===");
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

      console.log("=== NO DUPLICATE FOUND - ALLOWING EDIT ===");
      return { exists: false };
    } catch (err) {
      console.error("=== DUPLICATE CHECK ERROR ===", err);
      setError(
        "Network error while checking duplicates. Please check your connection."
      );
      return { exists: false }; // Allow edit if check fails
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!formData.modelName || !formData.company || !formData.quantity) {
      setError("Model name, company, and quantity are required");
      return;
    }

    // Validate color selection
    if (!formData.colour) {
      setError("Please select a colour");
      return;
    }

    if (formData.colour === "other" && !formData.customColour) {
      setError("Please enter a custom colour name");
      return;
    }

    // Check for duplicate model with same details (excluding current model)
    const duplicateCheck = await checkDuplicateEdit();
    if (duplicateCheck.exists) {
      setError(duplicateCheck.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`http://localhost:5000/api/models/${id}`, {
        method: "PUT",
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

  const handleAddPrice = () => {
    // Check if admin is already logged in
    const isAdminAuth = sessionStorage.getItem("adminAuth");
    if (isAdminAuth) {
      // Admin is already logged in, go directly to models section
      navigate("/admin?section=models");
    } else {
      // Admin is logged out, go to login page with redirect to models section
      navigate("/admin-login?redirect=/admin?section=models");
    }
  };

  if (loading) {
    return (
      <div className="model-container">
        <h2>Edit Model</h2>
        <div className="loading-state">
          <p>Loading model data...</p>
        </div>
      </div>
    );
  }

  if (error && !formData.modelName) {
    return (
      <div className="model-container">
        <h2>Edit Model</h2>
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
      <h2>Edit Model</h2>

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

          {!isAdminEdit && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Colour</label>
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
                            ? colorOptions.find(
                                (c) => c.value === formData.colour
                              )?.label
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
            </>
          )}

          {!isAdminEdit && (
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
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Purchase Date</label>
              <div
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  border: "2px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  color: "#374151",
                  backgroundColor: "#f9fafb",
                  display: "flex",
                  alignItems: "center",
                  minHeight: "42px",
                  cursor: "not-allowed",
                }}
              >
                {formData.purchaseDate || "No date set"}
              </div>
              <small
                style={{
                  display: "block",
                  marginTop: "0.25rem",
                  color: "#666",
                  fontSize: "0.8rem",
                }}
              >
                Purchase date cannot be changed during editing
              </small>
            </div>
          </div>

          <div className="form-row">
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
                  disabled={isSubmitting}
                  style={{
                    width: "16px",
                    height: "16px",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                />
                <label
                  htmlFor="purchasedInWarranty"
                  style={{
                    margin: 0,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    fontSize: "0.9rem",
                    color: "#333",
                  }}
                >
                  Purchased in Warranty
                </label>
              </div>
              <small
                style={{
                  display: "block",
                  marginTop: "0.25rem",
                  color: "#666",
                  fontSize: "0.8rem",
                }}
              >
                Check if this model was purchased under warranty
              </small>
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

          {!hasPurchasePrice && (
            <button
              type="button"
              className="btn btn-success"
              onClick={handleAddPrice}
              disabled={isSubmitting}
              style={{
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "4px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontSize: "0.9rem",
                fontWeight: "500",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.target.style.backgroundColor = "#059669";
                  e.target.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.target.style.backgroundColor = "#10b981";
                  e.target.style.transform = "translateY(0)";
                }
              }}
              title="Add purchase price for this model"
            >
              💰 Add Price
            </button>
          )}

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
