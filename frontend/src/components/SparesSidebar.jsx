import { NavLink, useLocation, useNavigate } from "react-router-dom";

const menuItems = [
  { path: "add", label: "Add Spare", icon: "➕" },
  { path: "edit", label: "Edit Spare", icon: "✏️" },
  { path: "all", label: "All Spares", icon: "📋" },
];

export default function SparesSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Handle navigation to prevent path accumulation
  const handleNavigation = (e, path) => {
    e.preventDefault();
    // Get the base path (everything before the last segment)
    const segments = location.pathname.split("/").filter(Boolean);
    const basePath =
      segments[0] === "spares" ? "/spares" : `/${segments[0]}/spares`;
    // Navigate to the clean path
    navigate(`${basePath}/${path}`, { replace: true });
  };

  // Check if the current path matches the menu item's path
  const isActive = (path) => {
    const currentPath = location.pathname;
    return (
      currentPath.endsWith(`/${path}`) ||
      (path === "add" &&
        (currentPath.endsWith("/spares") || currentPath.endsWith("/spares/")))
    );
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Spares</h3>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => (
            <li key={item.path}>
              <a
                href={`/spares/${item.path}`}
                className={isActive(item.path) ? "active" : ""}
                onClick={(e) => handleNavigation(e, item.path)}
              >
                <span className="icon">{item.icon}</span>
                <span className="label">{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
