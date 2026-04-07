import { NavLink, useNavigate } from "react-router-dom";

export default function ModelsSidebar({ showBottomHome, isOpen = false, onClose }) {
  const navigate = useNavigate();

  return (
    <div
      className={`sidebar ${isOpen ? "open" : ""}`}
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <div className="sidebar-header">
        <h3>Models Management</h3>
      </div>
      <nav className="sidebar-nav">
        <NavLink
          to="/models/add"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
        >
          <span className="icon">➕</span>
          Add Model
        </NavLink>
        <NavLink
          to="/models/edit"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
        >
          <span className="icon">✏️</span>
          Edit Model
        </NavLink>
        <NavLink
          to="/models/all"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
        >
          <span className="icon">📋</span>
          All Models
        </NavLink>
        <NavLink
          to="/models/old-scooties"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          onClick={() => (typeof onClose === "function" ? onClose() : undefined)}
        >
          <span className="icon">🛵</span>
          Old Scooties
        </NavLink>
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
