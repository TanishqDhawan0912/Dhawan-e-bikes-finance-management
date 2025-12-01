import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="page page-dashboard">
      <header className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Dhawan E-Bikes Overview</h1>
            <p>
              Quick view of capital, stock value, EMIs and cash position for
              your own business.
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
          <h3>Total Capital Invested</h3>
          <p className="stat-value">--</p>
          <p className="stat-label">
            Approximate capital blocked in stock and finance accounts.
          </p>
        </div>
        <div className="stat-card">
          <h3>Outstanding EMIs</h3>
          <p className="stat-value">--</p>
          <p className="stat-label">
            Total receivable amount from active finance customers.
          </p>
        </div>
        <div className="stat-card">
          <h3>Today&apos;s Cash Balance</h3>
          <p className="stat-value">--</p>
          <p className="stat-label">
            Based on entries recorded in the cashbook.
          </p>
        </div>
      </section>
    </div>
  );
}
