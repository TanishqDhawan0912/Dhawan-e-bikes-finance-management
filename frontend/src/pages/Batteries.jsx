import { useNavigate } from "react-router-dom";

export default function Batteries() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Batteries</h1>
            <p>
              Manage Dhawan E-Bikes batteries: stock, warranty and replacements.
            </p>
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
      <p>
        You can later design this page with tables and forms for different
        battery models and their status.
      </p>
    </div>
  );
}
