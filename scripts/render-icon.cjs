const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  const svg = fs.readFileSync(path.resolve('assets/icon.svg'), 'utf8');
  await window.loadURL('data:text/html,<html><body></body></html>');
  const dataURL = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024; canvas.getContext('2d').drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); }; img.onerror = reject; img.src = ${JSON.stringify('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'))}; })`);
  const icon = nativeImage.createFromDataURL(dataURL);
  fs.mkdirSync('assets/AppIcon.iconset', { recursive: true });
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const filename = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`;
      fs.writeFileSync(path.join('assets/AppIcon.iconset', filename), icon.resize({ width: size * scale, height: size * scale, quality: 'best' }).toPNG());
    }
  }
  fs.writeFileSync('assets/icon.png', icon.toPNG());
  app.quit();
}).catch(error => { console.error(error.message); app.exit(1); });
