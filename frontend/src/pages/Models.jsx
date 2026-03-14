import {
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import ModelsSidebar from "../components/ModelsSidebar";
import AddModel from "./models/AddModel";
import EditModel from "./models/EditModel";
import EditColor from "./models/EditColor";
import AllModels from "./models/AllModels";
import AddMoreStock from "./models/AddMoreStock";
import OldScooties from "./models/OldScooties";

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
  const headerHomeRef = useRef(null);
  const [isHeaderHomeVisible, setIsHeaderHomeVisible] = useState(true);

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

  useEffect(() => {
    const target = headerHomeRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsHeaderHomeVisible(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0.1,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, []);

  // If we're still on a path that needs redirection, show loading
  if (
    location.pathname === "/models" ||
    location.pathname.endsWith("/models/") ||
    location.pathname.split("/").filter(Boolean).length > 4
  ) {
    return <div className="loading">Loading...</div>;
  }

  const getPageTitle = () => {
    const path = location.pathname;

    // More specific path matching
    if (path.includes("add-more")) return "Add More Model Stock";
    if (path.includes("/models/add")) return "Add Models Here";
    if (path.includes("/models/edit")) return "Edit Models Here";
    if (path.includes("edit-color")) return "Add Color Variant";
    if (path.includes("/models/all")) return "All Models";
    if (path.includes("/models/old-scooties")) return "Old Scooties";
    return "Models";
  };

  return (
    <div className="models-layout">
      <ModelsSidebar
        showBottomHome={
          !isHeaderHomeVisible && location.pathname === "/models/all"
        }
      />
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
                ref={headerHomeRef}
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
            <Route path="add-more/:id" element={<AddMoreStock />} />
            <Route path="all" element={<AllModels />} />
            <Route path="old-scooties" element={<OldScooties />} />
            <Route index element={<Navigate to="add" replace />} />
            <Route path="*" element={<Navigate to="add" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
