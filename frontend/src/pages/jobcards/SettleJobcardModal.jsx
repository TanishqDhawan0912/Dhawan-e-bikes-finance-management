import { useState, useEffect } from "react";
import DatePicker from "../../components/DatePicker";

export default function SettleJobcardModal({ jobcard, onClose, onSuccess }) {
  const today = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState({
    paymentAmount: "",
    paymentMode: "cash",
  });
  const [datePickerValue, setDatePickerValue] = useState(today);
  const [loading, setLoading] = useState(false);
  const [partsWithPrices, setPartsWithPrices] = useState([]);

  // Load jobcard parts with prices
  useEffect(() => {
    if (jobcard && jobcard.parts) {
      setPartsWithPrices(jobcard.parts || []);
    }
  }, [jobcard]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleWheel = (e) => {
    // Prevent number input from changing value on scroll
    e.target.blur();
  };

  const handleNumberInputWheel = (e) => {
    const target = e.target;
    if (target && target.tagName === "INPUT" && target.type === "number") {
      target.blur();
    }
  };

  const calculatePartsTotal = () => {
    return partsWithPrices.reduce((sum, part) => {
      return sum + (part.price || 0) * (part.quantity || 1);
    }, 0);
  };

  const calculateBillTotal = () => {
    const partsTotal = calculatePartsTotal();
    const labour = jobcard.labour || 0;
    const discount = jobcard.discount || 0;
    return Math.max(0, partsTotal + labour - discount);
  };

  const getTotalPaid = () => {
    if (jobcard.paymentHistory && jobcard.paymentHistory.length > 0) {
      return jobcard.paymentHistory.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    }
    return jobcard.paidAmount || 0;
  };

  const getAllPayments = () => {
    let payments = [];
    
    // If paymentHistory exists and has entries, use it
    if (jobcard.paymentHistory && jobcard.paymentHistory.length > 0) {
      payments = [...jobcard.paymentHistory];
    } else if (jobcard.paidAmount && jobcard.paidAmount > 0) {
      // Otherwise, return initial payment if paidAmount exists
      payments = [{
        amount: jobcard.paidAmount,
        date: jobcard.date || new Date().toISOString().split("T")[0],
        paymentMode: jobcard.paymentMode || "cash",
      }];
    }
    
    // Sort payments by date in ascending order (oldest first)
    return payments.sort((a, b) => {
      const dateAStr = a.date || "";
      const dateBStr = b.date || "";
      
      // Handle dd/mm/yyyy format
      if (dateAStr.includes("/") && dateBStr.includes("/")) {
        const [dayA, monthA, yearA] = dateAStr.split("/").map(Number);
        const [dayB, monthB, yearB] = dateBStr.split("/").map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA - dateB;
      }
      
      // Fallback to standard date parsing
      const dateA = new Date(dateAStr);
      const dateB = new Date(dateBStr);
      return dateA - dateB;
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const paymentAmount = parseFloat(formData.paymentAmount) || 0;
      const billTotal = calculateBillTotal();
      const paidBefore = getTotalPaid();
      const currentPending = Math.max(0, billTotal - paidBefore);

      if (paymentAmount <= 0) {
        alert("Please enter a valid payment amount");
        setLoading(false);
        return;
      }

      if (paymentAmount > currentPending) {
        alert(`Payment amount cannot exceed pending amount of ₹${currentPending.toFixed(2)}`);
        setLoading(false);
        return;
      }

      if (!datePickerValue) {
        alert("Please select a payment date");
        setLoading(false);
        return;
      }

      const response = await fetch(`http://localhost:5000/api/jobcards/${jobcard._id}/settle`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: paymentAmount,
          paymentMode: formData.paymentMode,
          paymentDate: datePickerValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to settle payment");
      }

      const updatedJobcard = await response.json();
      // Prefer backend-derived pendingAmount when present.
      // Fallback derives pending = totalAmount - totalPaid (from paymentHistory or paidAmount).
      const serverPending =
        updatedJobcard.pendingAmount != null
          ? Number(updatedJobcard.pendingAmount) || 0
          : null;
      const totalPaidFromHistory = (updatedJobcard.paymentHistory || []).reduce(
        (sum, p) => sum + (p.amount || 0),
        0
      );
      const newPaid =
        totalPaidFromHistory > 0
          ? totalPaidFromHistory
          : Number(updatedJobcard.paidAmount) || 0;
      const newBillTotal = Number(updatedJobcard.totalAmount) || billTotal;
      const newPending =
        serverPending != null
          ? Math.max(0, serverPending)
          : Math.max(0, newBillTotal - newPaid);

      if (newPending === 0) {
        alert("Payment settled! Jobcard will be finalized.");
      } else {
        alert(`Payment recorded! ₹${newPending.toFixed(2)} still pending.`);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error settling payment:", error);
      alert(`Error settling payment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/jobcards/${jobcard._id}/finalize`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          labour: jobcard.labour || 0,
          discount: jobcard.discount || 0,
          paidAmount: getTotalPaid(),
          totalAmount: calculateBillTotal(),
          paymentMode: jobcard.paymentMode || "cash",
          pendingAmount: 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to finalize jobcard");
      }

      alert("Jobcard finalized successfully!");
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error finalizing jobcard:", error);
      alert(`Error finalizing jobcard: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!jobcard) return null;

  const partsTotal = calculatePartsTotal();
  const labour = jobcard.labour || 0;
  const discount = jobcard.discount || 0;
  const billTotal = calculateBillTotal();
  const totalPaid = getTotalPaid();
  const pendingAmount = Math.max(0, billTotal - totalPaid);
  const canFinalize = pendingAmount === 0;

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      // Check if date is already in dd/mm/yyyy format
      if (typeof dateString === "string" && dateString.includes("/")) {
        const parts = dateString.split("/");
        if (parts.length === 3) {
          // Already in dd/mm/yyyy format, return as is
          return dateString;
        }
      }
      // Try to parse as ISO date or other standard formats
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // If parsing failed, return the original string
        return dateString;
      }
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onWheelCapture={handleNumberInputWheel}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "0.5rem",
          width: "100%",
          maxWidth: "800px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "2rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ margin: 0 }}>Settle Payment - {jobcard.jobcardNumber}</h2>
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem",
              border: "none",
              backgroundColor: "transparent",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            ×
          </button>
        </div>

        {/* Jobcard Information */}
        <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#f9fafb", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
          <h3 style={{ marginBottom: "1rem", fontSize: "1rem" }}>Jobcard Information</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Customer</p>
              <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>{jobcard.customerName}</p>
            </div>
            <div>
              <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Mobile</p>
              <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>{jobcard.mobile}</p>
            </div>
          </div>
        </div>

        {/* Bill Breakdown */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Bill Breakdown</h3>
          <div style={{ padding: "1rem", backgroundColor: "#f9fafb", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Parts Total:</span>
                <span style={{ fontWeight: 500 }}>₹{partsTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Labour:</span>
                <span style={{ fontWeight: 500 }}>₹{labour.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Discount:</span>
                <span style={{ fontWeight: 500, color: "#dc2626" }}>-₹{discount.toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: "0.75rem",
                  borderTop: "2px solid #3b82f6",
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "#1e40af",
                }}
              >
                <span>Total Bill Amount:</span>
                <span>₹{billTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Payment History</h3>
          <div style={{ padding: "1rem", backgroundColor: "#f9fafb", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
            {getAllPayments().length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {getAllPayments().map((payment, index) => (
                  <div
                    key={index}
                    style={{
                      padding: "0.75rem",
                      backgroundColor: "white",
                      borderRadius: "0.375rem",
                      border: "1px solid #e5e7eb",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <p style={{ margin: "0 0 0.25rem 0", fontWeight: 500 }}>
                        ₹{payment.amount?.toFixed(2) || "0.00"}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>
                        {formatDate(payment.date)} • {payment.paymentMode?.toUpperCase() || "CASH"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "0.75rem", backgroundColor: "white", borderRadius: "0.375rem", border: "1px solid #e5e7eb" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280", fontStyle: "italic" }}>
                  No payments recorded yet
                </p>
              </div>
            )}
            <div
              style={{
                marginTop: "1rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 600,
              }}
            >
              <span>Paid Before:</span>
              <span style={{ color: "#059669" }}>₹{totalPaid.toFixed(2)}</span>
            </div>
            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 600,
                fontSize: "1.125rem",
                color: "#dc2626",
              }}
            >
              <span>Pending Amount:</span>
              <span>₹{pendingAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* New Payment */}
        {!canFinalize && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>Record New Payment</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  name="paymentAmount"
                  value={formData.paymentAmount}
                  onChange={handleInputChange}
                  onWheel={handleWheel}
                  placeholder="0.00"
                  min="0"
                  max={pendingAmount}
                  step="0.01"
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                    fontSize: "1rem",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
                  Payment Date
                </label>
                <DatePicker
                  value={datePickerValue}
                  onChange={(date) => {
                    setDatePickerValue(date);
                  }}
                  placeholder="dd/mm/yyyy"
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
                  Mode of Payment
                </label>
                <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", marginTop: "0.5rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", fontSize: "1rem" }}>
                    <input
                      type="radio"
                      name="paymentMode"
                      value="cash"
                      checked={formData.paymentMode === "cash"}
                      onChange={handleInputChange}
                      style={{ cursor: "pointer", width: "1.25rem", height: "1.25rem" }}
                    />
                    <span>Cash</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", fontSize: "1rem" }}>
                    <input
                      type="radio"
                      name="paymentMode"
                      value="upi"
                      checked={formData.paymentMode === "upi"}
                      onChange={handleInputChange}
                      style={{ cursor: "pointer", width: "1.25rem", height: "1.25rem" }}
                    />
                    <span>UPI</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              backgroundColor: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          {canFinalize ? (
            <button
              onClick={handleFinalize}
              disabled={loading}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {loading ? "Finalizing..." : "Finalize Jobcard"}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {loading ? "Saving..." : "Record Payment"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

