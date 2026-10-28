import { contextBridge, ipcRenderer } from 'electron';
import type { ArchiveAPI } from '../shared/model';
const api: ArchiveAPI = {
  load: () => ipcRenderer.invoke('archive:load'),
  save: input => ipcRenderer.invoke('archive:save', input),
  remove: id => ipcRenderer.invoke('archive:remove', id),
  favorite: id => ipcRenderer.invoke('archive:favorite', id),
  exportBackup: () => ipcRenderer.invoke('archive:export'),
  importBackup: () => ipcRenderer.invoke('archive:import'),
  openDataFolder: () => ipcRenderer.invoke('archive:open-data'),
  openBackupFolder: () => ipcRenderer.invoke('archive:open-backups'),
};
contextBridge.exposeInMainWorld('archive', api);
