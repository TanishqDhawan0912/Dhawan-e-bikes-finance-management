import { useRef } from "react";

/**
 * Print-friendly jobcard layout matching the physical E-BIKE JOB CARD format.
 * Landscape orientation, table layout with ESTIMATE, customer details, parts table, and total.
 */
export default function JobcardPrintView({ jobcard, onClose, onPrint }) {
  const printRef = useRef(null);

  // Same wording as jobcard creation form (Warranty Type dropdown)
  const getWarrantyTypeLabel = (value) => {
    if (!value) return "";
    const labels = { none: "No Warranty", full: "Full Warranty", battery: "Battery Only", charger: "Charger Only" };
    return labels[value] ?? value;
  };

  const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr || dateStr === "N/A" || dateStr === "NA") return "";
    try {
      if (typeof dateStr === "string" && dateStr.includes("/")) {
        const parts = dateStr.split("/");
        if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2) return dateStr;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "";
    }
  };

  const parts = jobcard?.parts || [];
  // For printing, compute billing total from parts but exclude replacement items
  // (only service + sales items should contribute to the bill).
  const billingTotal = parts.reduce((sum, part) => {
    if (part.partType === "replacement" || part.replacementType) {
      return sum;
    }
    const price = part.price || 0;
    const qty = part.quantity || 1;
    return sum + price * qty;
  }, 0);
  const detailsList =
    (Array.isArray(jobcard?.details) && jobcard.details.length > 0
      ? jobcard.details
      : jobcard?.place && jobcard.place !== "N/A"
      ? [jobcard.place]
      : []);
  const ebikeDetailText =
    jobcard?.ebikeDetails && typeof jobcard.ebikeDetails === "string" && jobcard.ebikeDetails.trim()
      ? jobcard.ebikeDetails.trim()
      : "";
  const placeText = jobcard?.place && jobcard.place !== "N/A" ? jobcard.place : "";
  const customerNameText = jobcard?.customerName && jobcard.customerName !== "N/A" ? jobcard.customerName : "";
  const nameWithPlace = placeText ? (customerNameText ? `${customerNameText} R/O ${placeText}` : `R/O ${placeText}`) : customerNameText;
  const maxRows = Math.max(detailsList.length, parts.length);
  const totalContentRows = maxRows;
  const isCompact = totalContentRows > 9;
  const rowPad = isCompact ? "2mm" : "4mm";
  const rowLineHeight = isCompact ? 1.2 : 1.5;

  const warrantyLabel = getWarrantyTypeLabel(jobcard?.warrantyType);
  const warrantyDisplay = warrantyLabel
    ? (jobcard?.warrantyDate && jobcard.warrantyDate !== "N/A" && jobcard.warrantyDate !== "NA"
        ? `${warrantyLabel} (${jobcard.warrantyDate})`
        : warrantyLabel)
    : "";

  const getPrintHtml = () => {
    const srNo = (jobcard?.jobcardNumber && jobcard.jobcardNumber !== "N/A") ? jobcard.jobcardNumber : "";
    const custName = (jobcard?.customerName && jobcard.customerName !== "N/A") ? jobcard.customerName : "";
    const dateVal = formatDateDDMMYYYY(jobcard?.date);
    const mob = (jobcard?.mobile && jobcard.mobile !== "N/A") ? jobcard.mobile : "";
    const place = (jobcard?.place && jobcard.place !== "N/A") ? jobcard.place : "";
    const billNo = jobcard?.billNo && jobcard.billNo !== "N/A" ? jobcard.billNo : "";
    const nameWithPlace = place ? (custName ? `${custName} R/O ${place}` : `R/O ${place}`) : custName;
    const chargerDisplay = jobcard?.charger === "yes" ? "Yes" : jobcard?.charger === "no" ? "No" : "";
    const wLabel = getWarrantyTypeLabel(jobcard?.warrantyType);
    const warrantyDisplay = wLabel
      ? (jobcard?.warrantyDate && jobcard.warrantyDate !== "N/A" && jobcard.warrantyDate !== "NA"
          ? `${wLabel} (${jobcard.warrantyDate})`
          : wLabel)
      : "";
    const detailsList = Array.isArray(jobcard?.details) && jobcard.details.length > 0 ? jobcard.details : (jobcard?.place && jobcard.place !== "N/A") ? [jobcard.place] : [];
    const ebikeDetailText =
      jobcard?.ebikeDetails && typeof jobcard.ebikeDetails === "string" && jobcard.ebikeDetails.trim()
        ? jobcard.ebikeDetails.trim()
        : "";
    const maxRows = Math.max(detailsList.length, parts.length);
    const totalContentRows = maxRows;
    const compact = totalContentRows > 9;
    const pad = compact ? "2mm" : "4mm";
    const lh = compact ? "1.2" : "1.4";
    const cel = `style="border-left:1px solid #000;border-right:1px solid #000;border-top:none;border-bottom:none;padding:${pad} 6px;line-height:${lh}"`;
    const firstCel = `style="border-left:none;border-right:1px solid #000;border-top:none;border-bottom:none;padding:${pad} 6px;line-height:${lh}"`;
    const lastCel = `style="border-left:1px solid #000;border-right:none;border-top:none;border-bottom:none;padding:${pad} 6px;line-height:${lh}"`;
    const dataRows = Array.from({ length: maxRows }).map((_, i) => {
      const detail = detailsList[i];
      const part = parts[i];
      const no = detail ? (i + 1) : "";
      const detailText = detail || "";
      let partText = "";
      let priceText = "";
      if (part) {
        const qty = part.quantity || 1;
        const price = part.price || 0;
        const isReplacement =
          part.partType === "replacement" || part.replacementType;
        const amount = isReplacement ? 0 : price * qty;
        const partName = part.spareName || "Part";

        const tags = [];
        // Type tags
        if (part.salesType === "battery" || part.replacementType === "battery") {
          tags.push("battery");
        }
        if (part.salesType === "charger" || part.replacementType === "charger") {
          tags.push("charger");
        }
        // Replacement tag
        if (isReplacement) {
          tags.push("replacement");
        }
        // Append model names (for spares tied to specific models) when present,
        // but only when it's a generic spare (no battery/charger/replacement tag)
        const modelNames = Array.isArray(part.models)
          ? part.models.filter(Boolean)
          : [];
        if (!tags.length && modelNames.length) {
          tags.push(...modelNames);
        }

        const typeSuffix = tags.length ? ` <${tags.join(", ")}>` : "";
        let label = partName;
        if (part.selectedColor) {
          label += ` (${part.selectedColor})`;
        }
        const baseText =
          qty > 1
            ? `${label}${typeSuffix} (Qty: ${qty})`
            : `${label}${typeSuffix}`;

        partText = baseText;
        priceText = `₹${amount.toFixed(2)}`;
      }
      return `<tr><td ${firstCel}>${no}</td><td ${cel}>${detailText}</td><td ${cel}>${partText}</td><td ${lastCel}>${priceText}</td></tr>`;
    }).join("");
    const emptyCount = Math.max(0, 20 - maxRows);
    const emptyRows = Array.from({ length: emptyCount }).map(() => {
      const epad = compact ? "2mm" : "4mm";
      const cel = `style="border-left:1px solid #000;border-right:1px solid #000;border-top:none;border-bottom:none;padding:${epad} 8px;line-height:${lh}"`;
      const firstCel = `style="border-left:none;border-right:1px solid #000;border-top:none;border-bottom:none;padding:${epad} 8px;line-height:${lh}"`;
      const lastCel = `style="border-left:1px solid #000;border-right:none;border-top:none;border-bottom:none;padding:${epad} 8px;line-height:${lh}"`;
      return `<tr><td ${firstCel}></td><td ${cel}></td><td ${cel}></td><td ${lastCel}></td></tr>`;
    }).join("");
    const spacerClass = totalContentRows > 9 ? "parts-spacer-inner short" : "parts-spacer-inner";
    const spacerRow = `<tr class="parts-spacer"><td style="border-left:none;border-right:1px solid #000;padding:0;vertical-align:top"><div class="${spacerClass}"></div></td><td style="border-left:1px solid #000;border-right:1px solid #000;padding:0;vertical-align:top"></td><td style="border-left:1px solid #000;border-right:1px solid #000;padding:0;vertical-align:top"></td><td style="border-left:1px solid #000;border-right:none;padding:0;vertical-align:top"></td></tr>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Job Card - ${srNo || "Print"}</title>
<style>
@page{size:A4 landscape;margin:0!important}
@media print{
  html,body{width:297mm!important;margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
  .preview-toolbar{display:none!important}
  .preview-paper{position:fixed!important;inset:0!important;padding:0!important;display:flex!important}
  .sheet{position:relative!important;width:297mm!important;min-height:210mm!important;transform:none!important;margin:0!important;padding:8mm!important;box-sizing:border-box!important;box-shadow:none!important;border-radius:0!important;border:1px solid #000!important;overflow:visible!important}
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;font-family:system-ui,-apple-system,sans-serif}
body{background:linear-gradient(180deg,#e5e7eb 0%,#d1d5db 100%);display:flex;flex-direction:column}
.preview-toolbar{flex-shrink:0;background:#1e293b;color:#f8fafc;padding:12px 20px;display:flex;align-items:center;justify-content:center;gap:16px;font-size:13px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.15)}
.preview-toolbar span{opacity:0.95}
.preview-toolbar .icon{font-size:16px}
.preview-paper{flex:1;display:flex;align-items:center;justify-content:center;padding:24px;overflow:hidden;min-height:0}
.sheet{width:1122px;height:794px;transform-origin:center center;background:#fff;padding:20px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.15);border-radius:2px;font-family:Arial,sans-serif;border:1px solid #000;position:relative}
.estimate-badge{position:absolute;top:0;left:0;background:#000;color:#fff;font-weight:700;font-size:11pt;letter-spacing:0.5px;padding:10px 18px;z-index:1}
.header-wrap{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0;flex-shrink:0;border-bottom:1px solid #000;padding-bottom:8px;min-height:48px}
.header-center{flex:1;display:flex;align-items:center;justify-content:center;padding:0 16px}
.jobcard-title{font-weight:700;font-size:22pt;letter-spacing:1px}
.header-right{flex-shrink:0}
.srno-box{border:1px solid #000;padding:8px 16px;font-weight:700;font-size:11pt}
.info-table{width:100%;border-collapse:collapse;margin-bottom:0;flex-shrink:0;font-size:11pt}
.info-table td{border:1px solid #000;padding:8px 10px}
.info-table .label{font-weight:600;width:12%}
.info-table .value{width:38%}
.info-table .wide{padding:10px 10px}
.parts-wrap{flex:1;min-height:120px;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box}
.parts-table{width:100%;border-collapse:collapse;border:1px solid #000;table-layout:fixed;height:100%;min-height:100px;font-size:11pt}
.parts-table thead td{border:1px solid #000;padding:10px 8px;font-weight:700}
.parts-table tbody td{border-left:1px solid #000;border-right:1px solid #000;border-top:none;border-bottom:none;padding:4mm 8px;line-height:1.5}
.parts-table.compact tbody td{padding:2mm 8px;line-height:1.2}
.parts-table tbody tr td:first-child{border-left:none}
.parts-table tbody tr td:last-child,.parts-table tbody tr.parts-spacer td{border-right:none}
.parts-table tbody tr.parts-spacer td{border-bottom:none}
.total-table td:last-child{border-right:1px solid #000!important}
.total-table{width:100%;border-collapse:collapse;flex-shrink:0;margin-top:0;border:1px solid #000;border-top:none}
.total-table td{border:1px solid #000;padding:10px 8px;font-size:11pt}
.total-table .total-label{font-weight:700;text-align:right}
.total-table .total-amount{font-weight:700;text-align:right;font-size:13pt}
.parts-spacer-inner{height:1px;min-height:380px;display:block}
.parts-spacer-inner.short{min-height:20mm}
@media print{.parts-wrap{overflow:visible!important}.parts-spacer-inner{height:50vh!important;min-height:90mm!important}.parts-spacer-inner.short{min-height:8mm!important}}
</style></head><body>
<div class="preview-toolbar"><span class="icon">🖨️</span><span>Print Preview — A4 Landscape</span><span style="opacity:0.7;font-size:12px">For best results: More settings → Margins: None</span></div>
<div class="preview-paper"><div class="sheet" id="print-sheet">
<span class="estimate-badge">ESTIMATE</span>
<div class="header-wrap">
<div class="header-center"><span class="jobcard-title">E-BIKE JOB CARD</span></div>
<div class="header-right"><div class="srno-box">SR. No. ${srNo}</div></div>
</div>
<table class="info-table">
<tr><td class="label">NAME</td><td class="value">${nameWithPlace}</td><td class="label">DATE</td><td class="value">${dateVal}</td></tr>
<tr><td class="label">MOB.</td><td class="value">${mob}</td><td class="label">Charger:-</td><td class="value">${chargerDisplay}</td></tr>
<tr><td class="label wide" style="vertical-align:top">E-BIKE Detail:-</td><td class="value wide">${ebikeDetailText}</td><td class="label wide">Mechanic</td><td class="value wide"></td></tr>
<tr><td class="label">Bill No.</td><td class="value">${billNo}</td><td class="label">Warranty</td><td class="value">${warrantyDisplay}</td></tr>
</table>
<div class="parts-wrap"><table class="parts-table${totalContentRows>9?' compact':''}"><thead><tr><td style="width:5%">No.</td><td style="width:35%">Details</td><td style="width:45%">PARTS</td><td style="width:15%">PRICE</td></tr></thead>
<tbody>${dataRows}${emptyRows}${spacerRow}</tbody></table></div>
<table class="total-table"><tr><td style="width:5%"></td><td style="width:35%"></td><td style="width:45%;font-weight:700;text-align:right">TOTAL</td><td style="width:15%;font-weight:700;text-align:right;border-right:1px solid #000!important">₹${billingTotal.toFixed(2)}</td></tr></table>
</div></div></body>
<script>
(function(){
  var sheet=document.getElementById('print-sheet');
  var paper=document.querySelector('.preview-paper');
  var w=1122,h=794;
  function scale(){
    if(!paper||!sheet)return;
    var pw=paper.clientWidth,ph=paper.clientHeight;
    var s=Math.min(1,pw/w,ph/h);
    sheet.style.transform='scale('+s+')';
  }
  scale();
  window.addEventListener('resize',scale);
})();
</script></html>`;
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      const printWin = window.open("", "_blank", "width=1200,height=900");
      if (printWin) {
        printWin.document.write(getPrintHtml());
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
          printWin.print();
          printWin.close();
        }, 500);
      } else {
        window.print();
      }
    }
  };

  return (
    <div className="jobcard-print-container">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html, body {
            width: 297mm;
            height: 210mm;
            margin: 0;
            padding: 0;
          }
          body * { visibility: hidden; }
          .jobcard-print-container,
          .jobcard-print-container * { visibility: visible; }
          .jobcard-print-container {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            overflow: hidden !important;
          }
          .jobcard-print-actions { display: none !important; }
          .jobcard-print-sheet {
            width: 297mm !important;
            height: 210mm !important;
            min-width: 297mm !important;
            min-height: 210mm !important;
            max-width: 297mm !important;
            max-height: 210mm !important;
            box-shadow: none !important;
            border: none !important;
            padding: 8mm !important;
          }
        }
      `}</style>

      <div className="jobcard-print-actions" style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        )}
        <button
          type="button"
          onClick={handlePrint}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            borderRadius: "0.375rem",
            border: "none",
            backgroundColor: "#3b82f6",
            color: "white",
            cursor: "pointer",
          }}
        >
          Print
        </button>
      </div>

      <div
        ref={printRef}
        className="jobcard-print-sheet"
        style={{
          position: "relative",
          width: "297mm",
          height: "210mm",
          minWidth: "297mm",
          minHeight: "210mm",
          padding: "8mm",
          backgroundColor: "white",
          border: "1px solid #000",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          fontFamily: "Arial, sans-serif",
          fontSize: "11pt",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        {/* ESTIMATE - simple rectangular badge, top-left */}
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            background: "#000",
            color: "#fff",
            fontWeight: 700,
            fontSize: "11pt",
            letterSpacing: "0.5px",
            padding: "10px 18px",
            zIndex: 1,
          }}
        >
          ESTIMATE
        </span>
        {/* Header: E-BIKE JOB CARD (centered) | SR. No. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 0,
            borderBottom: "1px solid #000",
            paddingBottom: "8px",
            minHeight: "48px",
          }}
        >
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
            <span style={{ fontWeight: 700, fontSize: "22pt", letterSpacing: "1px" }}>E-BIKE JOB CARD</span>
          </div>
          <div style={{ flexShrink: 0 }}>
            <div
              style={{
                border: "1px solid #000",
                padding: "8px 16px",
                fontWeight: 700,
                fontSize: "11pt",
              }}
            >
              SR. No. {(jobcard?.jobcardNumber && jobcard.jobcardNumber !== "N/A") ? jobcard.jobcardNumber : ""}
            </div>
          </div>
        </div>

        {/* Customer and E-Bike Details */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0, flexShrink: 0, fontSize: "11pt" }} cellSpacing={0} cellPadding={0}>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #000", padding: "8px 10px", width: "12%", fontWeight: 600 }}>NAME</td>
              <td style={{ border: "1px solid #000", padding: "8px 10px", width: "38%" }}>{nameWithPlace}</td>
              <td style={{ border: "1px solid #000", padding: "8px 10px", width: "12%", fontWeight: 600 }}>DATE</td>
              <td style={{ border: "1px solid #000", padding: "8px 10px", width: "38%" }}>{formatDateDDMMYYYY(jobcard?.date)}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #000", padding: "8px 10px", fontWeight: 600 }}>MOB.</td>
              <td style={{ border: "1px solid #000", padding: "8px 10px" }}>{(jobcard?.mobile && jobcard.mobile !== "N/A") ? jobcard.mobile : ""}</td>
              <td style={{ border: "1px solid #000", padding: "8px 10px", fontWeight: 600 }}>Charger:-</td>
              <td style={{ border: "1px solid #000", padding: "8px 10px" }}>{jobcard?.charger === "yes" ? "Yes" : jobcard?.charger === "no" ? "No" : ""}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px", fontWeight: 600, verticalAlign: "top" }}>E-BIKE Detail:-</td>
              <td style={{ border: "1px solid #000", padding: "10px" }}>{ebikeDetailText}</td>
              <td style={{ border: "1px solid #000", padding: "10px", fontWeight: 600 }}>Mechanic</td>
              <td style={{ border: "1px solid #000", padding: "10px" }}>{jobcard?.mechanic || ""}</td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #000", padding: "8px 10px", fontWeight: 600 }}>Bill No.</td>
              <td style={{ border: "1px solid #000", padding: "8px 10px" }}>{jobcard?.billNo || ""}</td>
              <td style={{ border: "1px solid #000", padding: "8px 10px", fontWeight: 600 }}>Warranty</td>
              <td style={{ border: "1px solid #000", padding: "8px 10px" }}>{warrantyDisplay}</td>
            </tr>
          </tbody>
        </table>

        {/* Parts Table: compact spacing when many entries to fit without scroll */}
        <div style={{ flex: 1, minHeight: "115mm", display: "flex", flexDirection: "column", boxSizing: "border-box", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", height: "100%", minHeight: "100px", border: "1px solid #000", tableLayout: "fixed" }} cellSpacing={0} cellPadding={0}>
          <thead>
            <tr>
              <td style={{ border: "1px solid #000", padding: "4mm 0.5rem", fontWeight: 700, width: "5%" }}>No.</td>
              <td style={{ border: "1px solid #000", padding: "4mm 0.5rem", fontWeight: 700, width: "35%" }}>Details</td>
              <td style={{ border: "1px solid #000", padding: "4mm 0.5rem", fontWeight: 700, width: "45%" }}>PARTS</td>
              <td style={{ border: "1px solid #000", padding: "4mm 0.5rem", fontWeight: 700, width: "15%" }}>PRICE</td>
            </tr>
          </thead>
          <tbody>
            {/* Details and Parts: side by side from top - each row has one detail + one part */}
            {Array.from({ length: maxRows }).map((_, i) => {
              const detail = detailsList[i];
              const part = parts[i];
              const cellStyle = {
                borderLeft: "1px solid #000",
                borderRight: "1px solid #000",
                borderTop: "none",
                borderBottom: "none",
                padding: `${rowPad} 0.5rem`,
                lineHeight: rowLineHeight,
              };
              const no = detail ? i + 1 : "";
              const detailText = detail || "";
              let partText = "";
              let priceText = "";
              if (part) {
                const qty = part.quantity || 1;
                const price = part.price || 0;
                const isReplacement =
                  part.partType === "replacement" || part.replacementType;
                const amount = isReplacement ? 0 : price * qty;
                const partName = part.spareName || "Part";

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
                const modelNames = Array.isArray(part.models)
                  ? part.models.filter(Boolean)
                  : [];
                if (!tags.length && modelNames.length) {
                  tags.push(...modelNames);
                }

                const typeSuffix = tags.length ? ` <${tags.join(", ")}>` : "";
                let label = partName;
                if (part.selectedColor) {
                  label += ` (${part.selectedColor})`;
                }
                const baseText =
                  qty > 1
                    ? `${label}${typeSuffix} (Qty: ${qty})`
                    : `${label}${typeSuffix}`;

                partText = baseText;
                priceText = `₹${amount.toFixed(2)}`;
              }
              return (
                <tr key={i}>
                  <td style={{ ...cellStyle, borderLeft: "none" }}>{no}</td>
                  <td style={cellStyle}>{detailText}</td>
                  <td style={cellStyle}>{partText}</td>
                  <td style={{ ...cellStyle, borderRight: "none" }}>{priceText}</td>
                </tr>
              );
            })}
            {Array.from({ length: Math.max(0, 20 - maxRows) }).map((_, i) => {
              const cellStyle = { borderLeft: "1px solid #000", borderRight: "1px solid #000", borderTop: "none", borderBottom: "none", padding: `${rowPad} 0.5rem`, lineHeight: rowLineHeight };
              return (
                <tr key={`empty-${i}`}>
                  <td style={{ ...cellStyle, borderLeft: "none" }}></td>
                  <td style={cellStyle}></td>
                  <td style={cellStyle}></td>
                  <td style={{ ...cellStyle, borderRight: "none" }}></td>
                </tr>
              );
            })}
            {/* Spacer row: shrinks when many entries so section fits */}
            <tr>
              <td style={{ borderLeft: "none", borderRight: "1px solid #000", borderTop: "none", borderBottom: "none", padding: 0, verticalAlign: "top" }}>
                <div style={{ height: totalContentRows > 9 ? "15mm" : "50vh", minHeight: totalContentRows > 9 ? "8mm" : "90mm", display: "block" }} />
              </td>
              <td style={{ borderLeft: "1px solid #000", borderRight: "1px solid #000", borderTop: "none", borderBottom: "none", padding: 0, verticalAlign: "top" }} />
              <td style={{ borderLeft: "1px solid #000", borderRight: "1px solid #000", borderTop: "none", borderBottom: "none", padding: 0, verticalAlign: "top" }} />
              <td style={{ borderLeft: "1px solid #000", borderRight: "none", borderTop: "none", borderBottom: "none", padding: 0, verticalAlign: "top" }} />
            </tr>
          </tbody>
        </table>
        </div>

        {/* Total - table row for full borders including right edge */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 0, flexShrink: 0 }} cellSpacing={0} cellPadding={0}>
          <tbody>
            <tr>
              <td style={{ width: "5%", border: "1px solid #000", padding: "10px 8px" }} />
              <td style={{ width: "35%", border: "1px solid #000", padding: "10px 8px" }} />
              <td style={{ width: "45%", border: "1px solid #000", padding: "10px 8px", fontWeight: 700, textAlign: "right" }}>TOTAL</td>
              <td style={{ width: "15%", border: "1px solid #000", borderRight: "1px solid #000", padding: "10px 8px", fontWeight: 700, textAlign: "right", fontSize: "13pt" }}>₹{billingTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

      </div>
    </div>
  );
}
