import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, protocol, session, shell } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArchiveStore, ASSET_NAME } from './store';
import type { Result, SaveInput } from '../shared/model';

app.setName('异闻档案');
const override = process.env.OC_ARCHIVE_DATA_DIR;
app.setPath('userData', override ? path.resolve(override) : path.join(app.getPath('appData'), '异闻档案'));
protocol.registerSchemesAsPrivileged([{ scheme: 'oc-asset', privileges: { standard: true, secure: true, supportFetchAPI: false } }]);
let window: BrowserWindow | null = null;
const indexPath = path.join(__dirname, '../dist/index.html');
const store = new ArchiveStore(path.join(app.getPath('userData'), 'archive'), async raw => {
  const img = nativeImage.createFromBuffer(raw);
  if (img.isEmpty()) throw new Error('图片无法读取，请选择 PNG、JPG 或 WebP 图片');
  const { width, height } = img.getSize();
  if (width * height > 80_000_000) throw new Error('图片尺寸过大，请先缩小到 8000 × 8000 像素以内');
  const ratio = Math.min(1, 1600 / Math.max(width, height));
  return img.resize({ width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)), quality: 'best' }).toPNG();
});
let loadError: string | null = null;

function handle<T>(channel: string, callback: (...args: any[]) => Promise<T> | T, allowBroken = false) {
  ipcMain.handle(channel, async (event, ...args): Promise<Result<T>> => {
    try {
      if (!window || event.sender !== window.webContents || !event.senderFrame || event.senderFrame !== window.webContents.mainFrame || fileURLToPath(event.senderFrame.url) !== indexPath) throw new Error('无效的窗口请求');
      if (loadError && !allowBroken) throw new Error(loadError);
      return { ok: true, value: await callback(...args) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '操作未完成，请重试' };
    }
  });
}

function setupHandlers() {
  handle('archive:load', () => ({ library: store.snapshot(), dataPath: store.root, recovered: store.recovered }));
  handle('archive:save', (input: SaveInput) => store.save(input));
  handle('archive:favorite', (id: string) => store.favorite(id));
  handle('archive:remove', (id: string) => store.remove(id));
  handle('archive:open-data', async () => {
    const error = await shell.openPath(store.root); if (error) throw new Error(error);
  }, true);
  handle('archive:open-backups', async () => {
    const error = await shell.openPath(store.backupPath); if (error) throw new Error(error);
  }, true);
  handle('archive:export', async () => {
    const result = await dialog.showSaveDialog(window!, { title: '导出完整角色库', defaultPath: `异闻档案-${new Date().toLocaleDateString('sv-SE')}.ocarchive`, filters: [{ name: '异闻档案备份', extensions: ['ocarchive'] }] });
    if (result.canceled || !result.filePath) return null;
    const data = await store.exportBackup();
    const temporary = `${result.filePath}.${Date.now()}.tmp`;
    try { await fs.writeFile(temporary, data, { mode: 0o600 }); await fs.rename(temporary, result.filePath); }
    catch (error) { await fs.rm(temporary, { force: true }); throw error; }
    return result.filePath;
  });
  handle('archive:import', async () => {
    const result = await dialog.showOpenDialog(window!, { title: '导入角色库备份', properties: ['openFile'], filters: [{ name: '异闻档案备份', extensions: ['ocarchive'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const filename = result.filePaths[0];
    if ((await fs.stat(filename)).size > 256 * 1024 * 1024) throw new Error('备份文件超过 256 MB 限制');
    const data = await fs.readFile(filename);
    const backup = await store.inspectBackup(data);
    const choice = await dialog.showMessageBox(window!, {
      type: 'question', title: '导入角色库', message: `这份备份包含 ${backup.library.characters.length} 位角色`,
      detail: '合并导入：保留现有角色，跳过编号相同的角色。\n替换角色库：使用备份中的全部角色。\n操作前会在本机自动保留一份完整备份。',
      buttons: ['合并导入', '取消', '替换角色库'], defaultId: 0, cancelId: 1, noLink: true,
    });
    if (choice.response === 1) return null;
    if (choice.response === 2) {
      const confirm = await dialog.showMessageBox(window!, { type: 'warning', message: '确定替换当前角色库？', detail: '现有角色将由备份内容替换。替换前的资料可以在自动备份文件夹中找回。', buttons: ['取消', '确认替换'], defaultId: 0, cancelId: 0 });
      if (confirm.response === 0) return null;
    }
    const imported = await store.importBackup(data, choice.response === 2 ? 'replace' : 'merge');
    loadError = null;
    return imported;
  }, true);
}

function createWindow() {
  window = new BrowserWindow({
    title: '异闻档案', width: 1380, height: 900, minWidth: 1020, minHeight: 700,
    backgroundColor: '#f8f7f3', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 16 },
    show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-prevent-unload', event => {
    const result = dialog.showMessageBoxSync(window!, { type: 'question', message: '当前档案还没有保存', detail: '离开后，本次编辑的内容将丢失。', buttons: ['继续编辑', '放弃更改'], defaultId: 0, cancelId: 0 });
    if (result === 1) event.preventDefault();
  });
  window.once('ready-to-show', () => window?.show());
  window.on('closed', () => { window = null; });
  void window.loadFile(indexPath);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.show(); window?.focus(); });
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
    protocol.handle('oc-asset', async request => {
      try {
        const url = new URL(request.url);
        const filename = decodeURIComponent(url.pathname.slice(1));
        if (url.host !== 'portrait' || !ASSET_NAME.test(filename)) return new Response(null, { status: 404 });
        const data = await fs.readFile(path.join(store.assetsPath, filename));
        return new Response(new Uint8Array(data), { headers: { 'Content-Type': filename.endsWith('.png') ? 'image/png' : 'image/jpeg', 'Cache-Control': 'max-age=31536000, immutable' } });
      } catch { return new Response(null, { status: 404 }); }
    });
    try { await store.init(); }
    catch (error) { loadError = error instanceof Error ? error.message : '档案读取失败'; }
    setupHandlers();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '异闻档案', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
      { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: '显示', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
      { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'close' }] },
    ]));
    app.setAboutPanelOptions({ applicationName: '异闻档案', applicationVersion: app.getVersion(), copyright: '你的角色，你的世界。', credits: '一个完全离线的个人 OC 档案馆。' });
    createWindow();
    app.on('activate', () => { if (!window) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
