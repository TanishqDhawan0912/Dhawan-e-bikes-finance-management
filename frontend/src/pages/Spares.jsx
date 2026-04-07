import {
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import SparesSidebar from "../components/SparesSidebar";
import MobileMenuToggleBar from "../components/MobileMenuToggleBar";
import AddSpare from "./spares/AddSpare";
import EditSpare from "./spares/EditSpare";
import AllSpares from "./spares/AllSpares";
import AddMoreStock from "./spares/AddMoreStock";

const WelcomeMessage = () => (
  <div className="welcome-message">
    <h2>Welcome to Spares Management</h2>
    <p>Select an option from the sidebar to get started.</p>
    <ul className="quick-actions">
      <li>• Add new spare parts to inventory</li>
      <li>• Edit existing spare part details</li>
      <li>• View and manage all spare parts in one place</li>
    </ul>
  </div>
);

export default function Spares() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // When switching between sections inside Spares, always reset scroll to top.
  // Scroll happens inside `.spares-content` (not window) due to the app shell.
  useEffect(() => {
    // Wait a frame so route content has mounted.
    requestAnimationFrame(() => {
      const el = document.querySelector(".spares-content");
      if (el && typeof el.scrollTo === "function") {
        el.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } else if (el) {
        el.scrollTop = 0;
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    });
  }, [location.pathname]);

  // Clean up any malformed URLs on mount and route changes
  useEffect(() => {
    const path = location.pathname;
    const segments = path.split("/").filter(Boolean);

    // If we have more than 3 segments (e.g., /spares/edit/id/something), clean it up
    if (segments.length > 3) {
      const cleanPath = `/${segments[0]}/${segments[1]}/${segments[2]}`;
      navigate(cleanPath, { replace: true });
      return;
    }

    // If we're at /spares, redirect to /spares/add
    if (path === "/spares" || path.endsWith("/spares/")) {
      navigate("/spares/add", { replace: true });
    }
  }, [location.pathname, navigate]);

  // If we're still on a path that needs redirection, show loading
  if (
    location.pathname === "/spares" ||
    location.pathname.endsWith("/spares/") ||
    location.pathname.split("/").filter(Boolean).length > 3
  ) {
    return <div className="loading">Loading...</div>;
  }

  const getPageTitle = () => {
    const path = location.pathname;

    // More specific path matching
    if (path.includes("/spares/add-more")) return "Add More Stock";
    if (path.includes("/spares/add")) return "Add Spares Here";
    if (path.includes("/spares/edit")) return "Edit Spares Here";
    if (path.includes("/spares/all")) return "All Spares";
    return "Spares";
  };

  return (
    <div className="spares-layout">
      <SparesSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div
        className={`overlay ${isSidebarOpen ? "show" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
      />
      <main className="spares-content">
        <MobileMenuToggleBar
          isHidden={isSidebarOpen}
          onClick={() => setIsSidebarOpen((v) => !v)}
        />
        <header className="content-header">
          <div className="header-content">
            <div className="header-left">
              <h1>{getPageTitle()}</h1>
              <p>Manage your spare parts inventory efficiently</p>
            </div>
            <div className="header-right">
              <button
                className="btn btn-back-home"
                onClick={() => navigate("/")}
                title="Back to Home"
              >
                🏠 Home
              </button>
            </div>
          </div>
        </header>
        <div className="content-area">
          <Routes>
            <Route path="add" element={<AddSpare />} />
            <Route path="edit/:id" element={<EditSpare />} />
            <Route path="all" element={<AllSpares />} />
            <Route path="add-more/:id" element={<AddMoreStock />} />
            <Route index element={<Navigate to="add" replace />} />
            <Route path="*" element={<Navigate to="add" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
