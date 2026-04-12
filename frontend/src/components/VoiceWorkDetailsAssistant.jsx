import { useCallback, useEffect, useRef, useState } from "react";
import { parseWorkDetailsTranscript } from "../utils/parseWorkDetailsVoice";

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Mic → transcript → split on "and" → onAddDetails(lines).
 */
export default function VoiceWorkDetailsAssistant({
  onAddDetails,
  disabled = false,
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [toast, setToast] = useState(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");

  const showToast = useCallback((message) => {
    setToast(message);
    const t = setTimeout(() => setToast(null), 2800);
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

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      showToast("Voice not available in this browser");
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
      const lines = parseWorkDetailsTranscript(text);
      if (lines.length === 0) {
        showToast("No work detail heard");
        return;
      }
      onAddDetails?.(lines);
      const n = lines.length;
      showToast(
        n === 1 ? `Added: ${lines[0]}` : `Added ${n} work details`
      );
      setTranscript("");
    };

    try {
      rec.start();
    } catch (e) {
      console.error(e);
      setListening(false);
      showToast("Voice not recognized");
    }
  }, [disabled, onAddDetails, showToast]);

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          flexShrink: 0,
        }}
      >
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
          disabled={disabled || listening}
          onClick={startListening}
          title="Add work details by voice — say one item, or several separated by “and”"
          aria-label="Add work details by voice"
          style={{
            minWidth: "44px",
            height: "38px",
            borderRadius: "0.375rem",
            border: listening ? "2px solid #059669" : "1px solid #d1d5db",
            background: listening ? "#ecfdf5" : "#ffffff",
            cursor: disabled ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.15rem",
            boxShadow: listening
              ? "0 0 0 3px rgba(5, 150, 105, 0.25)"
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
              color: listening ? "#059669" : "#6b7280",
              maxWidth: "120px",
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
    </>
  );
}
