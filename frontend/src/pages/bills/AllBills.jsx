import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import DatePicker from "../../components/DatePicker";


import { fetchWithRetry } from "../../config/api";
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

function billDateToISO(billDate) {
  if (!billDate) return null;
  const s = String(billDate).trim();
  if (!s) return null;

  // Already ISO-ish
  if (s.includes("-")) return s.slice(0, 10);

  // Legacy dd/mm/yyyy
  if (s.includes("/")) {
    const parts = s.split("/");
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      if (!yyyy || !mm || !dd) return null;
      return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  return null;
}

function serviceDateToInput(dateStr) {
  // For <input type="date"> we need yyyy-mm-dd.
  // Accept both yyyy-mm-dd and legacy dd/mm/yyyy.
  const iso = billDateToISO(dateStr);
  return iso || "";
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
  const [searchParams] = useSearchParams();
  const focusBillId = (searchParams.get("billId") || "").trim();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | cleared
  const [billDateFilter, setBillDateFilter] = useState(""); // YYYY-MM-DD — show bills on this bill date only

  // Service management (stored as part of the Bill; up to 3 entries)
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceModalBill, setServiceModalBill] = useState(null);
  const [serviceModalEntries, setServiceModalEntries] = useState([
    { serviceNumber: "", date: "" },
    { serviceNumber: "", date: "" },
    { serviceNumber: "", date: "" },
  ]);
  const [serviceSaving, setServiceSaving] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [validatingPassword, setValidatingPassword] = useState(false);
  const [deletingPaymentIndex, setDeletingPaymentIndex] = useState({ id: null, index: null });

  const getTodayISO = () => new Date().toISOString().split("T")[0];

  const [showClearPendingModal, setShowClearPendingModal] = useState(false);
  const [billToClearPending, setBillToClearPending] = useState(null);
  const [clearPendingAmount, setClearPendingAmount] = useState(0);
  const [clearPendingPaymentMode, setClearPendingPaymentMode] = useState("cash");
  const [clearPendingDate, setClearPendingDate] = useState(getTodayISO());
  const [showPaymentDeleteModal, setShowPaymentDeleteModal] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState({
    bill: null,
    idx: null,
    pay: null,
  });

  useEffect(() => {
    fetchBills();
  }, []);

  useEffect(() => {
    if (!focusBillId || loading) return;
    const rafId = requestAnimationFrame(() => {
      const el = document.getElementById(`bill-card-${focusBillId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(rafId);
  }, [focusBillId, loading, bills]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await fetchWithRetry(`/bills`);
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

    // Single bill date filter (exact day)
    if (billDateFilter) {
      const iso = billDateToISO(bill.billDate);
      if (!iso || iso !== billDateFilter) return false;
    }

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
    setShowPassword(false);
    setPassword("");
    setPasswordError("");
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setValidatingPassword(true);
    try {
      const res = await fetchWithRetry(`/admin/auth`, {
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
      const res = await fetchWithRetry(`/bills/${billId}`, { method: "DELETE" });
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
      const res = await fetchWithRetry(`/bills/${bill._id}`, {
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

  const handleOpenClearPending = (bill) => {
    const pendingAmount = bill.pendingAmount || 0;
    if (pendingAmount <= 0) return;
    setBillToClearPending(bill);
    setClearPendingAmount(pendingAmount);
    setClearPendingPaymentMode((bill.paymentMode || "cash") || "cash");
    setClearPendingDate(getTodayISO());
    setShowClearPendingModal(true);
  };

  const handleOpenServiceMenu = (bill) => {
    setServiceModalBill(bill);
    setServiceModalOpen(true);

    const entries = Array.isArray(bill.services) ? bill.services : [];
    const nextEntries = Array.from({ length: 3 }, (_, i) => {
      const e = entries[i] || {};
      const fallbackNumber = `SVC-${i + 1}`;
      const existingNumber = String(e.serviceNumber ?? e.serviceNo ?? "").trim();
      return {
        serviceNumber: existingNumber || fallbackNumber,
        date: serviceDateToInput(e.date ?? ""),
      };
    });
    setServiceModalEntries(nextEntries);
  };

  const handleSaveServices = async () => {
    const bill = serviceModalBill;
    if (!bill) return;

    const sanitizedServices = Array.isArray(serviceModalEntries)
      ? serviceModalEntries
          .map((e) => ({
            serviceNumber: String(e.serviceNumber ?? "").trim(),
            date: String(e.date ?? "").trim(),
          }))
          .filter((s) => s.date)
          .slice(0, 3)
      : [];

    setServiceSaving(true);
    try {
      const res = await fetchWithRetry(`/bills/${bill._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: sanitizedServices }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Failed to save services");
      }

      setServiceModalOpen(false);
      setServiceModalBill(null);
      setServiceModalEntries([
        { serviceNumber: "", date: "" },
        { serviceNumber: "", date: "" },
        { serviceNumber: "", date: "" },
      ]);
      fetchBills();
    } catch (err) {
      alert("Error saving service details: " + (err.message || "Unknown error"));
    } finally {
      setServiceSaving(false);
    }
  };

  const handleClearPending = async () => {
    const bill = billToClearPending;
    if (!bill) return;
    const currentPending = Number(bill.pendingAmount) || 0;
    const amountToClear = Number(clearPendingAmount) || 0;
    if (amountToClear <= 0) return;
    if (amountToClear > currentPending) return;

    const history = Array.isArray(bill.paymentHistory)
      ? [...bill.paymentHistory]
      : [];

    const newPaid = (Number(bill.paidAmount) || 0) + amountToClear;
    const newPending = Math.max(0, currentPending - amountToClear);
    const newPaymentHistory = [
      ...history,
      {
        amount: amountToClear,
        date: clearPendingDate,
        time: "",
        paymentMode: clearPendingPaymentMode || "cash",
      },
    ];

    try {
      const res = await fetchWithRetry(`/bills/${bill._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentHistory: newPaymentHistory,
          paidAmount: newPaid,
          pendingAmount: newPending,
        }),
      });
      if (!res.ok) throw new Error("Failed to clear pending");
      setShowClearPendingModal(false);
      setBillToClearPending(null);
      setClearPendingAmount(0);
      fetchBills();
    } catch (err) {
      alert("Error clearing pending: " + (err.message || "Unknown error"));
    }
  };

  const getBatteryChargerTags = (bill) => {
    const tags = [];

    const formatType = (t) => {
      if (!t) return "";
      const s = String(t).trim();
      if (!s) return "";
      return s.charAt(0).toUpperCase() + s.slice(1);
    };

    // Battery badge
    if (bill.withBattery === false) {
      tags.push("Without battery");
    } else if (
      bill.batteryName ||
      bill.batteryTypeForBill ||
      bill.batteryVoltageForBill
    ) {
      const batteryBits = [];
      if (bill.batteryName) batteryBits.push(bill.batteryName);
      const t = formatType(bill.batteryTypeForBill);
      if (t && bill.batteryVoltageForBill)
        batteryBits.push(`${t} ${bill.batteryVoltageForBill}`);
      else if (t) batteryBits.push(t);
      else if (bill.batteryVoltageForBill) batteryBits.push(bill.batteryVoltageForBill);

      tags.push(`Battery: ${batteryBits.join(" • ")}`);
    } else {
      tags.push("With battery");
    }

    // Charger badge
    if (bill.withCharger === false) {
      tags.push("Without charger");
    } else if (
      bill.chargerName ||
      bill.chargerTypeForBill ||
      bill.chargerVoltageForBill
    ) {
      const chargerBits = [];
      if (bill.chargerName) chargerBits.push(bill.chargerName);
      const t = formatType(bill.chargerTypeForBill);
      if (t && bill.chargerVoltageForBill)
        chargerBits.push(`${t} ${bill.chargerVoltageForBill}`);
      else if (t) chargerBits.push(t);
      else if (bill.chargerVoltageForBill) chargerBits.push(bill.chargerVoltageForBill);

      tags.push(`Charger: ${chargerBits.join(" • ")}`);
    } else {
      tags.push("With charger");
    }

    return tags;
  };

  const getPaymentHistory = (bill) => {
    return Array.isArray(bill.paymentHistory) ? bill.paymentHistory : [];
  };

  const jobcardStyleButtons = {
    printEdit: {
      padding: "0.5rem 1rem",
      fontSize: "0.875rem",
      fontWeight: 500,
      borderRadius: "0.375rem",
      border: "1px solid #d1d5db",
      backgroundColor: "#ffffff",
      color: "#374151",
      cursor: "pointer",
    },
    service: {
      padding: "0.5rem 1rem",
      fontSize: "0.875rem",
      fontWeight: 500,
      borderRadius: "0.375rem",
      border: "none",
      backgroundColor: "#3b82f6",
      color: "white",
      cursor: "pointer",
    },
    settle: {
      padding: "0.5rem 1rem",
      fontSize: "0.875rem",
      fontWeight: 500,
      borderRadius: "0.375rem",
      border: "none",
      backgroundColor: "#3b82f6",
      color: "white",
      cursor: "pointer",
    },
    delete: {
      padding: "0.5rem 1rem",
      fontSize: "0.875rem",
      fontWeight: 500,
      borderRadius: "0.375rem",
      border: "none",
      backgroundColor: "#ef4444",
      color: "white",
      cursor: "pointer",
    },
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
        <div className="bills-toolbar-top-row">
          <div className="bills-search-wrap">
            <span className="bills-search-icon" aria-hidden>
              <FaSearch />
            </span>
            <input
              type="text"
              className="bills-search-input"
              placeholder="Search by customer, bill no., mobile or model"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search bills"
            />
          </div>

          <div
            className="bills-toolbar-date-block"
            role="group"
            aria-label="Filter by bill date"
          >
            <span className="bills-toolbar-date-label">Bill date</span>
            <div className="bills-toolbar-date-picker">
              <DatePicker
                value={billDateFilter}
                onChange={(v) => setBillDateFilter(v || "")}
                className="date-picker-modern"
                placeholder="dd/mm/yyyy"
                showCalendarIcon={false}
              />
            </div>
          </div>
        </div>

        <div className="bills-status-group">
          <span className="bills-status-label">Status:</span>
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
        </div>
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
            const oldScootyLabel = (bill.oldScootyExchange || "").trim();
            const oldScootyPrice = bill.oldScootyExchangePrice || 0;
            const hasOldScooty = !!oldScootyLabel || oldScootyPrice > 0;

            // Bill-owned services are edited in the Service modal.

            return (
              <div key={bill._id} id={`bill-card-${bill._id}`} className="bills-card">
                <div className="bills-card-header">
                  <h3 className="bills-card-title">Bill No. – {bill.billNo && bill.billNo.trim() ? bill.billNo : "—"}</h3>
                  <div className="bills-card-header-meta">
                    <span className={`bills-badge ${isPaid ? "bills-badge-paid" : "bills-badge-pending"}`}>
                      {isPaid ? "Paid" : "Pending"}
                    </span>
                    <span className="bills-card-header-payment">Payment: {paymentMode}</span>
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

                  <div style={{ marginBottom: hasOldScooty || accessoriesText || paymentHistory.length > 0 ? "1rem" : 0, padding: "0.75rem 1rem", backgroundColor: "#f0fdfa", borderRadius: "0.5rem", border: "1px dashed #99f6e4" }}>
                    <p className="bills-card-label" style={{ marginBottom: "0.5rem" }}>Battery / Charger</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {batteryChargerTags.map((tag, idx) => (
                        <span key={idx} className="bills-badge" style={{ backgroundColor: "#ccfbf1", color: "#134e4a", fontSize: "0.8rem" }}>{tag}</span>
                      ))}
                    </div>
                  </div>

                  {hasOldScooty && (
                    <div style={{ marginBottom: accessoriesText || paymentHistory.length > 0 ? "1rem" : 0, padding: "0.75rem 1rem", backgroundColor: "#ecfeff", borderRadius: "0.5rem", border: "1px dashed #67e8f9" }}>
                      <p className="bills-card-label" style={{ marginBottom: "0.5rem", color: "#0e7490", fontWeight: 600 }}>
                        Old Scooty Available
                      </p>
                      <p className="bills-card-value">
                        {oldScootyLabel || "—"}
                        {oldScootyPrice > 0 ? `, Price ₹${oldScootyPrice.toFixed(2)}` : ""}
                      </p>
                    </div>
                  )}

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
                              onClick={() => {
                                setPaymentToDelete({ bill, idx, pay });
                                setShowPaymentDeleteModal(true);
                              }}
                              disabled={deletingPaymentIndex.id === bill._id && deletingPaymentIndex.index === idx}
                              className="bills-payment-delete-btn"
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
                  <div className="bills-card-footer-left">
                    <span className="bills-card-footer-created">Created: {formatDateTimeCreated(bill.createdAt)}</span>
                  </div>
                  <div className="bills-card-actions">
                      <button
                        type="button"
                        className="bills-action-service"
                        onClick={() => handleOpenServiceMenu(bill)}
                        disabled={serviceSaving}
                        title="Service management"
                        style={jobcardStyleButtons.service}
                      >
                        Service
                      </button>
                      {totals.pending > 0 && (
                        <button
                          type="button"
                          className="bills-action-settle"
                          onClick={() => handleOpenClearPending(bill)}
                          style={jobcardStyleButtons.settle}
                        >
                          Clear Pending
                        </button>
                      )}
                      <button
                        type="button"
                        className="bills-action-edit"
                        onClick={() => handleEdit(bill)}
                        style={jobcardStyleButtons.printEdit}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="bills-action-delete"
                        onClick={() => handleDeleteClick(bill)}
                        style={jobcardStyleButtons.delete}
                      >
                        Delete
                      </button>
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
            <h3>Confirm Deletion</h3>
            <p>Please enter the admin password to delete this bill.</p>
            {billToDelete && (
              <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem" }}>
                <span style={{ fontWeight: 600 }}>Bill:</span>{" "}
                {billToDelete.billNo || "N/A"}
              </p>
            )}
            <form onSubmit={handlePasswordSubmit}>
              <div className="bills-password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="bills-password-input"
                />
                <button
                  type="button"
                  className="bills-eye-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10.5 10.5a3 3 0 0 0 4 4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6 6l12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && <p className="bills-modal-error">{passwordError}</p>}
              <div className="bills-form-actions">
                <button
                  type="button"
                  className="bills-btn-secondary"
                  style={jobcardStyleButtons.printEdit}
                  onClick={() => {
                    setShowPasswordModal(false);
                    setBillToDelete(null);
                    setPassword("");
                    setPasswordError("");
                  }}
                  disabled={validatingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bills-btn-primary"
                  disabled={validatingPassword}
                  style={jobcardStyleButtons.delete}
                >
                  {validatingPassword ? "Checking..." : "Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClearPendingModal && billToClearPending && (
        <div
          className="bills-modal-overlay"
          onClick={() => {
            setShowClearPendingModal(false);
            setBillToClearPending(null);
          }}
        >
          <div
            className="bills-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Clear pending payment</h3>
            <div className="bills-pending-summary">
              <span className="bills-pending-summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 6v6l4 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="bills-pending-summary-text">
                <div className="bills-pending-summary-label">
                  Pending amount to clear
                </div>
                <div className="bills-pending-summary-amount">
                  ₹{Number(billToClearPending.pendingAmount || 0).toFixed(2)}
                </div>
              </div>
            </div>

            {(() => {
              const currentPending = Number(billToClearPending.pendingAmount || 0);
              const amountToClear = Number(clearPendingAmount) || 0;
              const remainingAfter = Math.max(0, currentPending - amountToClear);
              const totalPaidAfter =
                (Number(billToClearPending.paidAmount) || 0) + amountToClear;
              const canClear = amountToClear > 0 && amountToClear <= currentPending;
              return (
                <div style={{ margin: "0 0 1rem 0" }}>
                  <div style={{ fontSize: "0.9rem", color: "#374151", marginBottom: "0.35rem" }}>
                    Remaining pending after this:{" "}
                    <b style={{ color: "#0e7490" }}>₹{remainingAfter.toFixed(2)}</b>
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#475569" }}>
                    Total paid after this:{" "}
                    <b style={{ color: "#15803d" }}>₹{totalPaidAfter.toFixed(2)}</b>
                  </div>
                  {!canClear && amountToClear > 0 && (
                    <div style={{ marginTop: "0.5rem", color: "#dc2626", fontSize: "0.85rem", fontWeight: 600 }}>
                      Enter an amount between 1 and ₹{currentPending.toFixed(2)}.
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="bills-modal-field">
              <label className="bills-modal-label">Amount (₹)</label>
              <input
                className="bills-modal-control"
                type="number"
                value={clearPendingAmount}
                min={0}
                step={1}
                onChange={(e) => setClearPendingAmount(e.target.value)}
              />
            </div>

            <div className="bills-modal-field">
              <label className="bills-modal-label">Payment mode</label>
              <select
                value={clearPendingPaymentMode}
                onChange={(e) => setClearPendingPaymentMode(e.target.value)}
                className="bills-modal-control"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
              </select>
            </div>

            <div className="bills-modal-field">
              <label className="bills-modal-label">Payment date</label>
              <div style={{ width: "100%" }}>
                <DatePicker
                  value={clearPendingDate}
                  onChange={(v) => setClearPendingDate(v)}
                  className="date-picker-modern"
                  placeholder="dd/mm/yyyy"
                />
              </div>
            </div>

            <div className="bills-form-actions">
              <button
                type="button"
                className="bills-btn-success"
                onClick={handleClearPending}
                disabled={
                  !(Number(clearPendingAmount) > 0) ||
                  Number(clearPendingAmount) >
                    Number(billToClearPending?.pendingAmount || 0)
                }
              >
                Clear Pending
              </button>
              <button
                type="button"
                className="bills-btn-secondary"
                onClick={() => {
                  setShowClearPendingModal(false);
                  setBillToClearPending(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {serviceModalOpen && serviceModalBill && (
        <div
          className="bills-modal-overlay"
          onClick={() => {
            if (serviceSaving) return;
            setServiceModalOpen(false);
            setServiceModalBill(null);
            setServiceModalEntries([
              { serviceNumber: "", date: "" },
              { serviceNumber: "", date: "" },
              { serviceNumber: "", date: "" },
            ]);
          }}
        >
          <div className="bills-modal bills-service-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Service Management</h3>
            <p>Add up to 3 free services for this bill.</p>

            <div className="bills-service-entries">
              {serviceModalEntries.map((entry, idx) => (
                <div key={idx} className="bills-service-entry">
                  <div className="bills-service-entry-title">Service {idx + 1}</div>
                  <div className="bills-service-entry-controls">
                    <div className="bills-service-date-wrap">
                      <DatePicker
                        value={entry.date}
                        onChange={(v) => {
                          setServiceModalEntries((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], date: v };
                            return next;
                          });
                        }}
                        className="date-picker-modern bills-service-date-field-jobcard"
                        placeholder="dd/mm/yyyy"
                        showCalendarIcon={false}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bills-form-actions">
              <button
                type="button"
                className="bills-btn-secondary"
                style={jobcardStyleButtons.printEdit}
                onClick={() => {
                  if (serviceSaving) return;
                  setServiceModalOpen(false);
                  setServiceModalBill(null);
                  setServiceModalEntries([
                    { serviceNumber: "", date: "" },
                    { serviceNumber: "", date: "" },
                    { serviceNumber: "", date: "" },
                  ]);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bills-btn-primary"
                style={jobcardStyleButtons.service}
                onClick={handleSaveServices}
                disabled={serviceSaving}
              >
                {serviceSaving ? "Saving..." : "Save Services"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentDeleteModal && paymentToDelete.bill && (
        <div
          className="payment-delete-modal-overlay"
          onClick={() => {
            setShowPaymentDeleteModal(false);
            setPaymentToDelete({ bill: null, idx: null, pay: null });
          }}
        >
          <div
            className="payment-delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Delete payment history</h3>
            <p>Are you sure you want to delete this payment entry?</p>

            {paymentToDelete.pay && (
              <div className="payment-delete-modal-details">
                <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
                  ₹{(paymentToDelete.pay.amount || 0).toFixed(2)} on{" "}
                  {formatDateShort(paymentToDelete.pay.date)}
                </div>
                {formatPaymentTime(paymentToDelete.pay.time) ? (
                  <div style={{ color: "#475569", fontSize: "0.9rem" }}>
                    {formatPaymentTime(paymentToDelete.pay.time)}
                  </div>
                ) : null}
              </div>
            )}

            <div className="payment-delete-modal-actions">
              <button
                type="button"
                className="payment-delete-btn-cancel"
                onClick={() => {
                  setShowPaymentDeleteModal(false);
                  setPaymentToDelete({ bill: null, idx: null, pay: null });
                }}
                disabled={
                  deletingPaymentIndex.id === paymentToDelete.bill._id &&
                  deletingPaymentIndex.index === paymentToDelete.idx
                }
              >
                Cancel
              </button>
              <button
                type="button"
                className="payment-delete-btn-confirm"
                disabled={
                  deletingPaymentIndex.id === paymentToDelete.bill._id &&
                  deletingPaymentIndex.index === paymentToDelete.idx
                }
                onClick={async () => {
                  const { bill, idx } = paymentToDelete;
                  setShowPaymentDeleteModal(false);
                  setPaymentToDelete({ bill: null, idx: null, pay: null });
                  if (!bill || idx == null) return;
                  await handleDeletePayment(bill, idx);
                }}
              >
                {deletingPaymentIndex.id === paymentToDelete.bill._id &&
                deletingPaymentIndex.index === paymentToDelete.idx
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
