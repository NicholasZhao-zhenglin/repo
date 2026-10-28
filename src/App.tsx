import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpFromLine, BookOpen, Check, ChevronRight, CircleHelp, FolderOpen, Grid2X2, HardDrive, Heart, LayoutGrid, Library, LockKeyhole, Pencil, Plus, Search, Shield, Sparkles, Star, Trash2, X } from 'lucide-react';
import { FACTIONS, factionOf, type Character, type Faction, type Library as LibraryType } from '../shared/model';
import { ArchiveIllustration, Confirm, Emblem, Modal, Portrait } from './components';
import Editor from './Editor';

type Filter = 'all' | Faction | 'favorites';
const dateLabel = (date: string) => new Date(date).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

function Detail({ character: c, onBack, onEdit, onDelete, onFavorite }: { character: Character; onBack: () => void; onEdit: () => void; onDelete: () => void; onFavorite: () => void }) {
  const facts = [['昵称 / 别名', c.alias], ['性别', c.gender], ['年龄', c.age], ['生日', c.birthday], ['星座', c.zodiac], ['身高', c.height], ['身份 / 职务', c.occupation], ...c.customFields.map(f => [f.label, f.value])].filter(([, value]) => value);
  const sections = [['性格与习惯', c.personality], ['背景故事', c.biography], ['能力与装备', c.abilities], ['人物关系', c.relationships], ['创作手记', c.notes]].filter(([, value]) => value);
  return <div className={`detail-view ${c.faction}`}>
    <div className="detail-toolbar"><button className="text-button back-button" onClick={onBack}><ArrowLeft size={17}/>返回角色馆藏</button><div className="detail-actions"><button className={`icon-button ${c.favorite ? 'is-favorite' : ''}`} aria-label={c.favorite ? '取消收藏' : '收藏角色'} onClick={onFavorite}><Star size={19} fill={c.favorite ? 'currentColor' : 'none'}/></button><button className="button secondary" onClick={onEdit}><Pencil size={15}/>编辑档案</button><button className="icon-button delete-button" aria-label="删除角色" onClick={onDelete}><Trash2 size={17}/></button></div></div>
    <div className="detail-layout"><aside className="detail-left"><div className="detail-portrait-frame"><Portrait character={c}/><div className="portrait-frame-caption"><span>PERSONA / {c.id.slice(0, 6).toUpperCase()}</span><Sparkles size={14}/></div></div><div className={`detail-faction ${c.faction}`}><span className="faction-symbol">{c.faction === 'bureau' ? <Shield size={23} strokeWidth={1.2}/> : <Sparkles size={23} strokeWidth={1.2}/>}</span><div><small>AFFILIATION</small><strong>{factionOf(c.faction).name}</strong></div></div><div className="detail-dates"><span>建档于 {dateLabel(c.createdAt)}</span><span>最近更新 {dateLabel(c.updatedAt)}</span></div></aside>
      <article className="detail-content"><div className="detail-heading"><span className="eyebrow">CHARACTER DOSSIER</span><h1>{c.name}</h1>{(c.japaneseName || c.romanName) && <p className="foreign-name">{[c.japaneseName, c.romanName].filter(Boolean).join(' / ')}</p>}{c.summary && <p className="detail-summary">{c.summary}</p>}{c.tags.length > 0 && <div className="tags">{c.tags.map(t => <span key={t}>{t}</span>)}</div>}</div>
        {c.quote && <blockquote><span>“</span><p>{c.quote}</p></blockquote>}
        <section className="detail-section"><div className="section-title"><span>01</span><h2>基础信息</h2><div/></div>{facts.length ? <dl className="facts-grid">{facts.map(([label, value], i) => <div key={`${label}-${i}`}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="section-empty">故事才刚开始。编辑档案，为 TA 添上更多细节。</p>}</section>
        {sections.map(([title, content], i) => <section className="detail-section" key={title}><div className="section-title"><span>{String(i + 2).padStart(2, '0')}</span><h2>{title}</h2><div/></div><p className="prose">{content}</p></section>)}
        {!sections.length && <button className="story-prompt" onClick={onEdit}><BookOpen size={23} strokeWidth={1.3}/><div><strong>还有很多故事，等待被写下</strong><span>补充性格、能力、背景与那些微小而特别的细节。</span></div><ArrowRight size={19}/></button>}
        <div className="dossier-end"><span/><Emblem small/><span/></div>
      </article>
    </div>
  </div>;
}

export default function App() {
  const [library, setLibrary] = useState<LibraryType>({ version: 1, characters: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dataPath, setDataPath] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [compact, setCompact] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ character?: Character; faction: Faction } | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const characters = library.characters;
  const current = characters.find(c => c.id === selected);
  const deleting = characters.find(c => c.id === deleteId);
  const activeFaction = FACTIONS.find(f => f.id === filter);
  const count = (f: Filter) => characters.filter(c => f === 'all' || (f === 'favorites' ? c.favorite : c.faction === f)).length;
  function notify(message: string, error = false) { setToast({ message, error }); }
  async function load() {
    setLoading(true);
    try {
      if (!window.archive) throw new Error('请从「异闻档案」App 打开角色库');
      const result = await window.archive.load();
      if (!result.ok) throw new Error(result.error);
      setLibrary(result.value.library); setDataPath(result.value.dataPath); setLoadError('');
      if (result.value.recovered) notify('已从上一次保存恢复档案。受损文件已保留在自动备份文件夹。');
    } catch (error) { setLoadError((error as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), toast.error ? 7000 : 4200); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [selected, filter]);
  function create() { if (!loading && !loadError) setEditor({ faction: activeFaction?.id ?? 'bureau' }); }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); create(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); setSelected(null); window.setTimeout(() => searchRef.current?.focus(), 30); }
      if (event.key === 'Escape') { if (selected) setSelected(null); else setQuery(''); }
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [filter, selected, loading, loadError]);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return characters.filter(c => (filter === 'all' || (filter === 'favorites' ? c.favorite : c.faction === filter)) && (!needle || [c.name, c.alias, c.japaneseName, c.romanName, c.occupation, c.summary, ...c.tags].some(value => value.toLocaleLowerCase().includes(needle)))).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt));
  }, [characters, filter, query, sort]);
  function updateCharacter(c: Character) { setLibrary(old => ({ version: 1, characters: old.characters.some(item => item.id === c.id) ? old.characters.map(item => item.id === c.id ? c : item) : [...old.characters, c] })); }
  async function favorite(c: Character) {
    try { const result = await window.archive.favorite(c.id); if (result.ok) updateCharacter(result.value); else notify(result.error, true); }
    catch { notify('收藏状态未能保存，请重试', true); }
  }
  async function remove() {
    if (!deleteId || busy) return; setBusy(true);
    try {
      const result = await window.archive.remove(deleteId);
      if (!result.ok) { notify(result.error, true); return; }
      setLibrary(old => ({ ...old, characters: old.characters.filter(c => c.id !== deleteId) })); setSelected(null); setDeleteId(null); notify('档案已删除，删除前的完整备份已自动保留');
    } catch { notify('删除失败，请重试', true); }
    finally { setBusy(false); }
  }
  async function exportBackup() {
    if (busy) return; setBusy(true);
    try { const result = await window.archive.exportBackup(); if (!result.ok) notify(result.error, true); else if (result.value) notify('完整备份已导出，包含所有资料和头像'); }
    catch { notify('导出失败，请检查目标文件夹是否可以写入', true); }
    finally { setBusy(false); }
  }
  async function importBackup() {
    if (busy) return; setBusy(true);
    try {
      const result = await window.archive.importBackup();
      if (!result.ok) notify(result.error, true);
      else if (result.value) { setLibrary(result.value.library); setSelected(null); setFilter('all'); setQuery(''); setLoadError(''); notify(result.value.count ? `已${result.value.mode === 'replace' ? '恢复' : '导入'} ${result.value.count} 位角色` : result.value.mode === 'merge' ? '备份中的角色已经在库中，没有重复添加' : '已恢复为空角色库'); setBackupOpen(false); }
    } catch { notify('导入未完成，现有档案保持不变', true); }
    finally { setBusy(false); }
  }
  async function openFolder(backup = false) {
    try { const result = await (backup ? window.archive.openBackupFolder() : window.archive.openDataFolder()); if (!result.ok) notify(result.error, true); }
    catch { notify('无法打开文件夹', true); }
  }
  function navigate(next: Filter) { setFilter(next); setSelected(null); setQuery(''); }
  return <div className="app-shell">
    <header className="window-bar"><span>异闻档案 <i>/</i> 你的私人角色馆藏</span><span className="window-status"><span className="local-dot"/> 本地档案 · 离线可用</span></header>
    <aside className="sidebar"><div className="brand"><Emblem/><div><strong>异闻档案</strong><span>PERSONA ARCHIVE</span></div></div><div className="sidebar-label">我的馆藏 <span>COLLECTION</span></div>
      <nav className="main-nav" aria-label="角色导航"><button className={filter === 'all' ? 'active' : ''} onClick={() => navigate('all')} aria-current={filter === 'all' ? 'page' : undefined}><LayoutGrid size={18}/><span>全部角色</span><b>{count('all')}</b></button><button className={filter === 'favorites' ? 'active' : ''} onClick={() => navigate('favorites')} aria-current={filter === 'favorites' ? 'page' : undefined}><Star size={18}/><span>我的收藏</span><b>{count('favorites')}</b></button></nav>
      <div className="sidebar-label faction-label">阵营档案 <span>FACTIONS</span></div><nav className="main-nav faction-nav" aria-label="阵营导航">{FACTIONS.map(f => <button key={f.id} className={`${f.id} ${filter === f.id ? 'active' : ''}`} onClick={() => navigate(f.id)} aria-current={filter === f.id ? 'page' : undefined}><span className="faction-dot"/><span>{f.name}</span><b>{count(f.id)}</b></button>)}</nav>
      <div className="sidebar-note"><div className="small-line"/><p>每一个角色，<br/>都是一个世界的入口。</p><span>KEEP YOUR STORIES ALIVE.</span></div>
      <div className="sidebar-bottom"><button onClick={() => setBackupOpen(true)}><Archive size={17}/><span>备份与数据</span><ChevronRight size={15}/></button><button onClick={() => setHelpOpen(true)}><CircleHelp size={17}/><span>使用小记</span></button><div className="local-footer"><LockKeyhole size={12}/><span>只属于你 · 保存在本机</span><span>v1.0</span></div></div>
    </aside>
    <main className="main-content" ref={mainRef}>
      {current ? <Detail character={current} onBack={() => setSelected(null)} onEdit={() => setEditor({ character: current, faction: current.faction })} onDelete={() => setDeleteId(current.id)} onFavorite={() => void favorite(current)}/> : <>
        <header className="page-heading"><div><span className="eyebrow">{activeFaction?.english ?? (filter === 'favorites' ? 'THE ONES CLOSE TO HEART' : 'YOUR ORIGINAL CHARACTERS')}</span><h1>{activeFaction?.name ?? (filter === 'favorites' ? '我的收藏' : '角色馆藏')}<span className="heading-mark">/</span></h1><p>{activeFaction?.description ?? (filter === 'favorites' ? '那些偏爱的面孔，值得被好好珍藏。' : '收集面容，记录设定，让每一个想象都有迹可循。')}</p></div><button className="button primary new-character" onClick={create} disabled={loading || !!loadError}><Plus size={18}/>新建角色<span>⌘ N</span></button></header>
        {filter === 'all' && <div className="faction-overview">{FACTIONS.map(f => <button key={f.id} className={`faction-tile ${f.id}`} onClick={() => navigate(f.id)}><span className="faction-tile-icon">{f.id === 'bureau' ? <Shield size={27} strokeWidth={1.2}/> : <Sparkles size={27} strokeWidth={1.2}/>}</span><div><span className="eyebrow">{f.id === 'bureau' ? 'ORDER IN THE UNKNOWN' : 'STORIES WITHIN OBJECTS'}</span><strong>{f.name}</strong><small>{count(f.id)} 位角色已归档</small></div><ArrowUpRightIcon/></button>)}</div>}
        <div className="gallery-toolbar"><div className="search-box"><Search size={17}/><input ref={searchRef} aria-label="搜索角色" placeholder="寻找一个名字、身份或标签…" value={query} onChange={e => setQuery(e.target.value)}/>{query ? <button className="icon-button" aria-label="清空搜索" onClick={() => setQuery('')}><X size={15}/></button> : <kbd>⌘ F</kbd>}</div><div className="gallery-options"><span className="result-count">{visible.length} 份档案</span><select aria-label="角色排序" value={sort} onChange={e => setSort(e.target.value)}><option value="updated">最近更新</option><option value="created">最近创建</option><option value="name">姓名排序</option></select><div className="density-options"><button className={!compact ? 'active' : ''} aria-label="大卡片视图" aria-pressed={!compact} onClick={() => setCompact(false)}><Grid2X2 size={16}/></button><button className={compact ? 'active' : ''} aria-label="紧凑视图" aria-pressed={compact} onClick={() => setCompact(true)}><LayoutGrid size={16}/></button></div></div></div>
        {loading ? <div className="loading-state"><span className="spinner"/>正在翻开档案…</div> : loadError ? <div className="empty-state error-state"><Archive size={42} strokeWidth={1.2}/><h2>暂时无法打开角色库</h2><p>{loadError}</p><div><button className="button secondary" onClick={() => void openFolder()}>查看数据文件夹</button><button className="button primary" disabled={busy} onClick={() => void importBackup()}>从备份恢复</button></div></div> : visible.length ? <div className={`character-grid ${compact ? 'compact' : ''}`}>{visible.map(c => <article className={`character-card ${c.faction}`} key={c.id}><button className="card-open" onClick={() => setSelected(c.id)} aria-label={`查看角色：${c.name}`}><div className="card-image"><Portrait character={c}/><div className="card-image-shade"/><span className={`card-faction ${c.faction}`}><span className="faction-dot"/>{factionOf(c.faction).short}</span><span className="card-number">{c.id.slice(0, 4).toUpperCase()}</span></div><div className="card-info"><span className="card-roman">{c.romanName || c.japaneseName || 'ORIGINAL CHARACTER'}</span><div className="card-title"><h2>{c.name}</h2><ArrowRight size={18}/></div><p>{c.summary || c.occupation || c.alias || '一个等待被书写的故事。'}</p><div className="card-bottom">{c.tags.length ? <div className="card-tags">{c.tags.slice(0, 2).map(t => <span key={t}>{t}</span>)}{c.tags.length > 2 && <span>+{c.tags.length - 2}</span>}</div> : <span className="card-date">{dateLabel(c.createdAt)} 建档</span>}</div></div></button><button className={`card-favorite ${c.favorite ? 'is-favorite' : ''}`} aria-label={`${c.favorite ? '取消收藏' : '收藏'}${c.name}`} onClick={() => void favorite(c)}><Star size={17} fill={c.favorite ? 'currentColor' : 'none'}/></button></article>)}</div> : <div className={`empty-state ${characters.length === 0 ? 'first-visit' : ''}`}><ArchiveIllustration/><span className="eyebrow">{query ? 'LOOK A LITTLE CLOSER' : filter === 'favorites' ? 'KEEP THEM CLOSE' : 'EVERY STORY STARTS SOMEWHERE'}</span><h2>{query ? '还没有找到这个角色' : filter === 'favorites' ? '把偏爱的角色，留在这里' : activeFaction ? '这个阵营，正在等待第一位成员' : '每个世界，都从一个名字开始。'}</h2><p>{query ? '试试其他名字、别名或标签，或清空搜索看看。' : filter === 'favorites' ? '点击角色卡片上的星标，就能在这里再次遇见 TA。' : '为 TA 留下一张面容、一段故事，和一个属于自己的位置。'}</p>{query ? <button className="button secondary" onClick={() => setQuery('')}>清空搜索</button> : filter === 'favorites' ? <button className="button secondary" onClick={() => navigate('all')}>浏览全部角色<ArrowRight size={15}/></button> : <button className="button primary" onClick={create}><Plus size={17}/>{characters.length === 0 ? '创建我的第一个角色' : '新建阵营角色'}</button>}<span className="empty-footnote">不必一次写完，故事可以慢慢生长。</span></div>}
        <footer className="gallery-footer"><span>PERSONA ARCHIVE</span><div/><span>你的角色，你的世界。</span></footer>
      </>}
    </main>
    {editor && <Editor character={editor.character} faction={editor.faction} onClose={() => setEditor(null)} onSaved={c => { updateCharacter(c); setEditor(null); setSelected(c.id); notify('档案已保存'); }}/>}
    {deleting && <Confirm title={`删除「${deleting.name}」？`} body="这位角色将从角色库中移除。删除前会自动备份完整角色库，你可以在「备份与数据」中找到。" action="删除角色" onCancel={() => setDeleteId(null)} onConfirm={() => void remove()} busy={busy}/>}
    {backupOpen && <Modal title="为故事，留一份备份" onClose={() => !busy && setBackupOpen(false)} className="backup-modal"><div className="backup-content"><div className="backup-summary"><HardDrive size={26} strokeWidth={1.3}/><div><strong>{characters.length} 位角色，保存在这台电脑</strong><span>完整备份包含所有角色资料和头像。</span></div><span className="local-badge">本地保存</span></div><div className="backup-choices"><button onClick={() => void exportBackup()} disabled={busy || !!loadError}><span><ArrowDownToLine size={23}/></span><strong>导出完整备份</strong><p>把全部故事打包为一份文件，<br/>保存到你选择的位置。</p><small>{busy ? '正在处理…' : '导出 .ocarchive'}<ArrowRight size={14}/></small></button><button onClick={() => void importBackup()} disabled={busy}><span><ArrowUpFromLine size={23}/></span><strong>从备份导入</strong><p>选择合并新角色，<br/>或恢复为备份时的完整角色库。</p><small>选择备份文件<ArrowRight size={14}/></small></button></div><div className="automatic-backup"><Archive size={19}/><div><strong>多留一份安心</strong><p>删除角色、导入备份前，自动保留完整副本（最近 10 份）。每次保存还会保留上一版资料。重要创作建议定期手动导出。</p><button className="text-button" onClick={() => void openFolder(true)}><FolderOpen size={14}/>查看自动备份</button></div></div><div className="data-location"><span>数据存放位置</span><code title={dataPath}>{dataPath || 'Application Support / 异闻档案 / archive'}</code><button className="icon-button" aria-label="打开数据文件夹" onClick={() => void openFolder()}><FolderOpen size={18}/></button></div></div><footer className="modal-footer"><span className="muted footnote"><LockKeyhole size={13}/>没有账号，没有云端，资料只留在你手里。</span><button className="button secondary" onClick={() => setBackupOpen(false)} disabled={busy}>完成</button></footer></Modal>}
    {helpOpen && <Modal title="写给创作者的小记" onClose={() => setHelpOpen(false)} className="help-modal"><div className="help-content"><Emblem/><h3>你的角色，你的世界。</h3><p>「异闻档案」是一个只在本机运行的小型 OC 档案馆。每份档案从姓名与阵营开始，其他设定可以随时回来补完。</p><div className="help-row"><ImageIcon/><div><strong>先留下一张面容</strong><p>添加 PNG、JPG 或 WebP 头像，拖动位置滑杆让构图更合适。图片会复制到 App 的数据目录。</p></div></div><div className="help-row"><BookOpen size={21}/><div><strong>再慢慢写下故事</strong><p>基础资料、性格、背景、能力、关系与创作手记都已备好；特殊设定可以添加自定义条目。</p></div></div><div className="help-row"><Archive size={21}/><div><strong>记得为灵感留一份副本</strong><p>在「备份与数据」里导出完整备份。重装 App 不会删除角色库，但删除本机数据目录会。</p></div></div><div className="shortcut-list"><span><kbd>⌘ N</kbd>新建角色</span><span><kbd>⌘ F</kbd>搜索角色</span><span><kbd>Esc</kbd>返回 / 关闭</span></div></div><footer className="modal-footer"><span className="muted footnote">异闻档案 1.0.0 · 完全离线</span><button className="button primary" onClick={() => setHelpOpen(false)}>开始记录<ArrowRight size={15}/></button></footer></Modal>}
    {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <CircleHelp size={18}/> : <Check size={18}/>}<span>{toast.message}</span><button className="icon-button" aria-label="关闭提示" onClick={() => setToast(null)}><X size={15}/></button></div>}
  </div>;
}
function ArrowUpRightIcon() { return <svg className="faction-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 15L15 5M5 5h10v10" stroke="currentColor" strokeWidth="1.3"/></svg>; }
function ImageIcon() { return <Library size={21}/>; }
