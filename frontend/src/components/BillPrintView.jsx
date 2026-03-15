import { useRef } from "react";

/**
 * Print-friendly view for a Bill (new scooty sale).
 */
export default function BillPrintView({ bill, onClose, onPrint }) {
  const printRef = useRef(null);

  if (!bill) return null;

  const formatDate = (d) => {
    if (!d) return "";
    if (typeof d === "string" && d.includes("/")) return d;
    try {
      const x = new Date(d);
      if (isNaN(x.getTime())) return d;
      const day = String(x.getDate()).padStart(2, "0");
      const month = String(x.getMonth() + 1).padStart(2, "0");
      const year = x.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return d;
    }
  };

  const modelDisplay = [
    bill.modelPurchased,
    bill.descriptionVariant ? `(${bill.descriptionVariant})` : "",
    bill.modelColor ? `(${bill.modelColor})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="bill-print-overlay">
      <div ref={printRef} style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div className="bill-print-actions">
          <h1>Bill</h1>
          <div className="btns">
            <button type="button" className="bills-btn-primary" onClick={onPrint}>Print</button>
            <button type="button" className="bills-btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
        <table>
          <tbody>
            <tr><td>Bill No.</td><td>{bill.billNo || "—"}</td></tr>
            <tr><td>Bill Date</td><td>{formatDate(bill.billDate)}</td></tr>
            <tr><td>Customer</td><td>{bill.customerName || "—"}</td></tr>
            <tr><td>Mobile</td><td>{bill.mobile || "—"}</td></tr>
            <tr><td>Address</td><td>{bill.address || "—"}</td></tr>
            <tr><td>Model</td><td>{modelDisplay || "—"}</td></tr>
            <tr><td>Warranty</td><td>{bill.warranty || "None"}</td></tr>
            <tr><td>Selling Price</td><td>₹{(bill.sellingPrice || 0).toFixed(2)}</td></tr>
            <tr><td>Discount</td><td>₹{(bill.discount || 0).toFixed(2)}</td></tr>
            <tr><td>Net Amount</td><td>₹{(bill.netAmount != null ? bill.netAmount : (bill.sellingPrice || 0) - (bill.discount || 0)).toFixed(2)}</td></tr>
            <tr><td>Customer Paid</td><td>₹{(bill.paidAmount || 0).toFixed(2)}</td></tr>
            <tr><td>Pending</td><td>₹{(bill.pendingAmount != null ? bill.pendingAmount : 0).toFixed(2)}</td></tr>
            <tr><td>Payment</td><td>{(bill.paymentMode || "cash").toUpperCase()}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
