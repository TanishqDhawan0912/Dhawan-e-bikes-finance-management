import { useNavigate } from "react-router-dom";

export default function Customers() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Customers</h1>
            <p>Manage customers who have taken finance for Dhawan E-Bikes.</p>
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
      <div className="table-wrapper">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Total Bikes</th>
              <th>Active Loans</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sample Customer</td>
              <td>+91-00000-00000</td>
              <td>1</td>
              <td>1</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
