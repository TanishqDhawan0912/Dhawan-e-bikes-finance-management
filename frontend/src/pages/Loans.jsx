import { useNavigate } from "react-router-dom";

export default function Loans() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Finance Accounts</h1>
            <p>Internal list of all bikes sold on finance with EMI details.</p>
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
              <th>Bike No.</th>
              <th>Customer Name</th>
              <th>Finance Amount</th>
              <th>Monthly EMI</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>EB-001</td>
              <td>Sample Customer</td>
              <td>₹0</td>
              <td>₹0</td>
              <td>₹0</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
