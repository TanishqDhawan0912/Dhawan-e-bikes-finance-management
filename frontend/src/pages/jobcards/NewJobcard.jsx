import { useState } from "react";
import SparePartsSearch from "../../components/SparePartsSearch";

export default function NewJobcard() {
  // Form state
  const [formData, setFormData] = useState({
    customerName: "",
    place: "",
    mobile: "",
    warrantyType: "none",
    warrantyDate: "",
    details: "",
  });

  const [selectedParts, setSelectedParts] = useState([]);
  const [showPartsList, setShowPartsList] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePartSelect = (part) => {
    setSelectedParts((prev) => [...prev, { ...part, quantity: 1 }]);
    setShowSearch(false);
  };

  const removePart = (partId) => {
    setSelectedParts((prev) => prev.filter((part) => part.id !== partId));
  };

  const togglePartsList = () => {
    setShowPartsList(!showPartsList);
  };

  const toggleSearch = () => {
    setShowSearch(!showSearch);
  };

  const calculateTotal = () => {
    return selectedParts
      .reduce((sum, part) => sum + part.price * part.quantity, 0)
      .toFixed(2);
  };

  return (
    <div className="jobcard-container">
      <h2>New Jobcard</h2>

      <div className="jobcard-form">
        {/* Customer Information */}
        <div className="form-section">
          <h3>Customer Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Customer Name</label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                placeholder="Enter customer name"
              />
            </div>

            <div className="form-group">
              <label>Place</label>
              <input
                type="text"
                name="place"
                value={formData.place}
                onChange={handleInputChange}
                placeholder="Enter place"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Mobile Number</label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleInputChange}
                placeholder="Enter mobile number"
              />
            </div>
          </div>
        </div>

        {/* Jobcard Details */}
        <div className="form-section">
          <h3>Jobcard Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="text" value={today} readOnly className="readonly" />
            </div>

            <div className="form-group">
              <label>Warranty Type</label>
              <select
                name="warrantyType"
                value={formData.warrantyType}
                onChange={handleInputChange}
              >
                <option value="none">No Warranty</option>
                <option value="full">Full Warranty</option>
                <option value="battery">Battery Only</option>
                <option value="charger">Charger Only</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Warranty Date/Code</label>
              <input
                type="text"
                name="warrantyDate"
                value={formData.warrantyDate}
                onChange={handleInputChange}
                placeholder="Select warranty date"
              />
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="form-section">
          <h3>Details</h3>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Additional Details</label>
              <textarea
                name="details"
                value={formData.details}
                onChange={handleInputChange}
                placeholder="Enter any additional details, notes, or descriptions..."
                rows="6"
                className="details-textarea"
              />
            </div>
          </div>
        </div>

        {/* Spare Parts Section */}
        <div className="form-section">
          <div className="section-header" onClick={togglePartsList}>
            <h3>Spare Parts</h3>
            <span className="toggle-icon">{showPartsList ? "−" : "+"}</span>
          </div>

          {showPartsList && (
            <div className="parts-section">
              <button
                type="button"
                className="add-part-btn"
                onClick={toggleSearch}
              >
                {showSearch ? "Cancel" : "+ Add Spare Part"}
              </button>

              {showSearch && (
                <div className="search-container">
                  <SparePartsSearch onSelectPart={handlePartSelect} />
                </div>
              )}

              {selectedParts.length > 0 && (
                <div className="selected-parts">
                  <h4>Selected Parts</h4>
                  <div className="parts-list">
                    {selectedParts.map((part) => (
                      <div key={part.id} className="part-item">
                        <div className="part-info">
                          <span className="part-name">{part.name}</span>
                          <span className="part-price">
                            ₹{part.price.toFixed(2)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePart(part.id)}
                          className="remove-btn"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="total-amount">
                    <strong>Total: </strong>₹{calculateTotal()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-primary">
            Save Jobcard
          </button>
          <button type="button" className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
