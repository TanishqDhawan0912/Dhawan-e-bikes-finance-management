/**
 * API origin: `import.meta.env.VITE_API_URL` (set in Vercel for production builds).
 * Local dev: falls back to http://localhost:5000 when unset.
 * Production build without env: falls back to deployed Render API (set VITE_API_URL in Vercel anyway).
 */
const envUrl = import.meta.env.VITE_API_URL?.trim();
const LOCAL_DEV_ORIGIN = "http://localhost:5000";
const DEPLOYED_API_ORIGIN =
  "https://dhawan-e-bikes-finance-management.onrender.com";

const origin = (
  envUrl ||
  (import.meta.env.DEV ? LOCAL_DEV_ORIGIN : DEPLOYED_API_ORIGIN)
).replace(/\/$/, "");

if (import.meta.env.PROD && !envUrl) {
  console.warn(
    "[api] VITE_API_URL was not set at build time; using Render API URL fallback. Set VITE_API_URL in Vercel to https://dhawan-e-bikes-finance-management.onrender.com for explicit configuration."
  );
}

/** Base URL for all `/api/...` routes. */
export const API_BASE = `${origin}/api`;
