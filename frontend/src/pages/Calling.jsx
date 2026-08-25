import { Link } from "react-router-dom";
import { SERVICE_TIERS, useCallingTiers } from "../utils/callingService";

export default function Calling() {
  const { tierLists, loading, error } = useCallingTiers();

  return (
    <div
      className="calling-root"
      style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}
    >
      <div style={{ marginBottom: "16px" }}>
        <Link to="/" className="calling-back-btn">
          <span aria-hidden="true">←</span> Back to Home
        </Link>
      </div>

      <div
        style={{
          marginBottom: "20px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.6rem" }}>
          Calling — Free Service Reminders
        </h1>
        <p style={{ margin: "4px 0 0", color: "#666" }}>
          Customers due for their 1st, 2nd, or 3rd free service, based on bill
          date.
        </p>
      </div>

      {loading && <p>Loading bills...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        <div style={{ display: "grid", gap: "16px" }}>
          {SERVICE_TIERS.map((tier, idx) => {
            const list = tierLists[idx];
            const overdueCount = list.filter(
              (item) => item.status.tone === "overdue",
            ).length;
            return (
              <Link
                key={tier.key}
                to={`/calling/${tier.key}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "18px 20px",
                  borderRadius: "10px",
                  border: "1px solid #e2e2e2",
                  background: "#fff",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
                    {tier.label}
                  </h2>
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "#888",
                      fontSize: "0.9rem",
                    }}
                  >
                    {list.length} customer{list.length === 1 ? "" : "s"} pending
                    {overdueCount > 0 ? ` • ${overdueCount} overdue` : ""}
                  </p>
                </div>
                <span style={{ fontSize: "1.3rem", color: "#888" }}>›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
