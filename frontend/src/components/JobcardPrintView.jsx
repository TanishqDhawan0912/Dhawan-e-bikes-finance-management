import { useEffect, useLayoutEffect, useRef, useState } from "react";

const PREVIEW_BASE_W = 1122;
const PREVIEW_BASE_H = 794;

/** Highest index for getPartsDensityStyle (inclusive). */
const PARTS_DENSITY_MAX = 4;

/** Fixed line slots in the parts body (not counting spacer row). */
const JOB_CARD_BODY_LINE_ROWS = 20;

/** Details column font will not grow beyond this when filling slack vertical space. */
const MAX_DETAILS_FONT_FILL_PT = 16;

/** Details body cells use true bold so print/preview match job-card readability. */
const DETAILS_BODY_FONT_WEIGHT = 700;

/** Tbody cell vertical padding when rows are stretched to fill (frees space for larger type). */
const FILL_BODY_PAD_Y = "2px";

/**
 * Divide vertical space across max(8, used lines): ≤8 lines get the largest row height (max gap);
 * adding a 9th line uses 9 slots (tighter rows), same block height — gap changes before shrinking type.
 */
const PARTS_LAYOUT_BASE_SLOTS = 8;

/** Body rows below the layout block stay visually minimal (rules + empty slots). */
const MIN_FILLER_LINE_ROW_PX = 3;

function getPartsLayoutLineDenom(usedRowCount) {
  const capped = Math.min(
    JOB_CARD_BODY_LINE_ROWS,
    Math.max(0, usedRowCount)
  );
  return Math.min(
    JOB_CARD_BODY_LINE_ROWS,
    Math.max(PARTS_LAYOUT_BASE_SLOTS, capped)
  );
}

/** Minimal reserved height under thead for the spacer row (px, layout space). */
const SPACER_ROW_RESERVE_PX = 8;

/** Binary search lower bound when fitting detail text to row height (pt). */
const MIN_DETAILS_FONT_FILL_PT = 8;

/**
 * Per-level tuning so many detail lines fit on one sheet: tighter padding/line-height,
 * then smaller Details font only at higher levels.
 */
function getPartsDensityStyle(level) {
  const L = Math.max(0, Math.min(PARTS_DENSITY_MAX, level));
  const rows = [
    {
      rowPad: "4mm",
      rowLineHeight: 1.5,
      detailsFontPt: 14,
      headerDetailsFontPt: 12,
      theadCellPad: "4mm 0.5rem",
      useTallSpacer: true,
      spacerMinMm: 88,
      compact: false,
    },
    {
      rowPad: "2.5mm",
      rowLineHeight: 1.38,
      detailsFontPt: 13,
      headerDetailsFontPt: 11.5,
      theadCellPad: "3mm 0.45rem",
      useTallSpacer: false,
      spacerMinMm: 20,
      compact: true,
    },
    {
      rowPad: "1.5mm",
      rowLineHeight: 1.28,
      detailsFontPt: 12,
      headerDetailsFontPt: 11,
      theadCellPad: "2.5mm 0.4rem",
      useTallSpacer: false,
      spacerMinMm: 14,
      compact: true,
    },
    {
      rowPad: "1mm",
      rowLineHeight: 1.18,
      detailsFontPt: 11,
      headerDetailsFontPt: 10,
      theadCellPad: "2mm 0.35rem",
      useTallSpacer: false,
      spacerMinMm: 8,
      compact: true,
    },
    {
      rowPad: "0.45mm",
      rowLineHeight: 1.08,
      detailsFontPt: 10,
      headerDetailsFontPt: 9.5,
      theadCellPad: "1.5mm 0.3rem",
      useTallSpacer: false,
      spacerMinMm: 4,
      compact: true,
    },
  ];
  return rows[L];
}

function estimatePartsDensityFromRowCount(maxRows) {
  if (maxRows <= 9) return 0;
  if (maxRows <= 11) return 1;
  if (maxRows <= 14) return 2;
  if (maxRows <= 17) return 3;
  return 4;
}

