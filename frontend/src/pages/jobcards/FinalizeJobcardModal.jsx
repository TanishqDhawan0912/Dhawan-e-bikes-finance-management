import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DatePicker from "../../components/DatePicker";
import { getTodayForInput } from "../../utils/dateUtils";

import { API_BASE } from "../../config/api";
export default function FinalizeJobcardModal({ jobcard, onClose, onSuccess, onEdit }) {
  const navigate = useNavigate();
  const today = getTodayForInput();
  const [formData, setFormData] = useState({
    labour: "",
    discount: "",
    paidAmount: "",
    paymentMode: "cash",
    pendingAmount: "",
  });
  const [paymentDate, setPaymentDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [showZeroPaidWarning, setShowZeroPaidWarning] = useState(false);
  const [partsWithPrices, setPartsWithPrices] = useState([]);

  // Load jobcard parts with prices
  useEffect(() => {
    if (jobcard && jobcard.parts) {
      setPartsWithPrices(jobcard.parts || []);
    }
  }, [jobcard]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      // Allow user to fully clear numeric fields without them being auto-filled again
      if (value === "" && (name === "paidAmount" || name === "pendingAmount" || name === "discount")) {
        // If paidAmount is cleared, also clear discount so user can type it manually
        if (name === "paidAmount") {
          newData.discount = "";
        }
        return newData;
      }

      // Auto-calculate discount whenever paid/pending/labour change (discount field stays disabled in this mode)
      // Formula: discount = (Parts Total + Labour) - (Amount Paid + Pending Amount)
      if (name === "paidAmount" || name === "pendingAmount" || name === "labour") {
        const partsTotal = calculatePartsTotal();
        const labour = parseFloat(name === "labour" ? value : prev.labour) || 0;
        const totalBill = partsTotal + labour;

        const paid =
          name === "paidAmount"
            ? parseFloat(value) || 0
            : parseFloat(prev.paidAmount) || 0;
        const pending =
          name === "pendingAmount"
            ? parseFloat(value) || 0
            : parseFloat(prev.pendingAmount) || 0;

        // Only auto-calc when there is some paid amount (this is the "auto" mode)
        if (prev.paidAmount !== "" || name === "paidAmount") {
          const calculatedDiscount = Math.max(0, totalBill - paid - pending);
          newData.discount = calculatedDiscount.toFixed(2);
        }
      }

      return newData;
    });
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
    // Only include service + sales parts in billing total.
    // Replacement parts (warranty replacements) should not add to the bill.
    return partsWithPrices.reduce((sum, part) => {
      if (part.partType === "replacement" || part.replacementType) {
        return sum;
      }
      return sum + (part.price || 0) * (part.quantity || 1);
    }, 0);
  };

  const calculateBillTotal = () => {
    const partsTotal = calculatePartsTotal();
    const labour = parseFloat(formData.labour) || 0;
    const discount = parseFloat(formData.discount) || 0;
    return Math.max(0, partsTotal + labour - discount);
  };

  const getWarrantyTagForPart = (part) => {
    const isBattery =
      part?.salesType === "battery" || part?.replacementType === "battery";
    const isCharger =
      part?.salesType === "charger" || part?.replacementType === "charger";
    if (!isBattery && !isCharger) return null;

    const ws = String(part?.warrantyStatus ?? "").toLowerCase();
    const isWarranty =
      ws &&
      ws !== "nowarranty" &&
      ws !== "no warranty" &&
      ws !== "withoutwarranty" &&
      ws !== "without warranty" &&
      ws !== "none";
    return isWarranty ? "W" : "NW";
  };

  const partShowsCustomerOldChargerTradeIn = (part) => {
    if (!part) return false;
    if (String(part.partType || "").toLowerCase() !== "sales") return false;
    if (String(part.salesType || "").toLowerCase() !== "charger") return false;
    return (
      part.oldChargerAvailable === true ||
      String(part.oldChargerAvailable) === "true"
    );
  };

  const customerOldChargerTradeInSummary = (part) => {
    const v = String(part?.oldChargerVoltage || "").trim();
    const w = String(part?.oldChargerWorking || "").toLowerCase();
    const workingLabel =
      w === "notworking" || w === "not_working" || w === "not working"
        ? "Not working"
        : "Working";
    const bits = [];
    if (v) bits.push(v);
    bits.push(workingLabel);
    return bits.join(" · ");
  };

  const handleSubmit = async (options = {}) => {
    const { mode, skipZeroWarning } = options || {};
    const totalAmount = calculateBillTotal();
    const paidAmount = parseFloat(formData.paidAmount) || 0;
    const pendingFormAmount = parseFloat(formData.pendingAmount) || 0;
    const forceFinalize = mode === "finalize";

    // Warn only when nothing is recorded against the bill: ₹0 paid and ₹0 pending,
    // but the bill total is still > 0. If pending > 0, that already accounts for the balance.
    if (
      paidAmount === 0 &&
      pendingFormAmount === 0 &&
      totalAmount > 0 &&
      !showZeroPaidWarning &&
      !skipZeroWarning
    ) {
      setShowZeroPaidWarning(true);
      return;
    }

    try {
      setLoading(true);
      const partsTotal = calculatePartsTotal();
      const labour = parseFloat(formData.labour) || 0;
      const discount = parseFloat(formData.discount) || 0;

      let pendingAmount = parseFloat(formData.pendingAmount) || 0;
      // When user explicitly chooses a mode from the zero-payment dialog:
      // - "pending": keep full bill as pending
      // - "finalize": force finalize (no pending)
      if (mode === "pending") {
        pendingAmount = totalAmount;
      } else if (mode === "finalize") {
        pendingAmount = 0;
      }

      if (!forceFinalize && paidAmount > 0 && !paymentDate) {
        alert("Please select a payment date");
        setLoading(false);
        return;
      }

      const body = forceFinalize
        ? {
            labour,
            discount,
            paymentMode: formData.paymentMode,
            forceFinalize: true,
          }
        : {
            labour,
            discount,
            paidAmount,
            totalAmount,
            paymentMode: formData.paymentMode,
            pendingAmount,
            paymentDate,
          };

      const response = await fetch(`${API_BASE}/jobcards/${jobcard._id}/finalize`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save jobcard");
      }

      if (!forceFinalize && pendingAmount > 0) {
        alert("Jobcard saved with pending payment!");
      } else {
        alert("Jobcard finalized successfully!");
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving jobcard:", error);
      alert(`Error saving jobcard: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!jobcard) return null;

  const partsTotal = calculatePartsTotal();
  const labour = parseFloat(formData.labour) || 0;
  const discount = parseFloat(formData.discount) || 0;
  const billTotal = calculateBillTotal();
  const grossTotal = partsTotal + labour; // Total before discount
  const priceAfterDiscount = Math.max(0, grossTotal - discount); // Final amount after discount
  const paidAmount = parseFloat(formData.paidAmount) || 0;
  const pendingFormAmount = parseFloat(formData.pendingAmount) || 0;
  const balance = billTotal - paidAmount;
  /** Hide discount explainer when user split is "₹0 paid + pending > 0" (pending already covers the plan). */
  const hideDiscountFormulaHint =
    paidAmount === 0 && pendingFormAmount > 0;

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
          <h2 style={{ margin: 0 }}>Finalize Jobcard - {jobcard.jobcardNumber}</h2>
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

        {/* Bill Breakdown - Parts */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>Bill Breakdown</h3>
            <button
              type="button"
              onClick={() => {
                if (onEdit) {
                  onEdit();
                } else {
                  navigate("/spares/add");
                }
              }}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              + Add Spare
            </button>
          </div>
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#f9fafb",
              borderRadius: "0.5rem",
              border: "1px solid #e5e7eb",
            }}
          >
            {partsWithPrices.length > 0 ? (
              <div style={{ marginBottom: "1rem" }}>
                <h4 style={{ marginBottom: "0.75rem", fontSize: "0.875rem", color: "#6b7280", fontWeight: 600 }}>
                  Parts
                </h4>
                {partsWithPrices.map((part, index) => {
                  const qty = part.quantity || 1;
                  const price = part.price || 0;
                  const isReplacement =
                    part.partType === "replacement" || part.replacementType;
                  const lineAmount = isReplacement ? 0 : price * qty;

                  // Build display name: SpareName (Color) <tags/models>
                  const tags = [];
                  if (
                    part.salesType === "battery" ||
                    part.replacementType === "battery"
                  ) {
                    tags.push("battery");
                  }
                  if (
                    part.salesType === "charger" ||
                    part.replacementType === "charger"
                  ) {
                    tags.push("charger");
                  }
                  if (isReplacement) {
                    tags.push("replacement");
                  }
                  // If this is a generic spare (no type tags), append model names when present
                  const modelNames = Array.isArray(part.models)
                    ? part.models.filter(Boolean)
                    : [];
                  if (!tags.length && modelNames.length) {
                    tags.push(...modelNames);
                  }

                  const typeSuffix = tags.length ? ` <${tags.join(", ")}>` : "";
                  let label = part.spareName;
                  if (part.salesType === "oldScooty") {
                    const rawPmc = String(part.pmcNo || "").trim();
                    const pmcDisplay = rawPmc
                      ? `PMC-${rawPmc.replace(/^PMC-?/i, "")}`
                      : "";
                    label = pmcDisplay
                      ? `Old Scooty - ${label} (${pmcDisplay})`
                      : `Old Scooty - ${label}`;
                  }
                  if (part.selectedColor) {
                    label += ` (${part.selectedColor})`;
                  }
                  const nameWithTypes = `${label}${typeSuffix}`;
                  const warrantyTag = getWarrantyTagForPart(part);
                  const warrantyStyles =
                    warrantyTag === "W"
                      ? { backgroundColor: "#dcfce7", color: "#166534", borderColor: "#86efac" }
                      : warrantyTag === "NW"
                      ? { backgroundColor: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }
                      : null;

                  const scrapQty =
                    part.partType === "sales" &&
                    part.salesType === "battery" &&
                    part.scrapAvailable &&
                    (Number(part.scrapQuantity) || 0) > 0
                      ? Math.max(0, Number(part.scrapQuantity) || 0)
                      : 0;
                  const showOldChargerTrade =
                    partShowsCustomerOldChargerTradeIn(part);
                  const partRowHasExtraNote = scrapQty > 0 || showOldChargerTrade;

                  return (
                    <div
                      key={index}
                      style={{
                        padding: "0.75rem",
                        marginBottom: "0.5rem",
                        backgroundColor: "white",
                        borderRadius: "0.375rem",
                        border: "1px solid #e5e7eb",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: partRowHasExtraNote ? "flex-start" : "center",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            margin: "0 0 0.25rem 0",
                            fontWeight: 500,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <span>{nameWithTypes}</span>
                          {warrantyTag && warrantyStyles && (
                            <span
                              style={{
                                padding: "0.1rem 0.45rem",
                                borderRadius: "0.35rem",
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                border: `1px solid ${warrantyStyles.borderColor}`,
                                backgroundColor: warrantyStyles.backgroundColor,
                                color: warrantyStyles.color,
                                lineHeight: 1.2,
                              }}
                              title={warrantyTag === "W" ? "Warranty" : "No Warranty"}
                            >
                              {warrantyTag}
                            </span>
                          )}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.875rem",
                            color: "#6b7280",
                          }}
                        >
                          Qty: {qty} × ₹{price.toFixed(2)}
                        </p>
                        {scrapQty > 0 && (
                          <p
                            style={{
                              margin: "0.35rem 0 0",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: "#92400e",
                              backgroundColor: "#fffbeb",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              border: "1px solid #fcd34d",
                              display: "inline-block",
                            }}
                            title={
                              String(part.batteryOldNew || "").toLowerCase() ===
                              "new"
                                ? "Old batteries received with this new battery sale"
                                : "Scrap received with this old battery sale"
                            }
                          >
                            Customer scrap available: ×{scrapQty}
                          </p>
                        )}
                        {showOldChargerTrade && (
                          <p
                            style={{
                              margin: "0.35rem 0 0",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: "#92400e",
                              backgroundColor: "#fffbeb",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              border: "1px solid #fcd34d",
                              display: "inline-block",
                            }}
                            title={
                              part.oldChargerName
                                ? `Customer old charger: ${part.oldChargerName}`
                                : "Old charger received from customer with this charger sale"
                            }
                          >
                            Customer old charger:{" "}
                            {customerOldChargerTradeInSummary(part)}
                          </p>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: "#059669",
                          paddingTop: partRowHasExtraNote ? "0.125rem" : 0,
                        }}
                      >
                        ₹{lineAmount.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
                <div
                  style={{
                    paddingTop: "0.75rem",
                    borderTop: "1px solid #e5e7eb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontWeight: 600,
                  }}
                >
                  <span>Parts Total:</span>
                  <span>₹{partsTotal.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p style={{ color: "#6b7280", fontStyle: "italic" }}>No parts added</p>
            )}
          </div>
        </div>

        {/* Labour and Discount Fields */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Additional Charges</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
                Labour (₹)
              </label>
              <input
                type="number"
                name="labour"
                value={formData.labour}
                onChange={handleInputChange}
                onWheel={handleWheel}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
                Discount (₹) {formData.paidAmount && <span style={{ color: "#6b7280", fontSize: "0.75rem", fontWeight: 400 }}>(Auto-calculated)</span>}
              </label>
              <input
                type="number"
                name="discount"
                value={formData.discount}
                onChange={handleInputChange}
                onWheel={handleWheel}
                placeholder="0.00"
                min="0"
                step="0.01"
                readOnly={formData.paidAmount !== ""}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  backgroundColor: formData.paidAmount !== "" ? "#f3f4f6" : "white",
                  cursor: formData.paidAmount !== "" ? "not-allowed" : "text",
                }}
              />
            </div>
          </div>
        </div>

        {/* Bill Summary */}
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            backgroundColor: "#eff6ff",
            borderRadius: "0.5rem",
            border: "1px solid #bfdbfe",
          }}
        >
          <h3 style={{ marginBottom: "1rem", fontSize: "1rem" }}>Bill Summary</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>Parts Total:</span>
              <span style={{ fontWeight: 500 }}>₹{partsTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280" }}>Labour:</span>
              <span style={{ fontWeight: 500 }}>₹{labour.toFixed(2)}</span>
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
              <span>₹{grossTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
              <span style={{ color: "#6b7280" }}>Discount:</span>
              <span style={{ fontWeight: 500, color: "#dc2626" }}>-₹{discount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem" }}>
              <span style={{ color: "#111827", fontWeight: 600 }}>Price After Discount:</span>
              <span style={{ fontWeight: 700 }}>₹{priceAfterDiscount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Payment Information</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
                Amount Paid by Customer (₹)
              </label>
              <input
                type="number"
                name="paidAmount"
                value={formData.paidAmount}
                onChange={handleInputChange}
                onWheel={handleWheel}
                placeholder="0.00"
                min="0"
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
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>
                Mode of Payment
              </label>
              <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    cursor: "pointer",
                    fontSize: "1rem",
                  }}
                >
                  <input
                    type="radio"
                    name="paymentMode"
                    value="cash"
                    checked={formData.paymentMode === "cash"}
                    onChange={handleInputChange}
                    style={{ 
                      cursor: "pointer",
                      width: "1.25rem",
                      height: "1.25rem",
                    }}
                  />
                  <span>Cash</span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    cursor: "pointer",
                    fontSize: "1rem",
                  }}
                >
                  <input
                    type="radio"
                    name="paymentMode"
                    value="upi"
                    checked={formData.paymentMode === "upi"}
                    onChange={handleInputChange}
                    style={{ 
                      cursor: "pointer",
                      width: "1.25rem",
                      height: "1.25rem",
                    }}
                  />
                  <span>UPI</span>
                </label>
              </div>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
                Payment Date
              </label>
              <DatePicker
                value={paymentDate}
                onChange={(date) => {
                  setPaymentDate(date);
                }}
                placeholder="dd/mm/yyyy"
              />
            </div>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
              Pending Amount to be Paid (₹)
            </label>
            <input
              type="number"
              name="pendingAmount"
              value={formData.pendingAmount}
              onChange={handleInputChange}
              onWheel={handleWheel}
              placeholder="0.00"
              min="0"
              step="0.01"
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "1rem",
              }}
            />
            {formData.pendingAmount && parseFloat(formData.pendingAmount) > 0 && (
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.75rem", color: "#f59e0b", fontWeight: 500 }}>
                Jobcard will remain in Pending with pending payment tag
              </p>
            )}
          </div>
          {!hideDiscountFormulaHint &&
            (formData.paidAmount !== "" || formData.pendingAmount !== "") && (
            <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.75rem", color: "#6b7280" }}>
              Discount will be auto-calculated as: (Parts Total + Labour) - (Amount Paid + Pending Amount)
            </p>
          )}
          {paidAmount > 0 && balance > 0 && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                backgroundColor: "#fef3c7",
                borderRadius: "0.375rem",
                border: "1px solid #fde68a",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 500, color: "#92400e" }}>
                  Balance Due:
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "1.125rem",
                    color: "#92400e",
                  }}
                >
                  ₹{balance.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

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
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              backgroundColor: formData.pendingAmount && parseFloat(formData.pendingAmount) > 0 ? "#3b82f6" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading 
              ? (formData.pendingAmount && parseFloat(formData.pendingAmount) > 0 ? "Saving..." : "Finalizing...") 
              : (formData.pendingAmount && parseFloat(formData.pendingAmount) > 0 ? "Save" : "Finalize Jobcard")
            }
          </button>
        </div>

        {/* Zero paid custom warning overlay */}
        {showZeroPaidWarning && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(15,23,42,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1100,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "0.75rem",
                padding: "1.5rem",
                width: "100%",
                maxWidth: "420px",
                boxShadow:
                  "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 0.75rem 0",
                  fontSize: "1.05rem",
                  fontWeight: 600,
                }}
              >
                Confirm without payment?
              </h3>
              <p
                style={{
                  margin: "0 0 1rem 0",
                  fontSize: "0.9rem",
                  color: "#4b5563",
                  lineHeight: 1.5,
                }}
              >
                Customer paid amount is <strong>₹0.00</strong> while the total bill
                is <strong>₹{billTotal.toFixed(2)}</strong>. If you continue, this
                jobcard will be saved and kept in the <strong>Pending Jobcards</strong> tab
                with the full amount pending. Do you still want to proceed?
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginTop: "0.75rem",
                  flexWrap: "nowrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowZeroPaidWarning(false)}
                  style={{
                    padding: "0.5rem 0.9rem",
                    fontSize: "0.85rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#ffffff",
                    color: "#374151",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowZeroPaidWarning(false);
                    handleSubmit({ mode: "pending", skipZeroWarning: true });
                  }}
                  style={{
                    padding: "0.5rem 0.9rem",
                    fontSize: "0.85rem",
                    borderRadius: "0.375rem",
                    border: "none",
                    backgroundColor: "#f97316",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  disabled={loading}
                >
                  Keep It Pending
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowZeroPaidWarning(false);
                    handleSubmit({ mode: "finalize", skipZeroWarning: true });
                  }}
                  style={{
                    padding: "0.5rem 0.9rem",
                    fontSize: "0.85rem",
                    borderRadius: "0.375rem",
                    border: "none",
                    backgroundColor: "#16a34a",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  disabled={loading}
                >
                  Continue & Finalize
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

