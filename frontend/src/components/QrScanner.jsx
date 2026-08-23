import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { FiZap, FiZapOff } from "react-icons/fi";
import { fetchWithRetry } from "../config/api";

export default function QrScanner({ onClose }) {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const processingRef = useRef(false);
  const errorTimeoutRef = useRef(null);
  const [status, setStatus] = useState("Opening camera...");
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState(null);
  const [jobcards, setJobcards] = useState([]);
  const [totalPendingAmount, setTotalPendingAmount] = useState(0);
  const [showJobcards, setShowJobcards] = useState(false);
  const [openingJobcardId, setOpeningJobcardId] = useState("");
  const [flash, setFlash] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

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
      const scanner = new Html5Qrcode("home-qr-reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        useBarCodeDetectorIfSupported: true,
      });
      scannerRef.current = scanner;

      const makeQrbox = (ratio) => (viewfinderWidth, viewfinderHeight) => {
        const size = Math.floor(
          Math.min(viewfinderWidth, viewfinderHeight) * ratio,
        );
        return { width: size, height: size };
      };

      const baseConfig = {
        aspectRatio: 4 / 3,
        disableFlip: false,
      };

      const onScanSuccess = async (decodedText) => {
        if (processingRef.current || !decodedText) return;
        processingRef.current = true;
        setFlash(true);
        setError("");
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(60);
        }
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
            setError(
              "No saved login session on this device. Log in once using Admin.",
            );
            setStatus("Login required");
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
          setTotalPendingAmount(Number(data.totalPendingAmount) || 0);
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
          setFlash(false);
          setStatus("Unable to complete QR lookup");
          processingRef.current = false;
          if (errorTimeoutRef.current) {
            clearTimeout(errorTimeoutRef.current);
          }
          // Auto-clear the message so scanning feels continuous.
          errorTimeoutRef.current = setTimeout(() => setError(""), 2500);
        }
      };

      const onScanFailure = () => {};

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access is not supported by this browser.");
        }

        // Prompt for camera access directly so the browser supplies a useful
        // permission or device error before the scanner selects a camera.
        const permissionStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        permissionStream.getTracks().forEach((track) => track.stop());

        const cameras = await Html5Qrcode.getCameras();
        const camera =
          cameras.find((device) =>
            /back|rear|environment/i.test(device.label),
          ) || cameras[0];
        if (!camera) {
          throw new Error("No camera is available on this device.");
        }

        // Html5Qrcode cannot safely retry start() on the same instance while a
        // failed start is still settling, so select a device before starting.
        await scanner.start(
          camera.id,
          { ...baseConfig, fps: 15, qrbox: makeQrbox(0.78) },
          onScanSuccess,
          onScanFailure,
        );

        if (cancelled) return;
        setStatus("Scan QR code");
        try {
          const capabilities = scanner.getRunningTrackCapabilities?.();
          if (capabilities && "torch" in capabilities) {
            setTorchSupported(true);
          }
        } catch {
          // Torch capability detection is not supported on this browser.
        }
      } catch (cameraError) {
        if (import.meta.env.DEV) {
          console.warn("[QR] camera start failed", cameraError);
        }
        if (!cancelled) {
          const errorText =
            typeof cameraError === "string"
              ? cameraError
              : `${cameraError?.name || ""} ${cameraError?.message || ""}`;
          const name =
            cameraError?.name ||
            errorText.match(
              /NotAllowedError|SecurityError|NotFoundError|OverconstrainedError|NotReadableError/,
            )?.[0] ||
            "";
          if (!window.isSecureContext) {
            setError(
              "Camera access requires HTTPS. Open this app using its HTTPS address.",
            );
          } else if (name === "NotAllowedError" || name === "SecurityError") {
            setError(
              "Camera permission was denied. Allow camera access in your browser settings and try again.",
            );
          } else if (
            name === "NotFoundError" ||
            name === "OverconstrainedError"
          ) {
            setError("No camera is available on this device.");
          } else if (name === "NotReadableError") {
            setError(
              "Camera is in use by another app. Close it and try again.",
            );
          } else {
            setError(
              `Camera could not be started${errorText ? `: ${errorText}` : "."}`,
            );
          }
          setStatus("Camera unavailable");
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      processingRef.current = true;
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      stop();
    };
  }, []);

  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const next = !torchOn;
    try {
      await scanner.applyVideoConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      // This device or browser does not support torch control.
    }
  };

  const formatJobcardDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  };

  const openJobcard = async (jobcard) => {
    if (!jobcard?._id || openingJobcardId) return;
    setOpeningJobcardId(jobcard._id);
    setError("");
    try {
      const response = await fetchWithRetry(`/jobcards/${jobcard._id}`);
      if (!response.ok) throw new Error("Failed to load job card");
      const fullJobcard = await response.json();
      onClose();
      if (fullJobcard.status === "pending") {
        // Pending list scrolls this card into view.
        navigate("/jobcards/pending", {
          state: { editedJobcardId: String(fullJobcard._id) },
        });
      } else {
        // Finalized list opens the full details modal.
        navigate("/jobcards/all", {
          state: { selectedJobcard: fullJobcard },
        });
      }
    } catch {
      setError("Unable to open this job card.");
      setOpeningJobcardId("");
    }
  };

  return (
    <div
      className="qr-scanner-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Scan QR"
    >
      <div className="qr-scanner-modal">
        <div className="qr-scanner-heading">
          <h2>
            {customer ? (
              <span className="qr-scanner-found-heading">
                CUSTOMER FOUND ✓
                <span
                  className={`qr-type-dot qr-type-${
                    customer.customerType || "green"
                  }`}
                  title={`${(customer.customerType || "green").toUpperCase()} customer`}
                />
              </span>
            ) : (
              "Scan QR"
            )}
          </h2>
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
          <div className="qr-scanner-viewfinder">
            <div id="home-qr-reader" className="qr-scanner-reader" />
            <div className="qr-scanner-overlay" aria-hidden="true">
              <div className={`qr-scanner-frame${flash ? " qr-flash" : ""}`}>
                <span className="qr-corner qr-corner-tl" />
                <span className="qr-corner qr-corner-tr" />
                <span className="qr-corner qr-corner-bl" />
                <span className="qr-corner qr-corner-br" />
                <span className="qr-scan-line" />
              </div>
            </div>
            {torchSupported ? (
              <button
                type="button"
                className={`qr-torch-btn${torchOn ? " qr-torch-on" : ""}`}
                onClick={toggleTorch}
                aria-label={
                  torchOn ? "Turn flashlight off" : "Turn flashlight on"
                }
                aria-pressed={torchOn}
              >
                {torchOn ? <FiZap /> : <FiZapOff />}
              </button>
            ) : null}
          </div>
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
            <div>
              <strong>Pending</strong>
              <span
                className={
                  totalPendingAmount > 0 ? "qr-pending-due" : "qr-pending-clear"
                }
              >
                {totalPendingAmount > 0
                  ? `₹${totalPendingAmount.toFixed(2)}`
                  : "No dues"}
              </span>
            </div>
            <div>
              <strong>Type</strong>
              <span className="qr-type-label">
                <span
                  className={`qr-type-dot qr-type-${
                    customer.customerType || "green"
                  }`}
                />
                {(customer.customerType || "green").toUpperCase()}
              </span>
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
                      <button
                        type="button"
                        key={jobcard._id}
                        className="qr-jobcard-row"
                        onClick={() => openJobcard(jobcard)}
                        disabled={Boolean(openingJobcardId)}
                      >
                        <span className="qr-jc-number">
                          {openingJobcardId === jobcard._id
                            ? "Opening..."
                            : jobcard.jobcardNumber || "Job card"}
                        </span>
                        <span className="qr-jc-date">
                          {formatJobcardDate(jobcard.date)}
                        </span>
                        {Number(jobcard.pendingAmount) > 0 ? (
                          <span className="qr-jc-due">
                            ₹{Number(jobcard.pendingAmount).toFixed(0)}
                          </span>
                        ) : null}
                        <span
                          className={`qr-jc-status qr-jc-${
                            jobcard.status || "pending"
                          }`}
                        >
                          {jobcard.status || "pending"}
                        </span>
                      </button>
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