/**
 * Print-friendly jobcard layout matching the physical E-BIKE JOB CARD format.
 * Landscape orientation, table layout with ESTIMATE, customer details, parts table, and total.
 */
export default function JobcardPrintView({ jobcard, onClose, onPrint }) {
  const printRef = useRef(null);
  const previewRef = useRef(null);
  const partsWrapRef = useRef(null);
  const partsTableRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(() => {
    if (typeof window === "undefined") return 1;
    const w = Math.min(1180, window.innerWidth - 48);
    const h = Math.max(240, window.innerHeight * 0.82 - 120);
    const pad = 8;
    const s = Math.min(1, (w - pad) / PREVIEW_BASE_W, (h - pad) / PREVIEW_BASE_H);
    return Math.max(0.15, Math.min(1, s));
  });

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

  const [partsDensity, setPartsDensity] = useState(() =>
    estimatePartsDensityFromRowCount(maxRows)
  );

  const [partsVerticalFill, setPartsVerticalFill] = useState(() => ({
    rowHeightPx: null,
    detailsFontPt: null,
  }));

  useEffect(() => {
    setPartsDensity(estimatePartsDensityFromRowCount(maxRows));
    setPartsVerticalFill({ rowHeightPx: null, detailsFontPt: null });
  }, [jobcard?._id, jobcard?.jobcardNumber, maxRows]);

  const densityStyle = getPartsDensityStyle(partsDensity);
  const rowPad = densityStyle.rowPad;
  const rowLineHeight = densityStyle.rowLineHeight;
  const isCompact = densityStyle.compact;
  const vfRowH = partsVerticalFill.rowHeightPx;
  const filledDetailsFontPt =
    partsVerticalFill.detailsFontPt ?? densityStyle.detailsFontPt;
  const layoutLineDenom = getPartsLayoutLineDenom(maxRows);
  const bodyPadY = vfRowH != null ? FILL_BODY_PAD_Y : rowPad;
  const bodyLineHeight = vfRowH != null ? 1.18 : rowLineHeight;

  const lineRowTrStyle = (lineIndex) => {
    if (vfRowH == null) return undefined;
    const h =
      lineIndex < layoutLineDenom ? vfRowH : MIN_FILLER_LINE_ROW_PX;
    return {
      height: h,
      minHeight: h,
      boxSizing: "border-box",
    };
  };

  const isBelowLayoutBlock = (lineIndex) =>
    vfRowH != null && lineIndex >= layoutLineDenom;

  const detailsFingerprint =
    Array.isArray(jobcard?.details) && jobcard.details.length
      ? jobcard.details.join("\n")
      : "";

  useLayoutEffect(() => {
    const wrap = partsWrapRef.current;
    const table = partsTableRef.current;
    if (!wrap || !table) return;

    let raf = 0;

    const clearLineTrProbeStyles = (lineTrs) => {
      for (const tr of lineTrs) {
        tr.style.height = "";
        tr.style.minHeight = "";
        tr.style.boxSizing = "";
        for (const td of tr.querySelectorAll("td")) {
          td.style.verticalAlign = "";
          td.style.padding = "";
          td.style.lineHeight = "";
        }
        const d = tr.children[1];
        if (d) {
          d.style.fontSize = "";
          d.style.fontWeight = "";
        }
      }
    };

    const run = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        const wrapH = wrap.clientHeight;
        if (wrapH < 48) {
          setPartsVerticalFill((p) =>
            p.rowHeightPx == null && p.detailsFontPt == null
              ? p
              : { rowHeightPx: null, detailsFontPt: null }
          );
          return;
        }

        const tbody = table.querySelector("tbody");
        if (!tbody) return;
        const allTrs = [...tbody.querySelectorAll("tr")];
        if (allTrs.length < JOB_CARD_BODY_LINE_ROWS + 1) return;

        const thead = table.querySelector("thead");
        const theadH = thead?.offsetHeight ?? 0;
        const lineTrs = allTrs.slice(0, JOB_CARD_BODY_LINE_ROWS);

        const availForRows = Math.max(0, wrapH - theadH - SPACER_ROW_RESERVE_PX);
        const usedLineCount = Math.min(maxRows, JOB_CARD_BODY_LINE_ROWS);
        const layoutDenom = getPartsLayoutLineDenom(maxRows);
        const fillerLineCount = JOB_CARD_BODY_LINE_ROWS - layoutDenom;
        const availForLayoutSlots = Math.max(
          0,
          availForRows - fillerLineCount * MIN_FILLER_LINE_ROW_PX
        );
        const slotH = Math.max(
          20,
          Math.floor(availForLayoutSlots / layoutDenom)
        );

        // Tighten density only when a used row needs more than its layout slot (gap shrinks via
        // layoutDenom when line count passes 8; density is for content that truly won't fit).
        let needsTighten = false;
        for (let i = 0; i < usedLineCount; i++) {
          const tr = lineTrs[i];
          if (tr && tr.offsetHeight > slotH + 8) {
            needsTighten = true;
            break;
          }
        }

        if (needsTighten) {
          if (partsDensity < PARTS_DENSITY_MAX) {
            setPartsDensity((d) => d + 1);
            setPartsVerticalFill({ rowHeightPx: null, detailsFontPt: null });
            return;
          }
          // Already at max density: still run vertical fill so rows + font scale to the wrap.
        }

        const basePt = densityStyle.detailsFontPt;
        const rowH = slotH;

        const applyProbe = (pt) => {
          lineTrs.forEach((tr, idx) => {
            const h = idx < layoutDenom ? rowH : MIN_FILLER_LINE_ROW_PX;
            const tight = idx >= layoutDenom;
            tr.style.height = `${h}px`;
            tr.style.minHeight = `${h}px`;
            tr.style.boxSizing = "border-box";
            for (const td of tr.querySelectorAll("td")) {
              td.style.verticalAlign = "middle";
              td.style.padding = tight ? "0 0.5rem" : `${FILL_BODY_PAD_Y} 0.5rem`;
              td.style.lineHeight = tight ? "1" : "1.18";
            }
            const d = tr.children[1];
            if (d) {
              d.style.fontSize = `${pt}pt`;
              d.style.fontWeight = String(DETAILS_BODY_FONT_WEIGHT);
            }
          });
        };

        const allDetailCellsFit = () => {
          for (let idx = 0; idx < usedLineCount; idx++) {
            const tr = lineTrs[idx];
            if (!tr) continue;
            const d = tr.children[1];
            if (!d) continue;
            if (d.scrollHeight > d.clientHeight + 3) return false;
          }
          return true;
        };

        let best = basePt;
        let lo = MIN_DETAILS_FONT_FILL_PT;
        let hi = MAX_DETAILS_FONT_FILL_PT;
        for (let k = 0; k < 24; k++) {
          const mid = (lo + hi) / 2;
          applyProbe(mid);
          if (allDetailCellsFit()) {
            best = mid;
            lo = mid;
          } else {
            hi = mid;
          }
          if (hi - lo < 0.18) break;
        }

        best = Math.min(
          MAX_DETAILS_FONT_FILL_PT,
          Math.max(MIN_DETAILS_FONT_FILL_PT, best)
        );
        best = Math.round(best * 4) / 4;
        clearLineTrProbeStyles(lineTrs);

        setPartsVerticalFill((prev) => {
          const sameRow = prev.rowHeightPx === rowH;
          const samePt =
            prev.detailsFontPt != null &&
            Math.abs(prev.detailsFontPt - best) < 0.01;
          if (sameRow && samePt) return prev;
          return { rowHeightPx: rowH, detailsFontPt: best };
        });
      });
    };

    run();
    const ro = new ResizeObserver(() => run());
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    partsDensity,
    densityStyle.detailsFontPt,
    maxRows,
    jobcard?._id,
    jobcard?.jobcardNumber,
    detailsFingerprint,
    parts.length,
    previewScale,
  ]);

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
    const ds = getPartsDensityStyle(partsDensity);
    const pad = ds.rowPad;
    const lh = String(ds.rowLineHeight);
    const thPad = ds.theadCellPad;
    const printRowH = partsVerticalFill.rowHeightPx;
    const printDetailsPt =
      partsVerticalFill.detailsFontPt ?? ds.detailsFontPt;
    const layoutDenomPrint = getPartsLayoutLineDenom(maxRows);
    const vaMid = printRowH != null ? ";vertical-align:middle" : "";
    const trOpenForLine = (lineIdx) => {
      if (printRowH == null) return "<tr>";
      const h =
        lineIdx < layoutDenomPrint
          ? printRowH
          : MIN_FILLER_LINE_ROW_PX;
      return `<tr style="height:${h}px;min-height:${h}px;box-sizing:border-box">`;
    };
    const cellStylesForLine = (lineIdx, opts = {}) => {
      const boldNo = opts.boldNo === true;
      const yPad =
        printRowH == null
          ? pad
          : lineIdx < layoutDenomPrint
            ? FILL_BODY_PAD_Y
            : "0";
      const lhv =
        printRowH == null
          ? lh
          : lineIdx < layoutDenomPrint
            ? "1.18"
            : "1";
      const noBold = boldNo ? `;font-weight:${DETAILS_BODY_FONT_WEIGHT}` : "";
      const cel = `style="border-left:1px solid #000;border-right:1px solid #000;border-top:none;border-bottom:none;padding:${yPad} 0.5rem;line-height:${lhv};font-family:Arial,sans-serif${vaMid}"`;
      const detailFs = `${printDetailsPt}pt`;
      const detailCel = `style="border-left:1px solid #000;border-right:1px solid #000;border-top:none;border-bottom:none;padding:${yPad} 0.5rem;line-height:${lhv};font-family:Arial,sans-serif;font-size:${detailFs};font-weight:${DETAILS_BODY_FONT_WEIGHT}${vaMid}"`;
      const firstCel = `style="border-left:none;border-right:1px solid #000;border-top:none;border-bottom:none;padding:${yPad} 0.5rem;line-height:${lhv};font-family:Arial,sans-serif${noBold}${vaMid}"`;
      const lastCel = `style="border-left:1px solid #000;border-right:none;border-top:none;border-bottom:none;padding:${yPad} 0.5rem;line-height:${lhv};font-family:Arial,sans-serif${vaMid}"`;
      return { cel, detailCel, firstCel, lastCel };
    };
    const dataRows = Array.from({ length: maxRows }).map((_, i) => {
      const detail = detailsList[i];
      const part = parts[i];
      const no = detail ? (i + 1) : "";
      const { cel, detailCel, firstCel, lastCel } = cellStylesForLine(i, {
        boldNo: no !== "",
      });
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
        if (part.salesType === "oldScooty") {
          const rawPmc = String(part.pmcNo || "").trim();
          const pmcDisplay = rawPmc
            ? `PMC-${rawPmc.replace(/^PMC-?/i, "")}`
            : "";
          label = pmcDisplay ? `${pmcDisplay} - ${partName}` : partName;
        }
        if (part.selectedColor) {
          label += ` (${part.selectedColor})`;
        }
        const baseText =
          qty > 1
            ? `${label}${typeSuffix} (Qty: ${qty})`
            : `${label}${typeSuffix}`;

        const wTag = getWarrantyTagForPart(part);
        const wBadge = wTag
          ? ` <span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;border:1px solid ${
              wTag === "W" ? "#16a34a" : "#dc2626"
            };background:${
              wTag === "W" ? "#dcfce7" : "#fee2e2"
            };color:${
              wTag === "W" ? "#166534" : "#991b1b"
            };font-weight:700;font-size:10pt;line-height:1.2">${wTag}</span>`
          : "";

        partText = `${baseText}${wBadge}`;
        priceText = `₹${amount.toFixed(2)}`;
      }
      return `${trOpenForLine(i)}<td ${firstCel}>${no}</td><td ${detailCel}>${detailText}</td><td ${cel}>${partText}</td><td ${lastCel}>${priceText}</td></tr>`;
    }).join("");
    const emptyCount = Math.max(0, 20 - maxRows);
    const emptyRows = Array.from({ length: emptyCount }).map((_, ei) => {
      const lineIdx = maxRows + ei;
      const { cel: ecel, detailCel: edetail, firstCel: efirst, lastCel: elast } =
        cellStylesForLine(lineIdx);
      return `${trOpenForLine(lineIdx)}<td ${efirst}></td><td ${edetail}></td><td ${ecel}></td><td ${elast}></td></tr>`;
    }).join("");
    const spacerDivStyle =
      printRowH != null
        ? "height:1px;min-height:4px;display:block"
        : ds.useTallSpacer
          ? "height:1px;min-height:min(90mm,38vh);display:block"
          : `height:1px;min-height:${ds.spacerMinMm}mm;display:block`;
    const spacerRow = `<tr class="parts-spacer"><td style="border-left:none;border-right:1px solid #000;padding:0;vertical-align:top"><div style="${spacerDivStyle}"></div></td><td style="border-left:1px solid #000;border-right:1px solid #000;padding:0;vertical-align:top"></td><td style="border-left:1px solid #000;border-right:1px solid #000;padding:0;vertical-align:top"></td><td style="border-left:1px solid #000;border-right:none;padding:0;vertical-align:top"></td></tr>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Job Card - ${srNo || "Print"}</title>
<style>
@page{size:A4 landscape;margin:0!important}
@media print{
  html,body{width:297mm!important;margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
  .preview-toolbar{display:none!important}
  .preview-paper{position:fixed!important;inset:0!important;padding:0!important;display:flex!important}
  .sheet{position:relative!important;width:297mm!important;height:210mm!important;min-height:210mm!important;max-height:210mm!important;transform:none!important;margin:0!important;padding:20px!important;box-sizing:border-box!important;box-shadow:none!important;border-radius:0!important;border:1px solid #000!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}
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
.info-table{width:100%;border-collapse:collapse;margin-bottom:0;flex-shrink:0;font-size:13pt}
.info-table td{border:1px solid #000;padding:10px 10px}
.info-table .label{font-weight:900;width:12%;font-size:13.5pt;letter-spacing:0.5px}
.info-table .value{width:38%;font-weight:800;font-size:13pt}
.info-table .wide{padding:10px 10px}
.parts-wrap{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box}
.parts-table{width:100%;border-collapse:collapse;border:1px solid #000;table-layout:fixed;height:100%;min-height:100px;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.parts-table thead td{border:1px solid #000;font-weight:700}
.parts-table tbody td{border-left:1px solid #000;border-right:1px solid #000;border-top:none;border-bottom:none}
.parts-table tbody tr td:first-child{border-left:none}
.parts-table tbody tr td:last-child,.parts-table tbody tr.parts-spacer td{border-right:none}
.parts-table tbody tr.parts-spacer td{border-bottom:none}
.total-table td:last-child{border-right:1px solid #000!important}
.total-table{width:100%;border-collapse:collapse;flex-shrink:0;margin-top:0;border:1px solid #000;border-top:none}
.total-table td{border:1px solid #000;padding:10px 8px;font-size:11pt}
.total-table .total-label{font-weight:700;text-align:right}
.total-table .total-amount{font-weight:700;text-align:right;font-size:13pt}
@media print{.parts-wrap{overflow:hidden!important;min-height:0!important;flex:1 1 auto!important}}
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
<div class="parts-wrap"><table class="parts-table${ds.compact ? " compact" : ""}"><thead><tr><td style="width:5%;padding:${thPad};font-weight:700">No.</td><td style="width:35%;padding:${thPad};font-weight:700;font-size:${ds.headerDetailsFontPt}pt">Details</td><td style="width:45%;padding:${thPad};font-weight:700">PARTS</td><td style="width:15%;padding:${thPad};font-weight:700">PRICE</td></tr></thead>
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
        const runPrint = () => {
          printWin.print();
          printWin.close();
        };
        if (printWin.document.readyState === "complete") {
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(runPrint, 150)));
        } else {
          printWin.addEventListener(
            "load",
            () =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => setTimeout(runPrint, 150))
              ),
            { once: true }
          );
        }
      } else {
        window.print();
      }
    }
  };

  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      let w = rect.width || el.clientWidth;
      let h = rect.height || el.clientHeight;

      // Flex parents with only max-height can leave this host at ~0 before layout settles;
      // derive space from the modal shell so scale stays readable.
      const modalInner = el.closest(".jobcard-print-modal-inner");
      if (modalInner) {
        const ir = modalInner.getBoundingClientRect();
        const actionsEl = modalInner.querySelector(".jobcard-print-actions");
        const actionsH = actionsEl?.getBoundingClientRect().height ?? 52;

        // Always prefer viewport-based available height so the preview stays big even when
        // the modal is content-wrapped (height:auto).
        const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
        // env(safe-area-*) doesn't resolve via getComputedStyle consistently across browsers;
        // keep a conservative 0 here since we already cap to 90% viewport height.
        const safeTop = 0;
        const safeBottom = 0;

        const padX = 24; // modal padding + breathing room
        const padY = 20; // modal padding + breathing room
        const availableW = Math.max(240, ir.width - padX);
        const availableH = Math.max(
          220,
          Math.min(viewportH * 0.9, viewportH - safeTop - safeBottom) - actionsH - padY
        );

        w = Math.max(w, availableW);
        h = Math.max(h, availableH);
      }

      if (!w) w = window.innerWidth - 32;
      if (!h) h = Math.max(200, window.innerHeight * 0.65 - 100);
      const pad = 8;
      const s = Math.min(1, (w - pad) / PREVIEW_BASE_W, (h - pad) / PREVIEW_BASE_H);
      setPreviewScale(Math.max(0.15, Math.min(1, s)));
    };

    compute();
    const raf =
      typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(() => compute()) : 0;
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, []);

  return (
    <div
      className="jobcard-print-container"
      style={{
        maxWidth: "100%",
        minWidth: 0,
        minHeight: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        height: "100%",
        overflow: "hidden",
      }}
    >
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
          .jobcard-print-preview-outer {
            width: auto !important;
            height: auto !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
          }
          .jobcard-print-sheet {
            transform: none !important;
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

      <div
        className="jobcard-print-actions"
        style={{
          marginBottom: "0.5rem",
          display: "flex",
          gap: "0.5rem",
          justifyContent: "flex-end",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
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
        ref={previewRef}
        className="jobcard-print-preview-host"
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          flex: "1 1 auto",
          minHeight: 0,
          maxHeight: "100%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Wrapper fixes layout: transform:scale does not shrink flow size — without this, mobile gets 1122px horizontal overflow. */}
        <div
          className="jobcard-print-preview-outer"
          style={{
            width: PREVIEW_BASE_W * previewScale,
            height: PREVIEW_BASE_H * previewScale,
            overflow: "hidden",
            flexShrink: 0,
            margin: "0 auto",
          }}
        >
          <div
            ref={printRef}
            className="jobcard-print-sheet"
            style={{
              position: "relative",
              width: `${PREVIEW_BASE_W}px`,
              height: `${PREVIEW_BASE_H}px`,
              minWidth: `${PREVIEW_BASE_W}px`,
              minHeight: `${PREVIEW_BASE_H}px`,
              padding: "20px",
              backgroundColor: "white",
              border: "1px solid #000",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              fontFamily: "Arial, sans-serif",
              fontSize: "11pt",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
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

        {/* Parts table: density auto-tightens row gap + Details font when content overflows */}
        <div
          ref={partsWrapRef}
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
        <table
          ref={partsTableRef}
          className={`jobcard-parts-table${isCompact ? " compact" : ""}`}
          style={{ width: "100%", borderCollapse: "collapse", height: "100%", minHeight: "100px", border: "1px solid #000", tableLayout: "fixed", fontSize: "11pt" }}
          cellSpacing={0}
          cellPadding={0}
        >
          <thead>
            <tr>
              <td style={{ border: "1px solid #000", padding: densityStyle.theadCellPad, fontWeight: 700, width: "5%" }}>No.</td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: densityStyle.theadCellPad,
                  fontWeight: 700,
                  width: "35%",
                  fontSize: `${densityStyle.headerDetailsFontPt}pt`,
                }}
              >
                Details
              </td>
              <td style={{ border: "1px solid #000", padding: densityStyle.theadCellPad, fontWeight: 700, width: "45%" }}>PARTS</td>
              <td style={{ border: "1px solid #000", padding: densityStyle.theadCellPad, fontWeight: 700, width: "15%" }}>PRICE</td>
            </tr>
          </thead>
          <tbody>
            {/* Details and Parts: side by side from top - each row has one detail + one part */}
            {Array.from({ length: maxRows }).map((_, i) => {
              const detail = detailsList[i];
              const part = parts[i];
              const belowBlock = isBelowLayoutBlock(i);
              const cellStyle = {
                borderLeft: "1px solid #000",
                borderRight: "1px solid #000",
                borderTop: "none",
                borderBottom: "none",
                padding: belowBlock ? "0 0.5rem" : `${bodyPadY} 0.5rem`,
                lineHeight: belowBlock ? 1 : bodyLineHeight,
                ...(vfRowH != null ? { verticalAlign: "middle" } : {}),
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
                if (part.salesType === "oldScooty") {
                  const rawPmc = String(part.pmcNo || "").trim();
                  const pmcDisplay = rawPmc
                    ? `PMC-${rawPmc.replace(/^PMC-?/i, "")}`
                    : "";
                  label = pmcDisplay ? `${pmcDisplay} - ${partName}` : partName;
                }
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
              const detailCellStyle = {
                ...cellStyle,
                fontSize: `${filledDetailsFontPt}pt`,
                fontWeight: DETAILS_BODY_FONT_WEIGHT,
              };
              return (
                <tr key={i} style={lineRowTrStyle(i)}>
                  <td
                    style={{
                      ...cellStyle,
                      borderLeft: "none",
                      ...(no !== "" ? { fontWeight: DETAILS_BODY_FONT_WEIGHT } : {}),
                    }}
                  >
                    {no}
                  </td>
                  <td style={detailCellStyle}>{detailText}</td>
                  <td style={cellStyle}>{partText}</td>
                  <td style={{ ...cellStyle, borderRight: "none" }}>{priceText}</td>
                </tr>
              );
            })}
            {Array.from({ length: Math.max(0, 20 - maxRows) }).map((_, i) => {
              const lineIdx = maxRows + i;
              const belowBlock = isBelowLayoutBlock(lineIdx);
              const cellStyle = {
                borderLeft: "1px solid #000",
                borderRight: "1px solid #000",
                borderTop: "none",
                borderBottom: "none",
                padding: belowBlock ? "0 0.5rem" : `${bodyPadY} 0.5rem`,
                lineHeight: belowBlock ? 1 : bodyLineHeight,
                ...(vfRowH != null ? { verticalAlign: "middle" } : {}),
              };
              const emptyDetailStyle = {
                ...cellStyle,
                fontSize: `${filledDetailsFontPt}pt`,
                fontWeight: DETAILS_BODY_FONT_WEIGHT,
              };
              return (
                <tr key={`empty-${i}`} style={lineRowTrStyle(lineIdx)}>
                  <td style={{ ...cellStyle, borderLeft: "none" }}></td>
                  <td style={emptyDetailStyle}></td>
                  <td style={cellStyle}></td>
                  <td style={{ ...cellStyle, borderRight: "none" }}></td>
                </tr>
              );
            })}
            {/* Spacer row: fills remaining space when few rows; min height shrinks at higher density */}
            <tr>
              <td style={{ borderLeft: "none", borderRight: "1px solid #000", borderTop: "none", borderBottom: "none", padding: 0, verticalAlign: "top" }}>
                <div
                  style={{
                    height: "1px",
                    display: "block",
                    minHeight:
                      vfRowH != null
                        ? "4px"
                        : densityStyle.useTallSpacer
                          ? "min(90mm, 38vh)"
                          : `${densityStyle.spacerMinMm}mm`,
                  }}
                />
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
      </div>
    </div>
  );
}
