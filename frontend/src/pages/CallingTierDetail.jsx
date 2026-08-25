import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  SERVICE_TIERS,
  formatDate,
  useCallingTiers,
} from "../utils/callingService";

export default function CallingTierDetail() {
  const { tierKey } = useParams();
  const tierIndex = Number(tierKey);
  const tier = SERVICE_TIERS[tierIndex];
  const { tierLists, loading, error } = useCallingTiers();
  const [search, setSearch] = useState("");

  const list = tierLists[tierIndex] || [];

  const filteredList = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      ({ bill }) =>
        String(bill.customerName || "")
          .toLowerCase()
          .includes(term) ||
        String(bill.mobile || "").includes(term) ||
        String(bill.modelPurchased || "")
          .toLowerCase()
          .includes(term),
    );
  }, [list, search]);

  if (!tier) {
    return (
      <div style={{ padding: "24px" }}>
        <p>Unknown service tier.</p>
        <Link to="/calling">← Back to Calling</Link>
      </div>
    );
  }

  return (
    <div
      className="calling-root"
      style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}
    >
      <div style={{ marginBottom: "16px" }}>
        <Link to="/calling" className="calling-back-btn">
          <span aria-hidden="true">←</span> Back to Calling
        </Link>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "1.6rem" }}>{tier.label}</h1>
        <p style={{ margin: "4px 0 0", color: "#666" }}>
          {list.length} customer{list.length === 1 ? "" : "s"} pending for
          this service.
        </p>
      </div>

      <input
        type="text"
        placeholder="Search by customer name, mobile, or model..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 14px",
          marginBottom: "20px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          fontSize: "0.95rem",
        }}
      />

      {loading && <p>Loading bills...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading &&
        !error &&
        (filteredList.length === 0 ? (
          <p style={{ color: "#999" }}>No pending customers.</p>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {filteredList.map(({ bill, dueDate, status }) => (
              <div
                key={bill._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background:
                    status.tone === "overdue"
                      ? "#fdecea"
                      : status.tone === "today"
                        ? "#fff8e1"
                        : "#f4f7fb",
                }}
              >
                <div>
                  <strong>{bill.customerName}</strong>{" "}
                  <span style={{ color: "#666" }}>({bill.mobile})</span>
                  <div style={{ fontSize: "0.85rem", color: "#777" }}>
                    {bill.modelPurchased} • Bill date: {bill.billDate} • Due:{" "}
                    {formatDate(dueDate)}
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color:
                        status.tone === "overdue"
                          ? "#c0392b"
                          : status.tone === "today"
                            ? "#b8860b"
                            : "#2c6ecb",
                    }}
                  >
                    {status.label}
                  </span>
                  <a
                    href={`tel:${bill.mobile}`}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      background: "#2c6ecb",
                      color: "#fff",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                    }}
                  >
                    📞 Call
                  </a>
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
