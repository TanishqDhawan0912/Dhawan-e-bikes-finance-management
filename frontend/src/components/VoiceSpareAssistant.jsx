import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../config/api";
import {
  parseVoiceSpareText,
  filterIntegerDigits,
} from "../utils/voiceSpareParse";
import {
  getModelOptions,
  isUniversalSpare,
  needsModelPicker,
} from "../utils/spareModelVoice";

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function formatModelsLine(m) {
  const models = Array.isArray(m.models) ? m.models.filter(Boolean) : [];
  if (models.length === 0) return "Models: —";
  const preview = models.slice(0, 3).join(", ");
  return `Models: ${preview}${models.length > 3 ? "…" : ""}`;
}

/**
 * Mic → parse → search → confirm (with model step when spare has multiple models).
 * onConfirmPart(spare, qty, voiceMeta) where voiceMeta is { isUniversal } or { selectedModel }.
 */
export default function VoiceSpareAssistant({
  onConfirmPart,
  onCustomVoicePart,
  disabled = false,
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [matches, setMatches] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  /** String so the field can be cleared while editing; coerce on Confirm. */
  const [quantity, setQuantity] = useState("1");
  const [searching, setSearching] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  /** Parsed spare phrase sent to API (e.g. throttle) — shown in modal header */
  const [searchQueryText, setSearchQueryText] = useState("");
  /** Narrow long result lists inside the modal */
  const [listFilter, setListFilter] = useState("");
  const recognitionRef = useRef(null);
  const lastSubmitAt = useRef(0);
  const transcriptRef = useRef("");

  const showToast = useCallback((message) => {
    setToast(message);
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const selectedSpare = useMemo(
    () => matches.find((m) => String(m._id) === String(selectedId)) || null,
    [matches, selectedId]
  );

  useEffect(() => {
    if (!selectedSpare) {
      setSelectedModel("");
      return;
    }
    if (isUniversalSpare(selectedSpare)) {
      setSelectedModel("");
      return;
    }
    const opts = getModelOptions(selectedSpare);
    setSelectedModel(opts.length === 1 ? opts[0] : "");
  }, [selectedSpare]);

  const filteredMatches = useMemo(() => {
    const f = listFilter.trim().toLowerCase();
    if (!f) return matches;
    return matches.filter((m) => {
      const blob = `${m.name || ""} ${m.sellingPrice ?? ""} ${formatModelsLine(
        m
      )} ${m.supplierName || ""}`.toLowerCase();
      return blob.includes(f);
    });
  }, [matches, listFilter]);

  useEffect(() => {
    if (filteredMatches.length === 0) return;
    const ok = filteredMatches.some((m) => String(m._id) === String(selectedId));
    if (!ok && filteredMatches[0]?._id) {
      setSelectedId(String(filteredMatches[0]._id));
    }
  }, [filteredMatches, selectedId]);

  const confirmAllowed = useMemo(() => {
    if (!selectedId || matches.length === 0) return false;
    if (
      listFilter.trim() &&
      !filteredMatches.some((m) => String(m._id) === String(selectedId))
    ) {
      return false;
    }
    const spare = matches.find((m) => String(m._id) === String(selectedId));
    if (!spare) return false;
    if (isUniversalSpare(spare)) return true;
    const opts = getModelOptions(spare);
    if (opts.length <= 1) return true;
    return Boolean(selectedModel);
  }, [selectedId, matches, selectedModel, listFilter, filteredMatches]);

  const runSearch = useCallback(
    async (itemName, defaultQty) => {
      const q = String(itemName || "").trim();
      if (!q) {
        setNoMatch(true);
        setMatches([]);
        setSelectedId("");
        setSelectedModel("");
        setSearchQueryText("");
        setListFilter("");
        setQuantity("1");
        setModalOpen(true);
        return;
      }
      setSearching(true);
      setNoMatch(false);
      setSearchQueryText(q);
      setListFilter("");
      try {
        const res = await fetch(`${API_BASE}/items/search-by-voice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "Search failed");
        }
        const items = Array.isArray(data.items) ? data.items : [];
        setMatches(items);
        setSelectedId(items[0]?._id ? String(items[0]._id) : "");
        setQuantity(String(Math.max(1, defaultQty || 1)));
        setNoMatch(items.length === 0);
        setModalOpen(true);
      } catch (e) {
        console.error(e);
        showToast("Voice not recognized");
        setMatches([]);
        setNoMatch(true);
        setSearchQueryText(q);
        setQuantity(String(Math.max(1, defaultQty || 1)));
        setModalOpen(true);
      } finally {
        setSearching(false);
      }
    },
    [showToast]
  );

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      showToast("Voice not recognized");
      return;
    }
    if (disabled) return;

    transcriptRef.current = "";
    setTranscript("");
    setListening(true);

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      let full = "";
      for (let i = 0; i < ev.results.length; i++) {
        full += ev.results[i][0]?.transcript || "";
      }
      const t = full.trim();
      transcriptRef.current = t;
      setTranscript(t);
    };

    rec.onerror = (ev) => {
      console.warn("SpeechRecognition error:", ev?.error);
      setListening(false);
      showToast("Voice not recognized");
    };

    rec.onend = () => {
      setListening(false);
      const text = transcriptRef.current || "";
      const { quantity: q, itemName, isCustom } = parseVoiceSpareText(text);
      if (!itemName) {
        showToast("Voice not recognized");
        return;
      }
      if (isCustom) {
        if (typeof onCustomVoicePart === "function") {
          onCustomVoicePart(itemName, q);
        } else {
          showToast("Custom spare is not available here");
        }
        return;
      }
      runSearch(itemName, q);
    };

    try {
      rec.start();
    } catch (e) {
      console.error(e);
      setListening(false);
      showToast("Voice not recognized");
    }
  }, [disabled, runSearch, showToast, onCustomVoicePart]);

  const handleConfirm = useCallback(() => {
    const now = Date.now();
    if (now - lastSubmitAt.current < 650) return;
    lastSubmitAt.current = now;

    const spare = matches.find((m) => String(m._id) === String(selectedId));
    if (!spare) {
      showToast("Item not found, please select manually");
      return;
    }
    const qty = Math.max(
      1,
      Math.floor(Number.parseInt(String(quantity).trim(), 10) || 1)
    );

    if (isUniversalSpare(spare)) {
      onConfirmPart?.(spare, qty, { isUniversal: true });
    } else {
      const opts = getModelOptions(spare);
      const model =
        opts.length <= 1 ? opts[0] || null : selectedModel || null;
      if (opts.length >= 2 && !model) {
        showToast("Please select a model");
        return;
      }
      onConfirmPart?.(spare, qty, {
        isUniversal: false,
        selectedModel: model,
      });
    }

    setModalOpen(false);
    setMatches([]);
    setTranscript("");
    setSelectedModel("");
    setListFilter("");
    setSearchQueryText("");
  }, [
    matches,
    onConfirmPart,
    quantity,
    selectedId,
    selectedModel,
    showToast,
  ]);

  const handleCancel = () => {
    setModalOpen(false);
    setMatches([]);
    setNoMatch(false);
    setSelectedModel("");
    setListFilter("");
    setSearchQueryText("");
  };

  const modelOpts = selectedSpare ? getModelOptions(selectedSpare) : [];
  const showUniversalHint =
    selectedSpare && !noMatch && isUniversalSpare(selectedSpare);
  const showSingleModelHint =
    selectedSpare &&
    !noMatch &&
    !isUniversalSpare(selectedSpare) &&
    modelOpts.length === 1;
  const showModelPicker =
    selectedSpare && !noMatch && needsModelPicker(selectedSpare);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "#374151",
            visibility: "hidden",
          }}
          aria-hidden
        >
          Voice
        </span>
        <button
          type="button"
          disabled={disabled || listening || searching}
          onClick={startListening}
          title="Add spare by voice"
          aria-label="Add spare by voice"
          style={{
            minWidth: "44px",
            height: "38px",
            borderRadius: "0.375rem",
            border: listening
              ? "2px solid #2563eb"
              : "1px solid #d1d5db",
            background: listening ? "#eff6ff" : "#ffffff",
            cursor: disabled ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.15rem",
            boxShadow: listening
              ? "0 0 0 3px rgba(37, 99, 235, 0.35)"
              : "none",
            transition: "box-shadow 0.2s ease, background 0.2s ease",
          }}
        >
          🎤
        </button>
        {(listening || transcript) && (
          <div
            style={{
              fontSize: "0.7rem",
              color: listening ? "#2563eb" : "#6b7280",
              maxWidth: "140px",
              lineHeight: 1.3,
            }}
          >
            {listening ? "Listening…" : transcript ? `“${transcript}”` : null}
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: "1.25rem",
            right: "1.25rem",
            zIndex: 10050,
            padding: "0.65rem 1rem",
            background: "#1f2937",
            color: "#fff",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            maxWidth: "min(320px, 90vw)",
          }}
        >
          {toast}
        </div>
      )}

      {modalOpen && (
        <div
          className="voice-spare-modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10040,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => e.target === e.currentTarget && handleCancel()}
        >
          <div
            className="voice-spare-modal-panel"
            style={{
              background: "#fff",
              borderRadius: "0.5rem",
              padding: "1.25rem",
              maxWidth: "min(560px, 96vw)",
              width: "100%",
              maxHeight: "min(92dvh, 720px)",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="voice-spare-modal-title"
              style={{
                margin: "0 0 0.65rem 0",
                fontSize: "1.05rem",
                fontWeight: 600,
                color: "#0f172a",
                flexShrink: 0,
              }}
            >
              Confirm spare
            </h3>

            <div className="voice-spare-modal-body">
            {searchQueryText && matches.length > 0 && (
              <div
                style={{
                  marginBottom: "0.85rem",
                  padding: "0.75rem 0.9rem",
                  background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#64748b",
                  }}
                >
                  Voice search text
                </div>
                <div
                  style={{
                    marginTop: "0.35rem",
                    fontSize: "1.05rem",
                    fontWeight: 600,
                    color: "#1e40af",
                    wordBreak: "break-word",
                  }}
                >
                  “{searchQueryText}”
                </div>
                <div style={{ marginTop: "0.4rem", fontSize: "0.8rem", color: "#475569" }}>
                  {matches.length} matching line{matches.length === 1 ? "" : "s"} in catalog
                  {listFilter.trim() && filteredMatches.length !== matches.length
                    ? ` · showing ${filteredMatches.length} after filter`
                    : ""}
                </div>
              </div>
            )}

            {noMatch && matches.length === 0 && (
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#b45309",
                  marginBottom: "0.75rem",
                }}
              >
                Item not found, please select manually
              </p>
            )}

            {matches.length > 0 && (
              <>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.35rem",
                    color: "#334155",
                  }}
                >
                  Pick spare line
                </label>
                <input
                  type="search"
                  value={listFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                  placeholder="Filter by name, price, model…"
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.65rem",
                    marginBottom: "0.5rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.875rem",
                    boxSizing: "border-box",
                  }}
                />
                <div
                  className="voice-spare-modal-list"
                  role="listbox"
                  aria-label="Matching spares"
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                    marginBottom: "0.85rem",
                    background: "#fafafa",
                  }}
                >
                  {filteredMatches.length === 0 ? (
                    <div
                      style={{
                        padding: "1rem",
                        fontSize: "0.85rem",
                        color: "#b45309",
                        textAlign: "center",
                      }}
                    >
                      No lines match the filter — clear the box above to see all {matches.length}{" "}
                      matches.
                    </div>
                  ) : (
                    filteredMatches.map((m) => {
                      const id = String(m._id);
                      const active = id === String(selectedId);
                      return (
                        <button
                          key={id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => setSelectedId(id)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "0.65rem 0.85rem",
                            border: "none",
                            borderBottom: "1px solid #eef2f7",
                            background: active ? "#eff6ff" : "#ffffff",
                            borderLeft: active ? "3px solid #2563eb" : "3px solid transparent",
                            cursor: "pointer",
                            display: "block",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.9rem",
                              color: "#0f172a",
                              lineHeight: 1.35,
                            }}
                          >
                            {m.name || "Spare"}
                          </div>
                          <div
                            style={{
                              marginTop: "0.35rem",
                              fontSize: "0.78rem",
                              color: "#64748b",
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.35rem 0.75rem",
                              alignItems: "center",
                            }}
                          >
                            <span style={{ fontWeight: 600, color: "#0369a1" }}>
                              ₹{Number(m.sellingPrice ?? 0).toFixed(2)}
                            </span>
                            <span style={{ color: "#94a3b8" }}>·</span>
                            <span>{formatModelsLine(m)}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {showUniversalHint && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#047857",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderRadius: "0.375rem",
                  padding: "0.5rem 0.65rem",
                  marginBottom: "0.85rem",
                }}
              >
                Universal spare — fits all models. Confirm quantity below.
              </div>
            )}

            {showSingleModelHint && (
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "#475569",
                  marginBottom: "0.85rem",
                }}
              >
                Model: <strong>{modelOpts[0]}</strong>
              </p>
            )}

            {showModelPicker && (
              <>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    marginBottom: "0.35rem",
                    color: "#374151",
                  }}
                >
                  Compatible model <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.65rem",
                    marginBottom: "0.85rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                    fontSize: "0.9rem",
                  }}
                >
                  <option value="">Select model…</option>
                  {modelOpts.map((mo) => (
                    <option key={mo} value={mo}>
                      {mo}
                    </option>
                  ))}
                </select>
              </>
            )}
            </div>

            <div className="voice-spare-modal-footer">
            <label
              htmlFor="voice-spare-qty"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 500,
                marginBottom: "0.35rem",
                color: "#374151",
              }}
            >
              Quantity
            </label>
            <input
              id="voice-spare-qty"
              type="number"
              min={1}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(filterIntegerDigits(e.target.value))}
              onBlur={() => {
                if (String(quantity).trim() === "") setQuantity("1");
              }}
              style={{
                width: "100%",
                padding: "0.5rem 0.65rem",
                marginBottom: "0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
            />
            <div
              className="voice-spare-modal-footer-actions"
              style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
            >
              <button
                type="button"
                onClick={handleCancel}
                className="voice-spare-modal-btn voice-spare-modal-btn-secondary"
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmAllowed}
                onClick={handleConfirm}
                className="voice-spare-modal-btn voice-spare-modal-btn-primary"
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: confirmAllowed ? "pointer" : "not-allowed",
                  opacity: confirmAllowed ? 1 : 0.5,
                }}
              >
                Confirm
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
