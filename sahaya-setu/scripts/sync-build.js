const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sp = path.join(src, entry.name);
    const dp = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(sp, dp);
    else fs.copyFileSync(sp, dp);
  }
}

const dir = path.resolve(__dirname, '..');
const dist = path.join(dir, 'dist');
const build = path.join(dir, 'build');
const parentBuild = path.join(dir, '..', 'build');
const parentDist = path.join(dir, '..', 'dist');

if (fs.existsSync(dist)) {
  copyDir(dist, build);
  copyDir(dist, parentBuild);
  copyDir(dist, parentDist);
}
