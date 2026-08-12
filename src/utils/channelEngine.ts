import { Channel, Watchlist } from '../types';

/**
 * Returns a solid background color class for channel cards (no gradients) based on channel identity
 */
export function getChannelSolidBg(channel: { title?: string; category?: string; type?: string; id?: string; modes?: string[] }): string {
  const text = ((channel.title || '') + ' ' + (channel.category || '') + ' ' + (channel.id || '')).toLowerCase();

  // Radio / راديو
  if (/راديو|إذاعة|إذاعه|radio|podcast|بودكاست/.test(text)) {
    return 'bg-amber-900';
  }
  // Kids / أطفالي
  if (/أطفال|اطفال|طفل|kids|baby|cartoon|كرتون|ديزني|براعم|طيور/.test(text)) {
    return 'bg-sky-700';
  }
  // Quran / قرآن
  if (/قرآن|قران|تلاوات|إسلامي|اسلامي|quran|مسجد/.test(text)) {
    return 'bg-emerald-800';
  }
  // Action / أكشن
  if (/أكشن|اكشن|action|مطاردات|إثارة|اثاره|flame/.test(text)) {
    return 'bg-rose-800';
  }
  // Comedy / كوميديا
  if (/كوميديا|ضحك|comedy|سخرية/.test(text)) {
    return 'bg-amber-700';
  }
  // Horror / رعب
  if (/رعب|horror|مرعب|جمجمة/.test(text)) {
    return 'bg-zinc-900';
  }
  // Mystery / غموض
  if (/غموض|mystery|تحقيق|ألغاز/.test(text)) {
    return 'bg-slate-800';
  }
  // Sci-Fi / خيال علمي
  if (/خيال|scifi|sci-fi|فضاء|مستقبل/.test(text)) {
    return 'bg-cyan-800';
  }
  // Family / عائلتي / مسلسلات
  if (/عائلي|عائلتي|family|مسلسلات|دراما|night/.test(text)) {
    return 'bg-indigo-800';
  }
  // Docs / وثائقي
  if (/وثائقي|docs|طبيعة|تاريخ|عالم|علوم/.test(text)) {
    return 'bg-teal-800';
  }
  // Movies / Cinema / سينما / أفلام
  if (/أفلام|افلام|سينما|cinema|movies|film/.test(text)) {
    return 'bg-purple-800';
  }
  // Music / موسيقى
  if (/موسيقى|صوتيات|music|أغاني|اغاني|حفلات/.test(text)) {
    return 'bg-fuchsia-800';
  }
  // Sports / رياضة
  if (/رياضة|رياضية|sport|كرة|كورة/.test(text)) {
    return 'bg-green-800';
  }
  // News / أخبار
  if (/أخبار|اخبار|news|عاجل/.test(text)) {
    return 'bg-blue-800';
  }

  // Fallback solid color palette based on title hash
  const colors = [
    'bg-red-800',
    'bg-amber-800',
    'bg-emerald-800',
    'bg-teal-800',
    'bg-cyan-800',
    'bg-sky-800',
    'bg-blue-800',
    'bg-indigo-800',
    'bg-purple-800',
    'bg-fuchsia-800',
    'bg-rose-800',
    'bg-slate-800'
  ];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Groups single file watchlists into one virtual watchlist called "قائمة الملفات المنفردة"
 */
export function groupSingleFiles(watchlists: Watchlist[]): Watchlist[] {
  const singleFiles = watchlists.filter(w => w.isSingleFile);
  const regular = watchlists.filter(w => !w.isSingleFile);
  
  if (singleFiles.length === 0) return regular;
  
  const allSingleFiles = singleFiles.flatMap(w => {
    if (w.files && w.files.length > 0) return w.files;
    return [{
      name: w.title,
      title: w.title,
      size: '0 MB',
      absolutePath: w.files?.[0]?.absolutePath || w.folderPath,
      coverImage: w.coverImage
    }];
  });

  const combined: Watchlist = {
    id: 'combined_single_files_playlist',
    title: 'قائمة الملفات المنفردة 🎬',
    section: 'عام',
    targetMode: singleFiles[0]?.targetMode || 'family',
    isSingleFile: false,
    seriesCount: 1,
    episodesCount: allSingleFiles.length,
    files: allSingleFiles,
    coverImage: singleFiles.find(w => w.coverImage)?.coverImage || '',
    lastWatched: '',
    progress: 0,
    timeRemaining: '',
    folderName: 'قائمة الملفات المنفردة',
    folderPath: '/قائمة الملفات المنفردة'
  };

  return [...regular, combined];
}

/**
 * Automatically assigns local watchlists to relevant channels if playlistIds is empty
 */
export function autoAssignWatchlistsToChannels(channels: Channel[], rawWatchlists: Watchlist[]): Channel[] {
  const watchlists = groupSingleFiles(rawWatchlists);
  if (!watchlists || watchlists.length === 0) return channels;

  return channels.map(channel => {
    // If autoSync is explicitly disabled for this channel, stick strictly to user manual playlistIds
    if (channel.autoSyncEnabled === false) {
      const validIds = (channel.playlistIds || []).filter(id => watchlists.some(w => w.id === id));
      return { ...channel, playlistIds: validIds };
    }

    // Filter existing playlistIds to preserve valid, mode-compatible watchlists
    const matchedIds: string[] = (channel.playlistIds || []).filter(id => {
      const w = watchlists.find(item => item.id === id);
      if (!w) return false;
      if (channel.modes && channel.modes.length > 0 && w.targetMode) {
        return channel.modes.includes(w.targetMode);
      }
      return true;
    });

    watchlists.forEach(w => {
      const text = (w.title + ' ' + (w.section || '') + ' ' + (w.folderName || '')).toLowerCase();
      const wMode = w.targetMode;

      // STRICT MODE FILTER CHECK:
      // If the channel specifies modes (e.g., ['family', 'night']), a watchlist MUST belong to one of those modes.
      // If the watchlist belongs to a different mode (e.g. 'kids' or 'quran'), skip auto-assigning it.
      if (channel.modes && channel.modes.length > 0 && wMode) {
        if (!channel.modes.includes(wMode)) {
          return; // Skip incompatible mode
        }
      }

      // 1. Check if Watchlist targetMode directly intersects with channel modes
      if (wMode && channel.modes && channel.modes.includes(wMode)) {
        if (channel.id === 'ch_kids' && wMode === 'kids') {
          matchedIds.push(w.id);
          return;
        } else if (channel.id === 'ch_doc' && wMode === 'docs') {
          matchedIds.push(w.id);
          return;
        } else if (channel.id === 'ch_music' && wMode === 'music') {
          matchedIds.push(w.id);
          return;
        } else if (channel.id === 'ch_quran' && wMode === 'quran') {
          matchedIds.push(w.id);
          return;
        }
      }

      // 2. Check autoSyncCategories / category matching
      if (channel.autoSyncCategories && channel.autoSyncCategories.some(cat => 
        w.section?.toLowerCase().includes(cat.toLowerCase()) || text.includes(cat.toLowerCase())
      )) {
        matchedIds.push(w.id);
        return;
      }

      // 3. Built-in smart channel matching rules
      switch (channel.id) {
        case 'ch_kids':
          if (wMode === 'kids' || /طفل|أطفال|اطفال|kids|cartoon|كرتون|ديزني|disney|براعم/i.test(text) || w.section === 'أطفال') {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_syrian':
          if (/سور|شام|باب الحارة|ضيعة ضايعة|الخربة|الزند|الندم|ابتسم|عاصي|زنود|مرايا/i.test(text)) {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_arab':
        case 'ch_drama':
          if (/عرب|خليج|مصر|سعود|سوري|شام|لبنان|مغارب|دراما|مسلسلات/i.test(text) || w.section?.includes('مسلسلات') || wMode === 'family') {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_us':
          if (/امريك|أمريك|US|american|breaking|prison|mentalist|rookie|lost|game of thrones|stranger|office|friends/i.test(text)) {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_turkish':
          if (/ترك|تركيا|ارطغرل|أرطغرل|عثمان|الحفرة|التفاح|قيامة/i.test(text)) {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_korean':
          if (/كوري|korea|kdrama|crash landing|goblin|vincenzo|moving|kingdom/i.test(text)) {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_anime':
          if (/أنمي|انمي|أنيمي|anime|naruto|one piece|attack on titan|conan|spacetoon|سبيستون/i.test(text)) {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_action':
          if (/أكشن|اكشن|action|john wick|fast|mission|fight|thriller|مطار/i.test(text) || w.section === 'أكشن') {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_comedy':
          if (/كوميد|ضحك|comedy|funny|مضحك/i.test(text) || w.section === 'كوميديا') {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_horror':
          if (/رعب|horror|مرعب|جمجمة/i.test(text) || w.section === 'رعب') {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_doc':
          if (wMode === 'docs' || /وثائق|doc|nat geo|ناشونال|طبيعة|تاريخ|علم/i.test(text) || w.section === 'وثائقيات') {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_music':
          if (wMode === 'music' || /أغان|اغان|أغني|اغني|موسيق|حفلة|song|music|audio/i.test(text) || w.section === 'موسيقى') {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_quran':
        case 'ch_radio_quran':
          if (wMode === 'quran' || /قرآن|قران|تلاوة|تلاوات|إسلامي|اسلامي|مسجد|راديو/i.test(text) || w.section === 'قرآن') {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_radio_nasheed':
          if (wMode === 'music' || /أغان|اغان|أغني|اغني|موسيق|نشيد|أناشيد|اناشيد|صوتيات|راديو/i.test(text) || w.section === 'موسيقى') {
            matchedIds.push(w.id);
          }
          break;
        case 'ch_radio_podcasts':
          if (/بودكاست|محاضرة|محاضرات|كتاب صوتي|كتب صوتية|ثقافة|مسموع|راديو/i.test(text)) {
            matchedIds.push(w.id);
          }
          break;
        default:
          // For custom channels, match if section contains category name or targetMode matches
          if (channel.category && w.section && w.section.toLowerCase().includes(channel.category.toLowerCase())) {
            matchedIds.push(w.id);
          }
          break;
      }
    });

    // Fallback: If no matched IDs at all, provide default recommendations STRICTLY from mode-compatible watchlists
    if (matchedIds.length === 0) {
      const modeCompatibleWatchlists = watchlists.filter(w => {
        if (channel.modes && channel.modes.length > 0 && w.targetMode) {
          return channel.modes.includes(w.targetMode);
        }
        return true;
      });

      if (channel.type === 'movies') {
        const movieLists = modeCompatibleWatchlists.filter(w => w.episodesCount <= 3 || w.section === channel.category);
        matchedIds.push(...movieLists.slice(0, 3).map(m => m.id));
      } else {
        const seriesLists = modeCompatibleWatchlists.filter(w => w.episodesCount > 3 || w.seasons);
        matchedIds.push(...seriesLists.slice(0, 3).map(s => s.id));
      }
    }

    return {
      ...channel,
      playlistIds: Array.from(new Set(matchedIds))
    };
  });
}

export interface NowPlayingInfo {
  channelId: string;
  channelTitle: string;
  channelIcon: string;
  badge?: string;
  accentGradient: string;
  currentWatchlistTitle: string;
  currentEpisodeTitle: string;
  currentEpisodeIndex: number;
  totalEpisodes: number;
  currentFile: any;
  allFiles: any[];
  nextWatchlistTitle: string;
  nextEpisodeTitle: string;
  coverImage: string;
  currentWatchlistId: string;
  initialTime: number;
  transitionType?: 'episode' | 'time';
  transitionMinutes?: number;
  transitionEpisodes?: number;
  playbackOrder?: 'sequential' | 'random';
}

/**
 * Computes what is currently broadcasting on a given channel
 */
export function getChannelNowPlaying(
  channel: Channel,
  rawWatchlists: Watchlist[]
): NowPlayingInfo | null {
  const watchlists = groupSingleFiles(rawWatchlists);
  const linkedLists = watchlists.filter(w => channel.playlistIds?.includes(w.id));
  if (linkedLists.length === 0) return null;

  const currentSeriesIdx = channel.currentSeriesIndex || 0;
  let safeListIdx = Math.abs(currentSeriesIdx) % linkedLists.length;

  if (channel.playbackOrder === 'random' && linkedLists.length > 1) {
    // Deterministic random selection based on current series index & channel id
    const pseudoRand = Math.abs((currentSeriesIdx * 31 + channel.id.length * 17) % linkedLists.length);
    safeListIdx = pseudoRand;
  }

  const currentWatchlist = linkedLists[safeListIdx];

  // Get current episode index from watchlist or channel progress
  const progressMap = channel.watchlistProgress || {};
  const savedProg = progressMap[currentWatchlist.id];
  let episodeIndex = savedProg?.lastWatchedIndex ?? currentWatchlist.lastWatchedIndex ?? 0;
  const timeOffset = savedProg?.lastWatchedTime ?? currentWatchlist.lastWatchedTime ?? 0;

  // Flatten files from files + seasons
  let rawFiles = [
    ...(currentWatchlist.files || []),
    ...(currentWatchlist.seasons?.flatMap(s => s.files || []) || [])
  ];

  if (channel.selectedFiles && channel.selectedFiles[currentWatchlist.id] && channel.selectedFiles[currentWatchlist.id].length > 0) {
    const selectedPaths = new Set(channel.selectedFiles[currentWatchlist.id]);
    rawFiles = rawFiles.filter(f => selectedPaths.has(f.absolutePath));
  }

  if (rawFiles.length === 0) return null;

  if (channel.playbackOrder === 'random' && rawFiles.length > 1) {
    episodeIndex = Math.abs((episodeIndex * 13 + currentSeriesIdx) % rawFiles.length);
  }

  const safeEpIndex = Math.min(rawFiles.length - 1, Math.max(0, episodeIndex));
  const currentFile = rawFiles[safeEpIndex];
  const currentEpTitle = currentFile?.name || currentFile?.title || `الحلقة ${safeEpIndex + 1}`;

  // Decorate files with transition parameters for the PlayerView
  const allFiles = rawFiles.map(f => ({
    ...f,
    watchlistName: currentWatchlist.title,
    transitionType: channel.transitionType || 'episode',
    transitionMinutes: channel.transitionMinutes || 30,
    transitionEpisodes: channel.transitionEpisodes || 1,
    playbackOrder: channel.playbackOrder || 'sequential'
  }));

  // Next up calculation (Next series in rotation or next episode)
  let nextWatchlistTitle = currentWatchlist.title;
  let nextEpisodeTitle = `الحلقة ${((safeEpIndex + 1) % allFiles.length) + 1}`;

  if (linkedLists.length > 1) {
    const nextListIdx = (safeListIdx + 1) % linkedLists.length;
    const nextList = linkedLists[nextListIdx];
    const nextProg = progressMap[nextList.id];
    const nextEpIdx = nextProg?.lastWatchedIndex ?? nextList.lastWatchedIndex ?? 0;
    const nextAllFiles = [
      ...(nextList.files || []),
      ...(nextList.seasons?.flatMap(s => s.files || []) || [])
    ];
    const safeNextEpIdx = Math.min(nextAllFiles.length - 1, Math.max(0, nextEpIdx));
    const nextFile = nextAllFiles[safeNextEpIdx];

    nextWatchlistTitle = nextList.title;
    nextEpisodeTitle = nextFile?.name || nextFile?.title || `الحلقة ${safeNextEpIdx + 1}`;
  }

  const coverImage = currentWatchlist.coverImage || currentFile?.coverImage || currentFile?.thumbnail || '';

  return {
    channelId: channel.id,
    channelTitle: channel.title,
    channelIcon: channel.icon,
    badge: channel.badge,
    accentGradient: channel.accentGradient,
    currentWatchlistTitle: currentWatchlist.title,
    currentEpisodeTitle: currentEpTitle,
    currentEpisodeIndex: safeEpIndex,
    totalEpisodes: allFiles.length,
    currentFile,
    allFiles,
    nextWatchlistTitle,
    nextEpisodeTitle,
    coverImage,
    currentWatchlistId: currentWatchlist.id,
    initialTime: timeOffset,
    transitionType: channel.transitionType || 'episode',
    transitionMinutes: channel.transitionMinutes || 30,
    transitionEpisodes: channel.transitionEpisodes || 1,
    playbackOrder: channel.playbackOrder || 'sequential'
  };
}
