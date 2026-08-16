import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, SkipBack, SkipForward, ArrowRight, Volume2, VolumeX, Maximize, Minimize, List, RotateCw, X, Film, Check, Sparkles, CheckCircle2, BookOpen, Music, Star, Globe, Radio, Sliders, PictureInPicture, Sun, Settings, ChevronsLeft, ChevronsRight, Tv, Bell, BellOff } from 'lucide-react';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Mode, Channel, Watchlist, WeeklyScheduleEntry, ModeConfig } from '../types';
import { isTauri, toggleMaximizeWindow } from '../utils/tauri';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { MODES } from '../data';
import { getEpisodeInspiredCover, extractVideoFrameThumbnail, THEMATIC_IMAGES, getFileUrl, getFirstValidThumbnail, generateVideoCardPoster } from '../utils/coverHelper';
import '../utils/mpegts.js';
const getMpegts = () => (window as any).mpegts;
import { EpisodeThumbnail } from '../components/EpisodeThumbnail';
import { getChannelNowPlaying } from '../utils/channelEngine';
import { load } from '@tauri-apps/plugin-store';

const MODE_NAMES: Record<string, string> = {
  kids: 'أطفالي',
  night: 'عائلتي',
  family: 'المسلسلات',
  cinema: 'الأفلام',
  docs: 'الوثائقيات',
  quran: 'القرآن الكريم',
  music: 'الموسيقى'
};

const MODE_GLOW_COLORS: Record<string, { ring: string; shadow: string; bgGradient: string; badge: string; icon: string }> = {
  kids: {
    ring: 'border-yellow-400',
    shadow: 'shadow-[0_0_80px_rgba(250,204,21,0.8)]',
    bgGradient: 'from-yellow-500/40 via-pink-500/30 to-purple-600/40',
    badge: 'bg-yellow-400 text-black',
    icon: '👶'
  },
  cinema: {
    ring: 'border-red-500',
    shadow: 'shadow-[0_0_80px_rgba(239,68,68,0.8)]',
    bgGradient: 'from-red-600/40 via-amber-600/30 to-black',
    badge: 'bg-red-600 text-white',
    icon: '🎬'
  },
  docs: {
    ring: 'border-emerald-400',
    shadow: 'shadow-[0_0_80px_rgba(52,211,153,0.8)]',
    bgGradient: 'from-emerald-500/40 via-teal-600/30 to-black',
    badge: 'bg-emerald-500 text-black',
    icon: '🌍'
  },
  quran: {
    ring: 'border-amber-400',
    shadow: 'shadow-[0_0_80px_rgba(251,191,36,0.8)]',
    bgGradient: 'from-amber-500/40 via-emerald-600/30 to-black',
    badge: 'bg-amber-400 text-black',
    icon: '🕌'
  },
  music: {
    ring: 'border-fuchsia-400',
    shadow: 'shadow-[0_0_80px_rgba(217,70,239,0.8)]',
    bgGradient: 'from-fuchsia-500/40 via-purple-600/30 to-black',
    badge: 'bg-fuchsia-500 text-white',
    icon: '🎵'
  },
  family: {
    ring: 'border-sky-400',
    shadow: 'shadow-[0_0_80px_rgba(56,189,248,0.8)]',
    bgGradient: 'from-sky-500/40 via-indigo-600/30 to-black',
    badge: 'bg-sky-400 text-black',
    icon: '👨‍👩‍👧‍👦'
  }
};

interface PlayerViewProps {
  onExit: () => void;
  onRestoreView?: () => void;
  onPipStateChange?: (active: boolean) => void;
  file?: any;
  title?: string;
  watchlistTitle?: string;
  files?: any[];
  initialIndex?: number;
  initialTime?: number;
  currentMode?: Mode;
  customModes?: Record<Mode, ModeConfig>;
  onProgressUpdate?: (index: number, currentTime?: number) => void;
  channels?: Channel[];
  currentChannelId?: string;
  watchlists?: Watchlist[];
  schedules?: WeeklyScheduleEntry[];
  onPlayChannel?: (channel: Channel) => void;
  isFloating?: boolean;
  onToggleFloating?: (floating: boolean) => void;
  onStopPlayer?: () => void;
}

interface AudioAnimatedBackgroundProps {
  currentMode: Mode;
  customModes?: Record<Mode, ModeConfig>;
  currentTitle: string;
  watchlistTitle: string;
  isPlaying: boolean;
  currentFile: any;
  togglePlay: (e?: React.MouseEvent) => void;
  isCursorHidden?: boolean;
}

const AudioAnimatedBackground: React.FC<AudioAnimatedBackgroundProps> = ({
  currentMode,
  customModes,
  currentTitle,
  watchlistTitle,
  isPlaying,
  currentFile,
  togglePlay,
  isCursorHidden
}) => {
  let coverImage = '';
  if (currentMode === 'quran') {
    const rawCover = currentFile?.coverImage || currentFile?.thumbnail || currentFile?.poster;
    // Use raw cover only if it is a specific user custom image and not a generic video SVG or movie photo
    if (rawCover && !rawCover.startsWith('data:image/svg+xml') && !rawCover.includes('1574375927938') && !rawCover.includes('1594909122845') && !rawCover.includes('1489599849927')) {
      coverImage = rawCover;
    } else {
      const quranCovers = THEMATIC_IMAGES.quran;
      let seed = (currentTitle || '') + (watchlistTitle || '');
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
      }
      coverImage = quranCovers[Math.abs(hash) % quranCovers.length];
    }
  } else {
    const rawCover = currentFile?.coverImage || currentFile?.thumbnail || currentFile?.poster;
    if (rawCover && !rawCover.includes('1574375927938')) {
      coverImage = rawCover;
    } else {
      coverImage = getEpisodeInspiredCover(currentTitle, watchlistTitle, currentFile ? [currentFile] : [], currentMode);
    }
  }

  const modeConfig = customModes?.[currentMode] || MODES[currentMode];
  const modeBgImage = modeConfig?.bgImage;
  const modeBgOpacity = modeConfig?.bgOpacity ?? 45;

  const getModeConfig = () => {
    switch (currentMode) {
      case 'quran':
        return {
          bgGradient: 'from-emerald-950/90 via-teal-950/80 to-slate-950',
          accentGradient: 'from-amber-400 via-yellow-300 to-emerald-400',
          glowColor: 'rgba(251, 191, 36, 0.25)',
          badgeText: 'القرآن الكريم والتلاوات المباركة',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
          icon: BookOpen,
          barsColor: 'bg-gradient-to-t from-amber-500 to-yellow-300',
          centerRingColor: 'border-amber-400/50',
        };
      case 'music':
        return {
          bgGradient: 'from-violet-950/90 via-purple-950/80 to-fuchsia-950',
          accentGradient: 'from-fuchsia-400 via-pink-400 to-cyan-400',
          glowColor: 'rgba(217, 70, 239, 0.3)',
          badgeText: 'استماع موسيقي وصوتي',
          badgeBg: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/40',
          icon: Music,
          barsColor: 'bg-gradient-to-t from-fuchsia-500 via-purple-400 to-cyan-300',
          centerRingColor: 'border-fuchsia-400/60',
        };
      case 'kids':
        return {
          bgGradient: 'from-amber-950/90 via-purple-950/80 to-pink-950',
          accentGradient: 'from-yellow-300 via-pink-400 to-sky-300',
          glowColor: 'rgba(250, 204, 21, 0.3)',
          badgeText: 'عالم الأطفال والمرح',
          badgeBg: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40',
          icon: Star,
          barsColor: 'bg-gradient-to-t from-yellow-400 via-pink-400 to-sky-400',
          centerRingColor: 'border-yellow-400/60',
        };
      case 'cinema':
        return {
          bgGradient: 'from-red-950/90 via-zinc-950 to-black',
          accentGradient: 'from-red-500 via-amber-400 to-red-600',
          glowColor: 'rgba(239, 68, 68, 0.25)',
          badgeText: 'أوديو سينمائي',
          badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
          icon: Film,
          barsColor: 'bg-gradient-to-t from-red-600 via-amber-500 to-yellow-400',
          centerRingColor: 'border-red-500/50',
        };
      case 'docs':
        return {
          bgGradient: 'from-teal-950/90 via-cyan-950/80 to-slate-950',
          accentGradient: 'from-emerald-400 via-cyan-300 to-teal-200',
          glowColor: 'rgba(52, 211, 153, 0.25)',
          badgeText: 'وثائقي ومعرفة',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
          icon: Globe,
          barsColor: 'bg-gradient-to-t from-emerald-500 via-teal-400 to-cyan-300',
          centerRingColor: 'border-teal-400/50',
        };
      default: // family
        return {
          bgGradient: 'from-slate-950/90 via-indigo-950/80 to-purple-950',
          accentGradient: 'from-indigo-300 via-sky-300 to-purple-300',
          glowColor: 'rgba(99, 102, 241, 0.25)',
          badgeText: 'مشغل الصوتيات العائلي',
          badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40',
          icon: Radio,
          barsColor: 'bg-gradient-to-t from-indigo-500 via-sky-400 to-purple-300',
          centerRingColor: 'border-indigo-400/50',
        };
    }
  };

  const config = getModeConfig();
  const ModeIcon = config.icon;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-black select-none">
      {/* Mode Background Image */}
      {modeBgImage ? (
        <div className="absolute inset-0 pointer-events-none z-0">
          <img 
            src={modeBgImage} 
            alt={`${modeConfig?.title || currentMode} background`} 
            className="w-full h-full object-cover transition-all duration-700"
            style={{ opacity: Math.max(0.25, (modeBgOpacity ?? 45) / 100) }}
          />
          <div className={`absolute inset-0 bg-gradient-to-b ${config.bgGradient} opacity-85`} />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        </div>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-b ${config.bgGradient}`} />
      )}

      {/* Background Animated Particles & Aura Spheres */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        <motion.div 
          animate={{
            scale: isPlaying ? [1, 1.25, 1] : 1,
            opacity: isPlaying ? [0.35, 0.65, 0.35] : 0.3,
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[700px] h-[500px] sm:h-[700px] rounded-full blur-[100px] pointer-events-none"
          style={{ backgroundColor: config.glowColor }}
        />

        <motion.div 
          animate={{
            scale: isPlaying ? [1.2, 1, 1.2] : 1.1,
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-20 -right-20 w-96 h-96 rounded-full blur-[120px] bg-white/10 pointer-events-none"
        />

        {[...Array(14)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: (i % 5) * 150 - 300, 
              y: (i % 3) * 200 - 200,
              opacity: 0.2 + (i % 4) * 0.15,
              scale: 0.5 + (i % 3) * 0.3
            }}
            animate={isPlaying ? {
              y: [0, -70, 0],
              x: [0, Math.sin(i) * 35, 0],
              opacity: [0.3, 0.85, 0.3],
            } : {}}
            transition={{
              duration: 3 + (i % 4),
              repeat: Infinity,
              delay: i * 0.25,
              ease: "easeInOut"
            }}
            className="absolute top-1/2 left-1/2 rounded-full pointer-events-none"
            style={{
              width: i % 3 === 0 ? '10px' : '6px',
              height: i % 3 === 0 ? '10px' : '6px',
              backgroundColor: i % 2 === 0 ? '#ffffff' : '#fcd34d',
              boxShadow: '0 0 10px rgba(255,255,255,0.8)'
            }}
          />
        ))}
      </div>

      {/* Album Cover / Vinyl Record Disc Art */}
      <div className="relative z-20 flex flex-col items-center mb-3">
        <motion.div 
          animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
          transition={isPlaying ? { duration: 22, repeat: Infinity, ease: "linear" } : { duration: 0.5 }}
          onClick={togglePlay}
          className={`relative w-32 h-32 sm:w-44 sm:h-44 rounded-full border-4 ${config.centerRingColor} shadow-2xl overflow-hidden cursor-pointer group flex items-center justify-center bg-black/60 backdrop-blur-md`}
        >
          <img 
            src={coverImage} 
            alt={currentTitle} 
            className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" 
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            {!isPlaying && (
              <div className="p-3 sm:p-4 bg-white/90 text-black rounded-full shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-black translate-x-[2px]" />
              </div>
            )}
          </div>
          {/* Vinyl Center Hole */}
          <div className="absolute w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-zinc-950 border-2 border-amber-400/80 shadow-inner flex items-center justify-center pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
        </motion.div>
      </div>

      {/* Mode Badge & Title Header */}
      <div className="relative z-20 flex flex-col items-center mb-4 px-4 text-center">
        <div className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border backdrop-blur-md flex items-center gap-2 mb-2 shadow-lg ${config.badgeBg}`}>
          <ModeIcon className="w-4 h-4" />
          <span>{modeConfig?.title || config.badgeText}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white drop-shadow-xl max-w-2xl line-clamp-1">
          {currentTitle}
        </h2>
        <p className="text-sm sm:text-base text-white/80 mt-1 font-medium drop-shadow-md">
          {watchlistTitle}
        </p>
      </div>

      {/* Dynamic Audio Equalizer Wave Spectrum */}
      <div className="relative z-20 flex items-end justify-center gap-1.5 sm:gap-2 mt-2 h-12 px-6 py-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
        {[18, 34, 22, 45, 28, 52, 38, 20, 42, 58, 30, 48, 24, 36, 50, 26, 40, 18].map((height, idx) => (
          <motion.div
            key={idx}
            animate={isPlaying ? {
              height: [8, height, 12, height * 0.8, 8]
            } : {
              height: 6
            }}
            transition={{
              duration: 0.8 + (idx % 4) * 0.2,
              repeat: Infinity,
              delay: idx * 0.05,
              ease: "easeInOut"
            }}
            className={`w-1.5 sm:w-2 rounded-full ${config.barsColor} shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
          />
        ))}
      </div>

      <div className="relative z-20 mt-3 text-xs sm:text-sm text-white/80 font-semibold flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-400 animate-ping' : 'bg-amber-400'}`} />
        <span>{isPlaying ? 'جاري تشغيل المقطع الصوتي...' : 'المشغل متوقف مؤقتاً'}</span>
      </div>
    </div>
  );
};

export const PlayerView: React.FC<PlayerViewProps> = ({ 
  onExit, 
  onRestoreView,
  onPipStateChange,
  file, 
  title = "الحلقة 1", 
  watchlistTitle = "قائمة التشغيل",
  files = [],
  initialIndex = 0,
  initialTime = 0,
  currentMode = 'family',
  customModes,
  onProgressUpdate,
  channels = [],
  currentChannelId,
  watchlists = [],
  schedules = [],
  onPlayChannel,
  isFloating = false,
  onToggleFloating,
  onStopPlayer
}) => {
  const [isFloatingLocal, setIsFloatingLocal] = useState<boolean>(false);
  const isFloatingMode = isFloating || isFloatingLocal;
  // Do Not Disturb (Cinema Mode) Toggle State
  const [isDndActive, setIsDndActive] = useState<boolean>(() => {
    return localStorage.getItem('app_dnd_enabled') === 'true';
  });

  const toggleDnd = () => {
    const nextState = !isDndActive;
    setIsDndActive(nextState);
    localStorage.setItem('app_dnd_enabled', nextState ? 'true' : 'false');
  };

  // Up Next Schedule Ticker Calculation
  const upcomingSchedule = useMemo(() => {
    if (!schedules || schedules.length === 0) return null;
    const today = new Date().getDay();
    const nowH = new Date().getHours();
    const nowM = new Date().getMinutes();
    const nowMins = nowH * 60 + nowM;

    const todaySlots = schedules.filter(s => s.dayOfWeek === today);
    if (todaySlots.length === 0) return null;

    const sorted = [...todaySlots].sort((a, b) => a.time.localeCompare(b.time));
    const nextSlot = sorted.find(s => {
      const [h, m] = s.time.split(':').map(Number);
      return h * 60 + m >= nowMins;
    });

    return nextSlot || sorted[0] || null;
  }, [schedules]);
  const handleNextChannel = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!channels || channels.length === 0) return;
    const currIdx = channels.findIndex(c => c.id === currentChannelId);
    let attempts = 0;
    let nextIdx = currIdx === -1 ? 0 : (currIdx + 1) % channels.length;
    
    while (attempts < channels.length) {
      const targetChan = channels[nextIdx];
      const np = getChannelNowPlaying(targetChan, watchlists);
      if (np) {
        if (onPlayChannel) onPlayChannel(targetChan);
        return;
      }
      nextIdx = (nextIdx + 1) % channels.length;
      attempts++;
    }
  };

  const handlePrevChannel = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!channels || channels.length === 0) return;
    const currIdx = channels.findIndex(c => c.id === currentChannelId);
    let attempts = 0;
    let prevIdx = currIdx <= 0 ? channels.length - 1 : currIdx - 1;
    
    while (attempts < channels.length) {
      const targetChan = channels[prevIdx];
      const np = getChannelNowPlaying(targetChan, watchlists);
      if (np) {
        if (onPlayChannel) onPlayChannel(targetChan);
        return;
      }
      prevIdx = prevIdx <= 0 ? channels.length - 1 : prevIdx - 1;
      attempts++;
    }
  };

