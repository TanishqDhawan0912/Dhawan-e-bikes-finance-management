import {
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";
import ModelsSidebar from "../components/ModelsSidebar";
import AddModel from "./models/AddModel";
import EditModel from "./models/EditModel";
import EditColor from "./models/EditColor";
import AllModels from "./models/AllModels";

const WelcomeMessage = () => (
  <div className="welcome-message">
    <h2>Welcome to Models Management</h2>
    <p>Select an option from the sidebar to get started.</p>
    <ul className="quick-actions">
      <li>• Add new e-bike models to your inventory</li>
      <li>• Edit existing model specifications and details</li>
      <li>• View and manage all models in one place</li>
    </ul>
  </div>
);

export default function Models() {
  const location = useLocation();
  const navigate = useNavigate();

  // Clean up any malformed URLs on mount and route changes
  useEffect(() => {
    const path = location.pathname;
    const segments = path.split("/").filter(Boolean);

    // If we have more than 4 segments (e.g., /models/edit-color/id/something), clean it up
    if (segments.length > 4) {
      const cleanPath = `/${segments[0]}/${segments[1]}/${segments[2]}/${segments[3]}`;
      navigate(cleanPath, { replace: true });
      return;
    }

    // If we're at /models, redirect to /models/add
    if (path === "/models" || path.endsWith("/models/")) {
      navigate("/models/add", { replace: true });
    }
  }, [location.pathname, navigate]);

  // If we're still on a path that needs redirection, show loading
  if (
    location.pathname === "/models" ||
    location.pathname.endsWith("/models/") ||
    location.pathname.split("/").filter(Boolean).length > 4
  ) {
    return <div className="loading">Loading...</div>;
  }

  const getPageTitle = () => {
    if (location.pathname.endsWith("add")) return "Add New Model";
    if (location.pathname.endsWith("edit")) return "Edit Model";
    if (location.pathname.includes("edit-color")) return "Add Color Variant";
    if (location.pathname.endsWith("all")) return "All Models";
    return "Models";
  };

  return (
    <div className="models-layout">
      <ModelsSidebar />
      <main className="models-content">
        <header className="content-header">
          <div className="header-content">
            <div className="header-left">
              <h1>{getPageTitle()}</h1>
              <p>Manage your e-bike models and specifications efficiently</p>
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
            <Route path="add" element={<AddModel />} />
            <Route path="edit/:id" element={<EditModel />} />
            <Route path="edit-color/:id" element={<EditColor />} />
            <Route path="all" element={<AllModels />} />
            <Route index element={<Navigate to="add" replace />} />
            <Route path="*" element={<Navigate to="add" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
