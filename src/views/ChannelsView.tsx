import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Channel, Watchlist, WeeklyScheduleEntry, Mode } from '../types';
import { MODES, MODE_SECTIONS } from '../data';
import { ModeConfig } from '../types';
import { getChannelNowPlaying, autoAssignWatchlistsToChannels, NowPlayingInfo, getChannelSolidBg } from '../utils/channelEngine';
import { findScheduleConflict, parseTimeToMinutes, formatMinutesToTime } from '../utils/scheduleUtils';
import { 
  Tv, Play, Settings, Calendar, Sparkles, Plus, Check, Trash2, Clock, 
  Flame, Heart, Smile, Skull, Compass, Zap, Users, Baby, Music, Globe, ChevronDown, 
  Film, Star, Shield, Layers, Radio, Mic, RefreshCw, X, ChevronRight, Shuffle, Pencil, AlertTriangle, Clapperboard,
  GripVertical, ArrowUp, ArrowDown, Repeat, Wand2, Copy, CopyCheck, Sliders, SlidersHorizontal, Download, Upload, BookOpen
} from 'lucide-react';
import { useDialog } from '../contexts/DialogContext';

export interface CategorySlotConfig {
  id: string;
  time: string;
  mode: Mode;
  label?: string;
}

export const CATEGORY_NAMES_WITH_ICONS: Record<string, { label: string; icon: any; badgeColor: string; bg: string; border: string }> = {
  kids: { label: 'أطفال 👶', icon: Baby, badgeColor: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-400/40' },
  family: { label: 'مسلسلات 👨‍👩‍👧‍👦', icon: Radio, badgeColor: 'text-indigo-300', bg: 'bg-indigo-500/20', border: 'border-indigo-400/40' },
  cinema: { label: 'أفلام 🎬', icon: Film, badgeColor: 'text-rose-300', bg: 'bg-rose-500/20', border: 'border-rose-400/40' },
  quran: { label: 'قرآن 📖', icon: BookOpen, badgeColor: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-400/40' },
  docs: { label: 'وثائقيات 🌍', icon: Globe, badgeColor: 'text-cyan-300', bg: 'bg-cyan-500/20', border: 'border-cyan-400/40' },
  music: { label: 'موسيقى 🎵', icon: Music, badgeColor: 'text-fuchsia-300', bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-400/40' }
};

export const PRESET_CATEGORY_SCHEDULES: Record<string, { name: string; desc: string; slots: CategorySlotConfig[] }> = {
  family_diverse: {
    name: 'الجدول المتنوع المخصص (أطفال ⬅️ مسلسلات عربية ⬅️ قرآن ⬅️ مسلسلات أجنبية ⬅️ وثائقيات ⬅️ أفلام)',
    desc: 'ترتيب أوقات تلفزيونية منوعة ومثالية طوال اليوم بحسب تسلسلك المفضل',
    slots: [
      { id: 'fd-1', time: '10:00', mode: 'kids', label: '1. أطفال وكرتون' },
      { id: 'fd-2', time: '16:00', mode: 'family', label: '2. مسلسلات عربية' },
      { id: 'fd-3', time: '18:30', mode: 'quran', label: '3. قرآن وطمأنينة' },
      { id: 'fd-4', time: '20:00', mode: 'family', label: '4. مسلسلات أجنبية' },
      { id: 'fd-5', time: '21:30', mode: 'docs', label: '5. وثائقيات وثقافة' },
      { id: 'fd-6', time: '23:00', mode: 'cinema', label: '6. أفلام وسينما' }
    ]
  },
  entertainment: {
    name: 'النمط الترفيهي (أطفال + مسلسلات + أفلام)',
    desc: 'جدول ممتع من كرتون الأطفال ومسلسلات السهرة وسينما الليل',
    slots: [
      { id: 'en-1', time: '10:30', mode: 'kids', label: 'كرتون أطفال' },
      { id: 'en-2', time: '16:00', mode: 'kids', label: 'عروض أطفال ورسوم متحركة' },
      { id: 'en-3', time: '18:30', mode: 'family', label: 'مسلسلات عربية' },
      { id: 'en-4', time: '20:30', mode: 'family', label: 'مسلسلات أجنبية' },
      { id: 'en-5', time: '22:30', mode: 'cinema', label: 'فيلم وسينما السهرة' }
    ]
  },
  spiritual: {
    name: 'نمط القرآن والهدوء (قرآن + وثائقيات + موسيقى)',
    desc: 'جدول هادئ ومبارك للتلاوات والوثائقيات',
    slots: [
      { id: 'sp-1', time: '07:00', mode: 'quran', label: 'قرآن الصباح' },
      { id: 'sp-2', time: '13:00', mode: 'quran', label: 'قرآن الظهيرة' },
      { id: 'sp-3', time: '17:00', mode: 'docs', label: 'وثائقيات وطبيعة' },
      { id: 'sp-4', time: '20:00', mode: 'quran', label: 'تلاوات الليل الخاشعة' },
      { id: 'sp-5', time: '22:00', mode: 'music', label: 'موسيقى وألحان هادئة' }
    ]
  }
};

export function getWatchlistsForCategory(watchlists: Watchlist[], mode: Mode, slotLabel?: string): Watchlist[] {
  const norm = (s: string) => (s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
  const labelNorm = norm(slotLabel || '');

  const filtered = watchlists.filter(w => {
    const fileCount = (w.files?.length || 0) + (w.seasons?.flatMap(s => s.files || []).length || 0);
    if (fileCount === 0) return false;

    const titleNorm = norm(w.title);
    const secNorm = norm(w.section || '');
    const combined = titleNorm + ' ' + secNorm;

    // Sub-filtering for Arabic vs Foreign series
    if (mode === 'family' && slotLabel) {
      const isArabicSlot = labelNorm.includes('عرب');
      const isForeignSlot = labelNorm.includes('اجنب') || labelNorm.includes('مترجم') || labelNorm.includes('غريب');

      if (isArabicSlot) {
        if (/اجنبي|اجنبيه|مترجم|english|foreign/i.test(combined) && !/عربي/i.test(combined)) return false;
        if (/عربي|عربيه|مصر|سور|خليج|رمضان/i.test(combined) || w.targetMode === 'family') return true;
      }

      if (isForeignSlot) {
        if (/عربي|عربيه|مصريه|سوريه/i.test(combined) && !/مترجم|تركي|كوري|اجنبي/i.test(combined)) return false;
        if (/اجنبي|اجنبيه|مترجم|تركي|كوري|english|foreign|هوليوود/i.test(combined) || w.targetMode === 'family') return true;
      }
    }

    if (w.targetMode === mode || w.section === mode) return true;

    if (mode === 'kids') {
      return /اطفال|طفل|كرتون|براعم|انمي|طيور|سبونج|توم|جيري|ماشا|ديزني|kids|child/i.test(combined);
    }
    if (mode === 'family') {
      return /مسلسل|دراما|عائلي|رمضان|موسم|حلقات|series|show/i.test(combined);
    }
    if (mode === 'cinema') {
      return /فيلم|افلام|سينما|هوليود|اكشن|رعب|movie|cinema/i.test(combined);
    }
    if (mode === 'quran') {
      return /قران|تلاوه|مصحف|اذكار|حديث|اسلام|مكه|مدينه|quran/i.test(combined);
    }
    if (mode === 'docs') {
      return /وثايقي|طبيعه|علم|فضاء|تاريخ|حضاره|غابه|doc/i.test(combined);
    }
    if (mode === 'music') {
      return /موسيقى|اغاني|اناشيد|طرب|لحن|معزوفه|music/i.test(combined);
    }

    return false;
  });

  if (filtered.length > 0) return filtered;

  // Fallback: return general watchlists matching mode if no sub-filter match
  return watchlists.filter(w => {
    const fileCount = (w.files?.length || 0) + (w.seasons?.flatMap(s => s.files || []).length || 0);
    return fileCount > 0 && (w.targetMode === mode || w.section === mode);
  });
}

interface ChannelsViewProps {
  initialTab?: 'channels' | 'schedule';
  channels: Channel[];
  watchlists: Watchlist[];
  schedules: WeeklyScheduleEntry[];
  onUpdateChannels: (channels: Channel[]) => void;
  onUpdateSchedules: (schedules: WeeklyScheduleEntry[]) => void;
  customModes?: Record<string, ModeConfig>;
  customCategories?: Record<string, string[]>;
  onPlay: (
    file?: any, 
    title?: string, 
    watchlistTitle?: string, 
    files?: any[], 
    index?: number,
    sessionId?: string,
    watchlistId?: string,
    initialTime?: number,
    channelId?: string
  ) => void;
}

const ICON_MAP: Record<string, any> = {
  Flame, Heart, Smile, Skull, Compass, Zap, Users, Baby, Music, Globe,
  Tv, Film, Star, Shield, Sparkles, Clock, Layers, Radio, Mic
};

const DAYS_OF_WEEK = [
  { id: 6, name: 'السبت' },
  { id: 0, name: 'الأحد' },
  { id: 1, name: 'الاثنين' },
  { id: 2, name: 'الثلاثاء' },
  { id: 3, name: 'الأربعاء' },
  { id: 4, name: 'الخميس' },
  { id: 5, name: 'الجمعة' },
];

export const ChannelsView: React.FC<ChannelsViewProps> = ({
  customModes = MODES,
  customCategories = {},
  initialTab = 'channels',
  channels,
  watchlists,
  schedules,
  onUpdateChannels,
  onUpdateSchedules,
  onPlay
}) => {
  const { showAlert, showConfirm } = useDialog();
  const [activeTab, setActiveTab] = useState<'channels' | 'schedule'>(initialTab);
  const [filterType, setFilterType] = useState<'all' | 'favorites' | 'movies' | 'series' | 'radio'>('all');
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [showAllWatchlistsInModal, setShowAllWatchlistsInModal] = useState(false);

  // Quick Link Modal State
  const [isQuickLinkModalOpen, setIsQuickLinkModalOpen] = useState(false);
  const [expandedQuickLinkMode, setExpandedQuickLinkMode] = useState<{channelId: string, modeId: string} | null>(null);
  const [quickChannels, setQuickChannels] = useState<Channel[]>([]);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');

  const handleOpenQuickLink = () => {
    setQuickChannels(JSON.parse(JSON.stringify(channels)));
    setQuickSearchQuery('');
    setIsQuickLinkModalOpen(true);
  };
  
  // Weekly Schedule State
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [isAddSlotOpen, setIsAddSlotOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<WeeklyScheduleEntry | null>(null);
  const [slotTime, setSlotTime] = useState('20:00');
  const [slotTransitionType, setSlotTransitionType] = useState<'episode' | 'time'>('episode');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState<number>(60);
  const [slotTitle, setSlotTitle] = useState('');
  const [slotSourceType, setSlotSourceType] = useState<'channel' | 'watchlist'>('channel');
  const [slotChannelId, setSlotChannelId] = useState('');
  const [slotWatchlistId, setSlotWatchlistId] = useState('');
  const [slotEpisodeIndex, setSlotEpisodeIndex] = useState<number>(0);
  const [slotStartOffsetMinutes, setSlotStartOffsetMinutes] = useState<number>(0);
  const [slotMode, setSlotMode] = useState<Mode | ''>('');

  // Surprise Me Roulette State
  const [isSurpriseOpen, setIsSurpriseOpen] = useState(false);
  const [surpriseItem, setSurpriseItem] = useState<{ watchlist: Watchlist; file: any; epIndex: number } | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  // Today's Recommendations State (🍿 ماذا أشاهد اليوم؟)
  const [suggestions, setSuggestions] = useState<Watchlist[]>([]);

  // Trigger channel auto-sync manually based on mode constraints
  const handleRunSyncChannels = () => {
    const syncedChannels = autoAssignWatchlistsToChannels(channels, watchlists);
    onUpdateChannels(syncedChannels);
    showAlert('تم تشغيل المزامنة الأوتوماتيكية بنجاح! تم تحديث كافة القنوات ومطابقة القوائم بناءً على الأوضاع المحددة لكل قناة ⚡📺');
  };

  const refreshSuggestions = () => {
    if (!watchlists || watchlists.length === 0) return;
    const shuffled = [...watchlists].sort(() => 0.5 - Math.random());
    setSuggestions(shuffled.slice(0, 3));
  };

  React.useEffect(() => {
    if (watchlists.length > 0 && suggestions.length === 0) {
      refreshSuggestions();
    }
  }, [watchlists]);

  const refreshSingleSuggestion = (indexToReplace: number) => {
    if (!watchlists || watchlists.length === 0) return;
    const available = watchlists.filter(w => !suggestions.some(s => s.id === w.id));
    if (available.length === 0) {
      refreshSuggestions();
      return;
    }
    const newRandom = available[Math.floor(Math.random() * available.length)];
    const updated = [...suggestions];
    updated[indexToReplace] = newRandom;
    setSuggestions(updated);
  };

  const handlePlaySuggestion = (wl: Watchlist) => {
    const allFiles = [
      ...(wl.files || []),
      ...(wl.seasons?.flatMap(s => s.files || []) || [])
    ];
    if (allFiles.length === 0) {
      showAlert(`قائمة التشغيل "${wl.title}" لا تحتوي على ملفات وسائط قابلة للتشغيل.`);
      return;
    }
    const epIdx = wl.lastWatchedIndex || 0;
    const safeIdx = Math.min(allFiles.length - 1, Math.max(0, epIdx));
    const file = allFiles[safeIdx];
    onPlay(
      file,
      file?.name || file?.title || `الحلقة ${safeIdx + 1}`,
      wl.title,
      allFiles,
      safeIdx,
      undefined,
      wl.id,
      wl.lastWatchedTime || 0
    );
  };

  // Auto-populated Channels
  const resolvedChannels = useMemo(() => {
    return autoAssignWatchlistsToChannels(channels, watchlists);
  }, [channels, watchlists]);

  // Drag and Drop Channels Reordering State
  const [draggedChannelId, setDraggedChannelId] = useState<string | null>(null);
  const [dragOverChannelId, setDragOverChannelId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, channelId: string) => {
    e.dataTransfer.setData('text/plain', channelId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedChannelId(channelId);
  };

  const handleDragOver = (e: React.DragEvent, channelId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverChannelId !== channelId) {
      setDragOverChannelId(channelId);
    }
  };

  const handleDragEnd = () => {
    setDraggedChannelId(null);
    setDragOverChannelId(null);
  };

  const handleDrop = (e: React.DragEvent, targetChannelId: string) => {
    e.preventDefault();
    if (!draggedChannelId || draggedChannelId === targetChannelId) {
      handleDragEnd();
      return;
    }

    const sourceIndex = resolvedChannels.findIndex(c => c.id === draggedChannelId);
    const targetIndex = resolvedChannels.findIndex(c => c.id === targetChannelId);

    if (sourceIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    const updatedChannels = [...resolvedChannels];
    const [movedChannel] = updatedChannels.splice(sourceIndex, 1);
    updatedChannels.splice(targetIndex, 0, movedChannel);

    onUpdateChannels(updatedChannels);
    handleDragEnd();
  };

  const handleMoveChannel = (channelId: string, direction: 'up' | 'down') => {
    const currentIndex = resolvedChannels.findIndex(c => c.id === channelId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= resolvedChannels.length) return;

    const updatedChannels = [...resolvedChannels];
    const [movedChannel] = updatedChannels.splice(currentIndex, 1);
    updatedChannels.splice(targetIndex, 0, movedChannel);

    onUpdateChannels(updatedChannels);
  };

  // Compute Now Playing across all active channels
  const nowPlayingList = useMemo(() => {
    return resolvedChannels
      .map(ch => getChannelNowPlaying(ch, watchlists))
      .filter((np): np is NowPlayingInfo => np !== null);
  }, [resolvedChannels, watchlists]);

  const filteredChannels = useMemo(() => {
    if (filterType === 'favorites') return resolvedChannels.filter(c => c.isFavorite);
    if (filterType === 'movies') return resolvedChannels.filter(c => c.type === 'movies');
    if (filterType === 'series') return resolvedChannels.filter(c => c.type === 'series');
    if (filterType === 'radio') return resolvedChannels.filter(c => c.type === 'radio');
    return resolvedChannels;
  }, [resolvedChannels, filterType]);

  // Toggle Favorite Channel
  const handleToggleFavoriteChannel = (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation();
    const updated = resolvedChannels.map(c => 
      c.id === channelId ? { ...c, isFavorite: !c.isFavorite } : c
    );
    onUpdateChannels(updated);
  };

  // Delete Channel
  const handleDeleteChannel = async (e?: React.MouseEvent, channelToDelete?: Channel) => {
    if (e) e.stopPropagation();
    const targetChannel = channelToDelete || editingChannel;
    if (!targetChannel) return;

    const confirmed = await showConfirm(
      `هل أنت تأكد من حذف القناة "${targetChannel.title}"؟`,
      'حذف القناة',
      true
    );

    if (confirmed) {
      const updated = resolvedChannels.filter(c => c.id !== targetChannel.id);
      onUpdateChannels(updated);
      if (editingChannel?.id === targetChannel.id) {
        setEditingChannel(null);
      }
    }
  };

  // Play Channel
  const handlePlayChannel = (channel: Channel) => {
    const np = getChannelNowPlaying(channel, watchlists);
    if (!np) {
      showAlert(`القناة "${channel.title}" لا تحتوي على أي ملفات وسائط مرتبطة. قم بربط قائمة تشغيل أولاً من خيار التخصيص.`);
      return;
    }

    // Play current file with initial time offset
    onPlay(
      np.currentFile,
      np.currentEpisodeTitle,
      `${channel.title} - ${np.currentWatchlistTitle}`,
      np.allFiles,
      np.currentEpisodeIndex,
      undefined,
      np.currentWatchlistId,
      np.initialTime,
      channel.id
    );

    // Save/Advance channel progress in store
    const updatedChannels = channels.map(c => {
      if (c.id === channel.id) {
        const nextRot = ((c.currentSeriesIndex || 0) + 1) % Math.max(1, c.playlistIds?.length || 1);
        return {
          ...c,
          currentSeriesIndex: nextRot
        };
      }
      return c;
    });
    onUpdateChannels(updatedChannels);
  };

  // Update editing channel fields
  const handleUpdateEditingChannelField = (field: keyof Channel, value: any) => {
    if (!editingChannel) return;
    const updated = { ...editingChannel, [field]: value };
    setEditingChannel(updated);

    const newChannels = channels.map(c => c.id === editingChannel.id ? updated : c);
    onUpdateChannels(newChannels);
  };

  // Toggle watchlist link for channel
  const handleToggleWatchlistInChannel = (watchlistId: string) => {
    if (!editingChannel) return;
    const currentList = editingChannel.playlistIds || [];
    const exists = currentList.includes(watchlistId);
    const updatedIds = exists
      ? currentList.filter(id => id !== watchlistId)
      : [...currentList, watchlistId];

    handleUpdateEditingChannelField('playlistIds', updatedIds);
  };

  // Create a brand new custom channel
  const handleCreateNewChannel = () => {
    const newChan: Channel = {
      id: 'ch_custom_' + Date.now(),
      title: 'قناة جديدة 📺',
      description: 'وصف القناة المخصصة',
      icon: 'Tv',
      type: 'series',
      category: 'مسلسلات',
      badge: 'CUSTOM',
      accentGradient: 'from-amber-600 via-rose-700 to-indigo-950',
      playlistIds: []
    };
    onUpdateChannels([...channels, newChan]);
    setEditingChannel(newChan);
  };

  // Smart Auto-Scheduler State
  const [isSmartScheduleModalOpen, setIsSmartScheduleModalOpen] = useState(false);
  const [smartScope, setSmartScope] = useState<'all_week' | 'single_day'>('all_week');
  const [smartStrategy, setSmartStrategy] = useState<'category' | 'density'>('category');
  const [smartCategoryPreset, setSmartCategoryPreset] = useState<'family_diverse' | 'entertainment' | 'spiritual' | 'custom'>('family_diverse');
  const [categorySlots, setCategorySlots] = useState<CategorySlotConfig[]>(PRESET_CATEGORY_SCHEDULES.family_diverse.slots);
  const [smartDensity, setSmartDensity] = useState<'light' | 'balanced' | 'intense'>('balanced');
  const [smartAutoChannelMatch, setSmartAutoChannelMatch] = useState(true);
  const [smartSequentialEpisodes, setSmartSequentialEpisodes] = useState(true);
  const [smartOverwrite, setSmartOverwrite] = useState(true);
  const [copiedDaySlots, setCopiedDaySlots] = useState<WeeklyScheduleEntry[] | null>(null);

  // Category Slots Management Handlers
  const handleApplyCategoryPreset = (presetKey: 'family_diverse' | 'entertainment' | 'spiritual') => {
    setSmartCategoryPreset(presetKey);
    if (PRESET_CATEGORY_SCHEDULES[presetKey]) {
      setCategorySlots(PRESET_CATEGORY_SCHEDULES[presetKey].slots.map(s => ({ ...s, id: Date.now().toString() + Math.random().toString(36).substring(2, 5) })));
    }
  };

  const handleAddCategorySlot = () => {
    setSmartCategoryPreset('custom');
    const newSlot: CategorySlotConfig = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      time: '12:00',
      mode: 'kids',
      label: 'فقرة أطفال مخصصة'
    };
    setCategorySlots(prev => [...prev, newSlot].sort((a, b) => a.time.localeCompare(b.time)));
  };

  const handleUpdateCategorySlot = (id: string, updates: Partial<CategorySlotConfig>) => {
    setSmartCategoryPreset('custom');
    setCategorySlots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleRemoveCategorySlot = (id: string) => {
    setSmartCategoryPreset('custom');
    setCategorySlots(prev => prev.filter(s => s.id !== id));
  };

  // Auto-Smart Schedule Generator Engine
  const handleRunSmartAutoSchedule = (overrideScope?: 'all_week' | 'single_day') => {
    const scopeToUse = overrideScope || smartScope;

    const usableWatchlists = watchlists.filter(w => {
      const fileCount = (w.files?.length || 0) + (w.seasons?.flatMap(s => s.files || []).length || 0);
      return fileCount > 0;
    });

    if (usableWatchlists.length === 0) {
      showAlert('لا توجد قوائم تشغيل أو مسلسلات تحتوي على ملفات وسائط في مكتبتك. يرجى إضافة مسلسلات أو مجلدات إلى المكتبة أولاً.');
      return;
    }

    const targetDays = scopeToUse === 'single_day' ? [selectedDay] : [0, 1, 2, 3, 4, 5, 6];

    let updatedList = smartOverwrite
      ? schedules.filter(s => !targetDays.includes(s.dayOfWeek))
      : [...schedules];

    const findMatchingChannel = (wl: Watchlist): Channel | undefined => {
      if (!smartAutoChannelMatch) return undefined;
      const directMatch = resolvedChannels.find(c => c.playlistIds && c.playlistIds.includes(wl.id));
      if (directMatch) return directMatch;
      if (wl.targetMode) {
        const modeMatch = resolvedChannels.find(c => c.modes && c.modes.includes(wl.targetMode!));
        if (modeMatch) return modeMatch;
      }
      const titleLower = wl.title.toLowerCase();
      return resolvedChannels.find(c => 
        titleLower.includes(c.title.toLowerCase()) || 
        (c.badge && titleLower.includes(c.badge.toLowerCase()))
      );
    };

    const episodeTrackers: Record<string, number> = {};
    usableWatchlists.forEach(w => {
      const watchlistSchedules = schedules.filter(s => s.watchlistId === w.id && s.episodeIndex !== undefined);
      if (watchlistSchedules.length > 0) {
        const maxScheduledIndex = Math.max(...watchlistSchedules.map(s => s.episodeIndex!));
        episodeTrackers[w.id] = maxScheduledIndex + 1;
      } else {
        episodeTrackers[w.id] = w.lastWatchedIndex || 0;
      }
    });

    let generatedCount = 0;

    if (smartStrategy === 'category') {
      if (categorySlots.length === 0) {
        showAlert('يرجى إضافة وقت وصنف واحد على الأقل للجدول.');
        return;
      }

      const sortedCategorySlots = [...categorySlots].sort((a, b) => a.time.localeCompare(b.time));
      const categoryWatchlistIndex: Record<string, number> = {};

      targetDays.forEach((dayOfWeek, dayIndex) => {
        const existingTimesForDay = new Set(
          updatedList.filter(s => s.dayOfWeek === dayOfWeek).map(s => s.time)
        );

        sortedCategorySlots.forEach((slotConfig) => {
          if (!smartOverwrite && existingTimesForDay.has(slotConfig.time)) {
            return;
          }

          const catWatchlists = getWatchlistsForCategory(usableWatchlists, slotConfig.mode, slotConfig.label);
          let selectedWl: Watchlist | undefined;

          const catKey = `${slotConfig.mode}_${slotConfig.label || ''}`;
          if (catWatchlists.length > 0) {
            const idx = (categoryWatchlistIndex[catKey] || 0) % catWatchlists.length;
            selectedWl = catWatchlists[idx];
            categoryWatchlistIndex[catKey] = idx + 1;
          } else {
            // Fallback to general usable watchlist if no specific category match in library
            const fallbackIdx = (dayIndex * sortedCategorySlots.length) % usableWatchlists.length;
            selectedWl = usableWatchlists[fallbackIdx];
          }

          let currentEpIdx = 0;
          if (selectedWl) {
            const totalEps = (selectedWl.files?.length || 0) + (selectedWl.seasons?.flatMap(s => s.files || []).length || 0);
            currentEpIdx = (episodeTrackers[selectedWl.id] || 0) % Math.max(1, totalEps);

            if (smartSequentialEpisodes) {
              episodeTrackers[selectedWl.id] = (currentEpIdx + 1) % Math.max(1, totalEps);
            }
          }

          const matchedChan = selectedWl 
            ? findMatchingChannel(selectedWl)
            : resolvedChannels.find(c => c.modes?.includes(slotConfig.mode));

          const meta = CATEGORY_NAMES_WITH_ICONS[slotConfig.mode];
          const finalTitle = matchedChan ? matchedChan.title : (selectedWl ? selectedWl.title : (meta?.label || `قناة ${slotConfig.mode}`));

          const newSlot: WeeklyScheduleEntry = {
            id: `smart_${dayOfWeek}_${slotConfig.time.replace(':', '')}_${Math.random().toString(36).substring(2, 7)}`,
            dayOfWeek,
            time: slotConfig.time,
            title: finalTitle,
            channelId: matchedChan?.id,
            watchlistId: selectedWl?.id,
            episodeIndex: selectedWl ? currentEpIdx : 0,
            startTimeOffset: 0,
            mode: slotConfig.mode,
            transitionType: 'time',
            durationMinutes: 60,
            transitionMinutes: 60,
          };

          updatedList.push(newSlot);
          generatedCount++;
        });
      });
    } else {
      // Legacy density mode
      const timeSlotsByDensity = {
        light: ['18:30', '21:30'],
        balanced: ['15:00', '17:30', '20:00', '22:30'],
        intense: ['13:30', '15:30', '17:30', '19:30', '21:30', '23:15']
      };

      const selectedTimes = timeSlotsByDensity[smartDensity] || timeSlotsByDensity.balanced;

      targetDays.forEach((dayOfWeek, dayIndex) => {
        const existingTimesForDay = new Set(
          updatedList.filter(s => s.dayOfWeek === dayOfWeek).map(s => s.time)
        );

        selectedTimes.forEach((timeStr, slotIndex) => {
          if (!smartOverwrite && existingTimesForDay.has(timeStr)) {
            return;
          }

          const wlIndex = (dayIndex * selectedTimes.length + slotIndex) % usableWatchlists.length;
          const selectedWl = usableWatchlists[wlIndex];

          const totalEps = (selectedWl.files?.length || 0) + (selectedWl.seasons?.flatMap(s => s.files || []).length || 0);
          const currentEpIdx = (episodeTrackers[selectedWl.id] || 0) % Math.max(1, totalEps);

          if (smartSequentialEpisodes) {
            episodeTrackers[selectedWl.id] = (currentEpIdx + 1) % Math.max(1, totalEps);
          }

          const matchedChan = findMatchingChannel(selectedWl);

          const newSlot: WeeklyScheduleEntry = {
            id: `smart_${dayOfWeek}_${timeStr.replace(':', '')}_${Math.random().toString(36).substring(2, 7)}`,
            dayOfWeek,
            time: timeStr,
            title: matchedChan ? matchedChan.title : selectedWl.title,
            channelId: matchedChan?.id,
            watchlistId: selectedWl.id,
            episodeIndex: currentEpIdx,
            startTimeOffset: 0,
            mode: selectedWl.targetMode || matchedChan?.modes?.[0],
            transitionType: 'time',
            durationMinutes: 60,
            transitionMinutes: 60,
          };

          updatedList.push(newSlot);
          generatedCount++;
        });
      });
    }

    updatedList.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.time.localeCompare(b.time);
    });

    onUpdateSchedules(updatedList);
    setIsSmartScheduleModalOpen(false);

    const dayName = DAYS_OF_WEEK.find(d => d.id === selectedDay)?.name || '';
    showAlert(
      scopeToUse === 'single_day'
        ? `تم توليد ${generatedCount} موعداً ذكياً ليوم ${dayName} بنجاح بحسب الأصناف المخصصة! 🪄⚡`
        : `تم توليد جدول البث الأسبوعي الذكي بالكامل (${generatedCount} موعداً عبر 7 أيام) بنجاح بحسب الأصناف المخصصة! 🪄⚡`
    );
  };

  // Clear slots for specific day
  const handleClearDaySchedule = async (dayId: number) => {
    const dayName = DAYS_OF_WEEK.find(d => d.id === dayId)?.name || '';
    const slotsCount = schedules.filter(s => s.dayOfWeek === dayId).length;
    if (slotsCount === 0) return;

    const confirmed = await showConfirm(
      `هل أنت تأكد من تفريغ جميع مواعيد يوم (${dayName}) وعددهم ${slotsCount} موعداً؟`,
      'تفريغ جدول اليوم',
      'تفريغ اليوم',
      'إلغاء'
    );

    if (confirmed) {
      onUpdateSchedules(schedules.filter(s => s.dayOfWeek !== dayId));
      showAlert(`تم تفريغ جميع مواعيد يوم ${dayName} بنجاح`);
    }
  };

  // Clear all schedules across all days
  const handleClearAllSchedules = async () => {
    if (schedules.length === 0) {
      showAlert('جدول البث الأسبوعي فارغ بالفعل!');
      return;
    }

    const confirmed = await showConfirm(
      `هل أنت تأكد من تفريغ كافة مواعيد جدول البث الأسبوعي بجميع الأيام (${schedules.length} موعداً)؟`,
      'تفريغ جدول البث بالكامل',
      'تفريغ الكل 🧹',
      'إلغاء'
    );

    if (confirmed) {
      onUpdateSchedules([]);
      showAlert('تم تفريغ جميع مواعيد الجدول الأسبوعي لكل الأيام بنجاح 🧹');
    }
  };

  // Copy slots of specific day
  const handleCopyDaySchedule = (dayId: number) => {
    const daySlots = schedules.filter(s => s.dayOfWeek === dayId);
    if (daySlots.length === 0) {
      showAlert('لا توجد مواعيد في هذا اليوم لنسخها');
      return;
    }
    setCopiedDaySlots(daySlots);
    const dayName = DAYS_OF_WEEK.find(d => d.id === dayId)?.name || '';
    showAlert(`تم نسخ ${daySlots.length} موعداً من يوم ${dayName} إلى الحافظة 📋`);
  };

  // Paste slots to active day
  const handlePasteDaySchedule = (targetDayId: number) => {
    if (!copiedDaySlots || copiedDaySlots.length === 0) return;
    const dayName = DAYS_OF_WEEK.find(d => d.id === targetDayId)?.name || '';

    const pastedSlots = copiedDaySlots.map(slot => ({
      ...slot,
      id: `pasted_${targetDayId}_${Math.random().toString(36).substring(2, 7)}`,
      dayOfWeek: targetDayId
    }));

    const existingTimes = new Set(schedules.filter(s => s.dayOfWeek === targetDayId).map(s => s.time));
    const nonConflicting = pastedSlots.filter(s => !existingTimes.has(s.time));

    if (nonConflicting.length === 0) {
      showAlert(`جميع المواعيد المنسوخة تتضارب مع المواعيد الحالية في يوم ${dayName}`);
      return;
    }

    onUpdateSchedules([...schedules, ...nonConflicting].sort((a, b) => a.time.localeCompare(b.time)));
    showAlert(`تم لصق ${nonConflicting.length} موعداً بنجاح في يوم ${dayName}! 📥`);
  };

  // Quick adjust time (+15, -15, +30) with conflict detection
  const handleQuickAdjustSlotTime = (slotId: string, minutesDelta: number) => {
    const slotToAdjust = schedules.find(s => s.id === slotId);
    if (!slotToAdjust) return;

    const [h, m] = slotToAdjust.time.split(':').map(Number);
    let totalM = h * 60 + m + minutesDelta;
    if (totalM < 0) totalM += 24 * 60;
    totalM = totalM % (24 * 60);
    const newTime = formatMinutesToTime(totalM);
    const dur = slotToAdjust.durationMinutes || 60;

    const conflict = findScheduleConflict(slotToAdjust.dayOfWeek, newTime, dur, schedules, slotId);
    if (conflict) {
      showAlert(`يوجد تعارض مع موعد آخر في نفس اليوم (${conflict.slot.title} من ${conflict.existingStartTime} إلى ${conflict.existingEndTime}). يرجى اختيار وقت مختلف.`);
      return;
    }

    onUpdateSchedules(schedules.map(slot => {
      if (slot.id !== slotId) return slot;
      return { 
        ...slot, 
        time: newTime,
        endTime: formatMinutesToTime(totalM + dur)
      };
    }));
  };

  // Quick adjust episode (+1, -1)
  const handleQuickAdjustSlotEpisode = (slotId: string, delta: number) => {
    onUpdateSchedules(schedules.map(slot => {
      if (slot.id !== slotId) return slot;
      const current = slot.episodeIndex !== undefined ? slot.episodeIndex : 0;
      const nextEp = Math.max(0, current + delta);
      return { ...slot, episodeIndex: nextEp };
    }));
  };

  // Quick change channel
  const handleQuickChangeSlotChannel = (slotId: string, channelId: string) => {
    onUpdateSchedules(schedules.map(slot => {
      if (slot.id !== slotId) return slot;
      return { ...slot, channelId: channelId || undefined };
    }));
  };

  // Open Schedule Slot Modal for New Entry
  const handleOpenAddSlot = () => {
    setEditingSlot(null);
    setSlotTime('20:00');
    setSlotTransitionType('time');
    setSlotDurationMinutes(60);
    const defaultChan = resolvedChannels.length > 0 ? resolvedChannels[0] : null;
    setSlotChannelId(defaultChan ? defaultChan.id : '');
    setSlotTitle(defaultChan ? defaultChan.title : '');
    setSlotSourceType('channel');
    setSlotWatchlistId('');
    setSlotEpisodeIndex(0);
    setSlotStartOffsetMinutes(0);
    setSlotMode(defaultChan?.modes?.[0] || '');
    setIsAddSlotOpen(true);
  };

  // Open Schedule Slot Modal for Editing
  const handleOpenEditSlot = (slot: WeeklyScheduleEntry) => {
    setEditingSlot(slot);
    setSelectedDay(slot.dayOfWeek);
    setSlotTime(slot.time);
    setSlotTransitionType(slot.transitionType || 'time');
    setSlotDurationMinutes(slot.durationMinutes || slot.transitionMinutes || 60);
    const targetChanId = slot.channelId || (resolvedChannels.length > 0 ? resolvedChannels[0].id : '');
    const foundChan = resolvedChannels.find(c => c.id === targetChanId);
    setSlotChannelId(targetChanId);
    setSlotTitle(slot.title || foundChan?.title || '');
    setSlotSourceType(slot.watchlistId && !slot.channelId ? 'watchlist' : 'channel');
    setSlotWatchlistId(slot.watchlistId || '');
    setSlotEpisodeIndex(0);
    setSlotStartOffsetMinutes(0);
    setSlotMode(slot.mode || foundChan?.modes?.[0] || '');
    setIsAddSlotOpen(true);
  };

  // Save Schedule Entry with Conflict Prevention (Bound strictly to Channel)
  const handleSaveScheduleSlot = async () => {
    if (slotSourceType === 'channel' && !slotChannelId) {
      showAlert('يرجى اختيار القناة المخصصة لهذ الموعد');
      return;
    }
    if (slotSourceType === 'watchlist' && !slotWatchlistId) {
      showAlert('يرجى اختيار مكتبة المشاهدة');
      return;
    }

    const selectedChan = resolvedChannels.find(c => c.id === slotChannelId);
    const selectedWatchlist = watchlists.find(w => w.id === slotWatchlistId);
    const finalTitle = slotTitle.trim() || (slotSourceType === 'channel' ? selectedChan?.title : selectedWatchlist?.title) || 'موعد مجدول';

    if (!slotTime) {
      showAlert('يرجى تحديد توقيت العرض');
      return;
    }

    const durMins = Math.max(5, slotDurationMinutes || 60);

    // Check time overlap conflicts with existing slots on the same day (excluding currently edited slot)
    const conflict = findScheduleConflict(selectedDay, slotTime, durMins, schedules, editingSlot?.id);

    if (conflict) {
      showAlert(`يوجد تعارض مع موعد آخر في نفس اليوم (${conflict.slot.title} من ${conflict.existingStartTime} إلى ${conflict.existingEndTime}). يرجى اختيار وقت مختلف.`);
      return;
    }

    const startM = parseTimeToMinutes(slotTime);
    const endM = startM + durMins;

    const updatedEntry: WeeklyScheduleEntry = {
      id: editingSlot ? editingSlot.id : Date.now().toString(),
      dayOfWeek: selectedDay,
      time: slotTime,
      transitionType: 'time',
      durationMinutes: durMins,
      transitionMinutes: durMins,
      endTime: formatMinutesToTime(endM),
      title: finalTitle,
      channelId: slotSourceType === 'channel' ? slotChannelId : undefined,
      watchlistId: slotSourceType === 'watchlist' ? slotWatchlistId : undefined,
      mode: slotSourceType === 'watchlist' ? (slotMode as Mode) : (selectedChan?.modes?.[0] || undefined),
    };

    if (editingSlot) {
      onUpdateSchedules(schedules.map(s => s.id === editingSlot.id ? updatedEntry : s));
    } else {
      onUpdateSchedules([...schedules, updatedEntry]);
    }

    setIsAddSlotOpen(false);
    setEditingSlot(null);
  };

  // Direct Play from Schedule Entry (Dual-Source)
  const handlePlayScheduleSlot = (slot: WeeklyScheduleEntry) => {
    // Mark current slot as watched on its day
    const updatedSlot: WeeklyScheduleEntry = {
      ...slot,
      isWatched: true,
      watchedAtDayOfWeek: slot.dayOfWeek,
      watchedAtDate: new Date().toISOString()
    };
    onUpdateSchedules(schedules.map(s => s.id === slot.id ? updatedSlot : s));

    if (slot.watchlistId && !slot.channelId) {
      // 1. مسار مكتبة المشاهدة المباشر
      const targetWatchlist = watchlists.find(w => w.id === slot.watchlistId);
      if (!targetWatchlist) {
         showAlert('لم يتم العثور على مكتبة المشاهدة الخاصة بهذا الموعد.');
         return;
      }
      
      const allFiles = targetWatchlist.seasons && targetWatchlist.seasons.length > 0
        ? targetWatchlist.seasons.flatMap(s => s.files || [])
        : targetWatchlist.files || [];
        
      if (allFiles.length === 0) {
         showAlert('مكتبة المشاهدة فارغة من المحتوى.');
         return;
      }

      const epIndex = (slot.episodeIndex || 0) % allFiles.length;
      const fileToPlay = allFiles[epIndex];

      onPlay(
        fileToPlay,
        fileToPlay.title || `حلقة ${epIndex + 1}`,
        targetWatchlist.title,
        allFiles,
        epIndex,
        targetWatchlist.coverUrl,
        targetWatchlist.id,
        0, // Start from beginning
        undefined
      );
    } else {
      // 2. مسار القناة الحية المستمرة
      const targetChanId = slot.channelId || (resolvedChannels.length > 0 ? resolvedChannels[0].id : '');
      const targetChannel = resolvedChannels.find(c => c.id === targetChanId) || resolvedChannels[0];

      if (!targetChannel) {
        showAlert('لم يتم العثور على القناة المحددة للجدول.');
        return;
      }

      // Calculate live channel now playing stream
      const nowPlaying = getChannelNowPlaying(targetChannel, watchlists);
      if (nowPlaying) {
        onPlay(
          nowPlaying.currentFile,
          nowPlaying.currentEpisodeTitle,
          `${targetChannel.title} - ${nowPlaying.currentWatchlistTitle}`,
          nowPlaying.allFiles,
          nowPlaying.currentEpisodeIndex,
          undefined,
          nowPlaying.currentWatchlistId,
          nowPlaying.initialTime,
          targetChannel.id
        );
      } else {
        showAlert(`القناة المباشرة (${targetChannel.title}) جاهزة في جدول البث. يرجى ربط قائمة تشغيل بالقناة من قسم القنوات لبدء العرض الحقيقي.`);
      }
    }
  };

  const handleDeleteScheduleSlot = (id: string) => {
    onUpdateSchedules(schedules.filter(s => s.id !== id));
  };

  // Schedule JSON Export & Import Feature
  const scheduleFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportSchedule = () => {
    if (!schedules || schedules.length === 0) {
      showAlert('لا يوجد مواعيد بالجدول الأسبوعي لتصديرها حالياً.');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(schedules, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tv_schedule_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showAlert('تم تصدير ملف جدول البث الأسبوعي بنجاح 📁');
  };

  const handleImportSchedule = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.every(item => item.title && item.time && typeof item.dayOfWeek === 'number')) {
          onUpdateSchedules(parsed);
          showAlert('تم استيراد جدول البث الأسبوعي بنجاح! 📑✨');
        } else {
          showAlert('تنسيق ملف JSON غير مطابق لهيكل جدول البث. يرجى اختيار ملف تم تصديره سابقاً.');
        }
      } catch (err) {
        showAlert('حدث خطأ أثناء استيراد الملف. تأكد من صحة ملف JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Surprise Me Handler
  const handleSurpriseMe = () => {
    if (!watchlists || watchlists.length === 0) {
      showAlert('المكتبة فارغة! يرجى إضافة مجلد وسائط أو قائمة تشغيل أولاً.');
      return;
    }
    setIsSurpriseOpen(true);
    setIsSpinning(true);
    setSurpriseItem(null);

    setTimeout(() => {
      const randomWl = watchlists[Math.floor(Math.random() * watchlists.length)];
      const allFiles = [
        ...(randomWl.files || []),
        ...(randomWl.seasons?.flatMap(s => s.files || []) || [])
      ];
      if (allFiles.length > 0) {
        const randomEpIdx = Math.floor(Math.random() * allFiles.length);
        setSurpriseItem({
          watchlist: randomWl,
          file: allFiles[randomEpIdx],
          epIndex: randomEpIdx
        });
      }
      setIsSpinning(false);
    }, 1200);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-4 sm:p-8 lg:p-12 min-h-full flex flex-col relative w-full overflow-y-auto no-scrollbar pb-32 md:pb-20 dir-rtl text-right"
    >
      {initialTab === 'channels' ? (
        <>
          {/* LIGHT & ELEGANT ANIMATED BACKGROUND CANVAS FOR CHANNELS VIEW */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
            {/* Soft Light Gradient Mesh Canvas */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-amber-50/70 to-blue-50/80 opacity-95" />

            {/* Floating Orb 1: Soft Pastel Gold & Rose */}
            <div className="absolute top-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-amber-200/50 via-rose-200/40 to-fuchsia-200/30 blur-[120px] animate-float-orb-1" />

            {/* Floating Orb 2: Soft Sky Blue & Teal */}
            <div className="absolute top-[35%] left-[-15%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-sky-200/50 via-teal-200/40 to-indigo-200/30 blur-[130px] animate-float-orb-2" />

            {/* Floating Orb 3: Soft Lavender & Warm Amber */}
            <div className="absolute bottom-[-10%] right-[15%] w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-purple-200/40 via-pink-200/30 to-amber-200/40 blur-[120px] animate-float-orb-3" />
          </div>

          <div className="relative z-10 space-y-8">
            {/* Top Header for Channels Section */}
            <header className="mb-6 sm:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-md shrink-0">
                    <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 drop-shadow-sm">
                    القنوات والراديو
                  </h1>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-800 border border-amber-400/40 text-xs font-black flex items-center gap-1.5 shadow-sm shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>بث مدمج مستمر 📺📻</span>
                </span>
              </div>
              <p className="text-sm sm:text-lg text-slate-600 font-medium">
                شاهد واستمع لقنواتك الفضائية ومحطات الراديو الصوتية المستمدة بالكامل من مكتبتك المحلية
              </p>
            </div>

            {/* Surprise Me, Sync, Quick Link & Create Channel Controls */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 w-full xl:w-auto [&>button]:justify-center [&>button]:w-full">
              <button
                onClick={handleOpenQuickLink}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-lg shadow-amber-400/20 hover:scale-105 active:scale-95 transition-all text-sm sm:text-base border border-amber-300 cursor-pointer shrink-0"
                title="فتح نافذة الربط السريع لربط القنوات والأوضاع دفعة واحدة"
              >
                <Zap className="w-5 h-5 fill-current text-slate-950 stroke-[2.5]" />
                <span>الربط السريع ⚡</span>
              </button>

              <button
                onClick={handleRunSyncChannels}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 border border-amber-400/40 font-extrabold shadow-sm hover:scale-105 active:scale-95 transition-all text-sm sm:text-base cursor-pointer shrink-0"
                title="تشغيل المزامنة الأوتوماتيكية للقنوات وفقاً للأوضاع المحددة لكل قناة"
              >
                <RefreshCw className="w-5 h-5 text-amber-700" />
                <span>⚡ تشغيل المزامنة</span>
              </button>

              <button
                onClick={handleCreateNewChannel}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 text-slate-950 font-extrabold hover:bg-amber-300 transition-all text-sm sm:text-base cursor-pointer shadow-[0_8px_20px_rgba(250,204,21,0.35)] hover:scale-105 active:scale-95 border border-amber-300 shrink-0"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>إضافة قناة جديدة</span>
              </button>

              <button
                onClick={handleSurpriseMe}
                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-slate-900 text-amber-300 hover:bg-black font-extrabold shadow-lg shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all text-sm sm:text-base border border-slate-800 cursor-pointer shrink-0"
              >
                <Sparkles className="w-5 h-5 text-amber-300 animate-spin" style={{ animationDuration: '3s' }} />
                <span>🎲 فاجئني</span>
              </button>
            </div>
          </header>

          {/* TODAY'S RECOMMENDATIONS SECTION (🍿 ماذا أشاهد اليوم؟) */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
                  <Clapperboard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">🍿 ماذا أشاهد اليوم؟</h2>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">اقتراحات للبث المباشر من مكتبتك الشخصية</p>
                </div>
              </div>

              {watchlists.length > 3 && (
                <button
                  onClick={refreshSuggestions}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold transition-colors text-xs cursor-pointer border border-slate-200 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>تحديث الكل</span>
                </button>
              )}
            </div>

            {suggestions.length === 0 ? (
              <div className="p-8 rounded-3xl bg-white/80 border border-slate-200/80 text-center shadow-sm">
                <Film className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800 mb-1">المكتبة فارغة حالياً</p>
                <p className="text-xs text-slate-500">قم بإضافة محتوى وقوائم تشغيل لتظهر الاقتراحات المباشرة هنا</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {suggestions.map((item, idx) => (
                  <motion.div
                    key={item.id + '-' + idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-md shadow-slate-200/60 flex flex-col justify-between p-4 hover:border-amber-400 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                  >
                    <div className="flex gap-4">
                      {item.coverImage ? (
                        <img
                          src={item.coverImage}
                          alt={item.title}
                          className="w-20 h-28 rounded-2xl object-cover border border-slate-200 shadow-md shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-28 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                          <Film className="w-7 h-7 text-slate-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <span className="inline-block px-2.5 py-0.5 text-[10px] font-black rounded-lg bg-amber-500/10 text-amber-800 border border-amber-300/60 mb-1.5">
                            {item.section || 'عام'}
                          </span>
                          <h3 className="text-base font-extrabold text-slate-900 truncate leading-snug">
                            {item.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.episodesCount} مقطع/حلقة</span>
                          </p>
                        </div>

                        <p className="text-[11px] text-slate-400 truncate font-medium">
                          {item.lastWatched ? `آخر مشاهدة: ${item.lastWatched}` : 'جديد في المكتبة'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => handlePlaySuggestion(item)}
                        className="flex-1 py-2 px-3 rounded-xl bg-amber-400 text-slate-950 font-extrabold hover:bg-amber-300 transition-colors flex items-center justify-center gap-2 text-xs cursor-pointer shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950 translate-x-[1px]" />
                        <span>مشاهدة الآن</span>
                      </button>

                      <button
                        onClick={() => refreshSingleSuggestion(idx)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer border border-slate-200"
                        title="اقترح غيرها"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
          {/* NOW PLAYING HIGHLIGHT BANNER */}
          {nowPlayingList.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">🔴 يبث الآن عبر القنوات</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {nowPlayingList.slice(0, 3).map((np) => (
                  <motion.div
                    key={np.channelId}
                    whileHover={{ y: -4, scale: 1.01 }}
                    className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-md shadow-slate-200/60 p-5 flex flex-col justify-between group"
                  >
                    <div className={`absolute inset-0 ${getChannelSolidBg({ title: np.channelTitle, id: np.channelId })} opacity-10 pointer-events-none`} />

                    <div>
                      {/* Channel Header */}
                      <div className="flex items-start gap-2.5 mb-3 relative z-10">
                        <span className="text-2xl mt-0.5">{np.channelIcon.length <= 2 ? np.channelIcon : '📺'}</span>
                        <div className="flex flex-col gap-1">
                          <span className="font-black text-lg text-slate-900 leading-tight">{np.channelTitle}</span>
                          {np.badge && (
                            <span className="self-start px-2 py-0.5 text-[10px] font-black uppercase rounded-lg bg-amber-500/10 text-amber-800 border border-amber-300">
                              {np.badge}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content Card Info */}
                      <div className="flex items-center gap-3.5 my-2 relative z-10">
                        {np.coverImage ? (
                          <img
                            src={np.coverImage}
                            alt={np.currentWatchlistTitle}
                            className="w-16 h-20 rounded-xl object-cover border border-slate-200 shrink-0 shadow-md"
                          />
                        ) : (
                          <div className="w-16 h-20 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                            <Film className="w-7 h-7 text-slate-400" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-amber-600 mb-0.5">يعرض الآن:</p>
                          <h4 className="text-base font-extrabold text-slate-900 truncate leading-snug">
                            {np.currentWatchlistTitle}
                          </h4>
                          <p className="text-xs text-slate-600 truncate mt-0.5 font-medium">
                            {np.currentEpisodeTitle}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            التالي: <span className="text-slate-700 font-semibold">{np.nextWatchlistTitle}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Tune In Button */}
                    <button
                      onClick={() => {
                        const ch = resolvedChannels.find(c => c.id === np.channelId);
                        if (ch) handlePlayChannel(ch);
                      }}
                      className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black text-amber-300 font-extrabold transition-colors flex items-center justify-center gap-2 shadow-md text-sm cursor-pointer relative z-10"
                    >
                      <Play className="w-4 h-4 fill-amber-300 translate-x-[1px]" />
                      <span>شاهد القناة الآن</span>
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Filter Bar */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">دليل القنوات المتاحة</h2>
              <button
                onClick={handleOpenQuickLink}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black border border-amber-300 text-xs transition-all cursor-pointer shadow-sm hover:scale-105"
                title="فتح نافذة الربط السريع للقنوات بالأنماط والأوضاع"
              >
                <Zap className="w-3.5 h-3.5 fill-current stroke-[2.5]" />
                <span>الربط السريع ⚡</span>
              </button>
              <button
                onClick={handleRunSyncChannels}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 font-extrabold border border-amber-300 text-xs transition-colors cursor-pointer"
                title="مزامنة القنوات مع قوائم المكتبة"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                <span>تشغيل المزامنة</span>
              </button>
              <button
                onClick={handleCreateNewChannel}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-800 font-extrabold border border-slate-200 text-xs transition-colors cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة قناة جديدة</span>
              </button>

              <span className="text-xs text-slate-600 font-bold bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200/80 flex items-center gap-1.5 shadow-sm">
                <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                <span>اسحب القنوات لإعادة ترتيب أولوياتها</span>
              </span>
            </div>

            <div className="flex items-center gap-2 bg-white/80 p-1.5 rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto no-scrollbar shrink-0 max-w-full">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  filterType === 'all' ? 'bg-slate-900 text-amber-300 shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setFilterType('favorites')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  filterType === 'favorites' ? 'bg-slate-900 text-amber-300 shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${filterType === 'favorites' ? 'fill-amber-300 text-amber-300' : 'text-red-500 fill-red-500'}`} />
                <span>المفضلة</span>
              </button>
              <button
                onClick={() => setFilterType('movies')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  filterType === 'movies' ? 'bg-slate-900 text-amber-300 shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                🎬 قنوات الأفلام
              </button>
              <button
                onClick={() => setFilterType('series')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  filterType === 'series' ? 'bg-slate-900 text-amber-300 shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                📺 قنوات المسلسلات
              </button>
              <button
                onClick={() => setFilterType('radio')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  filterType === 'radio' ? 'bg-slate-900 text-amber-300 shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                📻 محطات الراديو
              </button>
            </div>
          </div>

          {/* CHANNELS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {filteredChannels.map((channel, idx) => {
              const np = getChannelNowPlaying(channel, watchlists);
              const linkedCount = channel.playlistIds?.length || 0;
              const IconComp = ICON_MAP[channel.icon] || Tv;

              // Find representative cover image from linked watchlists or current playing
              const expressiveCover = np?.coverImage || watchlists.find(w => channel.playlistIds?.includes(w.id) && w.coverImage)?.coverImage;

              return (
                <motion.div
                  key={channel.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, channel.id)}
                  onDragOver={(e) => handleDragOver(e, channel.id)}
                  onDrop={(e) => handleDrop(e, channel.id)}
                  onDragEnd={handleDragEnd}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`group relative rounded-3xl overflow-hidden border bg-white/95 shadow-lg shadow-slate-200/60 flex flex-col justify-between transition-all duration-300 ${
                    draggedChannelId === channel.id
                      ? 'opacity-30 scale-95 border-amber-500 border-dashed'
                      : dragOverChannelId === channel.id
                      ? 'border-amber-400 ring-4 ring-amber-400/30 scale-[1.02] bg-amber-50'
                      : 'border-slate-200/80 hover:border-amber-400/80 hover:shadow-2xl hover:shadow-slate-300/80 hover:-translate-y-1'
                  }`}
                >
                  {/* Decorative / Expressive Cover Poster Header */}
                  <div className="h-48 sm:h-52 w-full relative p-4 flex flex-col justify-between overflow-hidden shrink-0">
                    {expressiveCover ? (
                      <>
                        <img 
                          src={expressiveCover} 
                          alt={channel.title} 
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-900/30" />
                      </>
                    ) : (
                      <>
                        <div className={`absolute inset-0 ${getChannelSolidBg(channel)} group-hover:scale-105 transition-transform duration-500`} />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-black/20" />
                        <IconComp className="w-32 h-32 text-white/10 absolute -bottom-6 -left-6 transform rotate-12 pointer-events-none" />
                      </>
                    )}

                    {/* Top Floating Controls Bar */}
                    <div className="relative z-10 flex items-center justify-between gap-2">
                      {/* Drag Handle & Order Controls */}
                      <div 
                        className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-white/20 backdrop-blur-md cursor-grab active:cursor-grabbing hover:bg-slate-900 transition-colors shrink-0 shadow"
                        title="سحب وإسقاط لإعادة الترتيب"
                      >
                        <GripVertical className="w-4 h-4 text-amber-300" />
                        <div className="flex items-center gap-0.5 border-r border-white/20 pr-1 mr-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveChannel(channel.id, 'up'); }}
                            disabled={idx === 0}
                            className="p-0.5 rounded text-white/80 hover:text-white hover:bg-white/20 disabled:opacity-20 transition-colors cursor-pointer"
                            title="تقديم القناة"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveChannel(channel.id, 'down'); }}
                            disabled={idx === filteredChannels.length - 1}
                            className="p-0.5 rounded text-white/80 hover:text-white hover:bg-white/20 disabled:opacity-20 transition-colors cursor-pointer"
                            title="تأخير القناة"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Favorite & Delete Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => handleToggleFavoriteChannel(e, channel.id)}
                          className={`p-2 rounded-xl border backdrop-blur-md transition-all cursor-pointer shadow-sm ${
                            channel.isFavorite 
                              ? 'bg-red-500 text-white border-red-400 shadow-red-500/30' 
                              : 'bg-slate-950/70 text-white/80 hover:text-red-400 border-white/20 hover:bg-slate-900'
                          }`}
                          title={channel.isFavorite ? 'إزالة من المفضلة' : 'إضافة للقناة إلى المفضلة'}
                        >
                          <Heart className={`w-4 h-4 ${channel.isFavorite ? 'fill-white text-white' : ''}`} />
                        </button>

                        <button
                          onClick={(e) => handleDeleteChannel(e, channel)}
                          className="p-2 rounded-xl bg-slate-950/70 text-white/80 hover:text-red-400 hover:bg-red-500/30 border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-sm"
                          title="حذف القناة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Prominent & Extremely Clear Channel Title */}
                    <div className="relative z-10 flex items-end gap-3 mt-auto">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-400 text-slate-950 border-2 border-white flex items-center justify-center shrink-0 shadow-xl">
                        <IconComp className="w-7 h-7 sm:w-8 sm:h-8 text-slate-950" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-white text-base sm:text-lg drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] truncate leading-tight tracking-tight">
                          {channel.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {channel.badge && (
                            <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-black rounded-lg bg-amber-400 text-slate-950 border border-amber-300 uppercase shadow-sm">
                              {channel.badge}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border shadow-sm flex items-center gap-1 ${
                            channel.autoSyncEnabled !== false
                              ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                              : 'bg-slate-900/80 text-white/70 border-white/20'
                          }`}>
                            <Zap className="w-3 h-3 text-amber-300" />
                            <span>{channel.autoSyncEnabled !== false ? '⚡ مزامنة أوتوماتيكية' : '🎯 يدوي'}</span>
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-slate-900/80 text-white border border-white/20 shadow-sm">
                            {channel.playbackOrder === 'random' ? '🎲 عشوائي' : '🔁 متسلسل'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between bg-white">
                    <div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3.5 font-medium">
                        {channel.description}
                      </p>

                      {/* Current Status / Broadcast Info */}
                      {np ? (
                        <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200/80 mb-4 flex items-center gap-3">
                          {np.coverImage && (
                            <img src={np.coverImage} alt={np.currentWatchlistTitle} className="w-11 h-14 rounded-xl object-cover border border-amber-300/60 shrink-0 shadow-sm" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-amber-800 font-black mb-0.5 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" /> يعرض الآن:
                            </p>
                            <p className="text-sm font-extrabold text-slate-900 truncate">{np.currentWatchlistTitle}</p>
                            <p className="text-xs text-slate-600 truncate font-medium">{np.currentEpisodeTitle}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-2xl bg-slate-100/80 border border-slate-200/60 mb-4 text-center">
                          <p className="text-xs text-slate-500 font-medium">لا يوجد محتوى يبث حالياً (اضغط تخصيص لربط وسائط)</p>
                        </div>
                      )}
                    </div>

                    {/* Footer Info & Action Buttons */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-3 px-1 font-semibold">
                        <span>المحتوى المرتبط:</span>
                        <span className="font-bold text-slate-900">{linkedCount} قوائم/مسلسلات</span>
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        <button
                          onClick={() => handlePlayChannel(channel)}
                          className="col-span-4 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-black text-amber-300 font-extrabold transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/15 text-sm cursor-pointer active:scale-95"
                        >
                          <Play className="w-4 h-4 fill-amber-300 translate-x-[1px]" />
                          <span>شاهد القناة</span>
                        </button>

                        <button
                          onClick={() => setEditingChannel(channel)}
                          className="col-span-1 p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/80"
                          title="تخصيص القناة"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </>
      ) : (
        <>
          {/* ANIMATED COLORFUL BACKGROUND CANVAS FOR WEEKLY SCHEDULE VIEW */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
            {/* Shifting Multi-Color Schedule Gradient Mesh */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-950/90 via-slate-950/85 to-emerald-950/90 animate-gradient-flow opacity-95" />

            {/* Floating Orb 1: Cosmic Purple / Fuchsia / Indigo */}
            <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-purple-600/40 via-indigo-500/35 to-fuchsia-500/35 blur-[140px] animate-float-orb-2" />

            {/* Floating Orb 2: Vibrant Emerald / Teal / Gold */}
            <div className="absolute top-[30%] right-[-12%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-emerald-500/35 via-teal-400/30 to-amber-400/30 blur-[150px] animate-float-orb-1" />

            {/* Floating Orb 3: Electric Blue / Violet / Rose */}
            <div className="absolute bottom-[-15%] left-[20%] w-[580px] h-[580px] rounded-full bg-gradient-to-tl from-blue-600/35 via-violet-600/30 to-rose-500/25 blur-[135px] animate-float-orb-3" />

            {/* Radiant Ambient Light Grid Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/20 via-emerald-500/15 to-transparent mix-blend-screen pointer-events-none" />
          </div>

          <section className="relative z-10 space-y-8">
            {/* Top Header for Weekly Schedule & Action Toolbar */}
            <header className="mb-6 sm:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500/40 via-indigo-500/30 to-amber-500/40 border border-purple-400/50 flex items-center justify-center shadow-lg">
                    <Calendar className="w-6 h-6 text-purple-200" />
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-xl">
                    جدولة البث الأسبوعي
                  </h1>
                </div>
                <p className="text-xs sm:text-base text-white/70 font-medium">
                  نظام جدولة أوتوماتيكي مستوحى من كافة مكتباتك، مع إمكانية تعديل وتخصيص كل يوم منفرداً
                </p>
              </div>

              {/* Innovative Sticky Action Toolbar */}
              <div className="sticky top-2 z-30 flex flex-col items-stretch justify-center gap-2.5 sm:gap-3 p-2 bg-zinc-950/90 rounded-2xl border border-white/20 backdrop-blur-xl shadow-2xl w-full sm:w-auto min-w-[200px]">
                {/* 1. Smart Schedule Button (جدولة ذكية) */}
                <button
                  onClick={() => {
                    setSmartScope('all_week');
                    setIsSmartScheduleModalOpen(true);
                  }}
                  className="flex items-center justify-center w-full gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-500 text-white font-extrabold hover:brightness-110 transition-all text-xs sm:text-sm cursor-pointer shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:scale-105 active:scale-95 border border-purple-300/40 shrink-0 group"
                  title="توليد جدولة ذكية تلقائية مستوحاة من كافة المكتبات"
                >
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform" />
                  <span>جدولة ذكية 🪄⚡</span>
                </button>

                {/* 2. Add Manual Slot Button (إضافة موعد يدوي) */}
                <button
                  onClick={handleOpenAddSlot}
                  className="flex items-center justify-center w-full gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold transition-all text-xs sm:text-sm cursor-pointer border border-white/20 shrink-0 hover:scale-105 active:scale-95"
                  title="إضافة موعد بث جديد يدوياً إلى جدول الأسبوع"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5] text-amber-400" />
                  <span>إضافة موعد يدوي</span>
                </button>

                {/* 3. Clear All Days Content Button (تفريغ المحتوى لكل الأيام) */}
                {schedules.length > 0 && (
                  <button
                    onClick={handleClearAllSchedules}
                    className="flex items-center justify-center w-full gap-2 px-4 py-3 rounded-xl bg-red-500/20 hover:bg-red-500 hover:text-white text-red-300 font-extrabold transition-all text-xs sm:text-sm cursor-pointer border border-red-500/30 shrink-0 hover:scale-105 active:scale-95 shadow-sm"
                    title="تفريغ ومسح جدول البث بالكامل لجميع أيام الأسبوع"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-300" />
                    <span>تفريغ كل الأيام 🧹</span>
                  </button>
                )}
              </div>
            </header>

            {/* Days Selector & Overview Bar */}
            <div className="bg-zinc-950/60 p-4 rounded-3xl border border-white/10 backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between gap-3 text-xs text-white/60 font-medium px-2">
                <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <SlidersHorizontal className="w-4 h-4" /> اختر اليوم للتعديل أو المعاينة:
                </span>
                <span className="bg-purple-500/20 text-purple-200 px-3 py-1 rounded-full border border-purple-400/30 font-bold">
                  إجمالي المواعيد للأسبوع: {schedules.length}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = selectedDay === day.id;
                  const isToday = new Date().getDay() === day.id;
                  const daySlotsCount = schedules.filter(s => s.dayOfWeek === day.id).length;

                  return (
                    <button
                      key={day.id}
                      onClick={() => setSelectedDay(day.id)}
                      className={`p-3 rounded-2xl font-black text-sm transition-all cursor-pointer flex flex-col items-center justify-between gap-1.5 text-center relative overflow-hidden ${
                        isSelected
                          ? 'bg-gradient-to-b from-amber-400 via-orange-400 to-amber-500 text-black shadow-xl shadow-amber-400/20 scale-105 border border-amber-300 ring-2 ring-amber-300/50'
                          : 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 hover:border-amber-400/50'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{day.name}</span>
                        {isToday && (
                          <span className="px-1.5 py-0.2 text-[9px] rounded bg-red-500 text-white font-black animate-pulse">
                            اليوم
                          </span>
                        )}
                      </div>

                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isSelected 
                          ? 'bg-black/20 text-black' 
                          : daySlotsCount > 0 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30' 
                            : 'bg-white/5 text-white/40'
                      }`}>
                        {daySlotsCount > 0 ? `${daySlotsCount} مواعيد` : 'خالي'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Control Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-950/80 p-4 rounded-2xl border border-purple-500/30 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-white">
                  جدول يوم {DAYS_OF_WEEK.find(d => d.id === selectedDay)?.name}:
                </span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold">
                  {schedules.filter(s => s.dayOfWeek === selectedDay).length} موعد مجدول
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* Single Day Auto-Schedule Button */}
                <button
                  onClick={() => handleRunSmartAutoSchedule('single_day')}
                  className="px-3.5 py-2 rounded-xl bg-purple-500/20 text-purple-200 hover:bg-purple-500 hover:text-white border border-purple-400/40 font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="توليد مواعيد ذكية لهذا اليوم فقط مستوحاة من مكتبتك"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>جدولة ذكية لليوم</span>
                </button>

                {/* Copy Day Schedule */}
                <button
                  onClick={() => handleCopyDaySchedule(selectedDay)}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
                  title="نسخ جميع مواعيد هذا اليوم"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ اليوم</span>
                </button>

                {/* Paste Day Schedule */}
                {copiedDaySlots && (
                  <button
                    onClick={() => handlePasteDaySchedule(selectedDay)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-black border border-emerald-400/30 font-bold transition-all flex items-center gap-1.5 cursor-pointer animate-pulse"
                    title="لصق المواعيد المنسوخة إلى هذا اليوم"
                  >
                    <CopyCheck className="w-3.5 h-3.5" />
                    <span>لصق ({copiedDaySlots.length})</span>
                  </button>
                )}

                {/* Clear Day Schedule */}
                {schedules.filter(s => s.dayOfWeek === selectedDay).length > 0 && (
                  <button
                    onClick={() => handleClearDaySchedule(selectedDay)}
                    className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/30 text-red-300 border border-red-500/20 font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="حذف جميع مواعيد هذا اليوم"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تفريغ اليوم</span>
                  </button>
                )}
              </div>
            </div>

            {/* Schedule List for Selected Day */}
            <div className="space-y-4">
              {schedules.filter(s => s.dayOfWeek === selectedDay).length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-zinc-950/80 backdrop-blur-xl border border-white/15 shadow-2xl">
                  <Calendar className="w-14 h-14 text-purple-300/40 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-white mb-2">لا توجد مواعيد مجدولة ليوم {DAYS_OF_WEEK.find(d => d.id === selectedDay)?.name}</h3>
                  <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
                    يمكنك استخدام زر "الجدولة الذكية" لتوليد جدول تلفزيوني متكامل لليوم بضغطة زر، أو إضافة مواعيد يدويًا
                  </p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <button
                      onClick={() => handleRunSmartAutoSchedule('single_day')}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-amber-500 text-white font-extrabold transition-all text-sm cursor-pointer shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>توليد جدول ذكي لليوم تلقائياً 🪄</span>
                    </button>

                    <button
                      onClick={handleOpenAddSlot}
                      className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold transition-all text-sm cursor-pointer border border-white/15"
                    >
                      + إضافة موعد يدوي
                    </button>
                  </div>
                </div>
              ) : (
                schedules
                  .filter(s => s.dayOfWeek === selectedDay)
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((slot) => {
                    const ch = resolvedChannels.find(c => c.id === slot.channelId);

                    return (
                      <div
                        key={slot.id}
                        className="p-5 rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-amber-500/30 hover:border-amber-400/60 flex items-center justify-between gap-4 shadow-xl flex-wrap lg:flex-nowrap transition-all group hover:shadow-[0_10px_30px_rgba(245,158,11,0.2)]"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-[260px]">
                          {/* Time Chip */}
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <div className="px-4 py-2 rounded-xl bg-amber-400/20 border border-amber-400/30 text-amber-300 font-black text-base flex items-center gap-1.5 shadow">
                              <Clock className="w-4 h-4" />
                              <span>{slot.time}</span>
                            </div>

                            <div className="flex items-center gap-1 text-[10px]">
                              <button
                                onClick={() => handleQuickAdjustSlotTime(slot.id, -15)}
                                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
                                title="تقديم الموعد 15 دقيقة"
                              >
                                -15د
                              </button>
                              <button
                                onClick={() => handleQuickAdjustSlotTime(slot.id, 15)}
                                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
                                title="تأخير الموعد 15 دقيقة"
                              >
                                +15د
                              </button>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="space-y-1.5">
                            <h4 className="text-lg font-extrabold text-white flex items-center gap-2 flex-wrap">
                              <span>{slot.title}</span>
                              {slot.isWatched && (
                                <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black flex items-center gap-1 shadow-sm">
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>تمت المشاهدة اليوم</span>
                                </span>
                              )}
                            </h4>

                            <div className="flex items-center gap-2.5 flex-wrap text-xs text-white/60">
                              {/* Source Selector Pill */}
                              {slot.watchlistId && !slot.channelId ? (
                                <div className="flex items-center gap-1.5 bg-purple-500/20 px-3 py-1 rounded-xl border border-purple-500/40">
                                  <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                                  <span className="text-purple-200 font-extrabold text-xs truncate max-w-[200px]">
                                    {watchlists.find(w => w.id === slot.watchlistId)?.title || 'مكتبة مشاهدة'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-amber-400/10 px-3 py-1 rounded-xl border border-amber-400/30">
                                  <Tv className="w-3.5 h-3.5 text-amber-400" />
                                  <select
                                    value={slot.channelId || ''}
                                    onChange={(e) => handleQuickChangeSlotChannel(slot.id, e.target.value)}
                                    className="bg-transparent text-amber-200 font-extrabold focus:outline-none cursor-pointer text-xs max-w-[150px] truncate"
                                  >
                                    <option value="" className="bg-zinc-900 text-white">-- اختر القناة الحية --</option>
                                    {resolvedChannels.map(c => (
                                      <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                                        📺 {c.title}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Duration Badge */}
                              <span className="px-2.5 py-1 rounded-xl bg-white/10 text-white/80 border border-white/10 text-xs font-bold flex items-center gap-1">
                                <span>⏱️</span>
                                <span>{slot.durationMinutes || slot.transitionMinutes || 60} {slot.watchlistId && !slot.channelId ? 'دقيقة' : 'دقيقة بث حي'}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Controls */}
                        <div className="flex items-center gap-2.5 mr-auto lg:mr-0 shrink-0">
                          <button
                            onClick={() => handlePlayScheduleSlot(slot)}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-xs hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                          >
                            <Play className="w-3.5 h-3.5 fill-black" />
                            <span>{slot.watchlistId && !slot.channelId ? 'مشاهدة الموعد' : 'مشاهدة القناة الحية'}</span>
                          </button>

                          <button
                            onClick={() => handleOpenEditSlot(slot)}
                            className="p-2.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer border border-white/10"
                            title="تعديل الموعد"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteScheduleSlot(slot.id)}
                            className="p-2.5 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer border border-white/10"
                            title="حذف الموعد"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </section>
      </>
      )}

      {/* CHANNEL EDIT MODAL */}
      <AnimatePresence>
        {editingChannel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-zinc-900 rounded-3xl border border-white/20 p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-right dir-rtl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-white">تعديل القناة: {editingChannel.title}</h3>
                    <p className="text-xs text-white/60">يمكنك تعديل اسم القناة، وصفها، وقوائم التشغيل المرتبطة بها</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingChannel(null)}
                  className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Scrollable Form Body Container */}
              <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 pl-1.5 my-1 text-right">
                {/* Editable Fields Section */}
                <div className="space-y-3 pb-3 border-b border-white/10">
                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-1">اسم القناة وأيقونة الإيموجي</label>
                    <input
                      type="text"
                      value={editingChannel.title}
                      onChange={(e) => handleUpdateEditingChannelField('title', e.target.value)}
                      placeholder="اسم القناة"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/40 focus:outline-none focus:border-amber-400 text-sm font-bold"
                    />
                    {/* Quick Emoji Preset Picker */}
                    <div className="mt-2 space-y-1">
                      <span className="text-[11px] font-bold text-white/60">اختر إيموجي سريع للقناة:</span>
                      <div className="flex flex-wrap gap-1 bg-black/40 p-2 rounded-xl border border-white/10 max-h-24 overflow-y-auto no-scrollbar">
                        {['📺', '🍿', '🎬', '🕌', '🎵', '👶', '🌍', '💫', '⚡', '🎭', '📡', '🏆', '⚽', '🎮', '📜', '🌟', '👑', '🔮', '🔥', '🚀', '🎨', '🏖️', '🎧', '📽️', '💡'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              const currentTitle = editingChannel.title || '';
                              const hasEmojiPrefix = /^[\p{Emoji}\s]+/u.test(currentTitle.trim());
                              const cleanTitle = currentTitle.replace(/^[\p{Emoji}\s]+/u, '').trim();
                              const newTitle = `${emoji} ${cleanTitle || 'قناة جديدة'}`;
                              handleUpdateEditingChannelField('title', newTitle);
                            }}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-amber-400 hover:scale-110 text-base flex items-center justify-center transition-all cursor-pointer border border-white/10 hover:border-amber-400"
                            title={`إضافة الإيموجي ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/70 mb-1">شارة / هيدر القناة (Badge)</label>
                    <input
                      type="text"
                      value={editingChannel.badge || ''}
                      onChange={(e) => handleUpdateEditingChannelField('badge', e.target.value)}
                      placeholder="مثال: 4K, مسلسلات سورية"
                      className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-amber-400 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/70 mb-1">وصف القناة</label>
                    <input
                      type="text"
                      value={editingChannel.description || ''}
                      onChange={(e) => handleUpdateEditingChannelField('description', e.target.value)}
                      placeholder="وصف محتوى القناة"
                      className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-amber-400 text-xs"
                    />
                  </div>

                  {/* Channel Medium Type */}
                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-1">تصنيف البث (نوع المحتوى)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateEditingChannelField('type', 'movies')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                          editingChannel.type === 'movies'
                            ? 'bg-amber-400 text-black border-amber-300 shadow-md font-black'
                            : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <Film className="w-3.5 h-3.5" />
                        <span>🎬 أفلام</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateEditingChannelField('type', 'series')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                          editingChannel.type === 'series'
                            ? 'bg-amber-400 text-black border-amber-300 shadow-md font-black'
                            : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span>📺 مسلسلات</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateEditingChannelField('type', 'radio')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                          editingChannel.type === 'radio'
                            ? 'bg-amber-400 text-black border-amber-300 shadow-md font-black'
                            : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>📻 راديو بصوتي</span>
                      </button>
                    </div>
                  </div>

                  {/* Multiple Modes Selection */}
                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-1">الأوضاع المناسبة للقناة (إمكانية اختيار أكثر من وضع)</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {Object.entries(customModes).map(([id, mode]) => {
                        const m = { id, name: mode.title };
                        const selectedModes = editingChannel.modes || [];
                        const isSelected = selectedModes.includes(m.id as any);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              const nextModes = isSelected
                                ? selectedModes.filter(x => x !== m.id)
                                : [...selectedModes, m.id as any];
                              handleUpdateEditingChannelField('modes', nextModes);
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                              isSelected
                                ? 'bg-amber-400 text-black border-amber-400 shadow-sm'
                                : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <span>{m.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Auto-Sync Configuration Box */}
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
                        <span className="text-xs font-extrabold text-amber-300">الربط والمزامنة الأوتوماتيكية مع المكتبات</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdateEditingChannelField('autoSyncEnabled', editingChannel.autoSyncEnabled === false)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                          editingChannel.autoSyncEnabled !== false
                            ? 'bg-amber-400 text-black border-amber-300 shadow-md font-black'
                            : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                        }`}
                      >
                        {editingChannel.autoSyncEnabled !== false ? (
                          <>
                            <Zap className="w-3.5 h-3.5 text-black" />
                            <span>⚡ مفعّلة أوتوماتيكياً</span>
                          </>
                        ) : (
                          <span>🎯 تخصيص يدوي فقط</span>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-amber-100/80 leading-relaxed">
                      {editingChannel.autoSyncEnabled !== false
                        ? 'أي قائمة تشغيل أو مسلسل جديد تفتحه أو تضيفه في المكتبة (مثل أطفالي، المسلسلات، الوثائقيات...)، سيتم ربطه وإضافته أوتوماتيكياً للقناة فوراً!'
                        : 'المزامنة التلقائية معطلة لهذه القناة. يمكنك تحديد واختيار المسلسلات والقوائم يدويًا أدناه.'}
                    </p>
                  </div>

                  {/* Channel Playback Mechanics: Order & Transition */}
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        آلية البث والانتقال الذكي بالقناة
                      </span>
                    </div>

                    {/* Playback Order: Sequential vs Random */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-white/80">ترتيب عرض المحتوى والقوائم:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateEditingChannelField('playbackOrder', 'sequential')}
                          className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                            (editingChannel.playbackOrder || 'sequential') === 'sequential'
                              ? 'bg-amber-400 text-black border-amber-300 shadow-sm font-black'
                              : 'bg-black/30 text-white/70 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <Repeat className="w-3.5 h-3.5" />
                          <span>🔁 متسلسل (بالتتابع)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateEditingChannelField('playbackOrder', 'random')}
                          className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                            editingChannel.playbackOrder === 'random'
                              ? 'bg-amber-400 text-black border-amber-300 shadow-sm font-black'
                              : 'bg-black/30 text-white/70 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>🎲 عشوائي (خلط)</span>
                        </button>
                      </div>
                    </div>

                    {/* Transition Type: By Episode vs By Time */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-white/80">شرط الانتقال بين المسلسلات والقوائم:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateEditingChannelField('transitionType', 'episode')}
                          className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                            (editingChannel.transitionType || 'episode') === 'episode'
                              ? 'bg-amber-400 text-black border-amber-300 shadow-sm font-black'
                              : 'bg-black/30 text-white/70 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>📺 حسب عدد الحلقات</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateEditingChannelField('transitionType', 'time')}
                          className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                            editingChannel.transitionType === 'time'
                              ? 'bg-amber-400 text-black border-amber-300 shadow-sm font-black'
                              : 'bg-black/30 text-white/70 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>⏱️ حسب الوقت الزمني</span>
                        </button>
                      </div>
                    </div>

                    {/* Transition Value Selectors */}
                    {editingChannel.transitionType === 'time' ? (
                      <div className="space-y-1 pt-1">
                        <label className="block text-[11px] font-bold text-amber-200">مدة العرض قبل الانتقال للقائمة التالية:</label>
                        <div className="flex flex-wrap gap-1.5">
                          {[15, 30, 45, 60, 90].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => handleUpdateEditingChannelField('transitionMinutes', mins)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                (editingChannel.transitionMinutes || 30) === mins
                                  ? 'bg-amber-400 text-black border-amber-300 font-extrabold'
                                  : 'bg-black/40 text-white/70 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {mins} دقيقة
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 pt-1">
                        <label className="block text-[11px] font-bold text-amber-200">عدد الحلقات قبل الانتقال للقائمة التالية:</label>
                        <div className="flex flex-wrap gap-1.5">
                          {[1, 2, 3, 5].map((eps) => (
                            <button
                              key={eps}
                              type="button"
                              onClick={() => handleUpdateEditingChannelField('transitionEpisodes', eps)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                (editingChannel.transitionEpisodes || 1) === eps
                                  ? 'bg-amber-400 text-black border-amber-300 font-extrabold'
                                  : 'bg-black/40 text-white/70 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {eps} {eps === 1 ? 'حلقة واحدة' : eps === 2 ? 'حلقان' : 'حلقات'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Watchlists Selection Section */}
                {(() => {
                  const selectedModes = editingChannel.modes || [];
                  const displayWatchlists = showAllWatchlistsInModal
                    ? watchlists
                    : selectedModes.length > 0
                    ? watchlists.filter(wl => {
                        const wlMode = wl.targetMode || wl.section;
                        return selectedModes.some(m => wlMode === m || wl.targetMode === m || wl.section === m);
                      })
                    : watchlists;

                  return (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <label className="block text-xs font-bold text-amber-300">
                            ربط قوائم التشغيل والمسلسلات بالقناة
                          </label>
                          <p className="text-[11px] text-white/50">
                            {showAllWatchlistsInModal
                              ? 'عرض جميع قوائم المكتبة'
                              : selectedModes.length === 0
                              ? 'يرجى تحديد وضع للقناة من الأعلى لخصخصة القوائم المتاحة'
                              : `مصفاة حن المحتوى التابع للأوضاع المحددة فقط (${selectedModes.join(', ')})`}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const allIds = Array.from(new Set([
                                ...(editingChannel.playlistIds || []),
                                ...displayWatchlists.map(w => w.id)
                              ]));
                              handleUpdateEditingChannelField('playlistIds', allIds);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-amber-400/20 hover:bg-amber-400 text-amber-300 hover:text-black text-[11px] font-extrabold transition-all cursor-pointer border border-amber-400/40"
                            title="تحديد جميع القوائم المعروضة"
                          >
                            تحديد الكل 💥
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const displaySet = new Set(displayWatchlists.map(w => w.id));
                              const remaining = (editingChannel.playlistIds || []).filter(id => !displaySet.has(id));
                              handleUpdateEditingChannelField('playlistIds', remaining);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white text-[11px] font-extrabold transition-all cursor-pointer border border-red-500/40"
                            title="إلغاء تحديد القوائم المعروضة"
                          >
                            إلغاء الكل ❌
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowAllWatchlistsInModal(!showAllWatchlistsInModal)}
                            className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors cursor-pointer border border-white/15"
                          >
                            {showAllWatchlistsInModal ? 'تصفية حسب وضع القناة' : 'عرض جميع القوائم'}
                          </button>
                        </div>
                      </div>

                      {/* Watchlists List */}
                      <div className="space-y-2">
                        {displayWatchlists.length === 0 ? (
                          <div className="p-6 text-center rounded-2xl bg-white/5 border border-white/10 text-white/60">
                            <Film className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-300" />
                            <p className="text-xs font-bold mb-1">لا توجد قوائم تشغيل مضافة حتى الآن</p>
                            <p className="text-[11px] text-white/40">
                              قم بإضافة قوائم تشغيل ومسلسلات جديدة من قسم "إضافة محتوى" أو "المكتبة".
                            </p>
                          </div>
                        ) : (
                          displayWatchlists.map((wl) => {
                            const isChecked = editingChannel.playlistIds?.includes(wl.id);

                            return (
                              <div
                                key={wl.id}
                                onClick={() => handleToggleWatchlistInChannel(wl.id)}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                  isChecked
                                    ? 'bg-amber-400/15 border-amber-400/50 text-white shadow-sm'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/70'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {wl.coverImage ? (
                                    <img src={wl.coverImage} alt={wl.title} className="w-9 h-11 rounded-lg object-cover" />
                                  ) : (
                                    <div className="w-9 h-11 rounded-lg bg-white/10 flex items-center justify-center">
                                      <Film className="w-5 h-5 text-white/40" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <h4 className="font-bold text-xs sm:text-sm text-white">{wl.title}</h4>
                                      {wl.targetMode && (
                                        <span className="px-1.5 py-0.2 text-[9px] font-extrabold rounded bg-white/10 text-amber-300 border border-white/10">
                                          {wl.targetMode}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-white/50">{wl.section} • {wl.episodesCount} مقطع</p>
                                  </div>
                                </div>

                                <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors ${
                                  isChecked ? 'bg-amber-400 border-amber-400 text-black' : 'border-white/30'
                                }`}>
                                  {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteChannel(undefined, editingChannel)}
                    className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold border border-red-500/30 text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>حذف القناة</span>
                  </button>

                  <button
                    onClick={() => handleUpdateEditingChannelField('isFavorite', !editingChannel.isFavorite)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                      editingChannel.isFavorite
                        ? 'bg-red-500/30 text-red-400 border-red-500/50'
                        : 'bg-white/10 text-white/80 border-white/15 hover:bg-white/20'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${editingChannel.isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
                    <span>{editingChannel.isFavorite ? 'في المفضلة' : 'إضافة للمفضلة'}</span>
                  </button>
                </div>

                <button
                  onClick={() => setEditingChannel(null)}
                  className="px-6 py-2.5 rounded-xl bg-amber-400 text-black font-extrabold hover:bg-amber-300 transition-colors cursor-pointer text-sm"
                >
                  حفظ وإغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD / EDIT SCHEDULE MODAL */}
      <AnimatePresence>
        {isAddSlotOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-zinc-900 rounded-3xl border border-white/20 p-5 sm:p-6 shadow-2xl text-right dir-rtl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
                    {editingSlot ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-white">
                      {editingSlot ? 'تعديل موعد العرض' : 'إضافة موعد جدول جديد'}
                    </h3>
                    <p className="text-xs text-white/50">تأكد من عدم تضارب الموعد مع المواعيد المجدولة الأخرى</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddSlotOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 pl-1.5 my-1 text-right">
                {/* 1. DAY FIELD AT THE TOP */}
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1.5">اليوم</label>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-white/10 text-white focus:outline-none focus:border-amber-400 text-sm font-bold cursor-pointer"
                  >
                    <option value={0}>📅 الأحد</option>
                    <option value={1}>📅 الاثنين</option>
                    <option value={2}>📅 الثلاثاء</option>
                    <option value={3}>📅 الأربعاء</option>
                    <option value={4}>📅 الخميس</option>
                    <option value={5}>📅 الجمعة</option>
                    <option value={6}>📅 السبت</option>
                  </select>
                </div>

                {/* 2. PRIMARY FIELD: SOURCE TYPE SELECTOR */}
                <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-400/30 space-y-4">
                  <div>
                    <label className="block text-xs font-black text-amber-300 flex items-center gap-1.5 mb-2">
                      <Tv className="w-4 h-4 text-amber-400" />
                      <span>نوع مصدر المحتوى المباشر</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSlotSourceType('channel')}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          slotSourceType === 'channel'
                            ? 'bg-amber-400 text-black border-amber-300 shadow-md'
                            : 'bg-black/40 text-amber-400/50 border-amber-400/20 hover:border-amber-400/40'
                        }`}
                      >
                        📺 بث قناة حية
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlotSourceType('watchlist')}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          slotSourceType === 'watchlist'
                            ? 'bg-purple-500 text-white border-purple-400 shadow-md'
                            : 'bg-black/40 text-purple-400/50 border-purple-400/20 hover:border-purple-400/40'
                        }`}
                      >
                        📚 حلقة من مكتبة
                      </button>
                    </div>
                  </div>

                  {slotSourceType === 'channel' ? (
                    <div>
                      <select
                        value={slotChannelId}
                        onChange={(e) => {
                          const newChanId = e.target.value;
                          setSlotChannelId(newChanId);
                          const selectedChan = resolvedChannels.find(c => c.id === newChanId);
                          if (selectedChan) {
                            setSlotTitle(selectedChan.title);
                            if (selectedChan.modes?.[0]) setSlotMode(selectedChan.modes[0]);
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-amber-400/40 text-amber-200 focus:outline-none focus:border-amber-300 text-sm font-extrabold cursor-pointer"
                      >
                        <option value="" disabled className="bg-zinc-900 text-white">-- اختر القناة الحية --</option>
                        {resolvedChannels.map(c => (
                          <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                            📺 {c.title} ({c.category || 'عام'})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <select
                        value={slotMode}
                        onChange={(e) => {
                          setSlotMode(e.target.value as Mode);
                          setSlotWatchlistId('');
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-purple-400/40 text-purple-200 focus:outline-none focus:border-purple-300 text-sm font-extrabold cursor-pointer"
                      >
                        <option value="" disabled className="bg-zinc-900 text-white">-- اختر تصنيف المكتبة --</option>
                        {Object.entries(MODES).map(([mKey, mInfo]) => (
                          <option key={mKey} value={mKey} className="bg-zinc-900 text-white">
                            {mInfo.title}
                          </option>
                        ))}
                      </select>

                      <select
                        value={slotWatchlistId}
                        onChange={(e) => {
                          setSlotWatchlistId(e.target.value);
                          const selectedWatchlist = watchlists.find(w => w.id === e.target.value);
                          if (selectedWatchlist) {
                            setSlotTitle(selectedWatchlist.title);
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-purple-400/40 text-purple-200 focus:outline-none focus:border-purple-300 text-sm font-extrabold cursor-pointer"
                      >
                        <option value="" disabled className="bg-zinc-900 text-white">-- اختر المسلسل / القائمة --</option>
                        {watchlists
                          .filter(w => !slotMode || w.targetMode === slotMode || w.section === slotMode || slotMode === 'family')
                          .map(w => (
                          <option key={w.id} value={w.id} className="bg-zinc-900 text-white truncate">
                            📚 {w.title}
                          </option>
                        ))}
                      </select>

                      {slotWatchlistId && (() => {
                        const selectedWl = watchlists.find(w => w.id === slotWatchlistId);
                        const wlFiles = selectedWl ? (selectedWl.seasons && selectedWl.seasons.length > 0 ? selectedWl.seasons.flatMap(s => s.files || []) : (selectedWl.files || [])) : [];
                        const isScheduled = schedules.some(s => s.watchlistId === slotWatchlistId && s.episodeIndex === slotEpisodeIndex && s.id !== editingSlot?.id);
                        return (
                          <div className="space-y-2 mt-3">
                            <select
                              value={slotEpisodeIndex}
                              onChange={(e) => setSlotEpisodeIndex(Number(e.target.value))}
                              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-purple-400/40 text-purple-200 focus:outline-none focus:border-purple-300 text-sm font-extrabold cursor-pointer"
                            >
                              {wlFiles.length === 0 ? (
                                <option value={0} disabled className="bg-zinc-900 text-white">-- لا يوجد حلقات --</option>
                              ) : (
                                wlFiles.map((f, i) => (
                                  <option key={i} value={i} className="bg-zinc-900 text-white truncate">
                                    ▶ الحلقة {i + 1}: {f.title || f.name || 'حلقة'}
                                  </option>
                                ))
                              )}
                            </select>
                            {isScheduled && (
                              <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 px-3 py-2 rounded-lg border border-amber-400/20 shadow-sm mt-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>تنبيه: هذه الحلقة محجوزة مسبقاً في موعد آخر.</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* 3. BROADCAST TITLE & START TIME FIELDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-1.5">عنوان البث أو الفقرة المباشرة</label>
                    <input
                      type="text"
                      value={slotTitle}
                      onChange={(e) => setSlotTitle(e.target.value)}
                      placeholder="مثال: البث الحي المباشر"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-amber-400 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-1.5">توقيت بدء العرض</label>
                    <input
                      type="time"
                      value={slotTime}
                      onChange={(e) => setSlotTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-400 text-sm font-bold cursor-pointer"
                    />
                  </div>
                </div>

                {/* 4. DURATION FIELD (مدة العرض بالدقائق) */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white/90 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>مدة البث المباشر (بالدقائق):</span>
                    </span>
                    <span className="text-amber-300 font-mono font-bold">
                      ينتهي الساعة {formatMinutesToTime(parseTimeToMinutes(slotTime) + (slotDurationMinutes || 60))}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={5}
                    max={720}
                    step={5}
                    value={slotDurationMinutes}
                    onChange={(e) => setSlotDurationMinutes(Math.max(5, Number(e.target.value) || 30))}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-white focus:outline-none focus:border-amber-400 text-sm font-bold"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {[30, 45, 60, 90, 120, 180].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSlotDurationMinutes(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          slotDurationMinutes === m
                            ? 'bg-amber-400 text-black font-extrabold shadow'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                      >
                        {m} دقيقة
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
                <button
                  onClick={() => setIsAddSlotOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors text-sm cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveScheduleSlot}
                  className="px-6 py-2.5 rounded-xl bg-amber-400 text-black font-extrabold hover:bg-amber-300 transition-colors text-sm cursor-pointer shadow-lg flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{editingSlot ? 'حفظ التعديلات' : 'إضافة الموعد'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SURPRISE ME MODAL */}
      <AnimatePresence>
        {isSurpriseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-zinc-900 rounded-3xl border border-amber-400/50 p-8 shadow-[0_0_50px_rgba(245,158,11,0.3)] text-center dir-rtl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600" />

              <button
                onClick={() => setIsSurpriseOpen(false)}
                className="absolute top-4 left-4 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-rose-500 flex items-center justify-center mx-auto mb-4 shadow-xl border border-white/20">
                <Sparkles className="w-10 h-10 text-black animate-spin" style={{ animationDuration: '4s' }} />
              </div>

              <h3 className="text-2xl font-extrabold text-white mb-2">🎲 اقتراح فاجئني</h3>

              {isSpinning ? (
                <div className="py-8 space-y-3">
                  <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-bold text-amber-300">جاري اختيار مقطع عشوائي من مكتبتك...</p>
                </div>
              ) : surpriseItem ? (
                <div className="py-4 space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <h4 className="text-lg font-extrabold text-white">{surpriseItem.watchlist.title}</h4>
                    <p className="text-xs text-amber-300 font-medium mt-1">
                      {surpriseItem.file?.name || surpriseItem.file?.title || `الحلقة ${surpriseItem.epIndex + 1}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSurpriseMe}
                      className="flex-1 py-3 px-4 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>اختر آخر</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsSurpriseOpen(false);
                        const allFiles = [
                          ...(surpriseItem.watchlist.files || []),
                          ...(surpriseItem.watchlist.seasons?.flatMap(s => s.files || []) || [])
                        ];
                        onPlay(
                          surpriseItem.file,
                          surpriseItem.file?.name || `الحلقة ${surpriseItem.epIndex + 1}`,
                          surpriseItem.watchlist.title,
                          allFiles,
                          surpriseItem.epIndex,
                          undefined,
                          surpriseItem.watchlist.id
                        );
                      }}
                      className="flex-1 py-3 px-4 rounded-xl bg-amber-400 text-black font-extrabold hover:bg-amber-300 transition-colors text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-black" />
                      <span>شاهد الآن</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SMART AUTO SCHEDULE CONFIG MODAL */}
      <AnimatePresence>
        {isSmartScheduleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl lg:max-w-3xl p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-purple-500/40 shadow-[0_0_50px_rgba(168,85,247,0.3)] space-y-6 text-white overflow-hidden max-h-[92vh] overflow-y-auto dir-rtl text-right"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-amber-500 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-6 h-6 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-white">مولد الجدولة الذكية لبث القنوات التلفزيونية 🪄</h3>
                    <p className="text-xs text-amber-300 font-medium">توليد جدول أسبوعي تلقائي يربط المواعيد بالقنوات الحية مباشرة (قناة القرآن، الأطفال، السينما...) وعند حلول الموعد ينقلك فوراً لمشغل القناة الحية</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSmartScheduleModalOpen(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Options Form */}
              <div className="space-y-6 text-sm">
                {/* 1. Scope Selection */}
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-2">1. نطاق الجدولة</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSmartScope('all_week')}
                      className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                        smartScope === 'all_week'
                          ? 'bg-purple-600/30 border-purple-400 text-white ring-2 ring-purple-400/50'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-extrabold text-sm mb-1">جدول الأسبوع بالكامل (7 أيام)</div>
                      <div className="text-[11px] opacity-70">توليد جدول يومي تنوعي متكرر لكامل الأسبوع</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSmartScope('single_day')}
                      className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                        smartScope === 'single_day'
                          ? 'bg-purple-600/30 border-purple-400 text-white ring-2 ring-purple-400/50'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-extrabold text-sm mb-1">يوم {DAYS_OF_WEEK.find(d => d.id === selectedDay)?.name} فقط</div>
                      <div className="text-[11px] opacity-70">توليد المواعيد والأنماط لليوم المحدد حالياً فقط</div>
                    </button>
                  </div>
                </div>

                {/* 2. Strategy Switcher */}
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-2">2. استراتيجية توزيع المواعيد</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSmartStrategy('category')}
                      className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                        smartStrategy === 'category'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/50'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-extrabold text-sm mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>أوقات منوعة حسب الأصناف 🌟</span>
                      </div>
                      <div className="text-[11px] opacity-70">أوقات مخصصة لكل صنف (أطفال، مسلسلات، أفلام، قرآن...)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSmartStrategy('density')}
                      className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
                        smartStrategy === 'density'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/50'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-extrabold text-sm mb-1">توزيع أوتوماتيكي حسب الكثافة ⚡</div>
                      <div className="text-[11px] opacity-70">مواعيد عامة متتابعة من المكتبة حسب عدد الفترات</div>
                    </button>
                  </div>
                </div>

                {smartStrategy === 'category' ? (
                  /* CATEGORY BASED SCHEDULING CONFIG */
                  <div className="space-y-4 pt-2 border-t border-white/10">
                    {/* Presets Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-amber-300">3. اختيار القالب أو النمط المناسب</label>
                        <span className="text-[11px] text-purple-300 font-bold">{categorySlots.length} فقرات اليوم</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {Object.entries(PRESET_CATEGORY_SCHEDULES).map(([pKey, pData]) => (
                          <button
                            key={pKey}
                            type="button"
                            onClick={() => handleApplyCategoryPreset(pKey as any)}
                            className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                              smartCategoryPreset === pKey
                                ? 'bg-purple-600/30 border-purple-400 text-white font-extrabold shadow-md ring-2 ring-purple-400/40'
                                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                            }`}
                          >
                            <div className="font-bold text-xs text-amber-200 mb-0.5">{pData.name.split('(')[0]}</div>
                            <div className="text-[10px] text-white/50 line-clamp-2">{pData.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Live Day Ribbon Preview */}
                    <div className="bg-zinc-900/90 p-3 rounded-2xl border border-amber-400/30 shadow-inner">
                      <div className="text-[11px] font-bold text-amber-300 mb-2 flex items-center justify-between">
                        <span>معاينة التسلسل اليومي المباشر للأصناف:</span>
                        <span className="text-[10px] text-white/50">تتكرر هذه الفقرات مع كل يوم بطريقة تسلسلية للقصص والحلقات</span>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        {categorySlots.map((slot, idx) => {
                          const meta = CATEGORY_NAMES_WITH_ICONS[slot.mode] || CATEGORY_NAMES_WITH_ICONS.family;
                          const IconComp = meta.icon;
                          return (
                            <div key={slot.id} className="flex items-center gap-1.5 shrink-0 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                              <span className="text-xs font-black font-mono text-amber-300 bg-black/40 px-2 py-0.5 rounded-md">
                                {slot.time}
                              </span>
                              <span className={`text-xs font-bold flex items-center gap-1 ${meta.badgeColor}`}>
                                <IconComp className="w-3.5 h-3.5" />
                                {meta.label.split(' ')[0]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Interactive Category Time Slots Editor */}
                    <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar p-1 border border-white/10 rounded-2xl bg-black/40">
                      <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold text-white/60">
                        <span>الوقت والصنف المطلوب</span>
                        <span>الوصف والتحكم</span>
                      </div>
                      {categorySlots.map((slot) => (
                        <div key={slot.id} className="flex items-center gap-2 bg-zinc-900/80 p-2.5 rounded-xl border border-white/10">
                          {/* Time Input */}
                          <input
                            type="time"
                            value={slot.time}
                            onChange={(e) => handleUpdateCategorySlot(slot.id, { time: e.target.value })}
                            className="bg-black/60 border border-amber-400/30 text-amber-300 font-black text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-amber-400 text-center font-mono cursor-pointer"
                          />

                          {/* Category Selector */}
                          <select
                            value={slot.mode}
                            onChange={(e) => handleUpdateCategorySlot(slot.id, { mode: e.target.value as Mode })}
                            className="bg-zinc-800 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg border border-white/15 focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            <option value="kids">أطفال وكرتون 👶</option>
                            <option value="family">مسلسلات ودراما 👨‍👩‍👧‍👦</option>
                            <option value="cinema">أفلام وسينما 🎬</option>
                            <option value="quran">قرآن وطمأنينة 📖</option>
                            <option value="docs">وثائقيات وثقافة 🌍</option>
                            <option value="music">موسيقى وأغاني 🎵</option>
                          </select>

                          {/* Label Description */}
                          <input
                            type="text"
                            value={slot.label || ''}
                            onChange={(e) => handleUpdateCategorySlot(slot.id, { label: e.target.value })}
                            placeholder="وصف أو عنوان الفقرة"
                            className="flex-1 bg-black/40 border border-white/10 text-white text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-amber-400"
                          />

                          {/* Remove Slot */}
                          <button
                            type="button"
                            onClick={() => handleRemoveCategorySlot(slot.id)}
                            className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            title="حذف هذا الموعد"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={handleAddCategorySlot}
                        className="w-full py-2.5 border border-dashed border-amber-400/40 hover:border-amber-400 rounded-xl text-amber-300 hover:text-amber-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة وقت وصنف جديد للجدول</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* DENSITY BASED CONFIG */
                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-2">كثافة المواعيد اليومية</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'light', title: 'خفيف (موعدان)', desc: '18:30، 21:30' },
                        { id: 'balanced', title: 'متوازن (4 مواعيد)', desc: '15:00، 17:30، 20:00، 22:30' },
                        { id: 'intense', title: 'مكثف (6 مواعيد)', desc: '13:30، 15:30، 17:30...' }
                      ].map(d => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setSmartDensity(d.id as any)}
                          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                            smartDensity === d.id
                              ? 'bg-amber-400/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40'
                              : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          <div className="font-bold text-xs">{d.title}</div>
                          <div className="text-[10px] text-white/50 mt-1">{d.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Toggles */}
                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                    <span className="font-bold text-xs text-white">ربط القنوات المناسبة بالمحتوى أوتوماتيكياً</span>
                    <input
                      type="checkbox"
                      checked={smartAutoChannelMatch}
                      onChange={(e) => setSmartAutoChannelMatch(e.target.checked)}
                      className="w-4 h-4 accent-purple-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                    <span className="font-bold text-xs text-white">جدولة الحلقات بتسلسل ذكي ومستمر (تتابع الأجزاء يومياً)</span>
                    <input
                      type="checkbox"
                      checked={smartSequentialEpisodes}
                      onChange={(e) => setSmartSequentialEpisodes(e.target.checked)}
                      className="w-4 h-4 accent-purple-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                    <span className="font-bold text-xs text-white">استبدال المواعيد الحالية في النطاق المحدد</span>
                    <input
                      type="checkbox"
                      checked={smartOverwrite}
                      onChange={(e) => setSmartOverwrite(e.target.checked)}
                      className="w-4 h-4 accent-purple-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSmartScheduleModalOpen(false)}
                  className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => handleRunSmartAutoSchedule()}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-500 text-white font-black text-sm hover:brightness-110 transition-all flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Wand2 className="w-4 h-4 text-amber-300" />
                  <span>توليد وإنشاء الجدول الآن ⚡</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QUICK LINK MODAL (الربط السريع للقنوات بالأنماط والأوضاع) */}
      <AnimatePresence>
        {isQuickLinkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md dir-rtl text-right">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-4xl p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-amber-400/40 shadow-[0_0_60px_rgba(251,191,36,0.25)] space-y-6 text-white overflow-hidden max-h-[92vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/30 text-slate-950 shrink-0">
                    <Zap className="w-7 h-7 fill-current stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 flex-wrap">
                      <span>الربط السريع للقنوات والراديو بالأنماط</span>
                      <span className="px-2.5 py-0.5 text-xs rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30">سريع ودفعة واحدة ⚡</span>
                    </h3>
                    <p className="text-xs text-white/60 font-medium mt-0.5">
                      تحديد وربط أنماط البث المباشر (أطفال، مسلسلات، سينما، وثائقيات، قرآن، موسيقى) لجميع القنوات والمحطات في نافذة واحدة
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsQuickLinkModalOpen(false)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer border border-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Toolbar inside Modal */}
              <div className="flex items-center justify-between flex-wrap gap-3 bg-white/5 p-3.5 rounded-2xl border border-white/10 shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <input
                    type="text"
                    value={quickSearchQuery}
                    onChange={(e) => setQuickSearchQuery(e.target.value)}
                    placeholder="🔍 ابحث عن قناة أو محطة راديو بالاسم..."
                    className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/15 text-white placeholder-white/40 text-xs font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const synced = autoAssignWatchlistsToChannels(quickChannels, watchlists);
                      setQuickChannels(synced);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400 text-amber-300 hover:text-slate-950 font-extrabold text-xs transition-all border border-amber-400/40 cursor-pointer flex items-center gap-1.5 shadow-sm"
                    title="ربط القوائم والمسلسلات في المكتبة أوتوماتيكياً مع القنوات حسب أنماطها"
                  >
                    <Wand2 className="w-4 h-4" />
                    <span>مزامنة تلقائية للكل 🪄</span>
                  </button>

                  <button
                    onClick={() => {
                      setQuickChannels(prev => prev.map(ch => ({
                        ...ch,
                        autoSyncEnabled: true
                      })));
                    }}
                    className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white font-extrabold text-xs transition-all border border-purple-500/40 cursor-pointer flex items-center gap-1.5"
                  >
                    <Zap className="w-4 h-4" />
                    <span>تفعيل المزامنة للجميع ⚡</span>
                  </button>
                </div>
              </div>

              {/* Channels List Container */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
                {quickChannels
                  .filter(ch => !quickSearchQuery || ch.title.toLowerCase().includes(quickSearchQuery.toLowerCase()))
                  .map((ch) => {
                    const currentModes = ch.modes || [];
                    const linkedCount = ch.playlistIds?.length || 0;

                    return (
                      <div
                        key={ch.id}
                        className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 hover:border-amber-400/40 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${ch.accentGradient || 'from-amber-500 to-rose-600'} flex items-center justify-center text-white font-black text-sm shadow-md shrink-0`}>
                              {ch.id.includes('radio') || ch.type === 'radio' ? <Radio className="w-5 h-5" /> : <Tv className="w-5 h-5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-sm sm:text-base text-white">{ch.title}</h4>
                                {ch.badge && (
                                  <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                    {ch.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-white/50 mt-0.5">
                                {linkedCount > 0 ? (
                                  <span className="text-amber-300 font-bold">{linkedCount} قائمة تشغيل مرتبطة</span>
                                ) : (
                                  <span className="text-white/40">لا توجد قوائم تشغيل مرتبطة</span>
                                )}
                                {' • '}
                                <span>المزامنة التلقائية: {ch.autoSyncEnabled !== false ? 'مفعلة ⚡' : 'يدوية 🎯'}</span>
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const syncedCh = autoAssignWatchlistsToChannels([ch], watchlists)[0];
                              setQuickChannels(prev => prev.map(item => item.id === ch.id ? syncedCh : item));
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 font-bold text-xs transition-colors cursor-pointer border border-white/10 flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>مزامنة هذه القناة</span>
                          </button>
                        </div>

                        {/* Mode Selector Buttons */}
                        <div className="space-y-1.5 pt-2 border-t border-white/5">
                          <span className="text-[11px] font-bold text-amber-200 block">حدد الأنماط والأوضاع التشغيلية المرتبطة بهذه القناة:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(customModes).map(([id, mode]) => {
                              const m = { id, label: mode.title };
                              const isSelected = currentModes.includes(m.id as any);
                              const isExpanded = expandedQuickLinkMode?.channelId === ch.id && expandedQuickLinkMode?.modeId === m.id;
                              
                              const baseCategories = MODE_SECTIONS[m.id as Mode] || [];
                              const customCats = customCategories[m.id] || [];
                              const allCategories = Array.from(new Set([...baseCategories, ...customCats]));
                              
                              // Check if any specific categories of this mode are selected
                              const selectedCategories = ch.autoSyncCategories || [];
                              const hasSpecificCategories = selectedCategories.some(cat => allCategories.includes(cat));
                              const isAllSelected = isSelected && !hasSpecificCategories;

                              return (
                                <div key={m.id} className="relative">
                                  <div className="flex items-stretch">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextModes = isSelected && !hasSpecificCategories
                                          ? currentModes.filter(x => x !== m.id) // Toggle off if "All" is currently selected
                                          : [...currentModes.filter(x => x !== m.id), m.id as any]; // Ensure mode is added

                                        // Auto sync matching watchlists for nextModes (assuming ALL categories of this mode)
                                        const nextAutoSyncCats = selectedCategories.filter(cat => !allCategories.includes(cat)); // Remove specific categories for this mode

                                        const matchingWlIds = watchlists
                                          .filter(w => {
                                            const wMode = w.targetMode || w.section;
                                            
                                            // 1. Check modes
                                            if (nextModes.some(modeKey => wMode === modeKey || w.targetMode === modeKey || w.section === modeKey)) return true;
                                            
                                            // 2. Check autoSyncCategories (from other modes)
                                            if (nextAutoSyncCats.some(cat => w.section?.toLowerCase().includes(cat.toLowerCase()) || w.title?.toLowerCase().includes(cat.toLowerCase()))) return true;
                                            
                                            return false;
                                          })
                                          .map(w => w.id);

                                        setQuickChannels(prev => prev.map(item => {
                                          if (item.id !== ch.id) return item;
                                          return {
                                            ...item,
                                            modes: nextModes,
                                            autoSyncCategories: nextAutoSyncCats.length > 0 ? nextAutoSyncCats : undefined,
                                            playlistIds: Array.from(new Set([...(item.playlistIds || []), ...matchingWlIds]))
                                          };
                                        }));
                                      }}
                                      className={`px-3 py-1.5 rounded-r-full text-xs font-bold transition-all cursor-pointer border-y border-r flex items-center gap-1.5 ${
                                        isSelected
                                          ? 'bg-amber-400 text-slate-950 border-amber-500 font-extrabold shadow-md'
                                          : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/15'
                                      }`}
                                    >
                                      {isAllSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                      <span>{m.label}</span>
                                      {hasSpecificCategories && <span className="text-[10px] bg-slate-900 text-amber-400 px-1.5 rounded-full">*</span>}
                                    </button>
                                    
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedQuickLinkMode(isExpanded ? null : { channelId: ch.id!, modeId: m.id });
                                      }}
                                      className={`px-2 py-1.5 rounded-l-full border-y border-l transition-all cursor-pointer flex items-center justify-center ${
                                        isSelected
                                          ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 border-amber-500 border-r border-r-amber-500/50'
                                          : 'bg-white/5 hover:bg-white/20 text-white/70 border-white/10 border-r border-r-white/10'
                                      }`}
                                    >
                                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  </div>

                                  {isExpanded && (
                                    <div className="absolute z-50 top-full mt-1 left-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 w-48 max-h-64 overflow-y-auto">
                                      <div className="space-y-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextModes = [...currentModes.filter(x => x !== m.id), m.id as any];
                                            const nextAutoSyncCats = selectedCategories.filter(cat => !allCategories.includes(cat));
                                            
                                            const matchingWlIds = watchlists.filter(w => {
                                              const wMode = w.targetMode || w.section;
                                              if (nextModes.some(modeKey => wMode === modeKey || w.targetMode === modeKey || w.section === modeKey)) return true;
                                              if (nextAutoSyncCats.some(cat => w.section?.toLowerCase().includes(cat.toLowerCase()) || w.title?.toLowerCase().includes(cat.toLowerCase()))) return true;
                                              return false;
                                            }).map(w => w.id);

                                            setQuickChannels(prev => prev.map(item => {
                                              if (item.id !== ch.id) return item;
                                              return {
                                                ...item,
                                                modes: nextModes,
                                                autoSyncCategories: nextAutoSyncCats.length > 0 ? nextAutoSyncCats : undefined,
                                                playlistIds: Array.from(new Set([...(item.playlistIds || []), ...matchingWlIds]))
                                              };
                                            }));
                                            
                                            setExpandedQuickLinkMode(null);
                                          }}
                                          className={`w-full text-right px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                                            isAllSelected ? 'bg-amber-400 text-slate-950' : 'text-white hover:bg-white/10'
                                          }`}
                                        >
                                          <span>الكل</span>
                                          {isAllSelected && <Check className="w-3.5 h-3.5" />}
                                        </button>
                                        
                                        <div className="h-px bg-slate-700 my-1 mx-2"></div>
                                        
                                        {allCategories.filter(c => c !== 'الكل').map(category => {
                                          const isCatSelected = selectedCategories.includes(category);
                                          return (
                                            <button
                                              key={category}
                                              type="button"
                                              onClick={() => {
                                                const nextModes = [...currentModes.filter(x => x !== m.id), m.id as any];
                                                
                                                let nextAutoSyncCats;
                                                if (isCatSelected) {
                                                  nextAutoSyncCats = selectedCategories.filter(c => c !== category);
                                                } else {
                                                  nextAutoSyncCats = [...selectedCategories.filter(c => c !== 'الكل' && !allCategories.includes(c)), category, ...selectedCategories.filter(c => allCategories.includes(c))];
                                                }

                                                // If all specific categories are deselected, we don't automatically select 'الكل' to avoid confusing jumps, but 'hasSpecificCategories' becomes false so 'الكل' will visually be selected if mode is in currentModes.
                                                // Actually, if we deselect the last category, we might want to remove the mode? Let's just leave it, user can click mode button to toggle off.

                                                const matchingWlIds = watchlists.filter(w => {
                                                  const wMode = w.targetMode || w.section;
                                                  // We ONLY match the modes if no specific categories are selected for that mode.
                                                  // BUT wait, nextModes has 'm.id', so it would match EVERYTHING.
                                                  // So we need to only match 'm.id' if nextAutoSyncCats has NO categories from allCategories!
                                                  const hasSpecificForThisMode = nextAutoSyncCats.some(cat => allCategories.includes(cat));
                                                  
                                                  if (nextModes.filter(x => x !== m.id || !hasSpecificForThisMode).some(modeKey => wMode === modeKey || w.targetMode === modeKey || w.section === modeKey)) return true;
                                                  
                                                  if (nextAutoSyncCats.some(cat => w.section?.toLowerCase().includes(cat.toLowerCase()) || w.title?.toLowerCase().includes(cat.toLowerCase()))) return true;
                                                  
                                                  return false;
                                                }).map(w => w.id);

                                                setQuickChannels(prev => prev.map(item => {
                                                  if (item.id !== ch.id) return item;
                                                  return {
                                                    ...item,
                                                    modes: nextModes,
                                                    autoSyncCategories: nextAutoSyncCats.length > 0 ? nextAutoSyncCats : undefined,
                                                    playlistIds: Array.from(new Set([...(item.playlistIds || []), ...matchingWlIds]))
                                                  };
                                                }));
                                              }}
                                              className={`w-full text-right px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                                                isCatSelected ? 'bg-amber-500/20 text-amber-300' : 'text-white/80 hover:bg-white/10'
                                              }`}
                                            >
                                              <span>{category}</span>
                                              {isCatSelected && <Check className="w-3.5 h-3.5" />}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsQuickLinkModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors text-sm cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const finalChannels = autoAssignWatchlistsToChannels(quickChannels, watchlists);
                    onUpdateChannels(finalChannels);
                    setIsQuickLinkModalOpen(false);
                    showAlert('تم إعتماد وحفظ الربط السريع لجميع القنوات والأوضاع بنجاح! ⚡', 'نجاح الربط السريع');
                  }}
                  className="px-7 py-3 rounded-2xl bg-amber-400 text-slate-950 font-black hover:bg-amber-300 transition-all text-sm cursor-pointer shadow-[0_8px_20px_rgba(250,204,21,0.35)] flex items-center gap-2 hover:scale-105 active:scale-95"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>حفظ وإعتماد الربط السريع ⚡</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ChannelsView;
