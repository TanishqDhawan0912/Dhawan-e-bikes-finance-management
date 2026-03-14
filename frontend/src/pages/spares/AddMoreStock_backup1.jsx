import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

const style = {
  padding: "2rem",
  backgroundColor: "#f9fafb",
  minHeight: "100vh",
};

function AddMoreStock() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [spare, setSpare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newStockEntry, setNewStockEntry] = useState({
    quantity: "",
    purchasePrice: "",
    date: "",
  });
  const [stockField, setStockField] = useState("stockEntries");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parseDate = (dateString) => {
    if (!dateString) return "";
    const [day, month, year] = dateString.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };

  const fetchSpareDetails = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/spares/${id}`);
      const data = await response.json();

      console.log("API Response:", data);
      console.log("All fields:", Object.keys(data));

      // Check all possible field names for stock entries
      const stockField = Object.keys(data).find(
        (key) =>
          Array.isArray(data[key]) &&
          data[key].length > 0 &&
          data[key][0].quantity
      );

      console.log("Found stock field:", stockField);
      if (stockField) {
        console.log("Stock data:", data[stockField]);
        setStockField(stockField);
      }

      if (!response.ok) {
        throw new Error(data.message || "Error fetching spare details");
      }

      setSpare(data);
    } catch (err) {
      setError(err.message || "Error loading spare details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSpareDetails();
  }, [fetchSpareDetails]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewStockEntry((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !newStockEntry.quantity ||
      !newStockEntry.purchasePrice ||
      !newStockEntry.date
    ) {
      setError("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `http://localhost:5000/api/spares/${id}/add-stock`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newStockEntry),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error adding stock");
      }

      await fetchSpareDetails();

      setNewStockEntry({
        quantity: "",
        purchasePrice: "",
        date: "",
      });

      alert("Stock added successfully!");
    } catch (err) {
      setError(err.message || "Error adding stock. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <div>Loading spare details...</div>
      </div>
    );
  }

  if (error && !spare) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
        <button
          onClick={() => navigate("/spares")}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          Back to Spares
        </button>
      </div>
    );
  }

  return (
    <div style={style}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          padding: "1rem",
          backgroundColor: "white",
          borderRadius: "0.5rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h1 style={{ margin: 0, color: "#1f2937" }}>Add More Stock</h1>
        <button
          onClick={() => navigate("/spares")}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Back to Spares
        </button>
      </div>

      <div
        style={{
          backgroundColor: "white",
          padding: "2rem",
          borderRadius: "0.5rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ marginBottom: "1rem", color: "#1f2937" }}>
            Spare Details
          </h3>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#374151",
                }}
              >
                Spare Name
              </label>
              <input
                type="text"
                value={spare?.name || ""}
                readOnly
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  backgroundColor: "#f9fafb",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#374151",
                }}
              >
                Models
              </label>
              <input
                type="text"
                value={spare?.models?.join(", ") || "N/A"}
                readOnly
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  backgroundColor: "#f9fafb",
                }}
              />
            </div>
          </div>
        </div>

        {/* Stock Entries Section */}
        <div
          style={{
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ marginBottom: "1rem", color: "#1f2937" }}>
            Current Stock Entries
          </h3>
          {/* Quick debug to see the data */}
          <div
            style={{
              marginBottom: "1rem",
              fontSize: "0.75rem",
              color: "#6b7280",
            }}
          >
            Stock entries length: {spare?.stockEntries?.length || 0}
            <div>Available fields: {Object.keys(spare || {}).join(", ")}</div>
            {spare?.stockEntries?.length > 0 && (
              <div>First entry: {JSON.stringify(spare.stockEntries[0])}</div>
            )}
            {/* Check all fields for stock data */}
            {Object.keys(spare || {}).map((key) => {
              if (Array.isArray(spare[key]) && spare[key].length > 0) {
                return (
                  <div key={key}>
                    {key} array: {JSON.stringify(spare[key])}
                  </div>
          </div>
