// release.js
const fs = require('fs');
const { execSync } = require('child_process');
const semver = require('semver');

const typeMap = { 主: 'major', 副: 'minor', 小: 'patch' };
const type = process.argv[2];

if (!typeMap[type]) {
    console.error('用法: node release.js [主|副|小]');
    process.exit(1);
}

const pkg = require('./package.json');
const manifest = require('./manifest.json');
const newVersion = semver.inc(pkg.version, typeMap[type]);

if (!newVersion) {
    console.error('版本号计算失败');
    process.exit(1);
}

pkg.version = newVersion;
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));

manifest.version = newVersion;
fs.writeFileSync('./manifest.json', JSON.stringify(manifest, null, 2));

if (fs.existsSync('./manifest-beta.json')) {
    const beta = require('./manifest-beta.json');
    beta.version = newVersion;
    fs.writeFileSync('./manifest-beta.json', JSON.stringify(beta, null, 2));
}

execSync('git add package.json manifest.json manifest-beta.json', { stdio: 'inherit' });
execSync(`git commit -m "release: ${newVersion}"`, { stdio: 'inherit' });
execSync(`git tag ${newVersion}`, { stdio: 'inherit' }); // 不加 v 前缀
execSync('git push', { stdio: 'inherit' });
execSync('git push --tags', { stdio: 'inherit' });

console.log(`已发布新版本: ${newVersion}`);