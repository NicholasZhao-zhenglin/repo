import { packager } from '@electron/packager';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (process.platform !== 'darwin') throw new Error('当前发行包面向 macOS，请在 Mac 上打包');
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
if (!(await fs.stat('assets/AppIcon.icns').catch(() => null))) {
  execFileSync(require('electron'), ['scripts/render-icon.cjs'], { stdio: 'inherit' });
  execFileSync('iconutil', ['-c', 'icns', 'assets/AppIcon.iconset', '-o', 'assets/AppIcon.icns']);
}
const stage = path.resolve('release/staging');
await fs.mkdir(stage, { recursive: true });
await fs.cp('dist', path.join(stage, 'dist'), { recursive: true });
await fs.cp('dist-electron', path.join(stage, 'dist-electron'), { recursive: true });
await fs.copyFile('THIRD_PARTY_NOTICES.txt', path.join(stage, 'THIRD_PARTY_NOTICES.txt'));
await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, description: pkg.description, main: pkg.main, author: pkg.author, license: pkg.license }));
const paths = await packager({
  dir: stage, out: 'release', name: '异闻档案', executableName: 'PersonaArchive',
  appBundleId: 'com.nicholaszhao.personaarchive', appVersion: pkg.version,
  platform: 'darwin', arch: 'arm64', electronVersion: pkg.devDependencies.electron,
  electronZipDir: process.env.OC_ELECTRON_ZIP_DIR || undefined,
  icon: path.resolve('assets/AppIcon.icns'), asar: true, overwrite: true,
  prune: false, appCategoryType: 'public.app-category.lifestyle',
  extendInfo: { CFBundleDisplayName: '异闻档案', NSHumanReadableCopyright: '你的角色，你的世界。' },
});
for (const output of paths) {
  const appPath = path.join(output, '异闻档案.app');
  // Local ad-hoc signing for the user's own Mac; no Developer ID or notarization claim.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
  const zip = path.resolve(`release/PersonaArchive-${pkg.version}-mac-arm64.zip`);
  execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zip]);
  console.log(`App: ${appPath}\nZip: ${zip}`);
}
