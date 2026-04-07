import {
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import BatteriesSidebar from "../components/BatteriesSidebar";
import AddBattery from "./batteries/AddBattery";
import EditBattery from "./batteries/EditBattery";
import AllBatteries from "./batteries/AllBatteries";
import AddMoreBattery from "./batteries/AddMoreBattery";
import Scraps from "./scrap/Scraps";

export default function Batteries() {
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

    // If we're at /batteries, redirect to /batteries/add
    if (path === "/batteries" || path.endsWith("/batteries/")) {
      navigate("/batteries/add", { replace: true });
    }
  }, [location.pathname, navigate]);

  // If we're still on a path that needs redirection, show loading
  if (
    location.pathname === "/batteries" ||
    location.pathname.endsWith("/batteries/") ||
    location.pathname.split("/").filter(Boolean).length > 3
  ) {
    return <div className="loading">Loading...</div>;
  }

  const getPageTitle = () => {
    const path = location.pathname;

    if (path.includes("/batteries/add")) return "Add Batteries Here";
    if (path.includes("/batteries/edit")) return "Edit Batteries Here";
    if (path.includes("/batteries/all")) return "All Batteries";
    if (path.includes("/batteries/scraps")) return "Scraps";
    return "Batteries";
  };

  return (
    <div className="spares-layout">
      <BatteriesSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div
        className={`overlay ${isSidebarOpen ? "show" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
      />
      <main className="spares-content">
        <header className="content-header">
          <div className="header-content">
            <div className="header-left">
              <button
                className="menu-toggle"
                type="button"
                onClick={() => setIsSidebarOpen((v) => !v)}
                aria-label="Open menu"
              >
                ☰
              </button>
              <h1>{getPageTitle()}</h1>
              <p>Manage your battery and scrap inventory efficiently</p>
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
            <Route path="add" element={<AddBattery />} />
            <Route path="edit" element={<EditBattery />} />
            <Route path="edit/:id" element={<EditBattery />} />
            <Route path="all" element={<AllBatteries />} />
            <Route path="add-more/:id" element={<AddMoreBattery />} />
            <Route path="scraps" element={<Scraps />} />
            <Route index element={<Navigate to="add" replace />} />
            <Route path="*" element={<Navigate to="add" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
