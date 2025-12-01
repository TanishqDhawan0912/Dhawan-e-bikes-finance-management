import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AddSpare() {
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    category: "engine",
    quantity: "",
    costPrice: "",
    sellingPrice: "",
    minStockLevel: "5",
    supplier: {
      name: "",
      contact: "",
      email: "",
    },
    location: {
      aisle: "",
      shelf: "",
      bin: "",
    },
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Handle nested object properties
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (
      !formData.name ||
      !formData.quantity ||
      !formData.costPrice ||
      !formData.sellingPrice
    ) {
      setError("Name, quantity, and prices are required");
      return;
    }

    setIsSubmitting(true);

    try {
      // Here you would normally make an API call to save the spare
      console.log("Saving spare:", formData);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Navigate to all spares after successful save
      navigate("/spares/all");
    } catch {
      setError("Error saving spare. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="spare-container">
      <h2>Add New Spare</h2>

      <div className="spare-form">
        {/* Basic Information */}
        <div className="form-section">
          <h3>Basic Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Spare Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter spare part name"
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
              >
                <option value="engine">Engine</option>
                <option value="electrical">Electrical</option>
                <option value="suspension">Suspension</option>
                <option value="brakes">Brakes</option>
                <option value="interior">Interior</option>
                <option value="exterior">Exterior</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group full-width">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter spare part description..."
                rows="3"
                className="details-textarea"
              />
            </div>
          </div>
        </div>

        {/* Stock Information */}
        <div className="form-section">
          <h3>Stock Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="Enter quantity"
                min="0"
                required
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
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Cost Price *</label>
              <input
                type="number"
                name="costPrice"
                value={formData.costPrice}
                onChange={handleInputChange}
                placeholder="Enter cost price"
                min="0"
                step="0.01"
                required
              />
            </div>

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
              />
            </div>
          </div>
        </div>

        {/* Supplier Information */}
        <div className="form-section">
          <h3>Supplier Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Supplier Name</label>
              <input
                type="text"
                name="supplier.name"
                value={formData.supplier.name}
                onChange={handleInputChange}
                placeholder="Enter supplier name"
              />
            </div>

            <div className="form-group">
              <label>Contact Number</label>
              <input
                type="tel"
                name="supplier.contact"
                value={formData.supplier.contact}
                onChange={handleInputChange}
                placeholder="Enter contact number"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="supplier.email"
                value={formData.supplier.email}
                onChange={handleInputChange}
                placeholder="Enter email address"
              />
            </div>
          </div>
        </div>

        {/* Location Information */}
        <div className="form-section">
          <h3>Storage Location</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Aisle</label>
              <input
                type="text"
                name="location.aisle"
                value={formData.location.aisle}
                onChange={handleInputChange}
                placeholder="Enter aisle"
              />
            </div>

            <div className="form-group">
              <label>Shelf</label>
              <input
                type="text"
                name="location.shelf"
                value={formData.location.shelf}
                onChange={handleInputChange}
                placeholder="Enter shelf"
              />
            </div>

            <div className="form-group">
              <label>Bin</label>
              <input
                type="text"
                name="location.bin"
                value={formData.location.bin}
                onChange={handleInputChange}
                placeholder="Enter bin"
              />
            </div>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="form-section">
          <h3>Additional Notes</h3>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Enter any additional notes..."
                rows="4"
                className="details-textarea"
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
      </div>
    </div>
  );
}
