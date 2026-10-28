export const FACTIONS = [
  { id: 'bureau', name: '特异事务对策局', english: 'SPECIAL AFFAIRS BUREAU', short: '对策局', description: '守住日常与异常之间的边界。' },
  { id: 'atelier', name: '异常物品鉴定工作室', english: 'ANOMALY APPRAISAL ATELIER', short: '鉴定工作室', description: '每一件异常之物，都有来处。' },
] as const;
export type Faction = typeof FACTIONS[number]['id'];
export interface CharacterFields {
  name: string; faction: Faction; japaneseName: string; romanName: string; alias: string;
  gender: string; age: string; birthday: string; zodiac: string; height: string; occupation: string;
  quote: string; summary: string; personality: string; abilities: string; biography: string;
  relationships: string; notes: string; tags: string[]; favorite: boolean;
  portraitPosition: number; customFields: { label: string; value: string }[];
}
export interface Character extends CharacterFields {
  id: string; portrait: string | null; createdAt: string; updatedAt: string;
}
export interface Library { version: 1; characters: Character[] }
export interface SaveInput { id?: string; fields: CharacterFields; portraitData?: string | null }
export interface LibraryInfo { library: Library; dataPath: string; recovered: boolean }
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface ArchiveAPI {
  load(): Promise<Result<LibraryInfo>>;
  save(input: SaveInput): Promise<Result<Character>>;
  remove(id: string): Promise<Result<void>>;
  favorite(id: string): Promise<Result<Character>>;
  exportBackup(): Promise<Result<string | null>>;
  importBackup(): Promise<Result<{ count: number; mode: 'merge' | 'replace'; library: Library } | null>>;
  openDataFolder(): Promise<Result<void>>;
  openBackupFolder(): Promise<Result<void>>;
}
export function emptyFields(faction: Faction = 'bureau'): CharacterFields {
  return { name: '', faction, japaneseName: '', romanName: '', alias: '', gender: '', age: '', birthday: '', zodiac: '', height: '', occupation: '', quote: '', summary: '', personality: '', abilities: '', biography: '', relationships: '', notes: '', tags: [], favorite: false, portraitPosition: 30, customFields: [] };
}
export const portraitURL = (character: Character) => character.portrait ? `oc-asset://portrait/${character.portrait}` : null;
export const factionOf = (id: Faction) => FACTIONS.find(f => f.id === id)!;
