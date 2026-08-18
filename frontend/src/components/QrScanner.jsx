import { useEffect, useRef, useState } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { fetchWithRetry } from "../config/api";

export default function QrScanner({ onClose }) {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const processingRef = useRef(false);
  const [status, setStatus] = useState("Opening camera...");
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState(null);
  const [jobcards, setJobcards] = useState([]);
  const [showJobcards, setShowJobcards] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const stop = async () => {
      if (!scannerRef.current) return;
      try {
        await scannerRef.current.stop();
      } catch {
        // Camera may already be stopped after a successful scan.
      }
      try {
        await scannerRef.current.clear();
      } catch {
        // The scanner can already be disposed during unmount.
      }
      scannerRef.current = null;
    };

    const start = async () => {
      try {
        const scanner = new Html5Qrcode("home-qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const size = Math.floor(
                Math.min(viewfinderWidth, viewfinderHeight) * 0.78,
              );
              return { width: size, height: size };
            },
            aspectRatio: 4 / 3,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            useBarCodeDetectorIfSupported: true,
            disableFlip: false,
          },
          async (decodedText) => {
            if (processingRef.current || !decodedText) return;
            processingRef.current = true;
            setStatus("Verifying QR code...");
            try {
              const qrToken = decodedText.trim();
              if (import.meta.env.DEV) {
                console.info("[QR] decoded value", {
                  qrDecoded: Boolean(qrToken),
                  valueLength: qrToken.length,
                  looksLikeUrl: /^https?:\/\//i.test(qrToken),
                  jwtExists: Boolean(localStorage.getItem("token")?.trim()),
                });
              }
              const token = localStorage.getItem("token")?.trim();
              if (!token || token === "undefined" || token === "null") {
                if (import.meta.env.DEV) {
                  console.warn("[QR] request skipped: JWT missing");
                }
                setError("Please log in to continue.");
                setStatus("Scan failed");
                processingRef.current = false;
                return;
              }

              const response = await fetchWithRetry("/qr/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ qrToken }),
              });
              const data = await response.json();
              if (!response.ok || !data?.success || !data?.customer) {
                throw new Error("Customer QR code not found");
              }
              await stop();
              setCustomer(data.customer);
              setJobcards(Array.isArray(data.jobcards) ? data.jobcards : []);
              setStatus("Customer found");
            } catch (scanError) {
              if (import.meta.env.DEV) {
                console.warn("[QR] scan request failed", {
                  status: scanError?.status || "no-response",
                  responseError: scanError?.responseBody || scanError?.message,
                });
              }
              if (scanError?.status === 401) {
                setError("Your login session has expired. Please log in again.");
              } else if (scanError?.status === 403) {
                setError("You are not authorized to view this customer.");
              } else if (scanError?.status === 404) {
                setError("QR customer not found.");
              } else if (scanError?.status) {
                setError("Unable to scan this QR code.");
              } else {
                setError("Unable to connect to the server.");
              }
              setStatus("Unable to complete QR lookup");
              processingRef.current = false;
            }
          },
          () => {},
        );
        if (!cancelled) setStatus("Scan QR code");
      } catch {
        if (!cancelled) {
          setError("Camera permission was denied or no camera is available.");
          setStatus("Camera unavailable");
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      processingRef.current = true;
      stop();
    };
  }, []);

  return (
    <div
      className="qr-scanner-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Scan QR"
    >
      <div className="qr-scanner-modal">
        <div className="qr-scanner-heading">
          <h2>{customer ? "CUSTOMER FOUND ✓" : "Scan QR"}</h2>
          <button
            type="button"
            className="qr-scanner-close"
            onClick={onClose}
            aria-label="Close scanner"
          >
            ×
          </button>
        </div>

        {!customer ? (
          <div id="home-qr-reader" className="qr-scanner-reader" />
        ) : null}
        <p className="qr-scanner-status">{status}</p>
        {error ? <p className="qr-scanner-error">{error}</p> : null}

        {customer ? (
          <div className="qr-scanner-result">
            <div>
              <strong>Name</strong>
              <span>{customer.name}</span>
            </div>
            <div>
              <strong>Place</strong>
              <span>{customer.place}</span>
            </div>
            <div>
              <strong>Phone</strong>
              <span>{customer.phoneNumber}</span>
            </div>
            <div className="qr-scanner-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowJobcards((visible) => !visible)}
              >
                View Job Cards
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  navigate("/jobcards/new", {
                    state: {
                      prefillCustomer: {
                        customerId: customer.id,
                        customerName: customer.name,
                        place: customer.place,
                        mobile: customer.phoneNumber,
                      },
                    },
                  });
                }}
              >
                + Job Card
              </button>
            </div>
            {showJobcards ? (
              <div className="qr-scanner-jobcards">
                {jobcards.length === 0
                  ? "No job cards found."
                  : jobcards.map((jobcard) => (
                      <div key={jobcard._id}>
                        {jobcard.jobcardNumber || "Job card"} -{" "}
                        {jobcard.status || "pending"}
                      </div>
                    ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {!customer && error ? (
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}
