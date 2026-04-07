import { NavLink, useLocation, useNavigate } from "react-router-dom";

const menuItems = [
  { path: "new", label: "New Bill", icon: "📝" },
  { path: "edit", label: "Edit Bill", icon: "✏️" },
  { path: "all", label: "All Bills", icon: "📋" },
];

export default function BillsSidebar({ isOpen = false, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavigation = (e, path) => {
    e.preventDefault();
    const segments = location.pathname.split("/").filter(Boolean);
    const basePath =
      segments[0] === "bills" ? "/bills" : `/${segments[0]}/bills`;
    navigate(`${basePath}/${path}`, { replace: true });
    if (typeof onClose === "function") onClose();
  };

  const isActive = (path) => {
    const currentPath = location.pathname;
    return (
      currentPath.endsWith(`/${path}`) ||
      (path === "new" &&
        (currentPath.endsWith("/bills") || currentPath.endsWith("/bills/")))
    );
  };

  return (
    <div className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <h3>Bills</h3>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => (
            <li key={item.path}>
              <a
                href={`/bills/${item.path}`}
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
