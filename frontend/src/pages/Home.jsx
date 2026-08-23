import { FaMotorcycle } from "react-icons/fa";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import QrScanner from "../components/QrScanner.jsx";

function FeatureCard({ icon, title, description }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-text">{description}</p>
    </div>
  );
}

export default function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showScanner, setShowScanner] = useState(false);
  const [scannerResult, setScannerResult] = useState(null);

  useEffect(() => {
    let savedResult = null;
    try {
      savedResult = JSON.parse(sessionStorage.getItem("qr-return-result"));
    } catch {
      sessionStorage.removeItem("qr-return-result");
    }
    const result = location.state?.returnToQr || savedResult;
    if (!result?.customer) return;
    sessionStorage.removeItem("qr-return-result");
    setScannerResult(result);
    setShowScanner(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  return (
    <div className="home-root">
      <nav className="home-navbar">
        <div className="home-navbar-inner">
          <Link to="/" className="home-navbar-brand">
            <span className="home-navbar-icon">
              <FaMotorcycle size={24} />
            </span>
            <span>
              <h1 className="home-navbar-title">Dhawan E-Bikes</h1>
              <p className="home-navbar-subtitle">
                Internal workshop & finance management
              </p>
            </span>
          </Link>
          <div className="home-navbar-actions">
            <button
              type="button"
              className="home-navbar-scan-btn"
              onClick={() => {
                setScannerResult(null);
                setShowScanner(true);
              }}
            >
              📷 Scan QR
            </button>
            <Link to="/admin" className="home-navbar-admin-btn">
              Admin
            </Link>
          </div>
        </div>
      </nav>

      <div className="home-center">
        <div className="home-menu">
          <Link to="/jobcards" className="home-menu-button">
            Jobcard
          </Link>
          <Link to="/spares" className="home-menu-button">
            Spares
          </Link>
          <Link to="/models" className="home-menu-button">
            Models
          </Link>
          <Link to="/batteries" className="home-menu-button">
            Batteries
          </Link>
          <Link to="/chargers" className="home-menu-button">
            Chargers
          </Link>
          <Link to="/bills" className="home-menu-button">
            Bills
          </Link>
          <Link to="/customers" className="home-menu-button">
            Customers
          </Link>
        </div>
      </div>
      {showScanner ? (
        <QrScanner
          initialResult={scannerResult}
          onClose={() => {
            setShowScanner(false);
            setScannerResult(null);
          }}
        />
      ) : null}
    </div>
  );
}
