// Prints the CHANGELOG.md section for a version: node scripts/changelog-section.mjs 1.0.1
// Prints a generic Persian fallback line when the section is missing.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!version) {
  console.error("usage: node scripts/changelog-section.mjs <version>");
  process.exit(1);
}

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "CHANGELOG.md");
let text = "";
try {
  text = readFileSync(file, "utf8");
} catch {
  /* fall through to fallback */
}

const lines = text.split(/\r?\n/);
// Matches "## [1.0.1] - date" or "## 1.0.1"
const isHeading = (l) => {
  const m = /^##\s+\[?([^\]\s]+)\]?/.exec(l);
  return m !== null && m[1] === version;
};
const start = lines.findIndex(isHeading);
let out = "";
if (start !== -1) {
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end === -1) end = lines.length;
  out = lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
}
console.log(out || `نسخهٔ ${version} قسط‌یار. برای جزئیات به CHANGELOG.md مراجعه کنید.`);
