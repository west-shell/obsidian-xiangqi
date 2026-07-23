import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const type = process.argv[2];
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage: node scripts/release.mjs <patch|minor|major>');
  process.exit(1);
}

execSync(`npm version ${type} --no-git-tag-version`, { stdio: 'inherit' });
execSync('npm install --package-lock-only', { stdio: 'inherit' });

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const mfst = JSON.parse(readFileSync('manifest.json', 'utf8'));
mfst.version = pkg.version;
writeFileSync('manifest.json', JSON.stringify(mfst, null, 2) + '\n');

console.log(`Release: ${pkg.version}`);
execSync('git add -A', { stdio: 'inherit' });
execSync(`git commit -m "${pkg.version}"`, { stdio: 'inherit' });
execSync(`git tag ${pkg.version}`, { stdio: 'inherit' });
