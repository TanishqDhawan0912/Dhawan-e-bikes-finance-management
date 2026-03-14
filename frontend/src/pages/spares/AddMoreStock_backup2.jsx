        )}
      </div>

      {/* Add Stock Form */}
      <div
        style={{
          backgroundColor: "white",
          padding: "2rem",
          borderRadius: "0.5rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h3 style={{ marginBottom: "1rem", color: "#1f2937" }}>
          Add New Stock Entry
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
            <input
              type="number"
              name="quantity"
              value={newStockEntry.quantity}
              onChange={handleInputChange}
              placeholder="Quantity"
              style={{
                flex: 1,
                padding: "0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
              }}
            />
            <input
              type="number"
              name="purchasePrice"
              value={newStockEntry.purchasePrice}
              onChange={handleInputChange}
              placeholder="Purchase Price"
              style={{
                flex: 1,
                padding: "0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
              }}
            />
            <div style={{ flex: 1, display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                name="date"
                value={newStockEntry.date}
                onChange={handleInputChange}
                placeholder="dd/mm/yyyy"
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                }}
              />
                    padding: "1rem",
                    backgroundColor: "#f9fafb",
                    borderRadius: "0.5rem",
                    border: "1px solid #e5e7eb",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.25rem",
                        color: "#374151",
                        fontSize: "0.875rem",
                      }}
                    >
                      Quantity
                    </label>
                    <div
                      style={{
                        padding: "0.5rem",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        color: "#374151",
                      }}
                    >
                      {entry.quantity} pieces
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.25rem",
                        color: "#374151",
                        fontSize: "0.875rem",
                      }}
                    >
                      Purchase Price
                    </label>
                    <div
                      style={{
                        padding: "0.5rem",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        color: "#374151",
                      }}
                    >
                      ?{entry.purchasePrice}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.25rem",
                        color: "#374151",
                        fontSize: "0.875rem",
                      }}
                    >
                      Purchase Date
                    </label>
                    <div
                      style={{
                        padding: "0.5rem",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        color: "#374151",
                      }}
                    >
                      {entry.date}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  console.log("Add more stock clicked");
                }}
                style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  marginTop: "0.5rem",
                }}
              >
                + Add New Stock Entry
              </button>
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "2rem",
                color: "#6b7280",
                fontSize: "0.875rem",
                backgroundColor: "#f9fafb",
                borderRadius: "0.5rem",
                border: "1px solid #e5e7eb",
              }}
            >
              No stock entries found
            </div>
          )}
        </div>

        {/* Add Stock Form */}
        <div
          style={{
            backgroundColor: "white",
            padding: "2rem",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
        >
          <h3 style={{ marginBottom: "1rem", color: "#1f2937" }}>
            Add New Stock Entry
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
              <input
                type="number"
                name="quantity"
                value={newStockEntry.quantity}
                onChange={handleInputChange}
                placeholder="Quantity"
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                }}
              />
              <input
                type="number"
                name="purchasePrice"
                value={newStockEntry.purchasePrice}
                onChange={handleInputChange}
                placeholder="Purchase Price"
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                }}
              />
              <div style={{ flex: 1, display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  name="date"
                  value={newStockEntry.date}
                  onChange={handleInputChange}
                  placeholder="dd/mm/yyyy"
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const formattedDate = `${today
                      .getDate()
                      .toString()
                      .padStart(2, "0")}/${(today.getMonth() + 1)
                      .toString()
                      .padStart(2, "0")}/${today.getFullYear()}`;
                    // Use parseDate to convert dd/mm/yyyy to yyyy-mm-dd format
                    const parsedDate = parseDate(formattedDate);
                    console.log("Parsed date for internal use:", parsedDate);
                    setNewStockEntry((prev) => ({
                      ...prev,
                      date: formattedDate,
                    }));
                  }}
                  style={{
                    padding: "0.5rem",
                    backgroundColor: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontSize: "1rem",
                  }}
                  title="Select today's date"
                >
                  📅
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "0.75rem 1rem",
                backgroundColor: isSubmitting ? "#9ca3af" : "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontSize: "0.875rem",
              }}
            >
              {isSubmitting ? "Adding..." : "Add Stock"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddMoreStock;
