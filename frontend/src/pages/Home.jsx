import { FaMotorcycle } from "react-icons/fa";
import { Link } from "react-router-dom";

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
          <Link to="/admin" className="home-navbar-admin-btn">
            Admin
          </Link>
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
        </div>
      </div>
    </div>
  );
}
