import { NavLink, useLocation, useNavigate } from "react-router-dom";

const menuItems = [
  { path: "add", label: "Add New Scrap", icon: "➕" },
  { path: "edit", label: "Edit Scrap", icon: "✏️" },
  { path: "all", label: "All Scrap", icon: "📋" },
];

export default function ScrapSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Handle navigation to prevent path accumulation
  const handleNavigation = (e, path) => {
    e.preventDefault();
    // Get the base path (everything before the last segment)
    const segments = location.pathname.split("/").filter(Boolean);
    const basePath =
      segments[0] === "scrap" ? "/scrap" : `/${segments[0]}/scrap`;
    // Navigate to the clean path
    navigate(`${basePath}/${path}`, { replace: true });
  };

  // Check if the current path matches the menu item's path
  const isActive = (path) => {
    const currentPath = location.pathname;
    return (
      currentPath.endsWith(`/${path}`) ||
      (path === "add" &&
        (currentPath.endsWith("/scrap") || currentPath.endsWith("/scrap/")))
    );
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Scrap</h3>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => (
            <li key={item.path}>
              <a
                href={`/scrap/${item.path}`}
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
