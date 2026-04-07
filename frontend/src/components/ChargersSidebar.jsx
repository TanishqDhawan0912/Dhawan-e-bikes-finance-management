import { NavLink, useLocation, useNavigate } from "react-router-dom";

const menuItems = [
  { path: "add", label: "Add New Charger", icon: "➕" },
  { path: "edit", label: "Edit Charger", icon: "✏️" },
  { path: "all", label: "All Chargers", icon: "📋" },
  { path: "old-chargers", label: "Old Chargers", icon: "🔌" },
];

export default function ChargersSidebar({ isOpen = false, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Handle navigation to prevent path accumulation
  const handleNavigation = (e, path) => {
    e.preventDefault();
    // Get the base path (everything before the last segment)
    const segments = location.pathname.split("/").filter(Boolean);
    const basePath =
      segments[0] === "chargers" ? "/chargers" : `/${segments[0]}/chargers`;
    // Navigate to the clean path
    navigate(`${basePath}/${path}`, { replace: true });
    if (typeof onClose === "function") onClose();
  };

  // Check if the current path matches the menu item's path
  const isActive = (path) => {
    const currentPath = location.pathname;
    // For old-chargers path, check if the path includes old-chargers
    if (path === "old-chargers") {
      return currentPath.includes("/chargers/old-chargers");
    }
    // For regular paths, check exact match or if we're at /chargers
    return (
      currentPath.endsWith(`/${path}`) ||
      (path === "add" &&
        (currentPath.endsWith("/chargers") ||
          currentPath.endsWith("/chargers/")))
    );
  };

  return (
    <div className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <h3>Chargers</h3>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => (
            <li key={item.path}>
              <a
                href={`/chargers/${item.path}`}
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


