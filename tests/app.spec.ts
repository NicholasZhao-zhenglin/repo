import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('桌面完整流程：上传、编辑、阵营、搜索、收藏、备份、重启、删除恢复', async ({}, testInfo) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oc-desktop-'));
  let app: ElectronApplication | undefined;
  const errors: string[] = [];
  async function launch() {
    const launched = await electron.launch({ executablePath: process.env.OC_ARCHIVE_EXECUTABLE, args: process.env.OC_ARCHIVE_EXECUTABLE ? [] : [path.resolve('.')], env: { ...process.env, OC_ARCHIVE_DATA_DIR: dataDir }, timeout: 30000 });
    const page = await launched.firstWindow();
    page.on('pageerror', e => errors.push(e.message));
    await expect(page.getByRole('heading', { name: '角色馆藏' })).toBeVisible();
    return { launched, page };
  }
  try {
    let running = await launch(); app = running.launched; let page = running.page;
    await expect(page.getByRole('heading', { name: '每个世界，都从一个名字开始。' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('01-empty.png') });
    await page.getByRole('button', { name: '创建我的第一个角色' }).click();
    await page.getByLabel('姓名').fill('雾岛');
    await page.getByLabel('罗马音 / 英文名').fill('Kirishima');
    await page.getByLabel('昵称 / 别名').fill('小雾');
    await page.getByLabel('年龄', { exact: true }).fill('24');
    await page.getByLabel('生日', { exact: true }).fill('11/07');
    await page.getByLabel('性别', { exact: true }).fill('女');
    await page.getByLabel('身份 / 职务').fill('特别调查员');
    await page.getByLabel('一句话简介').fill('在城市的背面，收集未被记录的故事。');
    await page.getByLabel('角色标签').fill('红发，调查员');
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 800;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, 600, 800); gradient.addColorStop(0, '#aabbab'); gradient.addColorStop(1, '#677b79'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 600, 800);
      ctx.fillStyle = '#343a39'; ctx.beginPath(); ctx.ellipse(300, 760, 200, 290, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#efd5ba'; ctx.beginPath(); ctx.ellipse(300, 340, 118, 155, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#91473e'; ctx.beginPath(); ctx.ellipse(295, 242, 143, 113, -.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(164, 240, 37, 260); ctx.fillRect(405, 230, 25, 320);
      ctx.fillStyle = '#46342b'; ctx.fillRect(234, 345, 34, 4); ctx.fillRect(335, 345, 34, 4);
      ctx.strokeStyle = '#c4a17d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(300, 540); ctx.lineTo(300, 790); ctx.stroke();
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.getByLabel('头像文件').setInputFiles({ name: 'synthetic-portrait.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(page.getByAltText('头像预览')).toBeVisible();
    await page.getByRole('button', { name: '性格与故事' }).click();
    await page.getByLabel('角色寄语 / 代表台词').fill('别担心，异常也有它的规律。');
    await page.getByLabel('背景故事').fill('一位安静的调查员。\n在雨夜追寻城市中的异常。');
    await page.getByRole('button', { name: '更多设定' }).click();
    await page.getByLabel('能力与装备').fill('能读出旧物留下的片段记忆。');
    await page.getByRole('button', { name: '添加自定义条目' }).click();
    await page.getByLabel('条目 1 名称').fill('代表色');
    await page.getByLabel('条目 1 内容').fill('暗红');
    await page.screenshot({ path: testInfo.outputPath('02-editor.png') });
    await page.getByRole('button', { name: '保存档案' }).click();
    await expect(page.getByRole('heading', { name: '雾岛', exact: true })).toBeVisible();
    await expect(page.getByText('暗红', { exact: true })).toBeVisible();
    await expect(page.getByAltText('雾岛的头像')).toHaveJSProperty('naturalWidth', 600);
    await page.screenshot({ path: testInfo.outputPath('03-detail.png') });
    await page.getByRole('button', { name: '收藏角色', exact: true }).click();
    await expect(page.getByRole('button', { name: '取消收藏', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '编辑档案', exact: true }).click();
    await page.getByRole('button', { name: '异常物品鉴定工作室', exact: true }).click();
    await page.getByRole('button', { name: '保存档案' }).click();
    await expect(page.locator('.detail-faction')).toContainText('异常物品鉴定工作室');
    await page.getByRole('button', { name: '返回角色馆藏' }).click();
    await page.getByRole('navigation', { name: '阵营导航' }).getByRole('button', { name: /特异事务对策局/ }).click();
    await expect(page.getByRole('button', { name: '查看角色：雾岛' })).toHaveCount(0);
    await page.getByRole('navigation', { name: '阵营导航' }).getByRole('button', { name: /异常物品鉴定工作室/ }).click();
    await expect(page.getByRole('button', { name: '查看角色：雾岛' })).toBeVisible();
    await page.getByLabel('搜索角色').fill('小雾');
    await expect(page.getByRole('button', { name: '查看角色：雾岛' })).toBeVisible();
    await page.getByLabel('搜索角色').fill('没有这个角色');
    await expect(page.getByRole('heading', { name: '还没有找到这个角色' })).toBeVisible();
    await page.getByRole('button', { name: '清空搜索', exact: true }).first().click();
    await page.screenshot({ path: testInfo.outputPath('04-gallery.png') });
    // Exercise the real store/IPC and disk IO with only the system file picker stubbed.
    const backupFile = path.join(dataDir, 'test-export.ocarchive');
    await app.evaluate(({ dialog }, filename) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: filename }); }, backupFile);
    await page.getByRole('button', { name: '备份与数据' }).click();
    await page.getByRole('button', { name: /导出完整备份/ }).click();
    await expect(page.getByRole('status')).toContainText('完整备份已导出');
    expect((await fs.stat(backupFile)).size).toBeGreaterThan(100);
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await app.close(); app = undefined;
    running = await launch(); app = running.launched; page = running.page;
    await expect(page.getByRole('button', { name: '查看角色：雾岛' })).toBeVisible();
    await page.getByRole('button', { name: /我的收藏/ }).click();
    await page.getByRole('button', { name: '查看角色：雾岛' }).click();
    await expect(page.getByText('能读出旧物留下的片段记忆。', { exact: true })).toBeVisible();
    await expect(page.getByAltText('雾岛的头像')).toHaveJSProperty('naturalWidth', 600);
    await page.getByRole('button', { name: '删除角色', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByRole('heading', { name: '雾岛', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '删除角色', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '删除角色', exact: true }).click();
    await expect(page.getByRole('heading', { name: '把偏爱的角色，留在这里' })).toBeVisible();
    await app.evaluate(({ dialog }, filename) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filename] });
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
    }, backupFile);
    await page.getByRole('button', { name: '备份与数据' }).click();
    await page.getByRole('button', { name: /从备份导入/ }).click();
    await expect(page.getByRole('button', { name: '查看角色：雾岛' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('已导入 1 位角色');
    // Unsaved edit dismissal is guarded and keyboard focus stays within the dialog.
    await page.getByRole('button', { name: /新建角色/ }).click();
    await page.getByLabel('姓名').fill('未保存');
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByRole('heading', { name: '放弃这次编辑？' })).toBeVisible();
    await page.getByRole('button', { name: '放弃更改', exact: true }).click();
    await expect(page.getByRole('button', { name: '查看角色：未保存' })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (app) await app.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test('最小窗口、未保存退出保护、透明头像与桌面隔离边界', async ({}, testInfo) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oc-window-'));
  const app = await electron.launch({ executablePath: process.env.OC_ARCHIVE_EXECUTABLE, args: process.env.OC_ARCHIVE_EXECUTABLE ? [] : [path.resolve('.')], env: { ...process.env, OC_ARCHIVE_DATA_DIR: dataDir } });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1020, 700));
    await expect(page.getByRole('heading', { name: '角色馆藏' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined');
    expect(await page.evaluate(async () => { try { await fetch('https://example.com'); return true; } catch { return false; } })).toBe(false);
    await page.keyboard.press('Meta+n');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '保存档案' }).click();
    await expect(page.getByRole('alert')).toContainText('起一个名字');
    await page.getByLabel('姓名').fill('透明头像测试');
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 100; const ctx = c.getContext('2d')!; ctx.fillStyle = '#824b46'; ctx.fillRect(25, 25, 50, 50); return c.toDataURL('image/png').split(',')[1]; });
    await page.getByLabel('头像文件').setInputFiles({ name: 'alpha.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(page.getByAltText('头像预览')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('05-small-window.png') });
    const saveBox = await page.getByRole('button', { name: '保存档案' }).boundingBox();
    expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(700);
    expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await app.evaluate(({ dialog, BrowserWindow }) => { dialog.showMessageBoxSync = () => 0; BrowserWindow.getAllWindows()[0].close(); });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '保存档案' }).click();
    await expect(page.getByRole('heading', { name: '透明头像测试' })).toBeVisible();
    const data = JSON.parse(await fs.readFile(path.join(dataDir, 'archive/library.json'), 'utf8'));
    const imagePath = path.join(dataDir, 'archive/portraits', data.characters[0].portrait);
    expect(await app.evaluate(({ nativeImage }, filename) => nativeImage.createFromPath(filename).toBitmap()[3], imagePath)).toBe(0);
  } finally { await app.close(); await fs.rm(dataDir, { recursive: true, force: true }); }
});
