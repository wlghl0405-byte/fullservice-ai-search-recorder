'use strict';

/**
 * Next.js standalone 빌드 후 실행.
 * .next/static 과 public 을 .next/standalone/ 하위로 복사.
 * electron-builder가 standalone 폴더를 패키징할 때 정적 파일이 포함되도록 한다.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STANDALONE = path.join(ROOT, '.next', 'standalone');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[postbuild] skip (not found): ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('[postbuild] Copying .next/static → .next/standalone/.next/static');
copyDir(
  path.join(ROOT, '.next', 'static'),
  path.join(STANDALONE, '.next', 'static'),
);

console.log('[postbuild] Copying public → .next/standalone/public');
copyDir(
  path.join(ROOT, 'public'),
  path.join(STANDALONE, 'public'),
);

console.log('[postbuild] Done.');
