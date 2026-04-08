import { NavLink, useNavigate } from "react-router-dom";

export default function ModelsSidebar({ showBottomHome, isOpen = false, onClose }) {
  const navigate = useNavigate();

  return (
    <div
      className={`sidebar ${isOpen ? "open" : ""}`}
    >
      <div className="sidebar-header">
        <h3>Models Management</h3>
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li>
            <NavLink
              to="/models/add"
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() =>
                typeof onClose === "function" ? onClose() : undefined
              }
            >
              <span className="icon">➕</span>
              <span className="label">Add Model</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/models/edit"
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() =>
                typeof onClose === "function" ? onClose() : undefined
              }
            >
              <span className="icon">✏️</span>
              <span className="label">Edit Model</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/models/all"
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() =>
                typeof onClose === "function" ? onClose() : undefined
              }
            >
              <span className="icon">📋</span>
              <span className="label">All Models</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/models/old-scooties"
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() =>
                typeof onClose === "function" ? onClose() : undefined
              }
            >
              <span className="icon">🛵</span>
              <span className="label">Old Scooties</span>
            </NavLink>
          </li>
        </ul>
      </nav>
      {showBottomHome && (
        <button
          className="nav-link"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #d1d5db",
            background: "#f9fafb",
            cursor: "pointer",
            width: "56px",
            height: "56px",
            borderRadius: "9999px",
            marginTop: "auto",
            marginBottom: "1.25rem",
            alignSelf: "center",
            color: "#111827",
          }}
          onClick={() => navigate("/")}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#eef2ff";
            e.currentTarget.style.borderColor = "#6366f1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#f9fafb";
            e.currentTarget.style.borderColor = "#d1d5db";
          }}
          title="Back to Home"
        >
          <span className="icon" style={{ fontSize: "1rem", opacity: 0.9 }}>
            🏠
          </span>
        </button>
      )}
    </div>
  );
}
