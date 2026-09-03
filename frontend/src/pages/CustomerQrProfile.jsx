import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchWithRetry } from "../config/api";

function formatMoney(value) {
  const amount = Number(value) || 0;
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return String(dateString);
  return d.toLocaleDateString("en-GB");
}

export default function CustomerQrProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [jobcards, setJobcards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [qrImageData, setQrImageData] = useState("");
  const [scootyModelInput, setScootyModelInput] = useState("");
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [printPosition, setPrintPosition] = useState("middle");

  const totalPending = useMemo(() => {
    return jobcards.reduce(
      (sum, row) => sum + (Number(row.pendingAmount) || 0),
      0,
    );
  }, [jobcards]);

  const warrantyJobcard = useMemo(
    () =>
      jobcards.find((row) => row.warrantyType && row.warrantyType !== "none"),
    [jobcards],
  );

  const warrantyStatus =
    customer?.warrantyStatus === "warranty" || warrantyJobcard
      ? "warranty"
      : "none";
  const warrantyDate =
    customer?.warrantyDate || warrantyJobcard?.warrantyDate || "";
  const scootyModel =
    customer?.scootyModel ||
    jobcards.find((row) => String(row.ebikeDetails || "").trim())
      ?.ebikeDetails ||
    "";

  const customerType = customer?.customerType || "green";

  const updateCustomerType = async (type) => {
    if (type === customerType) return;
    try {
      const response = await fetchWithRetry(`/customers/${id}/type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerType: type }),
      });
      const data = await response.json();
      setCustomer(data?.customer || { ...customer, customerType: type });
    } catch (e) {
      setError(e?.message || "Failed to update customer type");
    }
  };

  const qrImageUrl = useMemo(() => {
    // Prefer locally generated data URL (reliable for print); fall back to
    // the external API only for on-screen display when no data URL exists yet.
    if (qrImageData) return qrImageData;
    if (!qrToken) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=420x420&ecc=H&qzone=2&data=${encodeURIComponent(qrToken)}`;
  }, [qrToken, qrImageData]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        setError("");
        const res = await fetchWithRetry(`/customers/${id}/history`, {
          method: "GET",
        });
        const data = await res.json();
        setCustomer(data?.customer || null);
        const loadedJobcards = Array.isArray(data?.jobcards)
          ? data.jobcards
          : [];
        setJobcards(loadedJobcards);
        setScootyModelInput(
          data?.customer?.scootyModel ||
            loadedJobcards.find((row) => String(row.ebikeDetails || "").trim())
              ?.ebikeDetails ||
            "",
        );
        const imageResponse = await fetchWithRetry(`/qr/customers/${id}/image`);
        const imageData = await imageResponse.json();
        setQrToken(imageData?.qrToken || "");
        setQrImageData(imageData?.qrImage || "");
      } catch (e) {
        setError(e?.message || "Failed to load customer details");
        setCustomer(null);
        setJobcards([]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [id]);

  const updateScootyModel = async () => {
    const value = scootyModelInput.trim();
    if (value === scootyModel) return;
    try {
      const response = await fetchWithRetry(`/customers/${id}/model`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scootyModel: value }),
      });
      const data = await response.json();
      setCustomer(data?.customer || { ...customer, scootyModel: value });
    } catch (e) {
      setError(e?.message || "Failed to update scooty model");
    }
  };

  const openNewJobcardPrefilled = () => {
    if (!customer) return;
    navigate("/jobcards/new", {
      state: {
        prefillCustomer: {
          customerId: customer._id,
          customerName: customer.name || "",
          place: customer.place || "",
          mobile: customer.mobile || "",
          warrantyStatus,
          warrantyDate,
          scootyModel,
        },
      },
    });
  };

  const printQrSticker = (position = printPosition) => {
    // Use the locally generated data URL so printing does not depend on a
    // cross-origin image, which Chrome can fail to rasterize (blank page).
    const imgSrc = qrImageData || qrImageUrl;
    if (!imgSrc) return;

    const customerName = customer?.name || "";
    const alignment =
      position === "left"
        ? "flex-start"
        : position === "right"
          ? "flex-end"
          : "center";

    // Print via a hidden iframe instead of window.open(): popups are
    // frequently blocked (silently falling back to printing the clipped SPA
    // shell, which looks like a blank page), while an iframe always works
    // and keeps the exact same sticker markup/size.
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Scooty QR Sticker</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        font-family: system-ui, -apple-system, sans-serif;
        color: #111827;
      }
      .sticker-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        align-self: ${alignment};
      }
      h1 { font-size: 20px; margin: 0 0 4px; }
      p { font-size: 12px; color: #4b5563; margin: 0 0 12px; }
      img {
        width: 192px;
        height: 192px;
        display: block;
      }
      @page { margin: 0; }
      @media print {
        body { min-height: auto; padding: 8mm; }
      }
    </style>
  </head>
  <body>
    <div class="sticker-content">
      <h1>Dhawan E-Bikes</h1>
      <p>${customerName ? `Owner: ${customerName}` : "Scooty QR Sticker"}</p>
      <img id="qrImg" src="${imgSrc}" alt="QR code" />
    </div>
  </body>
</html>`);
    doc.close();

    const runPrint = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(cleanup, 1000);
    };

    const img = doc.getElementById("qrImg");
    if (img.complete) {
      runPrint();
    } else {
      img.onload = runPrint;
      img.onerror = runPrint;
    }
  };

  const openPrintOptions = () => {
    if (!qrImageUrl) return;
    setPrintPosition("middle");
    setShowPrintOptions(true);
  };

  const confirmPrint = () => {
    setShowPrintOptions(false);
    printQrSticker(printPosition);
  };

  return (
    <div className="page customer-qr-page">
      <header className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Scooty Owner Card</h1>
            <p>Customer details and complete jobcard history.</p>
          </div>
          <div className="header-right customer-qr-header-actions">
            <button
              className="btn btn-secondary"
              onClick={() => navigate(-1)}
              title="Go back"
            >
              Back
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/")}>
              Home
            </button>
            <button
              className="btn btn-primary"
              onClick={openNewJobcardPrefilled}
              disabled={!customer}
            >
              New Jobcard
            </button>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="customer-loading">Loading customer data...</div>
      ) : null}
      {error ? <div className="customer-error">{error}</div> : null}

      {!isLoading && customer ? (
        <>
          <section className="customer-qr-owner-card">
            <h3>Owner Details</h3>
            <div className="customer-qr-owner-grid">
              <div>
                <label>Name</label>
                <p>{customer.name || "-"}</p>
              </div>
              <div>
                <label>Place</label>
                <p>{customer.place || "-"}</p>
              </div>
              <div>
                <label>Mobile</label>
                <p>{customer.mobile || "-"}</p>
              </div>
              <div>
                <label>Scooty Model</label>
                <input
                  type="text"
                  value={scootyModelInput}
                  onChange={(event) => setScootyModelInput(event.target.value)}
                  onBlur={updateScootyModel}
                  placeholder="Enter scooty model"
                />
              </div>
              <div>
                <label>Total Jobcards</label>
                <p>{jobcards.length}</p>
              </div>
              <div>
                <label>Total Pending</label>
                <p className={totalPending > 0 ? "customer-pending" : ""}>
                  {formatMoney(totalPending)}
                </p>
              </div>
              <div>
                <label>Warranty</label>
                <p>
                  {warrantyStatus === "warranty" ? "Warranty" : "No Warranty"}
                  {warrantyDate &&
                  warrantyDate !== "NA" &&
                  warrantyDate !== "N/A"
                    ? ` (${formatDate(warrantyDate)})`
                    : ""}
                </p>
              </div>
              <div>
                <label>Customer Type</label>
                <select
                  className="customer-type-select"
                  value={customerType}
                  onChange={(event) => updateCustomerType(event.target.value)}
                  aria-label="Customer Type"
                >
                  <option value="green">Green</option>
                  <option value="red">Red</option>
                  <option value="black">Black</option>
                </select>
              </div>
            </div>
          </section>

          <section className="customer-qr-print-card">
            <h2 className="customer-qr-print-heading">Dhawan E-Bikes</h2>
            <h3>Scooty QR Sticker</h3>
            <p>
              Print and paste this QR on the scooty. Scanning it opens this
              owner card directly.
            </p>
            <div className="customer-qr-print-body">
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt="Customer QR code"
                  className="customer-qr-image"
                />
              ) : null}
              <div className="customer-qr-print-actions">
                <button className="btn btn-primary" onClick={openPrintOptions}>
                  Print QR
                </button>
              </div>
            </div>
          </section>

          {showPrintOptions ? (
            <div
              className="qr-print-options-backdrop"
              role="dialog"
              aria-modal="true"
              aria-labelledby="qr-print-options-title"
            >
              <div className="qr-print-options-modal">
                <div className="qr-print-options-header">
                  <div>
                    <h2 id="qr-print-options-title">Choose QR position</h2>
                    <p>
                      Select how the QR should be aligned on the printed page.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="qr-print-options-close"
                    onClick={() => setShowPrintOptions(false)}
                    aria-label="Close print options"
                  >
                    ×
                  </button>
                </div>
                <div className="qr-print-previews">
                  {[
                    ["left", "Left"],
                    ["middle", "Middle"],
                    ["right", "Right"],
                  ].map(([position, label]) => (
                    <button
                      type="button"
                      key={position}
                      className={`qr-print-preview${
                        printPosition === position ? " selected" : ""
                      }`}
                      onClick={() => setPrintPosition(position)}
                    >
                      <span className="qr-print-preview-label">{label}</span>
                      <span
                        className="qr-print-preview-page"
                        style={{
                          alignItems:
                            position === "left"
                              ? "flex-start"
                              : position === "right"
                                ? "flex-end"
                                : "center",
                        }}
                      >
                        <strong>Dhawan E-Bikes</strong>
                        <small>{customer.name || "Owner"}</small>
                        <img src={qrImageUrl} alt={`${label} QR preview`} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="qr-print-options-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPrintOptions(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={confirmPrint}
                  >
                    Print{" "}
                    {printPosition[0].toUpperCase() + printPosition.slice(1)}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <section className="customer-history-panel">
            <div className="customer-history-header">
              <h3>Past Jobcards</h3>
              {totalPending > 0 ? (
                <strong className="customer-history-pending">
                  Pending from customer: {formatMoney(totalPending)}
                </strong>
              ) : null}
            </div>
            <div className="table-wrapper">
              <table className="simple-table">
                <thead>
                  <tr>
                    <th>Jobcard</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {jobcards.map((j) => (
                    <tr
                      key={j._id}
                      className="customer-history-row"
                      onClick={() =>
                        navigate("/jobcards/all", {
                          state: {
                            selectedJobcard: j,
                            returnPath: `/customer-card/${id}`,
                          },
                        })
                      }
                      title={`Open ${j.jobcardNumber || "jobcard"}`}
                    >
                      <td>{j.jobcardNumber || "-"}</td>
                      <td>{formatDate(j.date)}</td>
                      <td>{j.jobcardType || "-"}</td>
                      <td>{j.status || "pending"}</td>
                      <td>{formatMoney(j.totalAmount)}</td>
                      <td>{formatMoney(j.pendingAmount)}</td>
                    </tr>
                  ))}
                  {jobcards.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        No past jobcards found for this owner.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
