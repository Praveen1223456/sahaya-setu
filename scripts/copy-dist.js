const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const rootDir = path.resolve(__dirname, '..');
const source = path.join(rootDir, 'sahaya-setu', 'dist');
const targetDist = path.join(rootDir, 'dist');
const targetBuild = path.join(rootDir, 'build');
const innerBuild = path.join(rootDir, 'sahaya-setu', 'build');

if (fs.existsSync(source)) {
  copyDir(source, targetDist);
  copyDir(source, targetBuild);
  copyDir(source, innerBuild);
  console.log('✓ Synced build artifacts to dist, build, and sahaya-setu/build');
}
