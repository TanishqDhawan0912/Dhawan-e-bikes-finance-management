import { useNavigate, useParams } from "react-router-dom";

// Check if ID is a valid MongoDB ObjectId (24 hex characters)
const isValidObjectId = (id) => {
  return id && /^[0-9a-fA-F]{24}$/.test(id);
};

export default function EditScrap() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Show message if no scrap ID is provided or ID is invalid
  if (
    !id ||
    !isValidObjectId(id) ||
    id === "add" ||
    id === "all" ||
    id === "edit"
  ) {
    return (
      <div className="form-container">
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
            No Scrap Selected
          </h3>
          <p
            style={{
              margin: "0 0 1.5rem 0",
              color: "#92400e",
              fontSize: "0.875rem",
            }}
          >
            Please select a scrap item from the list to edit.
          </p>
          <button
            type="button"
            onClick={() => navigate("/batteries/scrap/all")}
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
            Go to All Scrap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Edit Scrap</h2>
        <p>Scrap edit form coming soon...</p>
      </div>
    </div>
  );
}
