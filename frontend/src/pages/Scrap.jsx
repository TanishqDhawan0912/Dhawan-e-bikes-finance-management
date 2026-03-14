import {
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";
import ScrapSidebar from "../components/ScrapSidebar";
import AddScrap from "./scrap/AddScrap";
import EditScrap from "./scrap/EditScrap";
import AllScrap from "./scrap/AllScrap";

export default function Scrap() {
  const location = useLocation();
  const navigate = useNavigate();

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

    // If we're at /scrap, redirect to /scrap/add
    if (path === "/scrap" || path.endsWith("/scrap/")) {
      navigate("/scrap/add", { replace: true });
    }
  }, [location.pathname, navigate]);

  // If we're still on a path that needs redirection, show loading
  if (
    location.pathname === "/scrap" ||
    location.pathname.endsWith("/scrap/") ||
    location.pathname.split("/").filter(Boolean).length > 3
  ) {
    return <div className="loading">Loading...</div>;
  }

  const getPageTitle = () => {
    const path = location.pathname;

    if (path.includes("/scrap/add")) return "Add Scrap Here";
    if (path.includes("/scrap/edit")) return "Edit Scrap Here";
    if (path.includes("/scrap/all")) return "All Scrap";
    return "Scrap";
  };

  return (
    <div className="spares-layout">
      <ScrapSidebar />
      <main className="spares-content">
        <header className="content-header">
          <div className="header-content">
            <div className="header-left">
              <h1>{getPageTitle()}</h1>
              <p>Manage your scrap inventory efficiently</p>
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
            <Route path="add" element={<AddScrap />} />
            <Route path="edit" element={<EditScrap />} />
            <Route path="edit/:id" element={<EditScrap />} />
            <Route path="all" element={<AllScrap />} />
            <Route index element={<Navigate to="add" replace />} />
            <Route path="*" element={<Navigate to="add" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
