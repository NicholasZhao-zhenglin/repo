import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { emptyFields, type Character, type CharacterFields, type Library, type SaveInput } from '../shared/model';

const MAX_BACKUP = 256 * 1024 * 1024;
const MAX_PORTRAIT = 20 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ASSET_NAME = /^[0-9a-f-]{36}\.(?:png|jpg)$/i;
export type ImageProcessor = (data: Buffer) => Promise<Buffer>;
type Backup = { format: 'oc-archive'; version: 1; exportedAt: string; library: Library; assets: Record<string, string> };
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function text(value: unknown, label: string, max = 200) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label}格式不正确或超出 ${max} 字限制`);
  return value.trim();
}

export function validateFields(value: unknown): CharacterFields {
  if (!isObject(value)) throw new Error('角色资料格式不正确');
  const fields = emptyFields();
  const short = ['name', 'japaneseName', 'romanName', 'alias', 'gender', 'age', 'birthday', 'zodiac', 'height', 'occupation'] as const;
  for (const key of short) fields[key] = text(value[key], key === 'name' ? '姓名' : '基本资料');
  if (!fields.name) throw new Error('请为角色填写姓名');
  if (value.faction !== 'bureau' && value.faction !== 'atelier') throw new Error('请选择有效的阵营');
  fields.faction = value.faction;
  fields.quote = text(value.quote, '角色寄语', 500);
  fields.summary = text(value.summary, '一句话简介', 500);
  for (const key of ['personality', 'abilities', 'biography', 'relationships', 'notes'] as const) fields[key] = text(value[key], '角色设定', 20000);
  if (!Array.isArray(value.tags) || value.tags.length > 12) throw new Error('最多添加 12 个标签');
  fields.tags = [...new Set(value.tags.map(v => text(v, '标签', 30)).filter(Boolean))];
  if (typeof value.favorite !== 'boolean') throw new Error('收藏状态不正确');
  fields.favorite = value.favorite;
  if (typeof value.portraitPosition !== 'number' || !Number.isFinite(value.portraitPosition) || value.portraitPosition < 0 || value.portraitPosition > 100) throw new Error('头像位置不正确');
  fields.portraitPosition = value.portraitPosition;
  if (!Array.isArray(value.customFields) || value.customFields.length > 20) throw new Error('最多添加 20 个自定义条目');
  fields.customFields = value.customFields.map(item => {
    if (!isObject(item)) throw new Error('自定义条目格式不正确');
    return { label: text(item.label, '条目名称', 100), value: text(item.value, '条目内容', 2000) };
  }).filter(item => item.label || item.value);
  if (fields.customFields.some(item => !item.label)) throw new Error('请为自定义条目填写名称');
  return fields;
}

export function validateLibrary(value: unknown): Library {
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.characters) || value.characters.length > 10000) throw new Error('不支持的档案格式或版本');
  const ids = new Set<string>();
  const characters = value.characters.map((row): Character => {
    if (!isObject(row) || typeof row.id !== 'string' || !UUID.test(row.id) || ids.has(row.id)) throw new Error('档案编号无效或重复');
    ids.add(row.id);
    if (row.portrait !== null && (typeof row.portrait !== 'string' || !ASSET_NAME.test(row.portrait))) throw new Error('头像引用无效');
    const createdAt = text(row.createdAt, '创建时间');
    const updatedAt = text(row.updatedAt, '更新时间');
    if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) throw new Error('档案时间无效');
    return { ...validateFields(row), id: row.id, portrait: row.portrait as string | null, createdAt, updatedAt };
  });
  return { version: 1, characters };
}

export class ArchiveStore {
  private library: Library = { version: 1, characters: [] };
  private queue: Promise<unknown> = Promise.resolve();
  recovered = false;
  readonly assetsPath: string;
  readonly backupPath: string;
  constructor(readonly root: string, private processImage: ImageProcessor) {
    this.assetsPath = path.join(root, 'portraits');
    this.backupPath = path.join(root, 'backups');
  }
  private get libraryPath() { return path.join(this.root, 'library.json'); }
  async init() {
    await fs.mkdir(this.assetsPath, { recursive: true });
    await fs.mkdir(this.backupPath, { recursive: true });
    let source: string;
    try { source = await fs.readFile(this.libraryPath, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await this.commit(this.library);
      return;
    }
    try { this.library = validateLibrary(JSON.parse(source)); }
    catch {
      // Preserve the damaged original. Never silently start with an empty library.
      await fs.copyFile(this.libraryPath, path.join(this.backupPath, `damaged-${Date.now()}.json`));
      let recovered: Library;
      try { recovered = validateLibrary(JSON.parse(await fs.readFile(`${this.libraryPath}.previous`, 'utf8'))); }
      catch { throw new Error('档案文件无法读取。原始文件已保留，请从完整备份恢复，或检查数据文件夹。'); }
      await this.atomicWrite(this.libraryPath, JSON.stringify(recovered, null, 2));
      this.library = recovered;
      this.recovered = true;
    }
  }
  snapshot(): Library { return structuredClone(this.library); }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private async atomicWrite(filename: string, data: string | Buffer) {
    const temporary = `${filename}.${randomUUID()}.tmp`;
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(data); await handle.sync(); }
    finally { await handle.close(); }
    try { await fs.rename(temporary, filename); }
    catch (error) { await fs.rm(temporary, { force: true }); throw error; }
  }
  private async commit(next: Library) {
    if (await fs.stat(this.libraryPath).then(() => true, () => false)) {
      await this.atomicWrite(`${this.libraryPath}.previous`, JSON.stringify(this.library, null, 2));
    }
    await this.atomicWrite(this.libraryPath, JSON.stringify(next, null, 2));
    this.library = next;
  }
  save(input: SaveInput): Promise<Character> {
    return this.serial(async () => {
      if (!isObject(input)) throw new Error('无效的保存请求');
      const fields = validateFields(input.fields);
      const old = input.id ? this.library.characters.find(c => c.id === input.id) : undefined;
      if (input.id && !old) throw new Error('该角色已不存在，请返回角色总览');
      if (!old && this.library.characters.length >= 10000) throw new Error('角色库已达到 10,000 份档案上限，请先导出备份再整理');
      let portrait = old?.portrait ?? null;
      if (input.portraitData === null) portrait = null;
      else if (input.portraitData !== undefined) {
        if (typeof input.portraitData !== 'string' || input.portraitData.length > MAX_PORTRAIT * 1.4) throw new Error('请选择 20 MB 以内的图片');
        const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(input.portraitData);
        if (!match) throw new Error('头像支持 PNG、JPG 和 WebP 格式');
        const raw = Buffer.from(match[1], 'base64');
        if (raw.length > MAX_PORTRAIT) throw new Error('请选择 20 MB 以内的图片');
        const normalized = await this.processImage(raw);
        portrait = `${randomUUID()}.png`;
        await this.atomicWrite(path.join(this.assetsPath, portrait), normalized);
      }
      const now = new Date().toISOString();
      const character: Character = { ...fields, id: old?.id ?? randomUUID(), createdAt: old?.createdAt ?? now, updatedAt: now, portrait };
      const characters = old ? this.library.characters.map(c => c.id === old.id ? character : c) : [...this.library.characters, character];
      await this.commit({ version: 1, characters });
      return structuredClone(character);
    });
  }
  favorite(id: string): Promise<Character> {
    return this.serial(async () => {
      const old = this.library.characters.find(c => c.id === id);
      if (!old) throw new Error('该角色已不存在');
      const character = { ...old, favorite: !old.favorite, updatedAt: new Date().toISOString() };
      await this.commit({ version: 1, characters: this.library.characters.map(c => c.id === id ? character : c) });
      return structuredClone(character);
    });
  }
  remove(id: string): Promise<void> {
    return this.serial(async () => {
      if (!this.library.characters.some(c => c.id === id)) throw new Error('该角色已不存在');
      await this.safetyBackup('before-delete');
      await this.commit({ version: 1, characters: this.library.characters.filter(c => c.id !== id) });
    });
  }
  private async encodeBackup(): Promise<Buffer> {
    const assets: Record<string, string> = {};
    for (const c of this.library.characters) {
      if (c.portrait && !assets[c.portrait]) assets[c.portrait] = (await fs.readFile(path.join(this.assetsPath, c.portrait))).toString('base64');
    }
    const backup: Backup = { format: 'oc-archive', version: 1, exportedAt: new Date().toISOString(), library: this.snapshot(), assets };
    const json = Buffer.from(JSON.stringify(backup));
    if (json.length > MAX_BACKUP) throw new Error('当前角色库超出单份备份 256 MB 的限制，请通过数据文件夹整体复制保存');
    return gzipSync(json);
  }
  exportBackup() { return this.serial(() => this.encodeBackup()); }
  private async safetyBackup(reason: string) {
    const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${reason}.ocarchive`;
    await this.atomicWrite(path.join(this.backupPath, filename), await this.encodeBackup());
    // Keep the newest ten automatic full backups; user exports are never touched.
    const files = (await fs.readdir(this.backupPath)).filter(f => /^\d{4}-.+\.ocarchive$/.test(f)).sort().reverse();
    await Promise.all(files.slice(10).map(f => fs.rm(path.join(this.backupPath, f), { force: true })));
  }
  async inspectBackup(data: Buffer): Promise<Backup> {
    if (data.length > MAX_BACKUP) throw new Error('备份文件过大');
    let parsed: unknown;
    try { parsed = JSON.parse(gunzipSync(data, { maxOutputLength: MAX_BACKUP }).toString('utf8')); }
    catch { throw new Error('无法读取此备份。请选择由异闻档案导出的 .ocarchive 文件'); }
    if (!isObject(parsed) || parsed.format !== 'oc-archive' || parsed.version !== 1 || !isObject(parsed.assets)) throw new Error('备份格式或版本不受支持');
    const library = validateLibrary(parsed.library);
    const assets: Record<string, string> = {};
    for (const c of library.characters) {
      if (!c.portrait || assets[c.portrait]) continue;
      const encoded = parsed.assets[c.portrait];
      if (typeof encoded !== 'string' || encoded.length > MAX_PORTRAIT * 1.4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('备份中的头像丢失或无效');
      // Decode and normalize before changing any current records or portrait files.
      assets[c.portrait] = (await this.processImage(Buffer.from(encoded, 'base64'))).toString('base64');
    }
    return { format: 'oc-archive', version: 1, exportedAt: String(parsed.exportedAt ?? ''), library, assets };
  }
  importBackup(data: Buffer, mode: 'merge' | 'replace') {
    return this.serial(async () => {
      if (mode !== 'merge' && mode !== 'replace') throw new Error('无效的导入方式');
      const backup = await this.inspectBackup(data);
      const existing = new Set(this.library.characters.map(c => c.id));
      const incoming = backup.library.characters.filter(c => mode === 'replace' || !existing.has(c.id));
      if (mode === 'merge' && this.library.characters.length + incoming.length > 10000) throw new Error('合并后将超出 10,000 份档案上限，请整理角色库或选择替换');
      await this.safetyBackup('before-import');
      const remap = new Map<string, string>();
      const characters: Character[] = [];
      for (const c of incoming) {
        let portrait: string | null = null;
        if (c.portrait) {
          portrait = remap.get(c.portrait) ?? `${randomUUID()}.png`;
          if (!remap.has(c.portrait)) await this.atomicWrite(path.join(this.assetsPath, portrait), Buffer.from(backup.assets[c.portrait], 'base64'));
          remap.set(c.portrait, portrait);
        }
        characters.push({ ...c, portrait });
      }
      await this.commit({ version: 1, characters: mode === 'replace' ? characters : [...this.library.characters, ...characters] });
      return { count: incoming.length, mode, library: this.snapshot() };
    });
  }
}
