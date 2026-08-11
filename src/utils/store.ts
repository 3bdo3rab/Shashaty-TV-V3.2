import { LazyStore } from '@tauri-apps/plugin-store';
import { Watchlist, Session, Mode, ModeConfig, Channel, WeeklyScheduleEntry } from '../types';
import { MODES } from '../data';

// Initialize the store file on disk. This is fully offline and persistent.

import { documentDir, join } from '@tauri-apps/api/path';

let dbInstance: LazyStore;
async function getDb(): Promise<LazyStore> {
  if (!dbInstance) {
    try {
      const docsDir = await documentDir();
      const dbPath = await join(docsDir, 'Shashaty TV', 'shashaty_db.json');
      dbInstance = new LazyStore(dbPath, { autoSave: false });
    } catch (e) {
      console.warn('Failed to resolve Documents directory, falling back to default', e);
      dbInstance = new LazyStore('shashaty_db.json', { autoSave: false });
    }
  }
  return dbInstance;
}


// Helper to ensure paths are saved securely
function sanitizeFileItem(item: any) {
  if (!item) return item;
  
  if (typeof item === 'object') {
    return {
      name: typeof item.name === 'string' ? item.name : (typeof item.title === 'string' ? item.title : 'مقطع'),
      size: typeof item.size === 'number' ? item.size : 0,
      type: typeof item.type === 'string' ? item.type : '',
      absolutePath: item.absolutePath || item.path || item.customPath || '',
      title: typeof item.title === 'string' ? item.title : (typeof item.name === 'string' ? item.name : 'مقطع'),
      url: typeof item.url === 'string' && !item.url.startsWith('blob:') ? item.url : '',
      coverImage: typeof item.coverImage === 'string' ? item.coverImage : (typeof item.thumbnail === 'string' ? item.thumbnail : (typeof item.poster === 'string' ? item.poster : ''))
    };
  }
  return item;
}

export function sanitizeWatchlists(lists: Watchlist[]): Watchlist[] {
  if (!Array.isArray(lists)) return [];
  return lists.map(w => ({
    ...w,
    files: Array.isArray(w.files) ? w.files.map(sanitizeFileItem) : [],
    seasons: Array.isArray(w.seasons)
      ? w.seasons.map(s => ({
          name: s.name,
          files: Array.isArray(s.files) ? s.files.map(sanitizeFileItem) : []
        }))
      : undefined
  }));
}

export const store = {
  async getWatchlists(): Promise<Watchlist[]> {
    try {
      const data = await (await getDb()).get<Watchlist[]>('app_watchlists');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Store getWatchlists failed:', e);
      return [];
    }
  },

  async setWatchlists(watchlists: Watchlist[]) {
    try {
      const sanitized = sanitizeWatchlists(watchlists);
      await (await getDb()).set('app_watchlists', sanitized);
      await (await getDb()).save();
    } catch (e) {
      console.warn('Store setWatchlists failed:', e);
    }
  },

  async getSessions(): Promise<Session[]> {
    try {
      const data = await (await getDb()).get<Session[]>('app_sessions');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Store getSessions failed:', e);
      return [];
    }
  },

  async setSessions(sessions: Session[]) {
    try {
      await (await getDb()).set('app_sessions', sessions);
      await (await getDb()).save();
    } catch (e) {
      console.warn('Store setSessions failed:', e);
    }
  },

  async getCategories(): Promise<Record<Mode, string[]>> {
    try {
      const data = await (await getDb()).get<Record<Mode, string[]>>('app_custom_categories');
      if (data && typeof data === 'object') return data;
    } catch (e) {
      console.warn('Store getCategories failed:', e);
    }
    return {
      kids: [], family: [], cinema: [], docs: [], quran: [], music: [], night: []
    };
  },

  async setCategories(categories: Record<Mode, string[]>) {
    try {
      await (await getDb()).set('app_custom_categories', categories);
      await (await getDb()).save();
    } catch (e) {
      console.warn('Store setCategories failed:', e);
    }
  },

  async getCustomModes(): Promise<Record<Mode, ModeConfig>> {
    try {
      const data = await (await getDb()).get<Record<Mode, ModeConfig>>('app_custom_modes');
      if (data && typeof data === 'object') return data;
    } catch (e) {
      console.warn('Store getCustomModes failed:', e);
    }
    return MODES;
  },

  async setCustomModes(modes: Record<Mode, ModeConfig>) {
    try {
      await (await getDb()).set('app_custom_modes', modes);
      await (await getDb()).save();
    } catch (e) {
      console.warn('Store setCustomModes failed:', e);
    }
  },

  async getChannels(): Promise<Channel[] | null> {
    try {
      const data = await (await getDb()).get<Channel[]>('app_channels');
      return Array.isArray(data) ? data : null;
    } catch (e) {
      console.warn('Store getChannels failed:', e);
      return null;
    }
  },

  async setChannels(channels: Channel[]) {
    try {
      await (await getDb()).set('app_channels', channels);
      await (await getDb()).save();
    } catch (e) {
      console.warn('Store setChannels failed:', e);
    }
  },

  async setLastPlaybackState(state: any) {
    await (await getDb()).set('last_playback_state', state);
    await (await getDb()).save();
  },

  async getLastPlaybackState(): Promise<any> {
    return await (await getDb()).get('last_playback_state');
  },

  async clearLastPlaybackState() {
    await (await getDb()).delete('last_playback_state');
    await (await getDb()).save();
  },

  async getSchedules(): Promise<WeeklyScheduleEntry[]> {
    try {
      const data = await (await getDb()).get<WeeklyScheduleEntry[]>('app_schedules');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Store getSchedules failed:', e);
      return [];
    }
  },

  async setSchedules(schedules: WeeklyScheduleEntry[]) {
    try {
      await (await getDb()).set('app_schedules', schedules);
      await (await getDb()).save();
    } catch (e) {
      console.warn('Store setSchedules failed:', e);
    }
  },

  async getMode(): Promise<Mode> {
    try {
      const data = await (await getDb()).get<Mode>('app_active_mode');
      return data || 'family';
    } catch (e) {
      return 'family';
    }
  },

  async setMode(mode: Mode) {
    try {
      await (await getDb()).set('app_active_mode', mode);
      await (await getDb()).save();
    } catch (e) {
      console.warn('Store setMode failed:', e);
    }
  }
};
