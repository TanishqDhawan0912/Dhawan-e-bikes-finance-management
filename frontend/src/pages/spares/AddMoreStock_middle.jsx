          {spare?.[stockField] && Array.isArray(spare[stockField]) && spare[stockField].length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {spare[stockField].map((entry, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    gap: "1rem",
                    padding: "1rem",
                    backgroundColor: "#f9fafb",
                    borderRadius: "0.5rem",
                    border: "1px solid #e5e7eb",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "0.25rem", color: "#374151", fontSize: "0.875rem" }}>
                      Quantity
                    </label>
                    <div style={{ padding: "0.5rem", backgroundColor: "white", border: "1px solid #d1d5db", borderRadius: "0.375rem", color: "#374151" }}>
                      {entry.quantity} pieces
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "0.25rem", color: "#374151", fontSize: "0.875rem" }}>
                      Purchase Price
                    </label>
                    <div style={{ padding: "0.5rem", backgroundColor: "white", border: "1px solid #d1d5db", borderRadius: "0.375rem", color: "#374151" }}>
                      ?{entry.purchasePrice}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "0.25rem", color: "#374151", fontSize: "0.875rem" }}>
                      Purchase Date
                    </label>
                    <div style={{ padding: "0.5rem", backgroundColor: "white", border: "1px solid #d1d5db", borderRadius: "0.375rem", color: "#374151" }}>
                      {entry.date}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => console.log("Add more stock clicked")}
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
            <div style={{
              textAlign: "center",
              padding: "2rem",
              color: "#6b7280",
              fontSize: "0.875rem",
              backgroundColor: "#f9fafb",
              borderRadius: "0.5rem",
              border: "1px solid #e5e7eb",
            }}>
              No stock entries found
            </div>
          )}
        </div>
