import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, "..", "src");
const apiPath = path.join(srcRoot, "utils", "api.js");

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(jsx|js)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function shouldSkip(file) {
  const rel = path.relative(srcRoot, file);
  if (rel.includes("backup") || rel.includes("_backup")) return true;
  if (path.normalize(rel) === path.join("utils", "api.js")) return true;
  return false;
}

let updated = 0;
for (const file of walk(srcRoot)) {
  if (shouldSkip(file)) continue;
  let c = fs.readFileSync(file, "utf8");
  if (!/\bfetch\s*\(/.test(c)) continue;

  const dir = path.dirname(file);
  let utilsRel = path.relative(dir, path.join(srcRoot, "utils")).replace(/\\/g, "/");
  if (!utilsRel.startsWith(".")) utilsRel = `./${utilsRel}`;

  // Must not use substring match: `../utils/api` matches `../utils/apiError`
  const importRe = new RegExp(
    `from\\s+["']${utilsRel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/api["']`
  );
  if (!importRe.test(c)) {
    const lines = c.split(/\r?\n/);
    let lastImp = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImp = i;
    }
    const insertAt = lastImp >= 0 ? lastImp + 1 : 0;
    lines.splice(insertAt, 0, `import { fetchWithRetry } from "${marker}";`);
    c = lines.join("\n");
  }

  c = c.replace(/\bfetch\s*\(/g, "fetchWithRetry(");
  fs.writeFileSync(file, c);
  updated++;
}

console.log("Updated files:", updated);
