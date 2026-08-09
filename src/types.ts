export type ViewState = 'home' | 'channels' | 'schedule' | 'library' | 'create_watchlist' | 'sessions' | 'player' | 'settings';
export type Mode = 'kids' | 'night' | 'family' | 'cinema' | 'docs' | 'quran' | 'music' | (string & {});

export interface ModeConfig {
  title: string;
  gradient: string;
  themeColor: string;
  bgImage?: string;
  bgOpacity?: number;
}

export interface VideoFile {
  name: string;
  size: number;
  type: string;
  absolutePath: string;
  title: string;
  url?: string;
  coverImage?: string;
}

export interface Watchlist {
  id: string;
  title: string;
  section: string;
  coverImage: string;
  seriesCount: number;
  episodesCount: number;
  lastWatched: string;
  progress: number; // 0-100
  timeRemaining: string;
  folderPath?: string;
  folderName?: string;
  files?: VideoFile[];
  seasons?: { name: string; files: VideoFile[] }[];
  isSubList?: boolean;
  parentSeriesTitle?: string;
  targetMode?: Mode;
  lastWatchedIndex?: number;
  lastWatchedTime?: number;
  isSingleFile?: boolean;
}

export interface Channel {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: 'movies' | 'series' | 'radio' | 'custom';
  category: string; // e.g. "أفلام" | "مسلسلات"
  badge?: string;
  accentGradient: string; // Tailwind gradient classes
  bgCover?: string;
  playlistIds: string[]; // watchlists attached to this channel
  modes?: Mode[]; // supported modes attached to this channel
  currentSeriesIndex?: number; // rotation index
  watchlistProgress?: Record<string, { lastWatchedIndex: number; lastWatchedTime: number }>;
  isFavorite?: boolean;
  transitionType?: 'episode' | 'time';
  transitionMinutes?: number;
  transitionEpisodes?: number;
  playbackOrder?: 'sequential' | 'random';
  autoSyncEnabled?: boolean; // enable automatic syncing of new libraries matching mode/categories
  autoSyncCategories?: string[]; // list of section/category names to auto sync
}

export interface WeeklyScheduleEntry {
  id: string;
  dayOfWeek: number; // 0: الأحد, 1: الاثنين, ..., 6: السبت
  time: string; // e.g. "20:00"
  durationMinutes?: number; // e.g. 120
  transitionType?: 'episode' | 'time';
  transitionMinutes?: number;
  endTime?: string; // e.g. "22:00"
  title: string;
  channelId?: string;
  watchlistId?: string;
  categoryTag?: string;
  episodeIndex?: number; // Specific episode index
  startTimeOffset?: number; // Start offset in seconds
  mode?: Mode;
  isWatched?: boolean;
  watchedAtDayOfWeek?: number;
  watchedAtDate?: string;
}

export interface ScheduleSlot {
  id: string;
  mode: Mode;
  watchlistId?: string;
  watchlistTitle?: string;
  durationMinutes?: number;
  transitionType?: 'episode' | 'time';
  transitionMinutes?: number;
  transitionEpisodes?: number;
}

export interface SessionItem {
  seriesName: string;
  episodesCount: number;
  watchlistId?: string;
  mode?: Mode;
  durationMinutes?: number;
}

export interface Session {
  id: string;
  title: string;
  items: SessionItem[];
  loopSequence: boolean;
  breakBetweenItems: number; // minutes
  breakBetweenLoops: number; // minutes
  selectedWatchlistIds?: string[];
  scheduleSlots?: ScheduleSlot[];
  strategy?: 'alternate' | 'random' | 'sequential' | 'schedule';
  lastWatchedIndex?: number;
  lastWatchedTime?: number;
  transitionType?: 'episode' | 'time';
  transitionMinutes?: number;
  queue?: any[];
}


