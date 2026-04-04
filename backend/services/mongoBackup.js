/**
 * Scheduled local MongoDB backups via mongodump.
 * Controlled by ENABLE_BACKUP=true and MONGO_LOCAL_URI (same DB the app uses).
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const DEFAULT_BACKUP_ROOT = "D:/backups";
/** Daily at 12:00 (noon), server local time — 5-field cron */
const DEFAULT_BACKUP_CRON = "0 12 * * *";

let backupInProgress = false;
let cronTask = null;

function maskMongoUri(uri) {
  if (!uri || typeof uri !== "string") return "(not set)";
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

function isBackupEnabled() {
  return String(process.env.ENABLE_BACKUP || "").trim().toLowerCase() === "true";
}

function getBackupRoot() {
  const raw = process.env.BACKUP_DIR?.trim();
  if (raw) return path.normalize(raw);
  return path.normalize(DEFAULT_BACKUP_ROOT);
}

function getBackupCronExpression() {
  const raw = process.env.BACKUP_CRON?.trim();
  return raw || DEFAULT_BACKUP_CRON;
}

/**
 * @returns {{ uri: string, dbName: string } | { error: string }}
 */
function resolveLocalMongoTarget() {
  const uri = process.env.MONGO_LOCAL_URI?.trim();
  if (!uri) {
    return { error: "MONGO_LOCAL_URI is not set" };
  }
  let dbName = "";
  try {
    const u = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://"));
    const p = (u.pathname || "").replace(/^\//, "");
    dbName = p.split("/")[0] || "";
  } catch {
    return { error: "MONGO_LOCAL_URI could not be parsed" };
  }
  if (!dbName) {
    return { error: "No database name in MONGO_LOCAL_URI (e.g. .../finance-management)" };
  }
  return { uri, dbName };
}

function timestampFolderName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours()
  )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/**
 * Run mongodump once. Resolves with output directory path, rejects on failure.
 * @param {{ reason?: string }} [opts]
 */
function runMongoDump(opts = {}) {
  const reason = opts.reason || "manual";
  const resolved = resolveLocalMongoTarget();
  if (resolved.error) {
    return Promise.reject(new Error(resolved.error));
  }
  const { uri, dbName } = resolved;
  const backupRoot = getBackupRoot();
  const folder = `${dbName}_${timestampFolderName()}`;
  const outDir = path.join(backupRoot, folder);

  return new Promise((resolve, reject) => {
    fs.mkdirSync(backupRoot, { recursive: true });

    const args = [
      "--uri",
      uri,
      "--db",
      dbName,
      "--gzip",
      "--out",
      outDir,
    ];

    const child = spawn("mongodump", args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: process.env,
    });

    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (c) => {
      stdout += c.toString();
    });
    child.stderr?.on("data", (c) => {
      stderr += c.toString();
    });

    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "mongodump not found. Install MongoDB Database Tools and add them to PATH."
          )
        );
        return;
      }
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ outDir, dbName, reason, stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        const err = new Error(
          `mongodump exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`
        );
        err.code = code;
        err.stderr = stderr;
        err.stdout = stdout;
        reject(err);
      }
    });
  });
}

/**
 * Guarded backup: skips if another run is in progress.
 * @param {{ reason?: string }} [opts]
 */
async function runBackupSafe(opts = {}) {
  if (!isBackupEnabled()) {
    return { skipped: true, reason: "ENABLE_BACKUP is not true" };
  }

  if (backupInProgress) {
    console.warn(
      "[Backup] Skipped (already running):",
      opts.reason || "scheduled or startup"
    );
    return { skipped: true, reason: "already_running" };
  }

  backupInProgress = true;
  const reason = opts.reason || "scheduled";
  const started = Date.now();
  try {
    const result = await runMongoDump({ reason });
    const ms = Date.now() - started;
    console.log("[Backup] SUCCESS", {
      reason,
      db: result.dbName,
      outDir: result.outDir,
      durationMs: ms,
    });
    return { success: true, ...result, durationMs: ms };
  } catch (err) {
    const ms = Date.now() - started;
    console.error("[Backup] FAILURE", {
      reason,
      message: err.message,
      durationMs: ms,
      mongoUriMasked: maskMongoUri(process.env.MONGO_LOCAL_URI),
    });
    return { success: false, error: err.message, durationMs: ms };
  } finally {
    backupInProgress = false;
  }
}

function stopBackupScheduler() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log("[Backup] Scheduled job stopped");
  }
}

/**
 * Start daily cron and optionally run once on startup (after DB is up).
 * @param {{ runOnStart?: boolean }} [opts]
 */
function startBackupScheduler(opts = {}) {
  const runOnStart = opts.runOnStart !== false;

  if (!isBackupEnabled()) {
    console.log("[Backup] Disabled (set ENABLE_BACKUP=true to enable)");
    return;
  }

  const resolved = resolveLocalMongoTarget();
  if (resolved.error) {
    console.error("[Backup] Not scheduling:", resolved.error);
    return;
  }

  const expr = getBackupCronExpression();
  if (!cron.validate(expr)) {
    console.error(
      `[Backup] Invalid BACKUP_CRON "${expr}"; use 5 fields (e.g. 0 12 * * *). Scheduler not started.`
    );
    return;
  }

  stopBackupScheduler();
  cronTask = cron.schedule(expr, () => {
    runBackupSafe({ reason: "cron" }).catch((e) =>
      console.error("[Backup] Cron handler error:", e.message)
    );
  });
  console.log("[Backup] Scheduled:", {
    cron: expr,
    root: getBackupRoot(),
    db: resolved.dbName,
    uri: maskMongoUri(resolved.uri),
  });

  if (runOnStart) {
    setImmediate(() => {
      runBackupSafe({ reason: "startup" }).catch((e) =>
        console.error("[Backup] Startup run error:", e.message)
      );
    });
  }
}

module.exports = {
  isBackupEnabled,
  runBackupSafe,
  startBackupScheduler,
  stopBackupScheduler,
  getBackupRoot,
  resolveLocalMongoTarget,
};
