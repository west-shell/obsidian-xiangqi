import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const type = process.argv[2];
if (!["patch", "minor", "major"].includes(type)) {
  console.error("Usage: node scripts/release.mjs <patch|minor|major>");
  process.exit(1);
}

execSync(`npm version ${type} --no-git-tag-version`, { stdio: "inherit" });

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
lock.version = pkg.version;
if (lock.packages && lock.packages[""]) lock.packages[""].version = pkg.version;
writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");

const mfst = JSON.parse(readFileSync("manifest.json", "utf8"));
mfst.version = pkg.version;
writeFileSync("manifest.json", JSON.stringify(mfst, null, 2) + "\n");

process.stdout.write(`Release: ${pkg.version}\n`);
execSync("git add -A", { stdio: "inherit" });
execSync(`git commit -m "${pkg.version}"`, { stdio: "inherit" });
execSync(`git tag ${pkg.version}`, { stdio: "inherit" });
