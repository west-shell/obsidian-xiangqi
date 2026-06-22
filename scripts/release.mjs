import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const type = process.argv[2];
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage: node scripts/release.mjs <patch|minor|major>');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const mfst = JSON.parse(readFileSync('manifest.json', 'utf8'));
const [mj, mn, pt] = pkg.version.split('.').map(Number);

let ver;
if (type === 'patch') ver = `${mj}.${mn}.${pt + 1}`;
else if (type === 'minor') ver = `${mj}.${mn + 1}.0`;
else ver = `${mj + 1}.0.0`;

pkg.version = ver;
mfst.version = ver;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
writeFileSync('manifest.json', JSON.stringify(mfst, null, 2) + '\n');

console.log(`Release: ${ver}`);
execSync('git add -A', { stdio: 'inherit' });
execSync(`git commit -m "${ver}"`, { stdio: 'inherit' });
execSync(`git tag ${ver}`, { stdio: 'inherit' });
