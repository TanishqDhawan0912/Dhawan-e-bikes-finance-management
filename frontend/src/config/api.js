/**
 * API origin: `import.meta.env.VITE_API_URL` (set in Vercel for production builds).
 * Local dev: falls back to http://localhost:5000 when unset.
 * Production build without env: falls back to deployed Render API (set VITE_API_URL in Vercel anyway).
 */
const envUrl = import.meta.env.VITE_API_URL?.trim();
const LOCAL_DEV_ORIGIN = "http://localhost:5000";
const DEPLOYED_API_ORIGIN =
  "https://dhawan-e-bikes-finance-management.onrender.com";

// In local dev, prefer the local backend so new routes work immediately.
// (You can still point to a remote API by setting VITE_API_URL to localhost/127.0.0.1 explicitly.)
const origin = (
  import.meta.env.DEV ? LOCAL_DEV_ORIGIN : envUrl || DEPLOYED_API_ORIGIN
).replace(/\/$/, "");

if (import.meta.env.PROD && !envUrl) {
  console.warn(
    "[api] VITE_API_URL was not set at build time; using Render API URL fallback. Set VITE_API_URL in Vercel to https://dhawan-e-bikes-finance-management.onrender.com for explicit configuration.",
  );
}

/** Base URL for all `/api/...` routes. */
export const API_BASE = `${origin}/api`;

function getStoredToken() {
  const token = localStorage.getItem("token")?.trim();
  if (!token || token === "undefined" || token === "null") {
    if (token) localStorage.removeItem("token");
    return "";
  }
  return token;
}

function logQrRequest(endpoint, token, headers) {
  if (!import.meta.env.DEV || endpoint !== "/qr/scan") return;
  console.info("[QR] request auth state", {
    endpoint,
    jwtExists: Boolean(token),
    authorizationAttached: headers.has("Authorization"),
  });
}

export async function fetchWithRetry(endpoint, options = {}, retries = 2) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  const headers = new Headers(options.headers);
  const token = getStoredToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  logQrRequest(endpoint, token, headers);

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const error = new Error(`Request failed: ${res.status}`);
      error.status = res.status;
      try {
        error.responseBody = (await res.clone().text()).slice(0, 500);
      } catch {
        error.responseBody = "";
      }
      throw error;
    }
    return res;
  } catch (err) {
    if (err?.status === 401) {
      throw err;
    }
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 3000));
      return fetchWithRetry(endpoint, options, retries - 1);
    }
    throw err;
  }
}
