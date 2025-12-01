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
      <div className="home-logo-top">
        <div className="home-logo-circle">
          <FaMotorcycle size={64} />
        </div>
        <h1 className="home-title">Dhawan E-Bikes</h1>
        <p className="home-subtitle">Internal workshop & finance management</p>
      </div>

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
          <Link to="/admin" className="home-menu-button home-menu-button-admin">
            Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
