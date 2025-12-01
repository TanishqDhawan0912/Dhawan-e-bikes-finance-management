import { NavLink, useLocation, useNavigate } from "react-router-dom";

const menuItems = [
  { path: "new", label: "New Jobcard", icon: "📝" },
  { path: "edit", label: "Edit Jobcard", icon: "✏️" },
  { path: "all", label: "All Jobcards", icon: "📋" },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Handle navigation to prevent path accumulation
  const handleNavigation = (e, path) => {
    e.preventDefault();
    // Get the base path (everything before the last segment)
    const segments = location.pathname.split("/").filter(Boolean);
    const basePath =
      segments[0] === "jobcards" ? "/jobcards" : `/${segments[0]}/jobcards`;
    // Navigate to the clean path
    navigate(`${basePath}/${path}`, { replace: true });
  };

  // Check if the current path matches the menu item's path
  const isActive = (path) => {
    const currentPath = location.pathname;
    return (
      currentPath.endsWith(`/${path}`) ||
      (path === "new" &&
        (currentPath.endsWith("/jobcards") ||
          currentPath.endsWith("/jobcards/")))
    );
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Jobcards</h3>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => (
            <li key={item.path}>
              <a
                href={`/jobcards/${item.path}`}
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
