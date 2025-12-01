import { useNavigate } from "react-router-dom";

export default function Payments() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Cashbook</h1>
            <p>
              Internal record of daily cash in / cash out for Dhawan E-Bikes.
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
      <div className="table-wrapper">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Particulars</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>--</td>
              <td>Opening Balance</td>
              <td>Cash In</td>
              <td>₹0</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
