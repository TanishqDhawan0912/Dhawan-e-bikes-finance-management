/**
 * Allowed browser origins (comma-separated in CORS_ORIGINS).
 * Trailing slashes are stripped. Requests with no Origin (curl, mobile) are allowed.
 */
function parseAllowedOrigins() {
  const fromEnv = process.env.CORS_ORIGINS?.trim();
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean);
  }

  return [
    "https://dhawan-e-bikes-finance-management.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
}

function buildCorsOptions() {
  const allowedOrigins = parseAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn("[CORS] Blocked origin:", origin);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  };
}

module.exports = { buildCorsOptions, parseAllowedOrigins };
