import { NavLink, useLocation, useNavigate } from "react-router-dom";

const menuItems = [
  { path: "new", label: "New Bill", icon: "📄" },
  { path: "edit", label: "Edit Bill", icon: "✏️" },
  { path: "all", label: "All Bills", icon: "📋" },
];

export default function BillsSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavigation = (e, path) => {
    e.preventDefault();
    const segments = location.pathname.split("/").filter(Boolean);
    const basePath =
      segments[0] === "bills" ? "/bills" : `/${segments[0]}/bills`;
    navigate(`${basePath}/${path}`, { replace: true });
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
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Bills</h3>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => {
            const active = isActive(item.path);
            return (
              <li key={item.path}>
                <a
                  href={`/bills/${item.path}`}
                  className={active ? "active" : ""}
                  onClick={(e) => handleNavigation(e, item.path)}
                >
                  <span className="icon">{item.icon}</span>
                  <span className="label">{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
