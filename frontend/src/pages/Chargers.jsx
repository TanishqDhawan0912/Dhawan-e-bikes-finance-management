import {
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import ChargersSidebar from "../components/ChargersSidebar";
import MobileMenuToggleBar from "../components/MobileMenuToggleBar";
import AddCharger from "./chargers/AddCharger";
import EditCharger from "./chargers/EditCharger";
import AllChargers from "./chargers/AllChargers";
import AddMoreCharger from "./chargers/AddMoreCharger";
import OldChargers from "./chargers/OldChargers";

export default function Chargers() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Clean up any malformed URLs on mount and route changes
  useEffect(() => {
    const path = location.pathname;
    const segments = path.split("/").filter(Boolean);

    // If we have more than 3 segments, clean it up
    if (segments.length > 3) {
      const cleanPath = `/${segments[0]}/${segments[1]}/${segments[2]}`;
      navigate(cleanPath, { replace: true });
      return;
    }

    // If we're at /chargers, redirect to /chargers/add
    if (path === "/chargers" || path.endsWith("/chargers/")) {
      navigate("/chargers/add", { replace: true });
    }
  }, [location.pathname, navigate]);

  // If we're still on a path that needs redirection, show loading
  if (
    location.pathname === "/chargers" ||
    location.pathname.endsWith("/chargers/") ||
    location.pathname.split("/").filter(Boolean).length > 3
  ) {
    return <div className="loading">Loading...</div>;
  }

  const getPageTitle = () => {
    const path = location.pathname;

    if (path.includes("/chargers/add")) return "Add Chargers Here";
    if (path.includes("/chargers/edit")) return "Edit Chargers Here";
    if (path.includes("/chargers/all")) return "All Chargers";
    if (path.includes("/chargers/old-chargers")) return "Old Chargers";
    return "Chargers";
  };

  return (
    <div className="spares-layout">
      <ChargersSidebar
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
              <p>Manage your charger inventory efficiently</p>
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
            <Route path="add" element={<AddCharger />} />
            <Route path="edit" element={<EditCharger />} />
            <Route path="edit/:id" element={<EditCharger />} />
            <Route path="all" element={<AllChargers />} />
            <Route path="add-more/:id" element={<AddMoreCharger />} />
            <Route path="old-chargers" element={<OldChargers />} />
            <Route index element={<Navigate to="add" replace />} />
            <Route path="*" element={<Navigate to="add" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
