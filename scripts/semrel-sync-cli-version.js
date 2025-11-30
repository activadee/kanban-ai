const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/semrel-sync-cli-version.js <version>');
  process.exit(1);
}

const packages = [
  'cli',
  'core',
  'server',
  'shared',
  'client'
];

packages.forEach((pkgDir) => {
  const pkgPath = path.join(__dirname, '..', pkgDir, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkgJson.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n');
  console.log(`Updated ${pkgDir}/package.json to ${version}`);
});
