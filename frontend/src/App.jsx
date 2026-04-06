import { Routes, Route, Link, useLocation } from "react-router-dom";
import { lazy, Suspense, memo, useMemo } from "react";
import { FaMotorcycle } from "react-icons/fa";

// Lazy load all pages for better performance
const Home = lazy(() => import("./pages/Home.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Loans = lazy(() => import("./pages/Loans.jsx"));
const Customers = lazy(() => import("./pages/Customers.jsx"));
const Payments = lazy(() => import("./pages/Payments.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const Jobcards = lazy(() => import("./pages/Jobcards.jsx"));
const Spares = lazy(() => import("./pages/Spares.jsx"));
const Models = lazy(() => import("./pages/Models.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const AdminLogin = lazy(() => import("./components/AdminLogin.jsx"));
const Batteries = lazy(() => import("./pages/Batteries.jsx"));
const Chargers = lazy(() => import("./pages/Chargers.jsx"));
const Bills = lazy(() => import("./pages/Bills.jsx"));

// Loading component
const PageLoader = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "50vh",
    }}
  >
    <div
      style={{
        width: "40px",
        height: "40px",
        border: "4px solid #f3f3f3",
        borderTop: "4px solid #3b82f6",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }}
    ></div>
  </div>
);

const Navbar = memo(() => {
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
});

function AppLayout() {
  const location = useLocation();
  const pathname = location.pathname;

  const classNames = useMemo(() => {
    const isJobcardPage = pathname.startsWith("/jobcards");
    const isSparesPage = pathname.startsWith("/spares");
    const isBatteriesPage = pathname.startsWith("/batteries");
    const isChargersPage = pathname.startsWith("/chargers");
    const isModelsPage = pathname.startsWith("/models");
    const isBillsPage = pathname.startsWith("/bills");
    const isHomePage = pathname === "/";
    const usesSparesShell =
      isSparesPage || isBatteriesPage || isChargersPage;

    return {
      root: `app-root ${isJobcardPage ? "jobcard-root" : ""} ${
        usesSparesShell ? "spares-root" : ""
      } ${isModelsPage ? "models-root" : ""} ${
        isBillsPage ? "bills-root" : ""
      }`.trim(),
      main: `app-main ${isHomePage ? "home-page" : ""}`,
    };
  }, [pathname]);

  return (
    <div className={classNames.root}>
      <main className={classNames.main}>
        <Suspense fallback={<PageLoader />}>
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
            <Route path="/batteries/*" element={<Batteries />} />
            <Route path="/chargers/*" element={<Chargers />} />
            <Route path="/bills/*" element={<Bills />} />
        </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return <AppLayout />;
}
