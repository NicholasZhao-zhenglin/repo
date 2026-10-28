import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Upload, Plus, Trash2, Check, MoveVertical, ChevronRight, Camera, Star } from 'lucide-react';
import { FACTIONS, emptyFields, portraitURL, type Character, type CharacterFields, type Faction } from '../shared/model';
import { Confirm, Modal } from './components';

const ZODIAC = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];
export default function Editor({ character, faction, onSaved, onClose }: { character?: Character; faction: Faction; onSaved: (c: Character) => void; onClose: () => void }) {
  const [fields, setFields] = useState<CharacterFields>(() => character ? { ...character, tags: [...character.tags], customFields: character.customFields.map(f => ({ ...f })) } : emptyFields(faction));
  const [tags, setTags] = useState(character?.tags.join('，') ?? '');
  const [portraitData, setPortraitData] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = useRef(JSON.stringify({ fields, tags }));
  const dirty = initial.current !== JSON.stringify({ fields, tags }) || portraitData !== undefined;
  const preview = portraitData === undefined ? (character ? portraitURL(character) : null) : portraitData;
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  function update<K extends keyof CharacterFields>(key: K, value: CharacterFields[K]) { setFields(previous => ({ ...previous, [key]: value })); }
  function close() { if (!saving && !reading) { if (dirty) setDiscard(true); else onClose(); } }
  async function readImage(file: File | undefined) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('头像支持 PNG、JPG 和 WebP 格式'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('请选择 20 MB 以内的图片'); return; }
    setError(''); setReading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('图片读取失败，请重新选择')); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); });
      await new Promise<void>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(); img.onerror = () => reject(new Error('图片内容无效，请重新选择')); img.src = data; });
      setPortraitData(data); update('portraitPosition', 30);
    } catch (e) { setError((e as Error).message); }
    finally { setReading(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (saving || reading) return;
    if (!fields.name.trim()) { setTab(0); setError('先给角色起一个名字吧'); window.setTimeout(() => document.getElementById('field-name')?.focus(), 30); return; }
    const newTags = [...new Set(tags.split(/[,，]/).map(t => t.trim()).filter(Boolean))];
    if (newTags.length > 12 || newTags.some(t => t.length > 30)) { setError('最多 12 个标签，每个标签不超过 30 字'); setTab(0); return; }
    setSaving(true); setError('');
    try {
      const result = await window.archive.save({ id: character?.id, fields: { ...fields, tags: newTags }, portraitData });
      if (!result.ok) { setError(result.error); return; }
      onSaved(result.value);
    } catch { setError('保存失败，请重试。当前填写的内容仍然保留。'); }
    finally { setSaving(false); }
  }
  function field(key: keyof CharacterFields, label: string, placeholder = '', className = '') {
    return <label className={`field ${className}`} key={key}><span>{label}{key === 'name' && <b className="required"> *</b>}</span><input id={`field-${key}`} name={key} value={String(fields[key])} onChange={e => update(key, e.target.value as never)} maxLength={key === 'quote' || key === 'summary' ? 500 : 200} placeholder={placeholder} data-autofocus={key === 'name' || undefined}/></label>;
  }
  function area(key: 'personality' | 'abilities' | 'biography' | 'relationships' | 'notes', label: string, placeholder: string) {
    return <label className="field" key={key}><span>{label}</span><textarea name={key} rows={key === 'biography' ? 6 : 4} maxLength={20000} value={fields[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder}/></label>;
  }
  return <>
    <Modal title={character ? '编辑角色档案' : '建立一份新档案'} onClose={close} className="editor-modal">
      <form onSubmit={save} className="editor-form">
        <div className="editor-body" inert={saving || reading}>
          <aside className="editor-portrait-column">
            <div className={`portrait-upload ${fields.faction} ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); if (!saving && !reading) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!saving && !reading) void readImage(e.dataTransfer.files[0]); }}>
              {preview ? <img src={preview} alt="头像预览" style={{ objectPosition: `50% ${fields.portraitPosition}%` }}/> : <div className="upload-prompt"><span className="upload-icon"><ImagePlus size={34} strokeWidth={1.25}/></span><strong>让角色拥有面容</strong><span>点击选择，或拖入一张图片</span><small>PNG / JPG / WebP · 最大 20 MB</small></div>}
              <button type="button" className={`upload-overlay ${preview ? 'has-image' : ''}`} onClick={() => inputRef.current?.click()} aria-label={preview ? '更换头像' : '上传头像'} disabled={saving || reading}>{preview && <span><Camera size={17}/> 更换头像</span>}</button>
              {reading && <div className="image-reading">正在读取图片…</div>}
            </div>
            <input ref={inputRef} aria-label="头像文件" className="hidden-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { void readImage(e.target.files?.[0]); e.target.value = ''; }}/>
            {preview && <div className="portrait-controls"><label><span><MoveVertical size={14}/> 头像显示位置</span><input aria-label="头像显示位置" type="range" min="0" max="100" value={fields.portraitPosition} onChange={e => update('portraitPosition', Number(e.target.value))}/></label><button type="button" className="text-button muted" onClick={() => setPortraitData(null)} disabled={saving || reading}>移除头像</button></div>}
            <div className="portrait-tip"><span className="eyebrow">A FACE, A WHOLE WORLD</span><p>有些故事，从一个眼神开始。<br/>头像与资料都可以随时修改。</p></div>
          </aside>
          <div className="editor-fields">
            <nav className="editor-tabs" aria-label="资料分类">{['基础信息', '性格与故事', '更多设定'].map((label, i) => <button type="button" className={tab === i ? 'active' : ''} onClick={() => setTab(i)} key={label} aria-current={tab === i ? 'page' : undefined}><span>0{i + 1}</span>{label}</button>)}</nav>
            <div className="editor-tab-content">
              {tab === 0 && <>
                <div className="form-section-label">角色是谁 <span>姓名为必填，其余都可以慢慢补充</span></div>
                <div className="fields-grid">{field('name', '姓名', '角色的名字')}{field('alias', '昵称 / 别名', '另一个被记住的名字')}{field('japaneseName', '日文名 / 外文名', '如：かんざき れい')}{field('romanName', '罗马音 / 英文名', '如：Kanzaki Rei')}</div>
                <div className="field"><span>所属阵营</span><div className="faction-options">{FACTIONS.map(f => <button key={f.id} type="button" className={`faction-option ${f.id} ${fields.faction === f.id ? 'selected' : ''}`} onClick={() => update('faction', f.id)} aria-pressed={fields.faction === f.id}><span className="faction-dot"/><strong>{f.name}</strong>{fields.faction === f.id && <Check size={15}/>}</button>)}</div></div>
                <div className="fields-grid three">{field('gender', '性别', '自由填写')}{field('age', '年龄', '如：24 / 不详')}{field('birthday', '生日', '如：11/07')}
                  <label className="field"><span>星座</span><select name="zodiac" value={fields.zodiac} onChange={e => update('zodiac', e.target.value)}><option value="">暂未设定</option>{ZODIAC.map(z => <option key={z}>{z}</option>)}{fields.zodiac && !ZODIAC.includes(fields.zodiac) && <option>{fields.zodiac}</option>}</select></label>{field('height', '身高', '如：168 cm')}{field('occupation', '身份 / 职务', '如：特别调查员')}
                </div>
                {field('summary', '一句话简介', '用一句话勾勒这个角色')}
                <label className="field"><span>角色标签 <small>使用逗号分隔，最多 12 个</small></span><input value={tags} onChange={e => setTags(e.target.value)} placeholder="如：沉稳，红发，神秘学" maxLength={420}/></label>
                <button type="button" className={`favorite-toggle ${fields.favorite ? 'active' : ''}`} onClick={() => update('favorite', !fields.favorite)} aria-pressed={fields.favorite}><Star size={16} fill={fields.favorite ? 'currentColor' : 'none'}/> 将这个角色加入收藏</button>
              </>}
              {tab === 1 && <><div className="form-section-label">让故事生长 <span>不必一次写完，灵感可以慢慢积累</span></div>{field('quote', '角色寄语 / 代表台词', '如果 TA 要说一句话……')}{area('personality', '性格与习惯', '对外的模样、不为人知的一面、喜欢与讨厌的事物……')}{area('biography', '背景故事', '从哪里来，经历过什么，又将走向哪里……')}{area('relationships', '人物关系', '重要的人、阵营中的伙伴、尚未说出口的牵绊……')}</>}
              {tab === 2 && <><div className="form-section-label">独一无二的细节 <span>把世界观中的特别设定写在这里</span></div>{area('abilities', '能力与装备', '特殊能力、使用条件、代价、随身物品……')}{area('notes', '创作手记', '灵感来源、待补充的伏笔、下次想画的表情……')}<div className="custom-fields-title"><strong>自定义条目</strong><span>血型、种族、代表色……由你决定</span></div>{fields.customFields.map((item, i) => <div className="custom-field-row" key={i}><input aria-label={`条目 ${i + 1} 名称`} placeholder="条目名称" maxLength={100} value={item.label} onChange={e => update('customFields', fields.customFields.map((f, n) => n === i ? { ...f, label: e.target.value } : f))}/><textarea aria-label={`条目 ${i + 1} 内容`} rows={1} placeholder="内容" maxLength={2000} value={item.value} onChange={e => update('customFields', fields.customFields.map((f, n) => n === i ? { ...f, value: e.target.value } : f))}/><button type="button" className="icon-button" aria-label={`移除条目 ${i + 1}`} onClick={() => update('customFields', fields.customFields.filter((_, n) => n !== i))}><Trash2 size={16}/></button></div>)}<button type="button" className="button dashed" disabled={fields.customFields.length >= 20} onClick={() => update('customFields', [...fields.customFields, { label: '', value: '' }])}><Plus size={15}/>添加自定义条目</button></>}
            </div>
          </div>
        </div>
        <footer className="modal-footer editor-footer"><div className={`editor-status ${error ? 'error' : ''}`} role={error ? 'alert' : undefined}>{error || <><span className="local-dot"/> 资料仅保存在这台电脑</>}</div><button type="button" className="button secondary" onClick={close} disabled={saving || reading}>取消</button>{tab < 2 && <button type="button" className="button next-tab" onClick={() => setTab(tab + 1)}>继续填写<ChevronRight size={15}/></button>}<button type="submit" className="button primary" disabled={saving || reading}><Check size={17}/>{saving ? '正在保存…' : '保存档案'}</button></footer>
      </form>
    </Modal>
    {discard && <Confirm title="放弃这次编辑？" body="尚未保存的内容将会丢失，已经保存的角色档案不会受影响。" action="放弃更改" onCancel={() => setDiscard(false)} onConfirm={onClose}/>}
  </>;
}
