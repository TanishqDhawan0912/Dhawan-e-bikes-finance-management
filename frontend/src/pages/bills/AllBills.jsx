import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BillPrintView from "../../components/BillPrintView";

const API = "http://localhost:5000/api";

function formatDateShort(dateString) {
  if (!dateString) return "N/A";
  try {
    if (typeof dateString === "string" && dateString.includes("/")) {
      const parts = dateString.split("/");
      if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2) return dateString;
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
}

function formatDateTimeCreated(dateString) {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const dateStr = formatDateShort(d.toISOString().split("T")[0]);
    const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${dateStr} | ${timeStr}`;
  } catch {
    return dateString;
  }
}

function formatPaymentTime(timeStr) {
  if (!timeStr || timeStr === "") return "";
  return timeStr;
}

function getModelDisplay(bill) {
  if (!bill) return "—";
  const parts = [bill.modelPurchased, bill.descriptionVariant ? `(${bill.descriptionVariant})` : "", bill.modelColor ? `(${bill.modelColor})` : ""].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

function getAccessoryDisplay(bill) {
  if (!bill) return "";
  if (Array.isArray(bill.accessoryDetails) && bill.accessoryDetails.length > 0) {
    const names = bill.accessoryDetails
      .map((a) => a && a.name)
      .filter(Boolean);
    if (names.length) return names.join(", ");
  }
  if (bill.accessoryIncluded && String(bill.accessoryIncluded).trim()) {
    return String(bill.accessoryIncluded).trim();
  }
  return "";
}

export default function AllBills() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | cleared
  const [printingBill, setPrintingBill] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [validatingPassword, setValidatingPassword] = useState(false);
  const [deletingPaymentIndex, setDeletingPaymentIndex] = useState({ id: null, index: null });

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/bills`);
      if (!res.ok) throw new Error("Failed to fetch bills");
      const data = await res.json();
      setBills(data);
    } catch (err) {
      console.error(err);
      alert("Error loading bills: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const getBillTotals = (bill) => {
    const sellingPrice = bill.sellingPrice ?? 0;
    const discount = bill.discount ?? 0;
    const netAmount = bill.netAmount != null ? bill.netAmount : sellingPrice - discount;
    const paid = bill.paidAmount ?? 0;
    const pending = bill.pendingAmount != null ? bill.pendingAmount : Math.max(0, netAmount - paid);
    return { sellingPrice, discount, netAmount, paid, pending };
  };

  const filteredBills = bills.filter((bill) => {
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" && (bill.pendingAmount || 0) > 0) ||
      (statusFilter === "cleared" && (bill.pendingAmount || 0) === 0);
    if (!matchStatus) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const billNo = (bill.billNo || "").toLowerCase();
    const customer = (bill.customerName || "").toLowerCase();
    const mobile = (bill.mobile || "").toLowerCase();
    const model = (bill.modelPurchased || "").toLowerCase();
    const address = (bill.address || "").toLowerCase();
    return billNo.includes(s) || customer.includes(s) || mobile.includes(s) || model.includes(s) || address.includes(s);
  });

  const pendingCount = bills.filter((b) => (b.pendingAmount || 0) > 0).length;
  const clearedCount = bills.filter((b) => (b.pendingAmount || 0) === 0).length;

  const handleEdit = (bill) => {
    navigate(`/bills/edit?id=${bill._id}`);
  };

  const handleDeleteClick = (bill) => {
    setBillToDelete(bill);
    setShowPasswordModal(true);
    setPassword("");
    setPasswordError("");
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setValidatingPassword(true);
    try {
      const res = await fetch(`${API}/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ securityKey: password }),
      });
      const data = await res.json();
      if (res.ok && data.success && billToDelete) {
        await deleteBill(billToDelete._id);
      } else {
        setPasswordError("Incorrect admin password. Please try again.");
      }
    } catch (err) {
      setPasswordError("Error validating password. Please try again.");
    } finally {
      setValidatingPassword(false);
    }
  };

  const deleteBill = async (billId) => {
    try {
      const res = await fetch(`${API}/bills/${billId}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to delete bill");
      }
      setShowPasswordModal(false);
      setPassword("");
      setBillToDelete(null);
      fetchBills();
    } catch (err) {
      alert("Error: " + err.message);
      setShowPasswordModal(false);
      setPassword("");
      setBillToDelete(null);
    }
  };

  const handleDeletePayment = async (bill, paymentIndex) => {
    const history = Array.isArray(bill.paymentHistory) ? [...bill.paymentHistory] : [];
    if (paymentIndex < 0 || paymentIndex >= history.length) return;
    history.splice(paymentIndex, 1);
    const newPaid = history.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totals = getBillTotals(bill);
    const newPending = Math.max(0, totals.netAmount - newPaid);
    setDeletingPaymentIndex({ id: bill._id, index: paymentIndex });
    try {
      const res = await fetch(`${API}/bills/${bill._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentHistory: history,
          paidAmount: newPaid,
          pendingAmount: newPending,
        }),
      });
      if (!res.ok) throw new Error("Failed to update payment");
      fetchBills();
    } catch (err) {
      alert("Error removing payment: " + err.message);
    } finally {
      setDeletingPaymentIndex({ id: null, index: null });
    }
  };

  const getBatteryChargerTags = (bill) => {
    const tags = [];
    tags.push(bill.withBattery !== false ? "With battery" : "Without battery");
    tags.push(bill.withCharger !== false ? "With charger" : "Without charger");
    return tags;
  };

  const getPaymentHistory = (bill) => {
    return Array.isArray(bill.paymentHistory) ? bill.paymentHistory : [];
  };

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ textAlign: "center", padding: "2rem" }}>Loading bills...</div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ minWidth: 0 }}>
      <div className="bills-toolbar">
        <div className="bills-filter-group">
          <button
            type="button"
            className={`bills-filter-chip ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All ({bills.length})
          </button>
          <button
            type="button"
            className={`bills-filter-chip ${statusFilter === "pending" ? "active" : ""}`}
            onClick={() => setStatusFilter("pending")}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            className={`bills-filter-chip ${statusFilter === "cleared" ? "active" : ""}`}
            onClick={() => setStatusFilter("cleared")}
          >
            Cleared ({clearedCount})
          </button>
        </div>
        <input
          type="text"
          className="bills-search-input"
          placeholder="Search by customer, bill no., mobile or registration number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredBills.length === 0 ? (
        <div className="bills-empty-state">
          <p>{bills.length === 0 ? "No bills found." : "No bills match your search or filter."}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {filteredBills.map((bill) => {
            const totals = getBillTotals(bill);
            const isPaid = totals.pending <= 0;
            const paymentMode = (bill.paymentMode || "cash").toUpperCase();
            const modelDisplay = getModelDisplay(bill);
            const warrantyDisplay = bill.warranty && String(bill.warranty).trim() ? bill.warranty : "None";
            const batteryChargerTags = getBatteryChargerTags(bill);
            const paymentHistory = getPaymentHistory(bill);
            const accessoriesText = getAccessoryDisplay(bill);

            return (
              <div key={bill._id} className="bills-card">
                <div className="bills-card-header">
                  <h3 className="bills-card-title">Bill No. – {bill.billNo && bill.billNo.trim() ? bill.billNo : "—"}</h3>
                  <div className="bills-card-meta">
                    <span style={{ fontSize: "0.8rem", color: "#4b5563", marginRight: "0.75rem" }}>
                      Date: {formatDateShort(bill.billDate)}
                    </span>
                    <span className={`bills-badge ${isPaid ? "bills-badge-paid" : "bills-badge-pending"}`}>
                      {isPaid ? "Paid" : "Pending"}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#0f766e" }}>Payment: {paymentMode}</span>
                  </div>
                </div>

                <div className="bills-card-body">
                  <div className="bills-card-grid" style={{ marginBottom: "1rem" }}>
                    <div>
                      <p className="bills-card-label">Customer</p>
                      <p className="bills-card-value">{bill.customerName || "—"}</p>
                    </div>
                    <div>
                      <p className="bills-card-label">Mobile</p>
                      <p className="bills-card-value">{bill.mobile || "—"}</p>
                    </div>
                    <div>
                      <p className="bills-card-label">Model</p>
                      <p className="bills-card-value">{modelDisplay}</p>
                    </div>
                    <div>
                      <p className="bills-card-label">Warranty</p>
                      <p className="bills-card-value">{warrantyDisplay}</p>
                    </div>
                    <div>
                      <p className="bills-card-label">Address</p>
                      <p className="bills-card-value">{bill.address || "—"}</p>
                    </div>
                  </div>
                  <div className="bills-card-grid" style={{ marginBottom: paymentHistory.length > 0 || batteryChargerTags.length ? "1rem" : 0 }}>
                    <div>
                      <p className="bills-card-label">Selling Price</p>
                      <p className="bills-card-value">₹{totals.sellingPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="bills-card-label">Discount</p>
                      <p className="bills-card-value">₹{totals.discount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="bills-card-label">Net Amount</p>
                      <p className="bills-card-value highlight">₹{totals.netAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="bills-card-label">Customer Paid</p>
                      <p className="bills-card-value">₹{totals.paid.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="bills-card-label">Pending</p>
                      <p className="bills-card-value">₹{totals.pending.toFixed(2)}</p>
                    </div>
                  </div>

                  <div style={{ marginBottom: paymentHistory.length > 0 ? "1rem" : 0, padding: "0.75rem 1rem", backgroundColor: "#f0fdfa", borderRadius: "0.5rem", border: "1px dashed #99f6e4" }}>
                    <p className="bills-card-label" style={{ marginBottom: "0.5rem" }}>Battery / Charger</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {batteryChargerTags.map((tag, idx) => (
                        <span key={idx} className="bills-badge" style={{ backgroundColor: "#ccfbf1", color: "#134e4a", fontSize: "0.8rem" }}>{tag}</span>
                      ))}
                    </div>
                  </div>

                  {accessoriesText && (
                    <div style={{ marginBottom: paymentHistory.length > 0 ? "1rem" : 0, padding: "0.75rem 1rem", backgroundColor: "#eff6ff", borderRadius: "0.5rem", border: "1px dashed #bfdbfe" }}>
                      <p className="bills-card-label" style={{ marginBottom: "0.5rem", color: "#1d4ed8" }}>Accessories included</p>
                      <p className="bills-card-value">{accessoriesText}</p>
                    </div>
                  )}

                  {paymentHistory.length > 0 && (
                    <div style={{ padding: "0.75rem 1rem", backgroundColor: "#f5f3ff", borderRadius: "0.5rem", border: "1px dashed #c4b5fd" }}>
                      <p className="bills-card-label" style={{ marginBottom: "0.5rem", color: "#5b21b6" }}>Payment History</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {paymentHistory.map((pay, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.875rem" }}>
                              ₹{(pay.amount || 0).toFixed(2)} on {formatDateShort(pay.date)}
                              {formatPaymentTime(pay.time) ? ` | ${formatPaymentTime(pay.time)}` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(bill, idx)}
                              disabled={deletingPaymentIndex.id === bill._id && deletingPaymentIndex.index === idx}
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", fontWeight: 500, color: "#dc2626", background: "none", border: "none", cursor: deletingPaymentIndex.id === bill._id ? "not-allowed" : "pointer" }}
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bills-card-footer">
                  <span>Created: {formatDateTimeCreated(bill.createdAt)}</span>
                  <div className="bills-card-actions">
                    <button type="button" className="bills-action-print" onClick={() => setPrintingBill(bill)}>Print</button>
                    <button type="button" className="bills-action-edit" onClick={() => handleEdit(bill)}>Edit</button>
                    <button type="button" className="bills-action-delete" onClick={() => handleDeleteClick(bill)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPasswordModal && (
        <div
          className="bills-modal-overlay"
          onClick={() => {
            if (!validatingPassword) {
              setShowPasswordModal(false);
              setBillToDelete(null);
              setPassword("");
              setPasswordError("");
            }
          }}
        >
          <div className="bills-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete bill</h3>
            <p>Enter admin password to delete this bill.</p>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
              />
              {passwordError && <p className="bills-modal-error">{passwordError}</p>}
              <div className="bills-form-actions">
                <button type="submit" className="bills-btn-primary" disabled={validatingPassword} style={{ background: "#dc2626", boxShadow: "0 2px 8px rgba(220,38,38,0.3)" }}>
                  {validatingPassword ? "Checking..." : "Delete"}
                </button>
                <button
                  type="button"
                  className="bills-btn-secondary"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setBillToDelete(null);
                    setPassword("");
                    setPasswordError("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printingBill && (
        <BillPrintView
          bill={printingBill}
          onClose={() => setPrintingBill(null)}
          onPrint={() => window.print()}
        />
      )}
    </div>
  );
}
