import { Routes, Route, Link } from "react-router-dom";
import { FaMotorcycle } from "react-icons/fa";
import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Loans from "./pages/Loans.jsx";
import Customers from "./pages/Customers.jsx";
import Payments from "./pages/Payments.jsx";
import Reports from "./pages/Reports.jsx";
import Jobcards from "./pages/Jobcards.jsx";
import Spares from "./pages/Spares.jsx";
import Models from "./pages/Models.jsx";
import Admin from "./pages/Admin.jsx";
import AdminLogin from "./components/AdminLogin.jsx";
import Batteries from "./pages/Batteries.jsx";

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="navbar-icon">
            <FaMotorcycle size={24} />
          </span>
          <span>
            <div className="navbar-title">Dhawan E-Bikes</div>
            <div className="navbar-subtitle">Finance Management</div>
          </span>
        </Link>
        <div className="navbar-links">
          <Link to="/" className="nav-link">
            Home
          </Link>
          <Link to="/jobcards" className="nav-link">
            Jobcards
          </Link>
          <Link to="/spares" className="nav-link">
            Spares
          </Link>
          <Link to="/models" className="nav-link">
            Models
          </Link>
        </div>
        <Link to="/admin" className="navbar-admin-btn">
          <button className="btn btn-primary">Admin</button>
        </Link>
      </div>
    </nav>
  );
}

function AppLayout() {
  const location = window.location.pathname;
  const isHomePage = location === "/";
  const isJobcardPage = location.startsWith("/jobcards");
  const isSparesPage = location.startsWith("/spares");
  const isModelsPage = location.startsWith("/models");

  return (
    <div
      className={`app-root ${isJobcardPage ? "jobcard-root" : ""} ${
        isSparesPage ? "spares-root" : ""
      } ${isModelsPage ? "models-root" : ""}`}
    >
      <main className={`app-main ${isHomePage ? "home-page" : ""}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/jobcards/*" element={<Jobcards />} />
          <Route path="/spares/*" element={<Spares />} />
          <Route path="/models/*" element={<Models />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/batteries" element={<Batteries />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <AppLayout />;
}
