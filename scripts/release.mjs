import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const type = process.argv[2];
if (!["patch", "minor", "major"].includes(type)) {
  console.error("Usage: node scripts/release.mjs <patch|minor|major>");
  process.exit(1);
}

// `npm run release` exports every npm config as npm_config_* env vars; a
// user-level `allow-scripts` entry then reaches the child npm as a
// CLI-level --allow-scripts, which npm rejects in project-scoped
// installs (EALLOWSCRIPTS). Strip it so the child reads its own config.
const env = { ...process.env };
delete env.npm_config_allow_scripts;

execSync(`npm version ${type} --no-git-tag-version`, { stdio: "inherit", env });
execSync("npm install --package-lock-only", { stdio: "inherit", env });

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const mfst = JSON.parse(readFileSync("manifest.json", "utf8"));
mfst.version = pkg.version;
writeFileSync("manifest.json", JSON.stringify(mfst, null, 2) + "\n");

process.stdout.write(`Release: ${pkg.version}\n`);
execSync("git add package.json package-lock.json manifest.json", {
  stdio: "inherit",
});
execSync(`git commit -m "${pkg.version}"`, { stdio: "inherit" });
execSync(`git tag ${pkg.version}`, { stdio: "inherit" });
