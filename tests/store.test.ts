import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gunzipSync, gzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { ArchiveStore } from '../electron/store';
import { emptyFields } from '../shared/model';

const imageBytes = Buffer.from('synthetic image bytes');
const portraitData = `data:image/png;base64,${imageBytes.toString('base64')}`;
async function fixture(t: test.TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oc-store-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const processor = async (buffer: Buffer) => { if (!buffer.equals(imageBytes)) throw new Error('invalid image'); return buffer; };
  const store = new ArchiveStore(root, processor);
  await store.init();
  return { store, root, processor };
}
const fields = (name = '雾岛 · 测试角色') => ({ ...emptyFields(), name, age: '24', tags: ['红发', '调查员'], biography: '第一行\n第二行' });

test('保存复制头像并在重启后完整读取 Unicode 和多行资料', async t => {
  const { store, root, processor } = await fixture(t);
  const created = await store.save({ fields: fields(), portraitData });
  assert.equal(created.name, '雾岛 · 测试角色');
  assert.ok(created.portrait);
  assert.deepEqual(await fs.readFile(path.join(root, 'portraits', created.portrait!)), imageBytes);
  const reopened = new ArchiveStore(root, processor); await reopened.init();
  assert.deepEqual(reopened.snapshot(), store.snapshot());
  const changed = await reopened.save({ id: created.id, fields: { ...created, name: '改名', faction: 'atelier' } });
  assert.equal(changed.createdAt, created.createdAt); assert.equal(changed.portrait, created.portrait);
});
test('并发保存和收藏串行完成，没有相互覆盖', async t => {
  const { store } = await fixture(t);
  const rows = await Promise.all(Array.from({ length: 16 }, (_, i) => store.save({ fields: fields(`角色 ${i}`) })));
  await Promise.all(rows.map(c => store.favorite(c.id)));
  assert.equal(store.snapshot().characters.length, 16);
  assert.ok(store.snapshot().characters.every(c => c.favorite));
});
test('无效输入被拒绝，队列仍能继续保存', async t => {
  const { store } = await fixture(t);
  await assert.rejects(store.save({ fields: fields('  ') }), /姓名/);
  await assert.rejects(store.save({ fields: { ...fields(), faction: 'bad' as any } }), /阵营/);
  await assert.rejects(store.save({ fields: fields(), portraitData: 'data:image/svg+xml;base64,aaaa' }), /格式/);
  await assert.rejects(store.save({ fields: { ...fields(), portraitPosition: NaN } }), /位置/);
  await assert.rejects(store.save({ fields: { ...fields(), customFields: [{ label: '', value: '无标题条目' }] } }), /名称/);
  await assert.rejects(store.save({ fields: fields(), id: 'missing' }), /不存在/);
  assert.equal(store.snapshot().characters.length, 0);
  await store.save({ fields: fields() }); assert.equal(store.snapshot().characters.length, 1);
});
test('备份在独立目录恢复头像，并可合并去重与替换', async t => {
  const a = await fixture(t); const b = await fixture(t);
  const c = await a.store.save({ fields: fields(), portraitData });
  const data = await a.store.exportBackup();
  const result = await b.store.importBackup(data, 'merge');
  assert.equal(result.count, 1); assert.equal(result.library.characters[0].id, c.id);
  assert.notEqual(result.library.characters[0].portrait, c.portrait);
  assert.deepEqual(await fs.readFile(path.join(b.root, 'portraits', result.library.characters[0].portrait!)), imageBytes);
  assert.equal((await b.store.importBackup(data, 'merge')).count, 0);
  await b.store.save({ fields: fields('额外角色') });
  await b.store.importBackup(data, 'replace');
  assert.equal(b.store.snapshot().characters.length, 1);
  assert.ok((await fs.readdir(b.store.backupPath)).some(n => n.includes('before-import')));
});
test('损坏或路径越界的备份不会改变当前角色库', async t => {
  const { store } = await fixture(t);
  await store.save({ fields: fields(), portraitData });
  const before = store.snapshot(); const backup = await store.exportBackup();
  await assert.rejects(store.importBackup(Buffer.from('broken'), 'replace'), /无法读取/);
  const bad = JSON.parse(gunzipSync(backup).toString());
  bad.library.characters[0].portrait = '../../file.jpg';
  await assert.rejects(store.importBackup(gzipSync(JSON.stringify(bad)), 'replace'), /头像引用/);
  assert.deepEqual(store.snapshot(), before);
});
test('备份头像缺失或不能解码时，恢复操作不写入现有资料', async t => {
  const { store } = await fixture(t); await store.save({ fields: fields(), portraitData });
  const before = store.snapshot(); const original = JSON.parse(gunzipSync(await store.exportBackup()).toString());
  const missing = structuredClone(original); missing.assets = {};
  await assert.rejects(store.importBackup(gzipSync(JSON.stringify(missing)), 'replace'), /头像丢失/);
  original.assets[before.characters[0].portrait!] = Buffer.from('not an image').toString('base64');
  await assert.rejects(store.importBackup(gzipSync(JSON.stringify(original)), 'replace'), /invalid image/);
  assert.deepEqual(store.snapshot(), before);
});
test('删除前生成完整备份，可把角色和头像找回', async t => {
  const { store } = await fixture(t); const c = await store.save({ fields: fields(), portraitData });
  await store.remove(c.id); assert.equal(store.snapshot().characters.length, 0);
  const names = await fs.readdir(store.backupPath); const filename = names.find(n => n.includes('before-delete'))!;
  await store.importBackup(await fs.readFile(path.join(store.backupPath, filename)), 'merge');
  assert.equal(store.snapshot().characters[0].id, c.id); assert.ok(store.snapshot().characters[0].portrait);
});
test('受损主文件从上一版恢复，同时保留受损原件', async t => {
  const { store, root, processor } = await fixture(t);
  await store.save({ fields: fields('第一版') }); const first = store.snapshot();
  await store.save({ fields: fields('第二位角色') });
  await fs.writeFile(path.join(root, 'library.json'), '{bad');
  const reopened = new ArchiveStore(root, processor); await reopened.init();
  assert.equal(reopened.recovered, true); assert.deepEqual(reopened.snapshot(), first);
  assert.ok((await fs.readdir(reopened.backupPath)).some(n => n.startsWith('damaged-')));
});
test('没有可用上一版时明确报错，不静默清空受损库', async t => {
  const { root, processor } = await fixture(t);
  await fs.writeFile(path.join(root, 'library.json'), 'broken');
  const reopened = new ArchiveStore(root, processor);
  await assert.rejects(reopened.init(), /无法读取/);
  assert.equal(await fs.readFile(path.join(root, 'library.json'), 'utf8'), 'broken');
  assert.ok((await fs.readdir(reopened.backupPath)).some(n => n.startsWith('damaged-')));
});
test('提交失败不更新内存中的角色快照', async t => {
  const { store, root } = await fixture(t);
  await store.save({ fields: fields() }); const before = store.snapshot();
  // Force atomic rename to fail inside the isolated fixture only.
  await fs.rm(path.join(root, 'library.json')); await fs.mkdir(path.join(root, 'library.json'));
  await assert.rejects(store.save({ fields: fields('未提交角色') }));
  assert.deepEqual(store.snapshot(), before);
});

test('到达容量边界时拒绝新增和合并，已有库仍可重启读取', async t => {
  const { root, processor } = await fixture(t);
  const source = await fixture(t);
  await source.store.save({ fields: fields('待合并角色') });
  const now = new Date().toISOString();
  const full = { version: 1, characters: Array.from({ length: 10000 }, (_, i) => ({ ...fields(`档案 ${i}`), id: randomUUID(), portrait: null, createdAt: now, updatedAt: now })) };
  await fs.writeFile(path.join(root, 'library.json'), JSON.stringify(full));
  const store = new ArchiveStore(root, processor); await store.init();
  await assert.rejects(store.save({ fields: fields('超出上限') }), /上限/);
  await assert.rejects(store.importBackup(await source.store.exportBackup(), 'merge'), /上限/);
  const reopened = new ArchiveStore(root, processor); await reopened.init();
  assert.equal(reopened.snapshot().characters.length, 10000);
  assert.equal(reopened.recovered, false);
});
