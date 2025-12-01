import { useNavigate } from "react-router-dom";

export default function Reports() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Business Reports</h1>
            <p>
              Internal reports for Dhawan E-Bikes finance and cash position.
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
      <section className="cards-grid">
        <div className="stat-card">
          <h3>Monthly Collection Summary</h3>
          <p className="stat-label">
            Total EMIs and cash received in a selected month.
          </p>
          <button className="btn btn-secondary">Download</button>
        </div>
        <div className="stat-card">
          <h3>Overdue Finance Accounts</h3>
          <p className="stat-label">
            List of customers with overdue EMIs and pending balance.
          </p>
          <button className="btn btn-secondary">Download</button>
        </div>
      </section>
    </div>
  );
}
