import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Mock data for demonstration
const mockSpares = [
  {
    id: 1,
    name: "Engine Oil Filter",
    sku: "ENG-0001",
    category: "engine",
    quantity: 25,
    costPrice: 150.0,
    sellingPrice: 200.0,
    minStockLevel: 10,
    supplier: { name: "Auto Parts Ltd", contact: "9876543210" },
    location: { aisle: "A", shelf: "1", bin: "5" },
  },
  {
    id: 2,
    name: "Brake Pads",
    sku: "BRK-0001",
    category: "brakes",
    quantity: 8,
    costPrice: 300.0,
    sellingPrice: 450.0,
    minStockLevel: 15,
    supplier: { name: "Brake Systems Co", contact: "9876543211" },
    location: { aisle: "B", shelf: "2", bin: "3" },
  },
  {
    id: 3,
    name: "Headlight Bulb",
    sku: "ELC-0001",
    category: "electrical",
    quantity: 50,
    costPrice: 80.0,
    sellingPrice: 120.0,
    minStockLevel: 20,
    supplier: { name: "Lighting Solutions", contact: "9876543212" },
    location: { aisle: "C", shelf: "1", bin: "8" },
  },
];

export default function AllSpares() {
  const navigate = useNavigate();
  const [spares, setSpares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSpares();
  }, []);

  const fetchSpares = async () => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSpares(mockSpares);
    } catch {
      setError("Error fetching spares. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (spareId) => {
    navigate(`/spares/edit/${spareId}`);
  };

  const handleDelete = async (spareId) => {
    if (!window.confirm("Are you sure you want to delete this spare?")) {
      return;
    }

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Remove from local state
      setSpares(spares.filter((spare) => spare.id !== spareId));
    } catch {
      setError("Error deleting spare. Please try again.");
    }
  };

  const getStockStatus = (quantity, minStockLevel) => {
    if (quantity <= minStockLevel / 2) {
      return { color: "#ef4444", text: "Critical" };
    } else if (quantity <= minStockLevel) {
      return { color: "#f59e0b", text: "Low Stock" };
    } else {
      return { color: "#10b981", text: "In Stock" };
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      engine: "#2563eb",
      electrical: "#7c3aed",
      suspension: "#dc2626",
      brakes: "#ea580c",
      interior: "#059669",
      exterior: "#0891b2",
      other: "#6b7280",
    };
    return colors[category] || "#6b7280";
  };

  if (loading) {
    return (
      <div className="page-content">
        <h2>All Spares</h2>
        <p>Loading spares...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <h2>All Spares</h2>
        <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
        <button className="btn btn-primary" onClick={fetchSpares}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h2>All Spares</h2>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/spares/add")}
        >
          + Add Spare
        </button>
      </div>

      {spares.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <p>No spares found. Add your first spare part!</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/spares/add")}
            style={{ marginTop: "1rem" }}
          >
            Add Spare
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="simple-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Stock Status</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {spares.map((spare) => {
                const stockStatus = getStockStatus(
                  spare.quantity,
                  spare.minStockLevel
                );
                return (
                  <tr key={spare.id}>
                    <td>{spare.sku}</td>
                    <td>
                      <div>
                        <strong>{spare.name}</strong>
                        {spare.supplier.name && (
                          <div
                            style={{ fontSize: "0.875rem", color: "#6b7280" }}
                          >
                            {spare.supplier.name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          backgroundColor: getCategoryColor(spare.category),
                          color: "white",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.75rem",
                          textTransform: "capitalize",
                        }}
                      >
                        {spare.category}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: "500" }}>{spare.quantity}</div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        Min: {spare.minStockLevel}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          color: stockStatus.color,
                          fontWeight: "500",
                          textTransform: "capitalize",
                        }}
                      >
                        {stockStatus.text}
                      </span>
                    </td>
                    <td>₹{spare.costPrice.toFixed(2)}</td>
                    <td>₹{spare.sellingPrice.toFixed(2)}</td>
                    <td>
                      {spare.location.aisle ||
                      spare.location.shelf ||
                      spare.location.bin ? (
                        <span style={{ fontSize: "0.875rem" }}>
                          {spare.location.aisle &&
                            `Aisle ${spare.location.aisle}`}
                          {spare.location.shelf &&
                            ` • Shelf ${spare.location.shelf}`}
                          {spare.location.bin && ` • Bin ${spare.location.bin}`}
                        </span>
                      ) : (
                        <span style={{ color: "#6b7280" }}>Not set</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn"
                        style={{
                          marginRight: "0.5rem",
                          padding: "0.25rem 0.75rem",
                          fontSize: "0.875rem",
                        }}
                        onClick={() => handleEdit(spare.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn"
                        style={{
                          backgroundColor: "#fee2e2",
                          color: "#dc2626",
                          padding: "0.25rem 0.75rem",
                          fontSize: "0.875rem",
                        }}
                        onClick={() => handleDelete(spare.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
