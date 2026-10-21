// Syncs package.json "version" into src-tauri/Cargo.toml and the app's entry in Cargo.lock.
// package.json is the single source of truth (tauri.conf.json points at it).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) throw new Error(`Bad version: ${version}`);

const tomlPath = join(root, "src-tauri", "Cargo.toml");
let toml = readFileSync(tomlPath, "utf8");
const pkgSection = /^\[package\][\s\S]*?(?=^\[|(?![\s\S]))/m.exec(toml)?.[0];
const name = /^name\s*=\s*"([^"]+)"/m.exec(pkgSection ?? "")?.[1];
if (!pkgSection || !name) throw new Error("[package] name not found in Cargo.toml");
const newSection = pkgSection.replace(/^version\s*=\s*"[^"]*"/m, () => `version = "${version}"`);
toml = toml.replace(pkgSection, () => newSection);
writeFileSync(tomlPath, toml);

const lockPath = join(root, "src-tauri", "Cargo.lock");
const lock = readFileSync(lockPath, "utf8");
const re = new RegExp(String.raw`(\[\[package\]\]\r?\nname = "${name}"\r?\nversion = )"[^"]*"`);
if (!re.test(lock)) throw new Error(`"${name}" not found in Cargo.lock`);
writeFileSync(lockPath, lock.replace(re, (_, head) => `${head}"${version}"`));

console.log(`Synced ${name} to ${version}`);