const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const titleBarTouchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hasUsedFallback, setHasUsedFallback] = useState<boolean>(false);
  const [isAudio, setIsAudio] = useState(false);

  const SAMPLE_VIDEOS = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
  ];

  const SAMPLE_AUDIOS = [
    'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg',
    'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg',
    'https://actions.google.com/sounds/v1/science_fiction/deep_sub_bass.ogg'
  ];

  // Transition Bumper Card State
  const [showTransitionBumper, setShowTransitionBumper] = useState(false);
  const [bumperCountdown, setBumperCountdown] = useState(10);
  const [nextEpisodeInfo, setNextEpisodeInfo] = useState<{ index: number; title: string; watchlistName?: string; coverImage?: string } | null>(null);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Slot Duration & Episodes Management for Super Sessions
  const slotAccumulatedRef = useRef<number>(0);
  const slotEpisodesPlayedRef = useRef<number>(0);
  const [slotElapsedSec, setSlotElapsedSec] = useState<number>(0);
  const prevIndexRef = useRef<number>(initialIndex);

  // Web Audio API Equalizer & Volume Booster state & refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  // mpegts FLV Player Instance
  const mpegtsPlayerRef = useRef<any>(null);

  const [volumeBoost, setVolumeBoost] = useState<number>(1.5); // Default 150% volume boost for low audio
  const [eqGains, setEqGains] = useState<number[]>([4, 2, 0, 3, 5]); // Default enhanced equalizer profile
  const [activeEqPreset, setActiveEqPreset] = useState<string>('boost');

  // Moved from bottom to prevent TDZ
  const [volume, setVolume] = useState(() => {
    const savedVol = localStorage.getItem('shashaty_player_volume');
    return savedVol !== null ? parseFloat(savedVol) : 1;
  });
  
  useEffect(() => {
    localStorage.setItem('shashaty_player_volume', volume.toString());
  }, [volume]);
  
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPipActive, setIsPipActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const initialTimeOnTouch = useRef<number>(0);
  const [seekFeedback, setSeekFeedback] = useState<string | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState("00:00");
  const [durationStr, setDurationStr] = useState("00:00");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [activeSettingWidget, setActiveSettingWidget] = useState<'colors' | 'aspect' | null>(null);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [hue, setHue] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<'auto' | '4:3' | '5:4' | '16:9' | 'cover' | 'fill'>(() => {
    const saved = localStorage.getItem('shashaty_aspect_ratio');
    return (saved as any) || 'auto';
  });

  // Persist aspectRatio
  useEffect(() => {
    localStorage.setItem('shashaty_aspect_ratio', aspectRatio);
  }, [aspectRatio]);

  // Broadcast TV State to Remote App
  useEffect(() => {
    const broadcastState = async () => {
      const state = {
        isConnected: true,
        ip: '', 
        port: 8080,
        currentMode: currentMode,
        isPlaying: isPlaying,
        currentTime: videoRef.current ? Math.floor(videoRef.current.currentTime) : 0,
        duration: videoRef.current ? Math.floor(videoRef.current.duration) : 0,
        title: title || (file ? file.name : ''),
        subtitle: watchlistTitle || MODE_NAMES[currentMode || 'family'],
        thumbnail: (() => {
          let thumb = file?.thumbnail || file?.coverImage || file?.poster || '';
          // Mobile remote cannot load Tauri asset:// or blob: URLs or absolute paths
          if (thumb.includes('asset://') || thumb.startsWith('blob:') || thumb.match(/^[a-zA-Z]:\\/)) {
            return generateVideoCardPoster(title || (file ? file.name : ''));
          }
          return thumb || generateVideoCardPoster(title || (file ? file.name : ''));
        })(),
        streamUrl: videoUrl || '',
        nextTitle: nextEpisodeInfo?.title || '',
        playlistName: watchlistTitle || 'قائمة التشغيل',
        volume: Math.round(volume * 100),
        isMuted: isMuted,
        volumeBoost: false,
        playbackRate: videoRef.current ? videoRef.current.playbackRate : 1.0,
        aspectRatio: aspectRatio,
        isFullscreen: isFullscreen,
        isPip: isPipActive,
        sleepTimerMinutes: null,
        isParentLocked: false,
        lastAction: null,
        lastActionTimestamp: Date.now(),
      };
      
      try {
        await invoke('broadcast_tv_state', { state });
      } catch (e) {
        console.error('Failed to broadcast TV state', e);
      }
    };

    broadcastState();
  }, [
    isPlaying, volume, isMuted, currentMode, 
    title, file, watchlistTitle, 
    aspectRatio, isFullscreen, isPipActive,
    videoUrl, nextEpisodeInfo
  ]);

  // Screen Mirroring Streamer (AnyDesk style)
  useEffect(() => {
    let animationFrameId: number;
    let lastBroadcast = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fps = 15;
    const intervalMs = 1000 / fps;

    const captureAndSend = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(captureAndSend);

      if (timestamp - lastBroadcast < intervalMs) return;
      
      const video = videoRef.current;
      if (!video || !isPlaying || video.videoWidth === 0) return;
      
      // Scale down for performance (max 640px wide)
      const maxDim = 640;
      let width = video.videoWidth;
      let height = video.videoHeight;
      if (width > maxDim) {
        height = Math.floor(height * (maxDim / width));
        width = maxDim;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      if (ctx) {
        // Draw the current video frame
        ctx.drawImage(video, 0, 0, width, height);
        // Compress as JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        // Broadcast via Tauri backend to all WebSockets
        invoke('broadcast_frame', { frameData: dataUrl }).catch(() => {});
      }
      
      lastBroadcast = timestamp;
    };

    // Only stream if video is playing and remotes are connected
    if (isPlaying) {
      animationFrameId = requestAnimationFrame(captureAndSend);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  const EQ_FREQUENCIES = [60, 230, 910, 4000, 14000];
  const EQ_LABELS = ['60Hz (جهير)', '230Hz', '910Hz (وسط)', '4kHz', '14kHz (حين)'];

  const EQ_PRESETS: Record<string, { name: string; gains: number[] }> = {
    boost: { name: 'مضخم الصوت 🔊', gains: [8, 5, 2, 4, 6] },
    quran: { name: 'القرآن والصوت النقائي 📖', gains: [-2, 2, 6, 8, 4] },
    cinema: { name: 'السينما الأفلام 🎬', gains: [6, 4, 0, 3, 5] },
    music: { name: 'الموسيقى والأغاني 🎵', gains: [5, 3, -1, 4, 6] },
    flat: { name: 'متوازن ⚖️', gains: [0, 0, 0, 0, 0] },
  };

  const setupAudioNodes = () => {
    if (!videoRef.current) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaElementSource(videoRef.current);
        sourceNodeRef.current = source;

        const gainNode = ctx.createGain();
        gainNode.gain.value = volumeBoost * volume;
        gainNodeRef.current = gainNode;

        const filters = EQ_FREQUENCIES.map((freq, idx) => {
          const filter = ctx.createBiquadFilter();
          if (idx === 0) filter.type = 'lowshelf';
          else if (idx === EQ_FREQUENCIES.length - 1) filter.type = 'highshelf';
          else filter.type = 'peaking';
          filter.frequency.value = freq;
          filter.gain.value = eqGains[idx] || 0;
          return filter;
        });
        filtersRef.current = filters;

        let current: AudioNode = source;
        filters.forEach((filter) => {
          current.connect(filter);
          current = filter;
        });
        current.connect(gainNode);
        gainNode.connect(ctx.destination);
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch (err) {
      console.warn('AudioContext setup note:', err);
    }
  };

  const updateEqGain = (index: number, value: number) => {
    const nextGains = [...eqGains];
    nextGains[index] = value;
    setEqGains(nextGains);
    setActiveEqPreset('custom');
    if (filtersRef.current[index]) {
      filtersRef.current[index].gain.value = value;
    }
  };

  const applyEqPreset = (presetKey: string) => {
    const preset = EQ_PRESETS[presetKey];
    if (!preset) return;
    setActiveEqPreset(presetKey);
    setEqGains([...preset.gains]);
    preset.gains.forEach((g, idx) => {
      if (filtersRef.current[idx]) {
        filtersRef.current[idx].gain.value = g;
      }
    });
  };

  const updateVolumeBoostValue = (boostVal: number) => {
    setVolumeBoost(boostVal);
    if (!audioCtxRef.current) {
      setupAudioNodes();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = boostVal * volume;
    }
  };

  const currentItem = files && files[currentIndex];
  const activeMode: Mode = currentItem && currentItem.mode ? currentItem.mode : currentMode;

  // Mode Transition Visual Effects State
  const [modeTransitionBanner, setModeTransitionBanner] = useState<{ mode: Mode; modeName: string } | null>(null);
  const [showModeGlow, setShowModeGlow] = useState(false);
  const prevModeRef = useRef<Mode | null>(null);

  useEffect(() => {
    if (prevModeRef.current !== null && prevModeRef.current !== activeMode) {
      // Trigger visual transition effect when switching modes
      setModeTransitionBanner({
        mode: activeMode,
        modeName: MODE_NAMES[activeMode] || activeMode
      });
      setShowModeGlow(true);

      const glowTimer = setTimeout(() => {
        setShowModeGlow(false);
      }, 3000);

      const bannerTimer = setTimeout(() => {
        setModeTransitionBanner(null);
      }, 4500);

      return () => {
        clearTimeout(glowTimer);
        clearTimeout(bannerTimer);
      };
    }
    prevModeRef.current = activeMode;
  }, [activeMode]);

  useEffect(() => {
    const prevItem = files && files[prevIndexRef.current];
    const currItem = files && files[currentIndex];
    
    // Reset slot accumulated time when moving to a different slot
    if (currItem && prevItem && (currItem.slotId !== prevItem.slotId || currItem.slotIndex !== prevItem.slotIndex)) {
      slotAccumulatedRef.current = 0;
      setSlotElapsedSec(0);
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex, files]);
  const [currentFile, setCurrentFile] = useState(() => {
    if (file) return file;
    if (files && files[initialIndex]) {
      const item = files[initialIndex];
      return item.file || item.originalFile || item.rawFile || item;
    }
    return null;
  });
  const [currentTitle, setCurrentTitle] = useState(title);
  const [initialSeekDone, setInitialSeekDone] = useState(false);

  // Sync internal state when incoming props change (e.g. channel switch, episode change)
  useEffect(() => {
    setCurrentIndex(initialIndex);
    const resolvedFile = file || (files && files[initialIndex] ? (files[initialIndex].file || files[initialIndex].originalFile || files[initialIndex].rawFile || files[initialIndex]) : null);
    setCurrentFile(resolvedFile);
    setCurrentTitle(title);
    setInitialSeekDone(false);
  }, [file, files, initialIndex, title, watchlistTitle, currentChannelId]);
  const [playStateFeedback, setPlayStateFeedback] = useState<'play' | 'pause' | null>(null);
  const lastReportedTimeRef = useRef<number>(0);

  // Audio track detection effect based on file type, extension, title or selected mode
  useEffect(() => {
    let target = currentFile;
    if (!target && files && files[currentIndex]) {
      const item = files[currentIndex];
      target = item.file || item.originalFile || item.rawFile || item;
    }
    
    const checkIsAudio = () => {
      if (target && typeof target === 'object') {
        if (target.type?.startsWith('audio/')) return true;
        if (target.name?.match(/\.(mp3|m4a|wav|flac|aac|ogg|wma)$/i)) return true;
        if (target.originalFile?.type?.startsWith('audio/')) return true;
        if (target.originalFile?.name?.match(/\.(mp3|m4a|wav|flac|aac|ogg|wma)$/i)) return true;
      }
      if (typeof target === 'string' && target.match(/\.(mp3|m4a|wav|flac|aac|ogg|wma)($|\?)/i)) return true;
      if (currentTitle?.match(/\.(mp3|m4a|wav|flac|aac|ogg|wma)$/i)) return true;
      
      if (currentMode === 'quran' || currentMode === 'music') {
        const isExplicitVideo = (target?.name || currentTitle || '').match(/\.(mp4|mkv|webm|avi|mov)$/i);
        if (!isExplicitVideo) return true;
      }

      return false;
    };

    setIsAudio(checkIsAudio());
  }, [currentFile, currentIndex, currentTitle, currentMode, videoUrl]);

  const onProgressUpdateRef = useRef(onProgressUpdate);
  useEffect(() => {
    onProgressUpdateRef.current = onProgressUpdate;
  }, [onProgressUpdate]);

  useEffect(() => {
    return () => {
      if (videoRef.current && onProgressUpdateRef.current) {
        onProgressUpdateRef.current(currentIndex, videoRef.current.currentTime);
      }
    };
  }, [currentIndex]);
  
  const [rotation, setRotation] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState(false);
  const [showChannelsDrawer, setShowChannelsDrawer] = useState(false);
  const [showScheduleEndOverlay, setShowScheduleEndOverlay] = useState(false);
  const [scheduleRecommendations, setScheduleRecommendations] = useState<Array<{
    id: string;
    title: string;
    category: string;
    details: string;
    coverImage: string;
    onSelect: () => void;
  }>>([]);

  const prepareAndShowRecommendations = () => {
    const currItem = files && files[currentIndex];
    
    // Detect active slot/item category mode
    let activeCategory: 'series' | 'movies' | 'quran' | 'kids' | 'docs' | 'music' | 'other' = 'other';
    
    const itemSection = (currItem?.section || currItem?.category || '').toLowerCase();
    const itemMode = (currItem?.mode || currentMode || '').toLowerCase();
    const wlName = (currItem?.watchlistName || watchlistTitle || '').toLowerCase();
    const itemTitle = (currItem?.title || currItem?.name || '').toLowerCase();

    if (
      itemSection.includes('series') || itemSection.includes('مسلسل') || 
      wlName.includes('مسلسل') || itemTitle.includes('حلقة') || 
      itemMode === 'family' || itemSection.includes('برامج')
    ) {
      activeCategory = 'series';
    } else if (
      itemSection.includes('movie') || itemSection.includes('فيلم') || itemSection.includes('أفلام') || 
      wlName.includes('فيلم') || wlName.includes('أفلام') || wlName.includes('سينما') ||
      itemMode === 'cinema'
    ) {
      activeCategory = 'movies';
    } else if (itemSection.includes('quran') || itemSection.includes('قرآن') || itemMode === 'quran') {
      activeCategory = 'quran';
    } else if (itemSection.includes('kids') || itemSection.includes('أطفال') || itemMode === 'kids') {
      activeCategory = 'kids';
    } else if (itemSection.includes('docs') || itemSection.includes('وثائقي') || itemMode === 'docs') {
      activeCategory = 'docs';
    } else if (itemSection.includes('music') || itemSection.includes('موسيقى') || itemMode === 'music') {
      activeCategory = 'music';
    } else {
      if (wlName.includes('فيلم') || wlName.includes('أفلام')) activeCategory = 'movies';
      else if (wlName.includes('مسلسل')) activeCategory = 'series';
    }

    const categoryLabels: Record<string, string> = {
      series: 'مسلسلات وبرامج 🎬',
      movies: 'أفلام وسينما 🎥',
      quran: 'القرآن الكريم 📖',
      kids: 'عالم الأطفال 👶',
      docs: 'أفلام وثائقية 🌍',
      music: 'استماع صوتي 🎵',
      other: 'مقترحات مخصصة 📺'
    };

    const candidateFiles: Array<{
      id: string;
      title: string;
      category: string;
      details: string;
      coverImage: string;
      categoryType: string;
      onSelect: () => void;
    }> = [];

    // Play a specific file directly
    const playFileDirectly = (fileToPlay: any, titleStr: string, parentWlTitle: string) => {
      setShowScheduleEndOverlay(false);
      setCurrentFile(fileToPlay.file || fileToPlay.originalFile || fileToPlay.rawFile || fileToPlay);
      setCurrentTitle(titleStr);
      setInitialSeekDone(false);
      lastReportedTimeRef.current = 0;
      if (onProgressUpdate) onProgressUpdate(0, 0);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    };

    // 1. Gather individual files from current queue first (excluding current index)
    if (files && files.length > 0) {
      files.forEach((f, idx) => {
        if (idx !== currentIndex) {
          const title = f.title || f.name?.replace(/\.[^/.]+$/, "") || `المقطع ${idx + 1}`;
          const fSection = (f.section || f.category || '').toLowerCase();
          const fWlName = (f.watchlistName || watchlistTitle || '').toLowerCase();
          
          let fType = 'other';
          if (fSection.includes('series') || fSection.includes('مسلسل') || fWlName.includes('مسلسل') || title.includes('حلقة')) fType = 'series';
          else if (fSection.includes('movie') || fSection.includes('فيلم') || fSection.includes('أفلام') || fWlName.includes('فيلم') || fWlName.includes('أفلام')) fType = 'movies';
          else if (fSection.includes('quran') || fSection.includes('قرآن')) fType = 'quran';
          else if (fSection.includes('kids') || fSection.includes('أطفال')) fType = 'kids';

          candidateFiles.push({
            id: `current-file-${idx}`,
            title: title,
            category: categoryLabels[fType] || categoryLabels[activeCategory],
            details: `ملف من: ${f.watchlistName || watchlistTitle || 'قائمة المشاهدة'}`,
            coverImage: f.coverImage || f.thumbnail || f.poster || getEpisodeInspiredCover(title, watchlistTitle, [f]),
            categoryType: fType,
            onSelect: () => {
              setShowScheduleEndOverlay(false);
              playItemAtIndex(idx);
            }
          });
        }
      });
    }

    // 2. Gather individual files from ALL watchlists
    if (watchlists && watchlists.length > 0) {
      watchlists.forEach((wl) => {
        const wlSection = (wl.section || wl.category || '').toLowerCase();
        const wlTitleLower = (wl.title || '').toLowerCase();
        
        let wlType = 'other';
        if (wlSection.includes('series') || wlSection.includes('مسلسل') || wlTitleLower.includes('مسلسل')) wlType = 'series';
        else if (wlSection.includes('movie') || wlSection.includes('فيلم') || wlSection.includes('أفلام') || wlTitleLower.includes('فيلم') || wlTitleLower.includes('أفلام') || wl.targetMode === 'cinema') wlType = 'movies';
        else if (wlSection.includes('quran') || wlSection.includes('قرآن') || wl.targetMode === 'quran') wlType = 'quran';
        else if (wlSection.includes('kids') || wlSection.includes('أطفال') || wl.targetMode === 'kids') wlType = 'kids';
        else if (wlSection.includes('docs') || wlSection.includes('وثائقي') || wl.targetMode === 'docs') wlType = 'docs';

        const wlFiles = wl.files || [];
        wlFiles.forEach((f: any, fIdx: number) => {
          const fTitle = f.title || f.name?.replace(/\.[^/.]+$/, "") || `${wl.title} - مقطع ${fIdx + 1}`;
          if (!candidateFiles.some(c => c.title === fTitle)) {
            candidateFiles.push({
              id: `wl-file-${wl.id}-${fIdx}`,
              title: fTitle,
              category: categoryLabels[wlType] || categoryLabels[activeCategory],
              details: `ملف من قائمة: ${wl.title}`,
              coverImage: f.coverImage || f.thumbnail || f.poster || wl.coverImage || getEpisodeInspiredCover(fTitle, wl.title, [f]),
              categoryType: wlType,
              onSelect: () => {
                playFileDirectly(f, fTitle, wl.title);
              }
            });
          }
        });
      });
    }

    // Filter candidate files matching activeCategory
    let matchedList = candidateFiles.filter(c => c.categoryType === activeCategory);
    
    if (matchedList.length < 3) {
      const remainingCandidates = candidateFiles.filter(c => !matchedList.includes(c));
      matchedList = [...matchedList, ...remainingCandidates];
    }

    // Category-specific fallbacks if fewer than 3 files found
    const modeFallbacks: Record<string, Array<{ title: string; category: string; details: string; cover: string }>> = {
      series: [
        {
          title: 'الحلقة التالية من مسلسل السهرة',
          category: 'مسلسلات وبرامج 🎬',
          details: 'متابعة المشاهدة • الحلقة التالية من الموسم الدرامي',
          cover: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=800&q=80'
        },
        {
          title: 'حلقة جديدة - دراما التشويق والغموض',
          category: 'مسلسلات وبرامج 🎬',
          details: 'عرض الدراما العائلية المشوقة عالية الجودة',
          cover: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=800&q=80'
        },
        {
          title: 'عرض تلفزيوني مميز - الحلقة القادمة',
          category: 'مسلسلات وبرامج 🎬',
          details: 'مقطع حماسي جديد جاهز للعرض مباشرة',
          cover: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80'
        }
      ],
      movies: [
        {
          title: 'فيلم سهرة خاص - سينما HD',
          category: 'أفلام وسينما 🎥',
          details: 'فيلم سينمائي طويل مميز • إثارة وتألق',
          cover: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80'
        },
        {
          title: 'فيلم الحركة والتشويق الرائع',
          category: 'أفلام وسينما 🎥',
          details: 'سينما السهرة المنزلية • تجربة مشاهدة فريدة',
          cover: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80'
        },
        {
          title: 'فيلم سينمائي نال إعجاب الجماهير',
          category: 'أفلام وسينما 🎥',
          details: 'عرض سينمائي متكامل بجودة عالية',
          cover: 'https://images.unsplash.com/photo-1518676599625-583284d511fe?auto=format&fit=crop&w=800&q=80'
        }
      ],
      quran: [
        {
          title: 'تلاوة خاشعة مباركة من المصحف',
          category: 'النمط القرآني 📖',
          details: 'سورة مباركة بتلاوة خاشعة ومريحة للأعصاب',
          cover: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&w=800&q=80'
        },
        {
          title: 'تلاوات هادئة لأجمل القراء',
          category: 'النمط القرآني 📖',
          details: 'استماع مباشر لآيات الذكر الحكيم',
          cover: 'https://images.unsplash.com/photo-1584286595398-a59f21d313f5?auto=format&fit=crop&w=800&q=80'
        },
        {
          title: 'ختمة قرآنية بصوت القارئ المميز',
          category: 'النمط القرآني 📖',
          details: 'تلاوات خاشعة تناسب أجواء السكينة',
          cover: 'https://images.unsplash.com/photo-1542816417-0983cbe82752?auto=format&fit=crop&w=800&q=80'
        }
      ],
      kids: [
        {
          title: 'حلقة ممتعة ومغامرة للأطفال',
          category: 'عالم الأطفال 👶',
          details: 'محتوى تعليمي وترفيهي آمن للعائلة',
          cover: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=800&q=80'
        },
        {
          title: 'برنامج الأطفال العائلي المميز',
          category: 'عالم الأطفال 👶',
          details: 'أغاني وأنشطة تفاعلية ومرح دائم',
          cover: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=800&q=80'
        },
        {
          title: 'رسوم متحركة ومغامرات جديدة',
          category: 'عالم الأطفال 👶',
          details: 'حلقة جديدة مليئة بالألوان والبهجة',
          cover: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80'
        }
      ],
      other: [
        {
          title: 'مقطع فيديو مميز للسهرة',
          category: 'عرض تلفزيوني 📺',
          details: 'محتوى تلفزيوني مخصص جاهز للمشاهدة',
          cover: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=800&q=80'
        },
        {
          title: 'عرض القناة الرئيسي القادم',
          category: 'عرض تلفزيوني 📺',
          details: 'متابعة البث مباشرة بجودة ممتازة',
          cover: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80'
        },
        {
          title: 'مقطع فيديو ترفيهي جديد',
          category: 'عرض تلفزيوني 📺',
          details: 'تجربة مشاهدة سلسة دون انقطاع',
          cover: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80'
        }
      ]
    };

    const currentFallbacks = modeFallbacks[activeCategory] || modeFallbacks.other;

    const finalList: Array<{
      id: string;
      title: string;
      category: string;
      details: string;
      coverImage: string;
      onSelect: () => void;
    }> = [];

    matchedList.slice(0, 3).forEach((item, idx) => {
      finalList.push({
        id: item.id || `rec-${idx}`,
        title: item.title,
        category: item.category,
        details: item.details,
        coverImage: item.coverImage,
        onSelect: item.onSelect
      });
    });

    let fbIdx = 0;
    while (finalList.length < 3) {
      const fb = currentFallbacks[fbIdx % currentFallbacks.length];
      finalList.push({
        id: `fb-${activeCategory}-${fbIdx}`,
        title: fb.title,
        category: fb.category,
        details: fb.details,
        coverImage: fb.cover,
        onSelect: () => {
          setShowScheduleEndOverlay(false);
          if (files && files.length > 0) playItemAtIndex(0);
        }
      });
      fbIdx++;
    }

    setScheduleRecommendations(finalList.slice(0, 3));
    setShowScheduleEndOverlay(true);
  };

  // (Moved state declarations to top)

  // Monitor Picture-in-Picture enter and leave events
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleEnterPip = () => {
      setIsPipActive(true);
      if (onPipStateChange) onPipStateChange(true);
    };

    const handleLeavePip = () => {
      setIsPipActive(false);
      if (onPipStateChange) onPipStateChange(false);
      // Restore view to main player whenever user exits floating window
      if (onRestoreView) {
        onRestoreView();
      }
    };

    videoEl.addEventListener('enterpictureinpicture', handleEnterPip);
    videoEl.addEventListener('leavepictureinpicture', handleLeavePip);

    return () => {
      videoEl.removeEventListener('enterpictureinpicture', handleEnterPip);
      videoEl.removeEventListener('leavepictureinpicture', handleLeavePip);
    };
  }, [onRestoreView, onPipStateChange]);

  // Save PiP dimensions on window resize when in floating mode
  useEffect(() => {
    let unlisten: () => void;
    if (isTauri() && isFloatingMode) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        win.onResized(async (size) => {
           try {
             const scale = await win.scaleFactor();
             const logicalSize = size.toLogical(scale);
             if (logicalSize.width < 1000) {
               const store = await load('settings.json', { autoSave: false });
               await store.set('pip_dimensions', { width: logicalSize.width, height: Math.max(logicalSize.height, 100) });
               await store.save();
             }
           } catch(e) {}
        }).then(u => unlisten = u);
      });
    }
    return () => { if (unlisten) unlisten(); };
  }, [isFloatingMode]);

  // Track isPipActive in a ref to avoid stale closures in unmount cleanup
  const isPipActiveRef = useRef(isPipActive);
  useEffect(() => {
    isPipActiveRef.current = isPipActive;
  }, [isPipActive]);

  // Clean up audio on unmount if PiP is not active
  useEffect(() => {
    return () => {
      if (!isPipActiveRef.current) {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture().catch(() => {});
        }
        if ((window as any).documentPictureInPicture?.window) {
          try {
            (window as any).documentPictureInPicture.window.close();
          } catch (e) {}
        }
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }
    };
  }, []);
  // (Moved state declarations to top)

  const resetColorSettings = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setHue(0);
  };

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if floating (user should be interacting with main app, not player)
      if (isFloatingMode) {
        return;
      }

      // Ignore if active inside editable input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      setShowControls(true);

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;

        case 'ArrowRight': {
          e.preventDefault();
          if (videoRef.current) {
            const step = e.shiftKey ? 60 : 10;
            const newTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + step);
            videoRef.current.currentTime = newTime;
            setSeekFeedback(`+${step} ثانية ⏩`);
            setTimeout(() => setSeekFeedback(null), 1200);
          }
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          if (videoRef.current) {
            const step = e.shiftKey ? 60 : 10;
            const newTime = Math.max(0, videoRef.current.currentTime - step);
            videoRef.current.currentTime = newTime;
            setSeekFeedback(`-${step} ثانية ⏪`);
            setTimeout(() => setSeekFeedback(null), 1200);
          }
          break;
        }

        case 'ArrowUp':
        case '+':
        case '=': {
          e.preventDefault();
          setVolume(prev => {
            const newVol = Math.min(1, Math.round((prev + 0.1) * 10) / 10);
            if (videoRef.current) videoRef.current.volume = newVol;
            setSeekFeedback(`الصوت: ${Math.round(newVol * 100)}% 🔊`);
            setTimeout(() => setSeekFeedback(null), 1200);
            return newVol;
          });
          setIsMuted(false);
          break;
        }

        case 'ArrowDown':
        case '-':
        case '_': {
          e.preventDefault();
          setVolume(prev => {
            const newVol = Math.max(0, Math.round((prev - 0.1) * 10) / 10);
            if (videoRef.current) videoRef.current.volume = newVol;
            setSeekFeedback(`الصوت: ${Math.round(newVol * 100)}% 🔉`);
            setTimeout(() => setSeekFeedback(null), 1200);
            return newVol;
          });
          break;
        }

        case 'Enter': {
          e.preventDefault();
          if (showTransitionBumper) {
            setShowTransitionBumper(false);
            if (nextEpisodeInfo) playItemAtIndex(nextEpisodeInfo.index);
          } else if (showSettingsDropdown) {
            setShowSettingsDropdown(false);
          } else if (activeSettingWidget) {
            setActiveSettingWidget(null);
          } else if (showEqualizer) {
            setShowEqualizer(false);
          }
          break;
        }

        case 'Escape': {
          e.preventDefault();
          if (showSettingsDropdown) {
            setShowSettingsDropdown(false);
          } else if (activeSettingWidget) {
            setActiveSettingWidget(null);
          } else if (showEqualizer) {
            setShowEqualizer(false);
          } else if (showPlaylistDrawer) {
            setShowPlaylistDrawer(false);
          } else if (showTransitionBumper) {
            setShowTransitionBumper(false);
          } else {
            handleExitWithSave();
          }
          break;
        }

        case 'f':
        case 'F': {
          e.preventDefault();
          toggleFullscreen();
          break;
        }

        case 'm':
        case 'M': {
          e.preventDefault();
          toggleMute();
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showTransitionBumper, 
    showSettingsDropdown,
    activeSettingWidget, 
    showEqualizer, 
    showPlaylistDrawer, 
    nextEpisodeInfo, 
    isPlaying
  ]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const bgPlayback = JSON.parse(localStorage.getItem('app_background_playback') ?? 'true');
      if (document.hidden && !bgPlayback) {
        if (isPlaying && videoRef.current) {
          videoRef.current.pause();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying]);

  const togglePlaybackSpeed = () => {
    const rates = [0.5, 1, 1.25, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (videoRef.current) videoRef.current.playbackRate = nextRate;
  };

  const togglePip = async () => {
    handleBackToFloating();
  };

  const toggleFullscreen = async () => {
    await toggleMaximizeWindow();
    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        setIsFullscreen(await win.isFullscreen());
      } catch (e) {}
    } else {
      setIsFullscreen(!!document.fullscreenElement);
    }
  };

  const handleNext = () => {
    if (files && currentIndex < files.length - 1) {
      const nextIndex = currentIndex + 1;
      playItemAtIndex(nextIndex);
      setShowNextEpisode(false);
    }
  };

  const handlePrev = () => {
    if (files && currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      playItemAtIndex(prevIndex);
      setShowNextEpisode(false);
    }
  };

  const playItemAtIndex = (index: number) => {
    if (!files || !files[index]) return;
    const selected = files[index];
    setCurrentIndex(index);
    const targetFile = selected.file || selected.originalFile || selected.rawFile || selected;
    setCurrentFile(targetFile);
    const itemTitle = selected.title || selected.name?.replace(/\.[^/.]+$/, "") || `المقطع ${index + 1}`;
    setCurrentTitle(itemTitle);
    setShowNextEpisode(false);
    setInitialSeekDone(false);
    lastReportedTimeRef.current = 0;
    if (onProgressUpdate) {
      onProgressUpdate(index, 0);
    }
  };

  const handleRequestNativePiP = async () => {
    const videoElement = videoRef.current;

    if (onProgressUpdate && videoElement) {
      onProgressUpdate(currentIndex, videoElement.currentTime);
    }

    if (videoElement && (('documentPictureInPicture' in window) || document.pictureInPictureEnabled) && !document.pictureInPictureElement) {
      try {
        await videoElement.requestPictureInPicture();
      } catch (error) {
        console.warn("Native Picture-in-Picture request failed, using floating mini-player:", error);
      }
    }

    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        await win.setFullscreen(false);
        let w = 440;
        let h = 260;
        try {
          const store = await load('settings.json', { autoSave: false });
          const savedSize: any = await store.get('pip_dimensions');
          if (savedSize && typeof savedSize.width === 'number') {
             w = savedSize.width;
             h = savedSize.height;
          }
        } catch(e) {}
        // Force window to mini-player dimensions
        await win.setSize(new LogicalSize(w, h));
        await win.setAlwaysOnTop(true);
        await win.setDecorations(false);
      } catch (err) {
        console.error("Failed to resize Tauri window for floating mode", err);
      }
    }

    if (onToggleFloating) {
      onToggleFloating(true);
    }
    setIsFloatingLocal(true);
    onExit();
  };

  const handleBackToFloating = async () => {
    // If native browser PiP is active, close it so we don't have duplicate floating windows
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    if ((window as any).documentPictureInPicture?.window) {
      (window as any).documentPictureInPicture.window.close();
    }

    // Removed document.exitFullscreen() to allow the app to remain in fullscreen mode

    const videoElement = videoRef.current;
    if (onProgressUpdate && videoElement) {
      onProgressUpdate(currentIndex, videoElement.currentTime);
    }

    if (onToggleFloating) {
      onToggleFloating(true);
    }
    setIsFloatingLocal(true);
    onExit();
  };

  const restoreAppWindow = async () => {
    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        const appAlwaysOnTop = localStorage.getItem('app_always_on_top') === 'true';
        await win.setAlwaysOnTop(appAlwaysOnTop);
      } catch (err) {}
    }
  };

  const handleStopAndClose = async () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (onProgressUpdate && videoRef.current) {
      onProgressUpdate(currentIndex, videoRef.current.currentTime);
    }
    await restoreAppWindow();
    
    if (onToggleFloating) {
      onToggleFloating(false);
    }
    setIsFloatingLocal(false);
    if (onStopPlayer) {
      onStopPlayer();
    } else {
      onExit();
    }
  };

  const handleExitWithSave = () => {
    handleBackToFloating();
  };

  const rotateVideo = () => {
    setRotation((prev) => (prev === 0 ? 90 : 0));
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volumeBoost * newVol;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      setProgress(duration > 0 ? (current / duration) * 100 : 0);
      setCurrentTimeStr(formatTime(current));

      // Check slot duration timer for Super Sessions
      const currItem = files && files[currentIndex];
      if (currItem) {
        const totalSlotTime = slotAccumulatedRef.current + current;
        setSlotElapsedSec(totalSlotTime);
        
        let shouldTransitionTime = false;
        
        // Respect individual slot transition settings if they exist
        if (currItem.transitionType === 'time' && currItem.transitionMinutes) {
           const timeLimit = Number(currItem.transitionMinutes) * 60;
           if (totalSlotTime >= timeLimit) shouldTransitionTime = true;
        } else if (!currItem.transitionType && currItem.durationMinutes) {
           // Fallback to old behavior
           const slotLimitSec = Number(currItem.durationMinutes) * 60;
           if (totalSlotTime >= slotLimitSec) shouldTransitionTime = true;
        }

        // If slot duration timer expired during video playback:
        if (shouldTransitionTime && !showTransitionBumper) {
          const currentSlotIdx = currItem.slotIndex !== undefined ? currItem.slotIndex : currentIndex;
          const nextSlotItemIdx = files.findIndex((f, idx) => 
            idx > currentIndex && (f.slotId !== currItem.slotId || f.slotIndex > currentSlotIdx)
          );

          if (nextSlotItemIdx !== -1) {
            const nextItem = files[nextSlotItemIdx];
            const nextModeName = MODE_NAMES[nextItem.mode] || nextItem.mode || 'الوضع التالي';
            setNextEpisodeInfo({
              index: nextSlotItemIdx,
              title: nextItem.title || `وضع ${nextModeName}`,
              watchlistName: nextItem.watchlistName || `وضع ${nextModeName}`,
              coverImage: nextItem.coverImage || nextItem.thumbnail || nextItem.poster
            });
            setBumperCountdown(4);
            setShowTransitionBumper(true);
          } else {
            // End of last slot in schedule broadcast / session
            prepareAndShowRecommendations();
          }
        }
      }

      // Periodically report currentTime progress every 3 seconds
      if (Math.abs(current - lastReportedTimeRef.current) >= 3) {
        lastReportedTimeRef.current = current;
        if (onProgressUpdate) {
          onProgressUpdate(currentIndex, current);
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDurationStr(formatTime(videoRef.current.duration));
      videoRef.current.volume = volume;
      videoRef.current.currentTime = 0;
      videoRef.current.muted = isMuted;

      setupAudioNodes();

      if (videoRef.current.videoHeight === 0 && videoRef.current.videoWidth === 0) {
        setIsAudio(true);
      }

      // Smart resume from saved initialTime if provided, but ONLY for the initial episode
      if (!initialSeekDone) {
        if (currentIndex === (initialIndex || 0) && initialTime && initialTime > 0) {
          const dur = videoRef.current.duration;
          if (isNaN(dur) || dur === Infinity || initialTime < dur) {
            videoRef.current.currentTime = initialTime;
          }
        }
        setInitialSeekDone(true);
      } else {
        // For any subsequent videos, forcefully start from the beginning
        videoRef.current.currentTime = 0;
      }

      videoRef.current.play().catch(e => console.warn("Auto-play prevented", e));
    }
  };

  useEffect(() => {
    if (playStateFeedback) {
      const timer = setTimeout(() => setPlayStateFeedback(null), 800);
      return () => clearTimeout(timer);
    }
  }, [playStateFeedback]);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        setPlayStateFeedback('pause');
        if (onProgressUpdate) {
          onProgressUpdate(currentIndex, videoRef.current.currentTime);
        }
      } else {
        videoRef.current.play().catch(err => console.warn("Auto-play prevented", err));
        setIsPlaying(true);
        setPlayStateFeedback('play');
      }
      setShowControls(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const bounds = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - bounds.left) / bounds.width;
      const newTime = percent * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      if (onProgressUpdate) {
        onProgressUpdate(currentIndex, newTime);
      }
    }
  };

  const seekByTime = (delta: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + delta));
      videoRef.current.currentTime = newTime;
      if (onProgressUpdate) {
        onProgressUpdate(currentIndex, newTime);
      }
      setSeekFeedback(`⏳ ${delta > 0 ? '+' : ''}${delta} ثانية`);
      setTimeout(() => setSeekFeedback(null), 1000);
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const errorType = (e.nativeEvent as any)?.type || e.type || "playback_error";
    console.warn("Media element reported playback error:", errorType);

    // If file is deleted, missing, or corrupted and there are more files in playlist, skip immediately to next file
    if (files && files.length > 1 && currentIndex < files.length - 1) {
      setSeekFeedback("الملف غير متوفر - جاري الانتقال للملف التالي ⏭️");
      setTimeout(() => {
        setSeekFeedback(null);
        handleNext();
      }, 500);
      return;
    }

    if (!hasUsedFallback) {
      setHasUsedFallback(true);
      const sampleIndex = Math.abs(currentIndex || 0) % (isAudio ? SAMPLE_AUDIOS.length : SAMPLE_VIDEOS.length);
      setVideoUrl(isAudio ? SAMPLE_AUDIOS[sampleIndex] : SAMPLE_VIDEOS[sampleIndex]);
    } else {
      setVideoError("تعذر تشغيل الملف الحالي. يرجى التأكد من المقطع.");
    }
  };

  useEffect(() => {
    let createdBlobUrl: string | null = null;
    async function loadVideo() {
      setVideoError(null);
      setHasUsedFallback(false);

      let target = currentFile;
      if (!target && files && files[currentIndex]) {
        const item = files[currentIndex];
        target = item.file || item.originalFile || item.rawFile || item;
      }

      const sampleIndex = Math.abs(currentIndex || 0) % (isAudio ? SAMPLE_AUDIOS.length : SAMPLE_VIDEOS.length);

      if (!target) {
        if (files && files.length > 1 && currentIndex < files.length - 1) {
          setSeekFeedback("الملف غير موجود - جاري الانتقال للملف التالي ⏭️");
          setTimeout(() => {
            setSeekFeedback(null);
            handleNext();
          }, 500);
          return;
        }
        setVideoUrl(isAudio ? SAMPLE_AUDIOS[sampleIndex] : SAMPLE_VIDEOS[sampleIndex]);
        return;
      }

      if (target && target.file) target = target.file;
      if (target && target.originalFile) target = target.originalFile;
      if (target && target.rawFile) target = target.rawFile;

      try {
        if (target?.absolutePath) {
          setVideoUrl(convertFileSrc(target.absolutePath));
        } else if (target?.isTauri && target.path) {
          setVideoUrl(convertFileSrc(target.path));
        } else if (typeof target === 'string' && target.length > 0) {
          setVideoUrl(target);
        } else if (target?.url) {
          setVideoUrl(target.url);
        } else if (target?.src) {
          setVideoUrl(target.src);
        } else {
          // Fallback sample media when restored without file handle
          setVideoUrl(isAudio ? SAMPLE_AUDIOS[sampleIndex] : SAMPLE_VIDEOS[sampleIndex]);
        }
      } catch (err) {
        console.error("Failed to load media file:", err);
        if (files && files.length > 1 && currentIndex < files.length - 1) {
          setSeekFeedback("تعذر الوصول للملف - جاري التخطي للملف التالي ⏭️");
          setTimeout(() => {
            setSeekFeedback(null);
            handleNext();
          }, 500);
          return;
        }
        setVideoUrl(isAudio ? SAMPLE_AUDIOS[sampleIndex] : SAMPLE_VIDEOS[sampleIndex]);
      }
    }

    loadVideo();

    return () => {
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [currentFile, currentIndex, isAudio]);

  // Attempt play when videoUrl changes and handle browser policy
  useEffect(() => {
    // Cleanup any existing mpegts player
    if (mpegtsPlayerRef.current) {
      mpegtsPlayerRef.current.destroy();
      mpegtsPlayerRef.current = null;
    }

    if (videoUrl && videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;

      // Handle FLV files
      const isFlv = currentFile?.name?.toLowerCase().endsWith('.flv') || videoUrl.toLowerCase().endsWith('.flv');
      const mpegts = getMpegts();
      
      if (isFlv && mpegts && typeof mpegts.isSupported === 'function' && mpegts.isSupported()) {
        const player = mpegts.createPlayer({
          type: 'flv',
          url: videoUrl
        });
        mpegtsPlayerRef.current = player;
        player.attachMediaElement(videoRef.current);
        player.load();
        const playPromise = player.play();
        if (playPromise !== undefined) {
          playPromise.then(() => setIsPlaying(true)).catch(err => {
            console.warn("FLV Autoplay was prevented:", err);
            setIsPlaying(false);
          });
        }
      } else {
        // Standard HTML5 Video Playback
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
          }).catch(err => {
            console.warn("Autoplay was prevented by browser policy, waiting for user click:", err);
            setIsPlaying(false);
          });
        }
      }
    }
    
    return () => {
      if (mpegtsPlayerRef.current) {
        mpegtsPlayerRef.current.destroy();
        mpegtsPlayerRef.current = null;
      }
    };
  }, [videoUrl, currentFile]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isPlaying && showControls && !showPlaylistDrawer && !showSettings && !showChannelsDrawer && !showScheduleEndOverlay) {
      timeout = setTimeout(() => setShowControls(false), 5000);
    }
    return () => clearTimeout(timeout);
  }, [isPlaying, showControls, showPlaylistDrawer, showSettings, showChannelsDrawer, showScheduleEndOverlay]);

  const isTransitionBumperEnabled = () => {
    try {
      const saved = localStorage.getItem('app_show_transition_bumper');
      return saved !== null ? JSON.parse(saved) : false; // Immediate transition by default
    } catch {
      return false;
    }
  };

  const triggerNextEpisodeBumper = async (targetIdx?: number) => {
    if (files) {
      const nextIdx = targetIdx !== undefined ? targetIdx : (currentIndex < files.length - 1 ? currentIndex + 1 : -1);
      if (nextIdx === -1) return;
      
      // If we are playing a Channel, transition seamlessly!
      if (currentChannelId) {
        playItemAtIndex(nextIdx);
        return;
      }

      
      const nextItem = files[nextIdx];
      const nextTitle = nextItem.title || nextItem.name?.replace(/\.[^/.]+$/, "") || `الحلقة ${nextIdx + 1}`;
      const nextWatchlist = nextItem.watchlistName || watchlistTitle;

      let extractedCover = nextItem.coverImage || nextItem.thumbnail || nextItem.poster;
      const rawFile = nextItem.file || (nextItem instanceof File ? nextItem : null);
      if (!extractedCover && rawFile) {
        try {
          extractedCover = await extractVideoFrameThumbnail(rawFile);
        } catch (e) {
          console.error('Failed to extract video thumbnail:', e);
        }
      }

      setNextEpisodeInfo({
        index: nextIdx,
        title: nextTitle,
        watchlistName: nextWatchlist,
        coverImage: extractedCover
      });
      setBumperCountdown(10);
      setShowTransitionBumper(true);
    }
  };

  // Handle video end
  const handleVideoEnded = () => {
    const currItem = files && files[currentIndex];
    if (currItem) {
      const videoDuration = videoRef.current ? videoRef.current.duration : 0;
      slotAccumulatedRef.current += isNaN(videoDuration) ? 0 : videoDuration;
      slotEpisodesPlayedRef.current += 1;
      const totalSlotSec = slotAccumulatedRef.current;
      
      let shouldTransition = false;
      if (currItem.transitionType === 'episode') {
        const requiredEpisodes = currItem.transitionEpisodes || 1;
        if (slotEpisodesPlayedRef.current >= requiredEpisodes) {
          shouldTransition = true;
        }
      } else if (currItem.transitionType === 'time' && currItem.transitionMinutes) {
        const slotLimitSec = Number(currItem.transitionMinutes) * 60;
        if (totalSlotSec >= slotLimitSec) shouldTransition = true;
      } else if (!currItem.transitionType && currItem.durationMinutes) {
        const slotLimitSec = Number(currItem.durationMinutes) * 60;
        if (totalSlotSec >= slotLimitSec) shouldTransition = true;
      }

      if (!shouldTransition) {
        // Slot duration or episode count is NOT reached yet! Find next item in SAME slot
        const currentSlotIdx = currItem.slotIndex !== undefined ? currItem.slotIndex : currentIndex;
        
        const nextInSameSlot = files.findIndex((f, idx) => 
          idx > currentIndex && (f.slotId === currItem.slotId || f.slotIndex === currentSlotIdx)
        );

        if (nextInSameSlot !== -1) {
          triggerNextEpisodeBumper(nextInSameSlot);
          return;
        } else {
          // Loop back to first item in SAME slot until slot duration / episode count expires
          const firstInSlot = files.findIndex((f) => 
            (f.slotId === currItem.slotId || f.slotIndex === currentSlotIdx)
          );
          if (firstInSlot !== -1) {
            triggerNextEpisodeBumper(firstInSlot);
            return;
          }
        }
      } else {
        // Slot transition condition IS reached! Reset episode count for new slot and move to next slot!
        slotEpisodesPlayedRef.current = 0;
        const currentSlotIdx = currItem.slotIndex !== undefined ? currItem.slotIndex : currentIndex;
        const nextSlotItemIdx = files.findIndex((f, idx) => 
          idx > currentIndex && (f.slotId !== currItem.slotId || f.slotIndex > currentSlotIdx)
        );

        if (nextSlotItemIdx !== -1) {
          triggerNextEpisodeBumper(nextSlotItemIdx);
          return;
        } else {
          // Reached end of schedule broadcast slots
          if (currentChannelId && onPlayChannel && channels) {
            const chan = channels.find(c => c.id === currentChannelId);
            if (chan) {
              onPlayChannel(chan);
              return;
            }
          }
          prepareAndShowRecommendations();
          return;
        }
      }
    }

    if (files && currentIndex < files.length - 1) {
      triggerNextEpisodeBumper(currentIndex + 1);
    } else {
      if (currentChannelId && onPlayChannel && channels) {
        const chan = channels.find(c => c.id === currentChannelId);
        if (chan) {
          onPlayChannel(chan);
          return;
        }
      }
      prepareAndShowRecommendations();
    }
  };


  // Countdown timer effect for transition bumper card
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showTransitionBumper && bumperCountdown > 0) {
      timer = setTimeout(() => setBumperCountdown(prev => prev - 1), 1000);
    } else if (showTransitionBumper && bumperCountdown === 0) {
      setShowTransitionBumper(false);
      if (nextEpisodeInfo) {
        playItemAtIndex(nextEpisodeInfo.index);
      } else if (files && currentIndex < files.length - 1) {
        playItemAtIndex(currentIndex + 1);
      }
    }
    return () => clearTimeout(timer);
  }, [showTransitionBumper, bumperCountdown, nextEpisodeInfo]);

  const getBumperTheme = () => {
    switch (activeMode) {
      case 'kids':
        return {
          bg: 'from-purple-950 via-indigo-900 to-pink-950',
          cardBg: 'bg-gradient-to-br from-yellow-400/20 via-pink-500/20 to-purple-600/30 border-yellow-400/50',
          titleGradient: 'from-yellow-300 via-pink-300 to-sky-300',
          badgeBg: 'bg-yellow-400 text-black font-extrabold',
          accentColor: 'text-yellow-300',
          buttonBg: 'bg-yellow-400 text-black hover:bg-yellow-300',
          ringColor: '#facc15'
        };
      case 'cinema':
        return {
          bg: 'from-zinc-950 via-neutral-900 to-black',
          cardBg: 'bg-gradient-to-br from-red-950/40 via-zinc-900/80 to-black border-red-500/40',
          titleGradient: 'from-red-400 via-amber-200 to-white',
          badgeBg: 'bg-red-600 text-white font-extrabold',
          accentColor: 'text-red-400',
          buttonBg: 'bg-red-600 text-white hover:bg-red-500',
          ringColor: '#ef4444'
        };
      case 'docs':
        return {
          bg: 'from-teal-950 via-slate-900 to-black',
          cardBg: 'bg-gradient-to-br from-emerald-950/50 via-teal-900/60 to-black border-emerald-400/40',
          titleGradient: 'from-emerald-300 via-cyan-200 to-white',
          badgeBg: 'bg-emerald-500 text-black font-bold',
          accentColor: 'text-emerald-400',
          buttonBg: 'bg-emerald-400 text-black hover:bg-emerald-300',
          ringColor: '#34d399'
        };
      case 'quran':
        return {
          bg: 'from-emerald-950 via-stone-900 to-black',
          cardBg: 'bg-gradient-to-br from-emerald-900/40 via-amber-950/30 to-black border-amber-400/40',
          titleGradient: 'from-amber-200 via-yellow-100 to-white',
          badgeBg: 'bg-amber-400 text-black font-bold',
          accentColor: 'text-amber-300',
          buttonBg: 'bg-amber-400 text-black hover:bg-amber-300',
          ringColor: '#fbbf24'
        };
      case 'music':
        return {
          bg: 'from-violet-950 via-indigo-950 to-black',
          cardBg: 'bg-gradient-to-br from-violet-900/50 via-fuchsia-900/40 to-black border-violet-400/50',
          titleGradient: 'from-fuchsia-300 via-purple-200 to-cyan-200',
          badgeBg: 'bg-fuchsia-500 text-white font-bold',
          accentColor: 'text-fuchsia-400',
          buttonBg: 'bg-fuchsia-500 text-white hover:bg-fuchsia-400',
          ringColor: '#d946ef'
        };
      default: // family
        return {
          bg: 'from-slate-950 via-indigo-950/80 to-black',
          cardBg: 'bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-black border-indigo-400/40',
          titleGradient: 'from-indigo-200 via-sky-200 to-white',
          badgeBg: 'bg-white text-black font-bold',
          accentColor: 'text-sky-300',
          buttonBg: 'bg-white text-black hover:bg-gray-200',
          ringColor: '#ffffff'
        };
    }
  };

  const theme = getBumperTheme();

  const handleInteraction = () => {
    setShowControls(true);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    handleInteraction();
    setIsTitleBarHovered(true);
    if (titleBarTouchTimerRef.current) clearTimeout(titleBarTouchTimerRef.current);
    titleBarTouchTimerRef.current = setTimeout(() => {
      setIsTitleBarHovered(false);
    }, 3500);
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      if (videoRef.current) {
        initialTimeOnTouch.current = videoRef.current.currentTime;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current !== null && videoRef.current) {
      const deltaX = e.touches[0].clientX - touchStartX.current;
      // Reverse logic if RTL, but deltaX > 0 means swiping right
      // Typically swiping right means forward. Let's do 1px = 0.5s or similar.
      // If the user swipes right (deltaX > 0), they are advancing the video.
      const timeDelta = (deltaX / window.innerWidth) * 120; // Max 120 seconds for full width swipe
      const newTime = Math.max(0, Math.min(videoRef.current.duration, initialTimeOnTouch.current + timeDelta));
      videoRef.current.currentTime = newTime;
      
      const diff = newTime - initialTimeOnTouch.current;
      if (Math.abs(diff) > 2) {
         setSeekFeedback((diff > 0 ? '+' : '') + Math.round(diff) + ' ثانية');
         setShowControls(true);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartX.current = null;
    setSeekFeedback(null);
  };


  useEffect(() => {
    const handleTvCommand = (e: any) => {
      const action = e.detail?.action;
      if (!action) return;
      switch (action) {
        case 'play_pause': togglePlay(); break;
        case 'toggle_mute': toggleMute(); break;
        case 'toggle_fullscreen': toggleFullscreen(); break;
        case 'volume_up': handleVolumeChange(null, Math.min(100, volume + 5)); break;
        case 'volume_down': handleVolumeChange(null, Math.max(0, volume - 5)); break;
        case 'back': handleStopAndClose(); break;
      }
    };
    window.addEventListener('tvCommand', handleTvCommand);
    return () => window.removeEventListener('tvCommand', handleTvCommand);
  }, [togglePlay, toggleMute, toggleFullscreen, volume, isFullscreen, onExit]);

  // Single Unified Player Render
  return (
    <motion.div 
      ref={containerRef}
      drag={isFloatingMode}
      dragMomentum={false}
      dragElastic={0.05}
      initial={{ opacity: 0, scale: isFloatingMode ? 0.9 : 1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className={
        isFloatingMode
          ? `fixed bottom-6 left-6 z-[999] w-80 sm:w-96 rounded-3xl bg-zinc-950/95 border-2 border-amber-400/90 shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl overflow-hidden flex flex-col text-right dir-rtl cursor-grab active:cursor-grabbing ${!showControls ? 'cursor-none' : ''}`
          : `fixed inset-0 z-50 bg-black flex flex-col overflow-hidden text-right dir-rtl ${!showControls ? 'cursor-none' : ''}`
      }
      style={
        !isFloatingMode && rotation % 180 !== 0
          ? {
              width: '100dvh',
              height: '100vw',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            }
          : undefined
      }
      dir="rtl"
      onMouseMove={!isFloatingMode ? handleInteraction : undefined}
      onTouchStart={!isFloatingMode ? handleTouchStart : undefined}
      onTouchMove={!isFloatingMode ? handleTouchMove : undefined}
      onTouchEnd={!isFloatingMode ? handleTouchEnd : undefined}
      onKeyDown={!isFloatingMode ? handleInteraction : undefined}
      tabIndex={!isFloatingMode ? 0 : undefined}
    >
      {/* 1. FLOATING HEADER (Only when isFloatingMode) */}
      {isFloatingMode && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 border-b border-white/10 text-white shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0 flex-1 pl-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span className="text-xs font-black text-amber-300 truncate">{watchlistTitle}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Maximize Button */}
            <button
              type="button"
              onClick={() => {
                if (onToggleFloating) onToggleFloating(false);
                setIsFloatingLocal(false);
                if (onRestoreView) onRestoreView();
              }}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-amber-400 hover:text-black text-white transition-colors cursor-pointer"
              title="إعادة تكبير المشغل (ملء الشاشة)"
            >
              <Maximize className="w-4 h-4" />
            </button>
            {/* Stop / Close Button */}
            <button
              type="button"
              onClick={handleStopAndClose}
              className="p-1.5 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white transition-colors cursor-pointer"
              title="إغلاق المشغل وإيقاف التشغيل نهائياً"
            >
              <X className="w-4 h-4" />
            </button>
            </div>
          </div>
      )}

      {/* 2. MODE TRANSITION GLOW & BANNER (Only when !isFloatingMode) */}
      {!isFloatingMode && (
        <>
          <AnimatePresence>
            {showModeGlow && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center overflow-hidden"
              >
                <div className={`absolute inset-0 border-8 sm:border-[16px] rounded-2xl ${MODE_GLOW_COLORS[activeMode]?.ring || 'border-amber-400'} ${MODE_GLOW_COLORS[activeMode]?.shadow || ''} animate-pulse`} />
                <motion.div 
                  initial={{ opacity: 0.9, scale: 0.2 }}
                  animate={{ opacity: 0, scale: 2.8 }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  className={`absolute w-[600px] h-[600px] rounded-full bg-gradient-to-r ${MODE_GLOW_COLORS[activeMode]?.bgGradient || 'from-amber-500/40 via-yellow-400/30 to-black'} blur-3xl`}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {modeTransitionBanner && (
              <motion.div
                initial={{ opacity: 0, y: -70, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -50, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="absolute top-20 sm:top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none max-w-sm sm:max-w-md w-11/12"
              >
                <div className={`relative px-5 py-3.5 rounded-2xl bg-gradient-to-r ${MODE_GLOW_COLORS[modeTransitionBanner.mode]?.bgGradient || 'from-amber-950/90 via-zinc-900/95 to-amber-950/90'} border-2 ${MODE_GLOW_COLORS[modeTransitionBanner.mode]?.ring || 'border-amber-400'} shadow-[0_0_50px_rgba(245,158,11,0.6)] backdrop-blur-2xl flex items-center justify-between gap-3 text-white overflow-hidden`}>
                  <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '250%' }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"
                  />

                  <div className="flex items-center gap-3 relative z-10">
                    <div className="text-2xl sm:text-3xl p-2 rounded-xl bg-white/10 backdrop-blur-md shadow-inner flex items-center justify-center shrink-0 border border-white/20">
                      {MODE_GLOW_COLORS[modeTransitionBanner.mode]?.icon || '⚡'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] sm:text-xs text-amber-300 font-extrabold uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                        انتقال الجلسة الذكية
                      </span>
                      <span className="text-base sm:text-xl font-black text-white drop-shadow-md">
                        وضع {modeTransitionBanner.modeName}
                      </span>
                    </div>
                  </div>

                  <div className={`px-3 py-1 rounded-full text-xs font-black shadow-lg ${MODE_GLOW_COLORS[modeTransitionBanner.mode]?.badge || 'bg-amber-400 text-black'} shrink-0 relative z-10 animate-bounce`}>
                    نشط الآن ⚡
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* 3. VIDEO CANVAS CONTAINER (Shared single <video> node!) */}
      <div 
        ref={videoContainerRef}
        className={
          isFloatingMode
            ? "relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden cursor-pointer"
            : "absolute inset-0 z-0 flex items-center justify-center overflow-hidden cursor-pointer bg-black"
        }
        onClick={togglePlay}
      >
        <video 
          ref={videoRef}
          src={videoUrl || undefined} 
          className={
            isAudio 
              ? "w-[1px] h-[1px] opacity-0 absolute pointer-events-none" 
              : `transition-all duration-300 ${
                  aspectRatio === 'cover' ? 'w-full h-full object-cover' :
                  aspectRatio === 'fill' ? 'w-full h-full object-fill' :
                  'w-full h-full object-contain'
                }`
          }
          style={
            !isAudio && (aspectRatio === '4:3' || aspectRatio === '5:4' || aspectRatio === '16:9')
              ? {
                  filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`,
                  aspectRatio: aspectRatio.replace(':', '/'),
                  objectFit: 'fill',
                  maxHeight: '100%',
                  maxWidth: '100%'
                }
              : {
                  filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`
                }
          }
          autoPlay 
          playsInline
          controls={false}
          loop={false}
          preload="auto"
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleVideoError}
          onEnded={handleVideoEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            setIsPlaying(false);
            if (onProgressUpdate && videoRef.current) {
              onProgressUpdate(currentIndex, videoRef.current.currentTime);
            }
          }}
        />

        {/* Audio Visualizer Background (Only when !isFloatingMode & isAudio) */}
        {!isFloatingMode && isAudio && (
          <AudioAnimatedBackground 
            currentMode={activeMode}
            customModes={customModes}
            currentTitle={currentTitle}
            watchlistTitle={watchlistTitle}
            isPlaying={isPlaying}
            videoRef={videoRef}
          />
        )}

        {/* Floating Mode Center Play/Pause & Progress Bar */}
        {isFloatingMode && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-amber-400 hover:text-black text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg opacity-90 hover:scale-110 z-10"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current translate-x-[1px]" />}
            </button>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-10">
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </>
        )}
      </div>

      {/* 4. FLOATING BOTTOM CONTROLS BAR (Only when isFloatingMode) */}
      {isFloatingMode && (
        <div className="p-3 bg-zinc-950 flex items-center justify-between gap-2 shrink-0 z-20">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-white truncate">{currentTitle}</p>
            <p className="text-[10px] text-white/60 font-mono truncate">{currentTimeStr} / {durationStr}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onToggleFloating) onToggleFloating(false);
              setIsFloatingLocal(false);
              if (onRestoreView) onRestoreView();
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-400 text-black font-black text-[11px] hover:bg-amber-300 transition-all shrink-0 flex items-center gap-1 cursor-pointer shadow-md"
          >
            <span>توسيع</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5. FULL SCREEN OVERLAYS & CONTROLS (Only when !isFloatingMode) */}
      {!isFloatingMode && (
        <>

        {isAudio ? (
          <AudioAnimatedBackground 
            currentMode={activeMode}
            customModes={customModes}
            currentTitle={currentTitle}
            watchlistTitle={watchlistTitle}
            isPlaying={isPlaying}
            currentFile={currentFile}
            togglePlay={togglePlay}
          />
        ) : videoError ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-6">
            <img src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=2000" className="w-full h-full object-cover opacity-20 absolute inset-0" alt="Error background" />
            <div className="absolute inset-0 bg-black/70" />
            <div className="relative z-10 text-center p-8 glass rounded-3xl max-w-lg border border-red-500/30">
              <Film className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2 text-white">{currentTitle}</h3>
              <p className="text-red-300 text-sm mb-6">{videoError}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const sampleIndex = Math.abs(currentIndex || 0) % SAMPLE_VIDEOS.length;
                    setVideoUrl(SAMPLE_VIDEOS[sampleIndex]);
                    setVideoError(null);
                  }}
                  className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform w-full sm:w-auto"
                >
                  تشغيل فيديو توضيحي
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExitWithSave();
                  }}
                  className="px-6 py-3 glass rounded-xl font-medium hover:bg-white/20 transition-colors w-full sm:w-auto text-white"
                >
                  العودة للمكتبة
                </button>
              </div>
            </div>
          </div>
        ) : videoUrl ? null : (
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-950">
            <img src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=2000" className="w-full h-full object-cover opacity-40" alt="Video frame" />
            <div className="absolute inset-0 bg-black/50" />
            <div className="absolute z-10 text-center p-6 glass rounded-3xl max-w-lg">
              <Film className="w-16 h-16 text-white/80 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">{currentTitle}</h3>
              <p className="text-white/60 text-sm">جاري تحضير واستدعاء الفيديو: {watchlistTitle}</p>
            </div>
          </div>
        )}

      {/* Seek / Volume Keyboard Shortcut Overlay Feedback */}
      <AnimatePresence>
        {seekFeedback && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.05 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute z-40 pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="px-6 py-3.5 bg-black/85 backdrop-blur-xl rounded-2xl text-white font-black text-xl sm:text-2xl shadow-[0_0_50px_rgba(0,0,0,0.9)] border border-amber-400/40 text-amber-300">
              {seekFeedback}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play/Pause Pulse Feedback Indicator */}
      <AnimatePresence>
        {playStateFeedback && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.1 }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
          >
            <div className="p-6 bg-black/60 backdrop-blur-md rounded-full text-white shadow-2xl border border-white/20">
              {playStateFeedback === 'play' ? (
                <Play className="w-14 h-14 fill-white text-white translate-x-[2px]" />
              ) : (
                <Pause className="w-14 h-14 fill-white text-white" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Playlist Side Drawer (قائمة تشغيل يسارية) */}
      <AnimatePresence>
        {showPlaylistDrawer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md"
            onClick={() => setShowPlaylistDrawer(false)}
          >
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-0 bottom-0 w-80 sm:w-96 h-full glass-panel border-r border-white/20 p-6 flex flex-col shadow-2xl z-10"
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white line-clamp-1">{watchlistTitle}</h3>
                  <p className="text-xs text-white/60 mt-1">
                    {files.length > 0 ? `${files.length} مقطع في القائمة` : 'قائمة التشغيل الحالية'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowPlaylistDrawer(false)}
                  className="p-2 glass rounded-full hover:bg-white hover:text-black transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pl-1">
                {files && files.length > 0 ? (
                  files.map((item, idx) => {
                    const isCurrent = idx === currentIndex;
                    const itemTitle = item.title || item.name?.replace(/\.[^/.]+$/, "") || `المقطع ${idx + 1}`;
                    return (
                      <div 
                        key={idx}
                        onClick={() => playItemAtIndex(idx)}
                        className={`p-4 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                          isCurrent 
                            ? 'bg-white text-black font-bold shadow-lg scale-[1.02]' 
                            : 'glass hover:bg-white/15 text-white/90'
                        }`}
                      >
                        <EpisodeThumbnail 
                          file={item} 
                          title={itemTitle} 
                          watchlistTitle={watchlistTitle} 
                          isActive={isCurrent} 
                        />
                        <div className="flex-1 min-w-0 pl-2">
                          <h4 className="text-sm font-semibold line-clamp-2">{itemTitle}</h4>
                          {item.watchlistName && (
                            <span className="text-[10px] text-white/60 block mt-0.5">{item.watchlistName}</span>
                          )}
                        </div>
                        {isCurrent && (
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-white/60 py-12">
                    <p>لا توجد مقاطع أخرى في هذه القائمة.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Channels Side Drawer Overlay */}
      <AnimatePresence>
        {showChannelsDrawer && currentChannelId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex justify-end"
            onClick={() => setShowChannelsDrawer(false)}
          >
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-zinc-950/95 border-l border-amber-400/30 h-full p-6 flex flex-col justify-between text-right overflow-y-auto shadow-2xl"
              dir="rtl"
            >
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-400/30 shrink-0">
                      <Tv className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-white">قنوات البث التلفزيوني 📺</h3>
                      <p className="text-xs text-amber-300 font-medium mt-0.5">
                        اختر أي قناة للتنقل إليها فوراً ({channels.length} قناة متاحة)
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowChannelsDrawer(false)}
                    className="p-2 glass rounded-full hover:bg-white hover:text-black transition-colors cursor-pointer shrink-0"
                    title="إغلاق"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Channels List */}
                <div className="space-y-3 no-scrollbar">
                  {channels.map((chan) => {
                    const isCurrent = chan.id === currentChannelId;
                    const nowPlaying = getChannelNowPlaying ? getChannelNowPlaying(chan, watchlists) : null;
                    const chanTitle = chan.title || 'قناة تلفزيونية';
                    const chanCover = chan.icon || (nowPlaying?.currentFile?.coverImage) || getEpisodeInspiredCover(chanTitle, 'قناة', []);

                    return (
                      <div 
                        key={chan.id}
                        onClick={() => {
                          setShowChannelsDrawer(false);
                          if (onPlayChannel) onPlayChannel(chan);
                        }}
                        className={`p-3.5 rounded-2xl flex items-center gap-3 cursor-pointer transition-all border ${
                          isCurrent 
                            ? 'bg-amber-400/20 border-amber-400/60 text-white shadow-lg shadow-amber-500/10 scale-[1.01]' 
                            : 'bg-white/5 border-white/10 hover:bg-white/15 text-white/90 hover:border-white/20'
                        }`}
                      >
                        {/* Channel Thumbnail */}
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-black/60 border border-white/10 flex items-center justify-center">
                          {chanCover ? (
                            <img src={chanCover} alt={chanTitle} className="w-full h-full object-cover" />
                          ) : (
                            <Radio className="w-6 h-6 text-amber-400" />
                          )}
                          {isCurrent && (
                            <div className="absolute inset-0 bg-amber-500/30 backdrop-blur-[1px] flex items-center justify-center">
                              <span className="w-3 h-3 rounded-full bg-green-400 animate-ping" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="text-sm font-extrabold text-white truncate">{chanTitle}</h4>
                            {isCurrent && (
                              <span className="bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                                تعرض الآن 🟢
                              </span>
                            )}
                          </div>

                          {nowPlaying ? (
                            <p className="text-xs text-amber-300 font-medium line-clamp-1">
                              📺 {nowPlaying.currentEpisodeTitle}
                            </p>
                          ) : (
                            <p className="text-xs text-white/50 font-medium truncate">
                              بث مستمر مخصص
                            </p>
                          )}

                          <span className="text-[10px] text-white/40 block mt-0.5">
                            {chan.playlistIds?.length || 0} قوائم مرتبطة • {chan.targetMode || 'جميع الأنماط'}
                          </span>
                        </div>

                        {/* Play Icon */}
                        <div className="shrink-0 p-2 rounded-xl bg-white/10 text-white hover:bg-amber-400 hover:text-black transition-colors">
                          <Play className="w-4 h-4 fill-current translate-x-[-1px]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 mt-4">
                <button
                  type="button"
                  onClick={() => setShowChannelsDrawer(false)}
                  className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  إغلاق قائمة القنوات
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule End 3-Card Recommendations Overlay */}
      <AnimatePresence>
        {showScheduleEndOverlay && (
          <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-2xl overflow-y-auto"
            dir="rtl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-5xl bg-zinc-950/95 border border-amber-400/40 rounded-[2.5rem] p-6 sm:p-10 shadow-[0_25px_80px_rgba(0,0,0,0.95)] flex flex-col text-right space-y-8 my-auto"
            >
              {/* Header */}
              <div className="text-center space-y-3 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs sm:text-sm font-extrabold shadow-lg">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                  <span>انتهى الموعد المجدول في البث الأسبوعي 📺</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  ماذا تود أن تشاهد الآن؟ ✨
                </h2>
                <p className="text-xs sm:text-base text-white/70 font-medium">
                  اختر أحد مقاطع الفيديو المقترحة أدناه لمتابعة التشغيل مباشرة حسب نمط الموعد
                </p>
              </div>

              {/* 3 Suggestion Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
                {scheduleRecommendations.map((rec, idx) => (
                  <motion.div
                    key={rec.id || idx}
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => rec.onSelect()}
                    className="group relative bg-zinc-900/90 border border-white/15 hover:border-amber-400/70 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between"
                  >
                    {/* Top Image Container */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black/80">
                      <img 
                        src={rec.coverImage} 
                        alt={rec.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out filter brightness-[0.9]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-80" />
                      
                      {/* Category Tag Badge */}
                      <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-amber-300 text-[11px] font-extrabold shadow-md">
                        {rec.category}
                      </div>

                      {/* Play Hover Circle Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                        <div className="w-14 h-14 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.6)] transform group-hover:scale-110 transition-transform">
                          <Play className="w-7 h-7 fill-black translate-x-[-1px]" />
                        </div>
                      </div>
                    </div>

                    {/* Card Content Details */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3 className="font-black text-base sm:text-lg text-white group-hover:text-amber-300 transition-colors line-clamp-1 leading-snug">
                          {rec.title}
                        </h3>
                        <p className="text-xs text-white/70 font-medium mt-1.5 line-clamp-2 leading-relaxed">
                          {rec.details}
                        </p>
                      </div>

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          rec.onSelect();
                        }}
                        className="w-full py-3 rounded-2xl bg-amber-400/20 group-hover:bg-amber-400 text-amber-300 group-hover:text-black font-extrabold text-xs sm:text-sm border border-amber-400/40 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>تشغيل الآن</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Modal Footer Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleEndOverlay(false);
                    if (files && files.length > 0) playItemAtIndex(0);
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/15 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>إعادة تشغيل البث الأخير</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleEndOverlay(false);
                    handleExitWithSave();
                  }}
                  className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs sm:text-sm transition-all cursor-pointer shadow-lg hover:scale-105 flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة للشاشة الرئيسية</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Screen Interstitial Transition Card Bumper */}
      <AnimatePresence>
        {showTransitionBumper && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-6 md:p-12 overflow-hidden text-right"
          >
            {(() => {
              const nextTitle = nextEpisodeInfo?.title || (files && currentIndex < files.length - 1 ? files[currentIndex + 1]?.title || files[currentIndex + 1]?.name?.replace(/\.[^/.]+$/, "") || `الحلقة ${currentIndex + 2}` : `الحلقة ${currentIndex + 2}`);
              const nextWatchlist = nextEpisodeInfo?.watchlistName || (files && currentIndex < files.length - 1 ? files[currentIndex + 1]?.watchlistName || watchlistTitle : watchlistTitle);
              const nextItem = files && nextEpisodeInfo?.index !== undefined ? files[nextEpisodeInfo.index] : files[currentIndex + 1];
              const linkedWl = watchlists?.find(w => w.title === nextWatchlist || w.title === watchlistTitle);
              const nextCover = nextEpisodeInfo?.coverImage || nextItem?.coverImage || nextItem?.thumbnail || nextItem?.poster || linkedWl?.coverImage || getEpisodeInspiredCover(nextTitle, nextWatchlist, nextItem ? [nextItem] : []);

              return (
                <>
                  {/* FULL SCREEN BACKGROUND COVER IMAGE (ملئ الشاشة والعرض) */}
                  <div className="absolute inset-0 z-0 overflow-hidden">
                    <img 
                      src={nextCover} 
                      alt={nextTitle} 
                      className="w-full h-full object-cover scale-105 filter brightness-[0.55] contrast-[1.1] transition-transform duration-1000"
                    />
                    {/* Dark gradient overlays for high text contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/40" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/80" />
                  </div>

                  {/* TOP TOOLBAR */}
                  <div className="relative z-10 flex items-center justify-between w-full max-w-7xl mx-auto pt-2">
                    <div className={`px-6 py-2.5 rounded-full text-sm font-extrabold shadow-2xl flex items-center gap-2 ${theme.badgeBg}`}>
                      <Sparkles className="w-5 h-5 animate-spin" />
                      <span>الاستمرار في الجلسة الذكية</span>
                    </div>
                  </div>

                  {/* CENTER CONTENT (اسم المسلسل ورقم الحلقة كبير جداً وواضح) */}
                  <div className="relative z-10 flex flex-col items-center text-center my-auto w-full max-w-6xl mx-auto px-4 py-6">
                    {/* اسم المسلسل / القائمة (كبير جداً وواضح) */}
                    <div className="mb-3">
                      <span className="inline-block px-6 py-2 rounded-full bg-black/70 backdrop-blur-md border border-amber-400/40 text-amber-300 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-wide drop-shadow-[0_5px_20px_rgba(0,0,0,1)]">
                        📺 {nextWatchlist}
                      </span>
                    </div>

                    {/* رقم / اسم الحلقة (بحجم مناسب لا يخرج عن الإطار) */}
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white drop-shadow-[0_8px_40px_rgba(0,0,0,1)] tracking-normal leading-snug my-4 max-w-full break-words line-clamp-3">
                      {nextTitle}
                    </h1>

                    <div className="flex items-center justify-center gap-3 mt-2">
                      <span className="w-3.5 h-3.5 rounded-full bg-green-400 animate-ping inline-block" />
                      <span className="text-xl sm:text-2xl font-bold text-white/90 drop-shadow-md">
                        الحلقة التالية جاري تجهيزها للعرض
                      </span>
                    </div>

                    {/* Equalizer Audio Effect */}
                    <div className="flex items-center gap-1.5 mt-6 h-8">
                      {[16, 28, 20, 32, 18, 30, 14, 26, 22].map((h, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [8, h, 8] }}
                          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" }}
                          className={`w-1.5 rounded-full ${theme.badgeBg}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* BOTTOM BAR: Countdown & Action Controls */}
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 w-full max-w-6xl mx-auto pb-4">
                    {/* Countdown Timer Circle */}
                    <div className="flex items-center gap-4 glass p-4 px-6 rounded-3xl border border-white/20 shadow-2xl bg-black/60 backdrop-blur-xl">
                      <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-white/10"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="transition-all duration-1000 ease-linear"
                            strokeWidth="4"
                            strokeDasharray="100, 100"
                            strokeDashoffset={100 - (bumperCountdown / 10) * 100}
                            strokeLinecap="round"
                            stroke={theme.ringColor}
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-xl font-mono font-black text-white">{bumperCountdown}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-bold text-white block">الانتقال التلقائي</span>
                        <span className="text-xs text-white/60">خلال {bumperCountdown} ثواني</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <button 
                        onClick={() => {
                          setShowTransitionBumper(false);
                          if (nextEpisodeInfo) playItemAtIndex(nextEpisodeInfo.index);
                        }}
                        className={`flex-1 md:flex-none py-4 px-8 md:px-12 rounded-2xl font-black text-xl md:text-2xl transition-transform hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3 cursor-pointer ${theme.buttonBg}`}
                      >
                        <CheckCircle2 className="w-7 h-7 fill-current" />
                        <span>موافق (متابعة)</span>
                      </button>

                      <button 
                        onClick={() => {
                          setShowTransitionBumper(false);
                        }}
                        className="py-4 px-6 rounded-2xl font-bold text-white bg-red-500/30 hover:bg-red-500/40 border border-red-500/50 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer text-lg"
                        title="إلغاء الانتقال التلقائي"
                      >
                        <X className="w-6 h-6 text-red-300" />
                        <span>إلغاء</span>
                      </button>

                      <button 
                        onClick={() => setBumperCountdown(prev => prev + 5)}
                        className="glass px-5 py-4 rounded-2xl font-bold text-white text-sm hover:bg-white/20 transition-colors cursor-pointer shrink-0"
                        title="تأخير الانتقال 5 ثواني"
                      >
                        +5 ثواني
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title Bar (Header Toolbar) - Appears when controls are shown */}
      <div 
        className={`absolute top-0 left-0 right-0 z-30 transition-all duration-300 pointer-events-auto min-h-[90px] ${
          showControls || showPlaylistDrawer || showChannelsDrawer || showSettings
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 -translate-y-3 pointer-events-none'
        }`}
      >
        <div className="p-4 sm:p-8 flex justify-between items-center bg-gradient-to-b from-black/90 via-black/60 to-transparent">
          <button 
            onClick={handleExitWithSave} 
            className="p-2.5 sm:px-4 sm:py-2.5 glass rounded-full hover:bg-white hover:text-black transition-all cursor-pointer flex items-center gap-2 border border-white/20 hover:scale-105 active:scale-95 shadow-lg group"
            title="رجوع (تصغير للنافذة العائمة ومتابعة التشغيل)"
          >
            <ArrowRight className="w-6 h-6 text-amber-400 group-hover:text-black" />
            <span className="text-sm font-extrabold text-white group-hover:text-black hidden sm:inline">رجوع</span>
          </button>
          <div className="text-center flex flex-col items-center">
            <h2 className="text-xl sm:text-2xl font-bold drop-shadow-lg text-white">{watchlistTitle}</h2>
            <p className="text-white/80 drop-shadow-md mt-1 text-xs sm:text-sm">{currentTitle}</p>
            {channels && channels.length > 0 && currentChannelId && (
              <div className="mt-2 flex items-center justify-center">
                <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black text-xs backdrop-blur-md shadow-md flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span>{channels.find(c => c.id === currentChannelId)?.title || 'قناة جارية'}</span>
                </div>
              </div>
            )}
            {currentItem && (currentItem.transitionType === 'time' ? currentItem.transitionMinutes : (!currentItem.transitionType && currentItem.durationMinutes)) && (
              <div className="mt-2 flex items-center gap-2 bg-gradient-to-r from-amber-500/30 via-orange-500/30 to-amber-500/30 border border-amber-400/50 px-4 py-1.5 rounded-full backdrop-blur-md shadow-[0_0_15px_rgba(245,158,11,0.3)] text-amber-200 text-xs sm:text-sm font-bold animate-pulse">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>
                  المتبقي في وضع {MODE_NAMES[activeMode] || activeMode}: {formatTime(Math.max(0, (Number(currentItem.transitionType === 'time' ? currentItem.transitionMinutes : currentItem.durationMinutes) * 60) - slotElapsedSec))}
                </span>
              </div>
            )}

            {/* Now Playing & Up Next Schedule Ticker Bar */}
            {upcomingSchedule && (
              <div className="mt-2 px-3.5 py-1.5 rounded-full bg-slate-950/90 border border-amber-400/40 text-amber-200 text-xs font-extrabold backdrop-blur-xl shadow-xl flex items-center gap-2 border-amber-400/30">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span className="text-amber-400 font-black shrink-0">القادم حسب الجدول ({upcomingSchedule.time}):</span>
                <span className="truncate text-white max-w-[180px] sm:max-w-[280px]">{upcomingSchedule.title}</span>
                {upcomingSchedule.episodeIndex !== undefined && (
                  <span className="text-amber-300 text-[11px] shrink-0 font-bold"> (الحلقة {upcomingSchedule.episodeIndex + 1})</span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            {/* Do Not Disturb (Cinema Mode) Quick Toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleDnd();
              }}
              className={`p-3 glass rounded-full transition-all relative cursor-pointer ${
                isDndActive 
                  ? 'bg-amber-400 text-slate-950 border-2 border-amber-300 font-bold shadow-lg shadow-amber-400/30 scale-105' 
                  : 'hover:bg-white/20 text-white/80 hover:text-white'
              }`}
              title={isDndActive ? 'وضع عدم الإزعاج نشط (يتم كتم وتأجيل المنبهات المجدولة تلقائياً أثناء المشاهدة)' : 'تفعيل وضع عدم الإزعاج (الوضع السينمائي)'}
            >
              {isDndActive ? <BellOff className="w-6 h-6 text-slate-950" /> : <Bell className="w-6 h-6" />}
              {isDndActive && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow">
                  ✓
                </span>
              )}
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowChannelsDrawer(false);
                setShowPlaylistDrawer(!showPlaylistDrawer);
              }} 
              className={`p-3 glass rounded-full transition-all relative cursor-pointer ${
                showPlaylistDrawer ? 'bg-white text-black font-bold shadow-lg scale-105' : 'hover:bg-white hover:text-black text-white'
              }`}
              title="قائمة التشغيل"
            >
              <List className="w-6 h-6" />
              {files && files.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                  {files.length}
                </span>
              )}
            </button>

            {channels && channels.length > 0 && currentChannelId && onPlayChannel && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPlaylistDrawer(false);
                  setShowChannelsDrawer(!showChannelsDrawer);
                }} 
                className={`p-3 glass rounded-full transition-all relative cursor-pointer ${
                  showChannelsDrawer 
                    ? 'bg-amber-400 text-black border-amber-300 font-bold shadow-lg scale-105' 
                    : 'hover:bg-amber-400 hover:text-black text-amber-300 border border-amber-400/40'
                }`}
                title="قنوات البث التلفزيوني (TV Channels) 📺"
              >
                <Tv className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 bg-amber-400 text-black text-xs font-extrabold rounded-full w-5 h-5 flex items-center justify-center shadow">
                  {channels.length}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controls Overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"
          >
            {/* Bottom Controls */}
            <div className="p-4 sm:p-8 md:p-12 pt-0 pb-6 sm:pb-8 md:pb-12 w-full max-w-6xl mx-auto pointer-events-auto">
              {/* Progress Bar */}
              <div className="mb-4 sm:mb-8 group cursor-pointer flex items-center gap-2 sm:gap-4 py-3" dir="ltr">
                <span className="text-xs sm:text-sm font-mono text-white/80 w-12 sm:w-16 text-right select-none">{currentTimeStr}</span>
                <div 
                  className="flex-1 h-3 sm:h-3 bg-white/20 rounded-full relative overflow-hidden transition-all group-hover:h-4 sm:group-hover:h-5"
                  onClick={handleSeek}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    if (videoRef.current) {
                      const bounds = e.currentTarget.getBoundingClientRect();
                      const percent = (touch.clientX - bounds.left) / bounds.width;
                      const newTime = percent * videoRef.current.duration;
                      videoRef.current.currentTime = newTime;
                      if (onProgressUpdate) onProgressUpdate(currentIndex, newTime);
                    }
                  }}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    if (videoRef.current) {
                      const bounds = e.currentTarget.getBoundingClientRect();
                      let percent = (touch.clientX - bounds.left) / bounds.width;
                      percent = Math.max(0, Math.min(1, percent));
                      const newTime = percent * videoRef.current.duration;
                      videoRef.current.currentTime = newTime;
                      if (onProgressUpdate) onProgressUpdate(currentIndex, newTime);
                    }
                  }}
                >
                  <div 
                    className="absolute top-0 left-0 h-full bg-white rounded-full relative" 
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform origin-center translate-x-1/2 pointer-events-none" />
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-mono text-white/80 w-12 sm:w-16 text-left select-none">{durationStr}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                {/* Left Side: Volume & Settings */}
                <div className="flex items-center gap-2 sm:gap-6 w-1/3">
                  {/* Volume Button & Slider */}
                  <div 
                    className="relative flex items-center gap-1 sm:gap-2 group cursor-pointer"
                    onMouseEnter={() => setShowVolumeControl(true)}
                    onMouseLeave={() => setShowVolumeControl(false)}
                    onWheel={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const delta = e.deltaY < 0 ? 0.05 : -0.05;
                      setVolume((prev) => {
                        const newVol = Math.min(1, Math.max(0, Math.round((prev + delta) * 100) / 100));
                        if (videoRef.current) videoRef.current.volume = newVol;
                        setSeekFeedback(`الصوت: ${Math.round(newVol * 100)}% 🔊`);
                        setTimeout(() => setSeekFeedback(null), 1200);
                        return newVol;
                      });
                      setIsMuted(false);
                    }}
                  >
                    <button 
                      onClick={toggleMute} 
                      className="p-2 text-white/80 hover:text-white transition-colors cursor-pointer" 
                      title={isMuted ? "إلغاء الكتم (أو تحريك عجلة الماوس لتغيير الصوت)" : "كتم الصوت (أو تحريك عجلة الماوس لتغيير الصوت)"}
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 sm:w-7 sm:h-7 text-red-400" /> : <Volume2 className="w-5 h-5 sm:w-7 sm:h-7" />}
                    </button>
                    
                    <AnimatePresence>
                      {showVolumeControl && (
                        <motion.div 
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 80 }}
                          exit={{ opacity: 0, width: 0 }}
                          className="hidden md:flex items-center overflow-hidden"
                          dir="ltr"
                        >
                          <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            onWheel={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const delta = e.deltaY < 0 ? 0.05 : -0.05;
                              setVolume((prev) => {
                                const newVol = Math.min(1, Math.max(0, Math.round((prev + delta) * 100) / 100));
                                if (videoRef.current) videoRef.current.volume = newVol;
                                setSeekFeedback(`الصوت: ${Math.round(newVol * 100)}% 🔊`);
                                setTimeout(() => setSeekFeedback(null), 1200);
                                return newVol;
                              });
                              setIsMuted(false);
                            }}
                            className="w-20 sm:w-24 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Center: Playback Controls */}
                <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6" dir="ltr">
                  {channels && channels.length > 0 && currentChannelId && onPlayChannel && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlePrevChannel(); }}
                      className="p-2 sm:p-3 rounded-full text-amber-300 hover:text-black hover:bg-amber-400 bg-amber-500/20 border border-amber-400/40 transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 shadow-md"
                      title="القناة السابقة 📺"
                    >
                      <ChevronsLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  )}

                  <button 
                    onClick={handlePrev}
                    className={`p-2 sm:p-3 rounded-full transition-all ${files && currentIndex > 0 ? 'text-white/80 hover:text-white hover:bg-white/10 cursor-pointer' : 'text-white/30 cursor-not-allowed'}`}
                    disabled={!files || currentIndex === 0}
                    title="المقطع السابق"
                  >
                    <SkipBack className="w-6 h-6 sm:w-8 sm:h-8" />
                  </button>

                  <button 
                    onClick={togglePlay}
                    className="w-14 h-14 sm:w-20 sm:h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all shrink-0"
                  >
                    {isPlaying ? <Pause className="w-6 h-6 sm:w-8 sm:h-8 fill-black" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-black translate-x-[2px]" />}
                  </button>

                  <button 
                    onClick={handleNext}
                    className={`p-2 sm:p-3 rounded-full transition-all ${files && currentIndex < files.length - 1 ? 'text-white/80 hover:text-white hover:bg-white/10 cursor-pointer' : 'text-white/30 cursor-not-allowed'}`}
                    disabled={!files || currentIndex === files.length - 1}
                    title="المقطع التالي"
                  >
                    <SkipForward className="w-6 h-6 sm:w-8 sm:h-8" />
                  </button>

                  {channels && channels.length > 0 && currentChannelId && onPlayChannel && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleNextChannel(); }}
                      className="p-2 sm:p-3 rounded-full text-amber-300 hover:text-black hover:bg-amber-400 bg-amber-500/20 border border-amber-400/40 transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 shadow-md"
                      title="القناة التالية 📺"
                    >
                      <ChevronsRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  )}
                </div>

                {/* Right Side: Additional Controls */}
                <div className="flex items-center justify-end gap-1 sm:gap-4 w-1/3">
                  {/* Settings Button with Dropdown */}
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettingsDropdown(prev => !prev);
                      }} 
                      className="text-white/70 hover:text-white transition-colors p-2 flex items-center gap-1 cursor-pointer shrink-0" 
                      title="إعدادات الفيديو (الألوان ونسبة العرض)"
                    >
                      <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {showSettingsDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-full right-0 mb-3 w-56 bg-zinc-950/95 backdrop-blur-2xl border border-white/20 rounded-2xl p-2 shadow-[0_10px_40px_rgba(0,0,0,0.9)] z-50 text-right flex flex-col gap-1"
                          dir="rtl"
                        >
                          <div className="px-3 py-1.5 border-b border-white/10 text-[11px] text-white/50 font-extrabold">
                            خيارات العرض والصورة
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowSettingsDropdown(false);
                              setActiveSettingWidget('colors');
                            }}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/15 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer text-right"
                          >
                            <Sun className="w-4 h-4 text-amber-300 shrink-0" />
                            <span>تعديل الألوان</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowSettingsDropdown(false);
                              setActiveSettingWidget('aspect');
                            }}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/15 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer text-right"
                          >
                            <Maximize className="w-4 h-4 text-sky-300 shrink-0" />
                            <span>نسبة العرض إلى الارتفاع</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button 
                    onClick={() => {
                      setupAudioNodes();
                      setShowEqualizer(!showEqualizer);
                    }} 
                    className="text-white/70 hover:text-white transition-colors p-2 hidden sm:flex items-center gap-1 relative cursor-pointer" 
                    title="المعادل وتضخيم الصوت"
                  >
                    <Sliders className="w-5 h-5 sm:w-6 sm:h-6" />
                    {volumeBoost > 1 && (
                      <span className="bg-amber-400 text-black text-[10px] font-extrabold px-1.5 py-0.2 rounded-full dir-ltr">
                        {Math.round(volumeBoost * 100)}%
                      </span>
                    )}
                  </button>
                  <button onClick={togglePlaybackSpeed} className="text-white/70 hover:text-white transition-colors p-2 font-bold flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full hover:bg-white/10 shrink-0" title="سرعة التشغيل">
                    <span className="text-sm">{playbackRate}x</span>
                  </button>
                  <button onClick={togglePip} className="text-white/70 hover:text-white transition-colors p-2 shrink-0 cursor-pointer" title="نافذة عائمة (PiP)">
                    <PictureInPicture className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors p-2 shrink-0" title="ملئ الشاشة">
                    {isFullscreen ? <Minimize className="w-5 h-5 sm:w-6 sm:h-6" /> : <Maximize className="w-5 h-5 sm:w-6 sm:h-6" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Equalizer & Audio Booster Centered Modal (Horizontal Layout) */}
      <AnimatePresence>
        {showEqualizer && (
          <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
            onClick={() => setShowEqualizer(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950/95 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 border border-amber-400/50 shadow-[0_25px_70px_rgba(0,0,0,0.95)] flex flex-col text-right space-y-6"
            >
              {/* Top Header with Title, Dropdown Presets & Close */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-400/30 shrink-0">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-lg sm:text-xl">المعادل الصوتي وتضخيم الصوت الفائق</h4>
                    <p className="text-xs text-amber-300 font-medium">تضخيم الصوت حتى 500% وموازن الترددات 🎛️</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  {/* Presets Dropdown */}
                  <div className="flex items-center gap-2 bg-black/40 p-1.5 px-3 rounded-2xl border border-white/15">
                    <span className="text-xs font-bold text-white/80 whitespace-nowrap">النمط:</span>
                    <select
                      value={activeEqPreset}
                      onChange={(e) => applyEqPreset(e.target.value)}
                      className="bg-zinc-900 text-amber-300 font-extrabold text-xs sm:text-sm rounded-xl px-3 py-1.5 border border-amber-400/40 focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      {Object.entries(EQ_PRESETS).map(([key, p]) => (
                        <option key={key} value={key} className="bg-zinc-950 text-white font-medium py-1">
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={() => setShowEqualizer(false)} 
                    className="text-white/60 hover:text-white p-2.5 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    title="إغلاق"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Horizontal Split Body */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                {/* Column 1: Volume Booster */}
                <div className="bg-gradient-to-br from-amber-950/40 via-orange-950/30 to-zinc-900/80 p-5 rounded-3xl border border-amber-400/40 shadow-inner flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-2">
                        <Volume2 className="w-5 h-5 text-amber-400" />
                        تضخيم الصوت الفائق:
                      </span>
                      <span className="font-mono text-base font-extrabold text-amber-300 bg-amber-400/20 px-3 py-1 rounded-xl border border-amber-400/40 dir-ltr">
                        {Math.round(volumeBoost * 100)}%
                      </span>
                    </div>

                    <input 
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.1"
                      value={volumeBoost}
                      onChange={(e) => updateVolumeBoostValue(Number(e.target.value))}
                      className="w-full h-3 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400 my-4"
                    />

                    <p className="text-xs text-white/70 leading-relaxed">
                      يرفع شدة الصوت للمقاطع الضعيفة حتى <strong className="text-amber-300">500%</strong> (+14dB) مع الحفاظ على وضوح النبرات.
                    </p>
                  </div>

                  {/* Quick Boost Options */}
                  <div>
                    <span className="text-xs font-bold text-white/60 block mb-2">اختصارات التضخيم السريع:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: '100% (عادي)', val: 1.0 },
                        { label: '150% (متوسط)', val: 1.5 },
                        { label: '300% (عالي 🔊)', val: 3.0 },
                        { label: '500% (تضخيم أقصى 🚀)', val: 5.0 },
                      ].map((b) => (
                        <button
                          key={b.val}
                          type="button"
                          onClick={() => updateVolumeBoostValue(b.val)}
                          className={`py-2.5 px-3 text-xs font-extrabold rounded-2xl border transition-all cursor-pointer text-center ${
                            volumeBoost === b.val 
                              ? 'bg-amber-400 text-black border-amber-300 shadow-lg scale-102' 
                              : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Column 2: Equalizer Frequency Sliders */}
                <div className="bg-black/50 p-5 rounded-3xl border border-white/10 flex flex-col justify-between space-y-3">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-xs sm:text-sm font-bold text-white/90">ضبط الترددات الصوتية (Equalizer Bands):</span>
                    <span className="text-xs text-amber-300 font-mono">-12dB إلى +12dB</span>
                  </div>

                  <div className="space-y-3 py-1">
                    {EQ_FREQUENCIES.map((freq, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm">
                        <span className="font-bold text-white/90 w-28 shrink-0">{EQ_LABELS[idx]}</span>
                        <input 
                          type="range"
                          min="-12"
                          max="12"
                          step="1"
                          value={eqGains[idx]}
                          onChange={(e) => updateEqGain(idx, Number(e.target.value))}
                          className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400"
                        />
                        <span className="font-mono text-amber-300 w-12 text-left font-bold dir-ltr">
                          {eqGains[idx] > 0 ? `+${eqGains[idx]}` : eqGains[idx]}dB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <button 
                type="button"
                onClick={() => setShowEqualizer(false)}
                className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-sm transition-all cursor-pointer shadow-lg hover:scale-[1.01]"
              >
                تطبيق وإغلاق
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Compact Floating Tool Widget for Video Settings (Colors & Aspect Ratio) */}
      <AnimatePresence>
        {activeSettingWidget && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-16 left-4 sm:left-8 z-[150] w-72 sm:w-80 bg-zinc-950/85 backdrop-blur-2xl rounded-2xl p-4 border border-white/20 shadow-[0_15px_50px_rgba(0,0,0,0.9)] flex flex-col text-right space-y-3"
            dir="rtl"
          >
            {/* Widget Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                {activeSettingWidget === 'colors' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-300 shrink-0" />
                    <h5 className="font-extrabold text-white text-xs sm:text-sm">تعديل الألوان</h5>
                  </>
                ) : (
                  <>
                    <Maximize className="w-4 h-4 text-sky-300 shrink-0" />
                    <h5 className="font-extrabold text-white text-xs sm:text-sm">نسبة العرض إلى الارتفاع</h5>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => setActiveSettingWidget(activeSettingWidget === 'colors' ? 'aspect' : 'colors')}
                  className="px-2 py-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  title="الانتقال إلى الإعداد الآخر"
                >
                  {activeSettingWidget === 'colors' ? 'نسبة العرض' : 'الألوان'}
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveSettingWidget(null)} 
                  className="p-1 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Colors Tool */}
            {activeSettingWidget === 'colors' && (
              <div className="space-y-3 text-xs pt-1">
                {/* Brightness */}
                <div className="space-y-1 bg-black/40 p-2.5 rounded-xl border border-white/10">
                  <div className="flex justify-between items-center font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-amber-300" />
                      السطوع
                    </span>
                    <span className="font-mono text-amber-300">{brightness}%</span>
                  </div>
                  <input 
                    type="range"
                    min="50"
                    max="150"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>

                {/* Contrast */}
                <div className="space-y-1 bg-black/40 p-2.5 rounded-xl border border-white/10">
                  <div className="flex justify-between items-center font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-sky-300" />
                      التباين
                    </span>
                    <span className="font-mono text-sky-300">{contrast}%</span>
                  </div>
                  <input 
                    type="range"
                    min="50"
                    max="150"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Saturation */}
                <div className="space-y-1 bg-black/40 p-2.5 rounded-xl border border-white/10">
                  <div className="flex justify-between items-center font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
                      التشبع
                    </span>
                    <span className="font-mono text-fuchsia-300">{saturation}%</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="200"
                    value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-fuchsia-400"
                  />
                </div>

                {/* Hue */}
                <div className="space-y-1 bg-black/40 p-2.5 rounded-xl border border-white/10">
                  <div className="flex justify-between items-center font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 text-emerald-300" />
                      درجة اللون
                    </span>
                    <span className="font-mono text-emerald-300">{hue}°</span>
                  </div>
                  <input 
                    type="range"
                    min="-180"
                    max="180"
                    value={hue}
                    onChange={(e) => setHue(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>

                <button 
                  type="button"
                  onClick={resetColorSettings}
                  className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>إعادة تعيين الألوان</span>
                </button>
              </div>
            )}

            {/* Aspect Ratio Tool */}
            {activeSettingWidget === 'aspect' && (
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                {[
                  { id: 'auto', label: 'تلقائي (حسب الشاشة)' },
                  { id: '4:3', label: '4:3 (شاشة قديمة)' },
                  { id: '5:4', label: '5:4' },
                  { id: '16:9', label: '16:9 (عريض حديث)' },
                  { id: 'cover', label: 'تعبئة مع قص (Cover)' },
                  { id: 'fill', label: 'تمطيط بالكامل (Fill)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAspectRatio(opt.id as any)}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                      aspectRatio === opt.id
                        ? 'bg-amber-400 text-black border-amber-300 shadow-md font-extrabold scale-[1.02]'
                        : 'bg-black/40 text-white border-white/15 hover:bg-white/10'
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </motion.div>
  );
};

export default PlayerView;
