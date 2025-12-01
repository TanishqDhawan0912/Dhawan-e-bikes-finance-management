import { NavLink, useLocation } from "react-router-dom";

export default function ModelsSidebar() {
  const location = useLocation();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Models Management</h3>
      </div>
      <nav className="sidebar-nav">
        <NavLink
          to="/models/add"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
        >
          <span className="icon">➕</span>
          Add Model
        </NavLink>
        <NavLink
          to="/models/edit"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
        >
          <span className="icon">✏️</span>
          Edit Model
        </NavLink>
        <NavLink
          to="/models/all"
          className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
        >
          <span className="icon">📋</span>
          All Models
        </NavLink>
      </nav>
    </div>
  );
}
