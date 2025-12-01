import {
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "../components/Sidebar";
import NewJobcard from "./jobcards/NewJobcard";
import EditJobcard from "./jobcards/EditJobcard";
import AllJobcards from "./jobcards/AllJobcards";

const WelcomeMessage = () => (
  <div className="welcome-message">
    <h2>Welcome to Jobcards Management</h2>
    <p>Select an option from the sidebar to get started.</p>
    <ul className="quick-actions">
      <li>• Create a new jobcard for service requests</li>
      <li>• Edit existing jobcards and update status</li>
      <li>• View and manage all jobcards in one place</li>
    </ul>
  </div>
);

export default function Jobcards() {
  const location = useLocation();
  const navigate = useNavigate();

  // Clean up any malformed URLs on mount and route changes
  useEffect(() => {
    const path = location.pathname;
    const segments = path.split("/").filter(Boolean);

    // If we have more than 2 segments (e.g., /jobcards/new/something), clean it up
    if (segments.length > 2) {
      const cleanPath = `/${segments[0]}/${segments[1]}`;
      navigate(cleanPath, { replace: true });
      return;
    }

    // If we're at /jobcards, redirect to /jobcards/new
    if (path === "/jobcards" || path.endsWith("/jobcards/")) {
      navigate("/jobcards/new", { replace: true });
    }
  }, [location.pathname, navigate]);

  // If we're still on a path that needs redirection, show loading
  if (
    location.pathname === "/jobcards" ||
    location.pathname.endsWith("/jobcards/") ||
    location.pathname.split("/").filter(Boolean).length > 2
  ) {
    return <div className="loading">Loading...</div>;
  }

  const getPageTitle = () => {
    if (location.pathname.endsWith("new")) return "Create New Jobcard";
    if (location.pathname.endsWith("edit")) return "Edit Jobcard";
    if (location.pathname.endsWith("all")) return "All Jobcards";
    return "Jobcards";
  };

  return (
    <div className="jobcards-layout">
      <Sidebar />
      <main className="jobcards-content">
        <header className="content-header">
          <div className="header-content">
            <div className="header-left">
              <h1>{getPageTitle()}</h1>
              <p>Manage your service and repair jobcards efficiently</p>
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
            <Route path="new" element={<NewJobcard />} />
            <Route path="edit" element={<EditJobcard />} />
            <Route path="all" element={<AllJobcards />} />
            <Route index element={<Navigate to="new" replace />} />
            <Route path="*" element={<Navigate to="new" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
