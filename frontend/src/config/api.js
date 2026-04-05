/** Default when `VITE_API_URL` is unset (local dev). */
const DEV_API_ORIGIN = "http://localhost:5000";

const envUrl = import.meta.env.VITE_API_URL?.trim();
const origin = (envUrl || DEV_API_ORIGIN).replace(/\/$/, "");

if (import.meta.env.PROD && !envUrl) {
  console.error(
    "[api] VITE_API_URL was not set at build time. API calls will use localhost and will fail for users. Set VITE_API_URL in Vercel (or your host) to your Render API origin, then redeploy."
  );
}

/** Base URL for all `/api/...` routes. */
export const API_BASE = `${origin}/api`;
