import { NavLink, useLocation, useNavigate } from "react-router-dom";

const menuItems = [
  { path: "add", label: "Add New Battery", icon: "➕" },
  { path: "edit", label: "Edit Battery", icon: "✏️" },
  { path: "all", label: "All Batteries", icon: "📋" },
  { path: "scraps", label: "Scraps", icon: "🗑️" },
];

export default function BatteriesSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Handle navigation to prevent path accumulation
  const handleNavigation = (e, path) => {
    e.preventDefault();
    // Get the base path (everything before the last segment)
    const segments = location.pathname.split("/").filter(Boolean);
    const basePath =
      segments[0] === "batteries" ? "/batteries" : `/${segments[0]}/batteries`;
    // Navigate to the clean path
    navigate(`${basePath}/${path}`, { replace: true });
  };

  // Check if the current path matches the menu item's path
  const isActive = (path) => {
    const currentPath = location.pathname;
    // For scraps path, check if the path includes scraps
    if (path === "scraps") {
      return currentPath.includes("/batteries/scraps");
    }
    // For regular paths, check exact match or if we're at /batteries
    return (
      currentPath.endsWith(`/${path}`) ||
      (path === "add" &&
        (currentPath.endsWith("/batteries") ||
          currentPath.endsWith("/batteries/")))
    );
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Batteries</h3>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => (
            <li key={item.path}>
              <a
                href={`/batteries/${item.path}`}
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
