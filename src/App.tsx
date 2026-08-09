import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import HomeView from './views/HomeView';
import ChannelsView from './views/ChannelsView';
import LibraryView from './views/LibraryView';
import CreateWatchlistView from './views/CreateWatchlistView';
import SmartSessionsView from './views/SmartSessionsView';
import PlayerView from './views/PlayerView';
import SettingsView from './views/SettingsView';
import { ViewState, Mode, Watchlist, Session, ModeConfig, Channel, WeeklyScheduleEntry } from './types';
import { autoAssignWatchlistsToChannels, getChannelNowPlaying } from './utils/channelEngine';
import { MODES } from './data';
import { DEFAULT_CHANNELS } from './data/defaultChannels';
import { store } from './utils/store';
import { isCrossOriginIframe } from './utils/fileSystem';
import { extractVideoFrameThumbnail, generateVideoCardPoster } from './utils/coverHelper';
import { FolderLock, FolderPlus, FolderTree, CheckCircle2, FolderOpen, Info, X, ShieldCheck, Play, Sparkles, Zap, PictureInPicture } from 'lucide-react';
import { AppContextProvider } from './contexts/AppContext';
import { toggleMaximizeWindow } from './utils/tauri';
import { useDialog } from './contexts/DialogContext';
import { ProcessingRing } from './components/ProcessingRing';
import { ScheduleNotifier } from './components/ScheduleNotifier';
import { open } from '@tauri-apps/plugin-dialog';
import { setAlwaysOnTop, closeWindow } from './utils/tauri';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);
  const { showAlert } = useDialog();
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [previousView, setPreviousView] = useState<ViewState>('home');
  const [isPipActive, setIsPipActive] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  
  const [customModes, setCustomModes] = useState<Record<Mode, ModeConfig>>(MODES as Record<Mode, ModeConfig>);
  const [currentMode, setCurrentMode] = useState<Mode>('family');
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [schedules, setSchedules] = useState<WeeklyScheduleEntry[]>([]);
  const [customCategories, setCustomCategories] = useState<Record<Mode, string[]>>({
    kids: [], family: [], cinema: [], docs: [], quran: [], music: [], night: []
  });


  useKeyboardShortcuts({
    currentView,
    setCurrentView,
    currentMode,
    setCurrentMode
  });


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleMaximizeWindow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    try {
      const isAlwaysOnTop = localStorage.getItem('app_always_on_top') === 'true';
      if (isAlwaysOnTop) {
        setAlwaysOnTop(true);
      }
      const isLiteMode = localStorage.getItem('app_lite_mode_enabled') === 'true';
      if (isLiteMode) {
        document.documentElement.classList.add('lite-mode');
      } else {
        document.documentElement.classList.remove('lite-mode');
      }
    } catch (e) {
      console.warn('Could not restore app settings:', e);
    }
  }, []);


  useEffect(() => {
    async function loadData() {
      const mode = await store.getMode();
      const lists = await store.getWatchlists();
      const sess = await store.getSessions();
      const cats = await store.getCategories();
      const mods = await store.getCustomModes();
      const chs = await store.getChannels();
      const schs = await store.getSchedules();
      
      setCurrentMode(mode);
      setSessions(sess);
      setCustomCategories(cats);
      const mergedModes = { ...MODES, ...(mods || {}) };
      if (mods?.family && !mods.family.bgImage) {
        mergedModes.family = { ...mergedModes.family, bgImage: MODES.family.bgImage };
      }
      if (mods?.quran && (mods.quran.bgImage === 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&q=80&w=1600' || !mods.quran.bgImage)) {
        mergedModes.quran = { ...mergedModes.quran, bgImage: MODES.quran.bgImage };
      }
      setCustomModes(mergedModes);
      let loadedChannels = chs && chs.length > 0 ? [...chs] : [...DEFAULT_CHANNELS];
      DEFAULT_CHANNELS.forEach(defCh => {
        if (!loadedChannels.some(c => c.id === defCh.id)) {
          loadedChannels.push(defCh);
        }
      });
      const sanitizedChannels = loadedChannels.map(ch => ({
        ...ch,
        title: ch.title ? ch.title.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim() : ch.title
      }));
      setChannels(sanitizedChannels);
      setSchedules(schs || []);

      setWatchlists(lists);

      // Auto-Resume
      const isAutoResumeEnabled = localStorage.getItem('app_resume_playback') !== 'false';
      const lastState = await store.getLastPlaybackState();
      if (isAutoResumeEnabled && lastState && lastState.watchlistId && lastState.fileIndex !== undefined) {
        const wl = lists.find((w: any) => w.id === lastState.watchlistId);
        if (wl) {
          const allFiles = [...(wl.files || []), ...(wl.seasons?.flatMap((s: any) => s.files || []) || [])];
          const file = allFiles[lastState.fileIndex];
          if (file) {
            handlePlay(file, file.name || file.title, wl.title, allFiles, lastState.fileIndex, lastState.sessionId, wl.id, undefined, lastState.channelId);
            setIsStoreLoaded(true);
            return;
          }
        }
      }

      setIsStoreLoaded(true);
    }
    loadData();
  }, []);

  // Sync channels and smart sessions automatically whenever watchlists are updated or loaded
  useEffect(() => {
    if (!isStoreLoaded || !watchlists || watchlists.length === 0) return;

    // 1. Refresh & auto-assign watchlists to channels
    const syncedChannels = autoAssignWatchlistsToChannels(channels, watchlists);
    if (syncedChannels.length !== channels.length || syncedChannels.some((c, i) => (c.playlistIds?.length || 0) !== (channels[i]?.playlistIds?.length || 0))) {
      setChannels(syncedChannels);
      store.setChannels(syncedChannels);
    }

    // 2. Auto-sync smart sessions and super sessions with new watchlists
    let sessionsChanged = false;
    const syncedSessions = sessions.map(sess => {
      const existingWatchlistIds = new Set(sess.selectedWatchlistIds || []);
      const updatedWatchlistIds = [...(sess.selectedWatchlistIds || [])];

      const sessionModes = new Set([
        ...(sess.items || []).map(i => i.mode).filter(Boolean),
        ...(sess.scheduleSlots || []).map(s => s.mode).filter(Boolean)
      ]);

      if (sessionModes.size > 0) {
        watchlists.forEach(w => {
          if (w.targetMode && sessionModes.has(w.targetMode) && !existingWatchlistIds.has(w.id)) {
            updatedWatchlistIds.push(w.id);
            sessionsChanged = true;
          }
        });
      }

      if (updatedWatchlistIds.length !== (sess.selectedWatchlistIds?.length || 0)) {
        return { ...sess, selectedWatchlistIds: updatedWatchlistIds };
      }
      return sess;
    });

    if (sessionsChanged) {
      setSessions(syncedSessions);
      store.setSessions(syncedSessions);
    }
  }, [watchlists.length, isStoreLoaded]);

  useEffect(() => {
    if (!isStoreLoaded) return;
    store.setCustomModes(customModes).catch(err => console.error(err));
  }, [customModes, isStoreLoaded]);

  useEffect(() => {
    if (!isStoreLoaded) return;
    store.setWatchlists(watchlists).catch(err => console.error(err));
  }, [watchlists, isStoreLoaded]);

  useEffect(() => {
    if (!isStoreLoaded) return;
    store.setSessions(sessions).catch(err => console.error(err));
  }, [sessions, isStoreLoaded]);

  useEffect(() => {
    if (!isStoreLoaded) return;
    store.setCategories(customCategories).catch(err => console.error(err));
  }, [customCategories, isStoreLoaded]);

  useEffect(() => {
    if (!isStoreLoaded) return;
    store.setMode(currentMode).catch(err => console.error(err));
  }, [currentMode, isStoreLoaded]);

  useEffect(() => {
    if (!isStoreLoaded) return;
    store.setChannels(channels).catch(err => console.error(err));
  }, [channels, isStoreLoaded]);

  useEffect(() => {
    if (!isStoreLoaded) return;
    store.setSchedules(schedules).catch(err => console.error(err));
  }, [schedules, isStoreLoaded]);

  const handleAddCategory = (mode: Mode, category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    setCustomCategories(prev => {
      const existing = prev[mode] || [];
      if (existing.includes(trimmed)) return prev;
      return { ...prev, [mode]: [...existing, trimmed] };
    });
  };

  const handleDeleteCategory = (mode: Mode, category: string) => {
    setCustomCategories(prev => {
      const existing = prev[mode] || [];
      return { ...prev, [mode]: existing.filter(c => c !== category) };
    });
  };

  const handleRenameCategory = (mode: Mode, oldCategory: string, newCategory: string) => {
    const trimmedNew = newCategory.trim();
    if (!trimmedNew || oldCategory === trimmedNew) return;

    setCustomCategories(prev => {
      const existing = prev[mode] || [];
      const hasOld = existing.includes(oldCategory);
      let updated = hasOld ? existing.map(c => c === oldCategory ? trimmedNew : c) : [...existing, trimmedNew];
      return { ...prev, [mode]: Array.from(new Set(updated)) };
    });

    setWatchlists(prev => prev.map(w => {
      if (w.section === oldCategory) {
        return { ...w, section: trimmedNew };
      }
      return w;
    }));
  };

  const handleReorderCategories = (mode: Mode, newCategories: string[]) => {
    setCustomCategories(prev => ({
      ...prev,
      [mode]: newCategories
    }));
  };
  
  const [activeFile, setActiveFile] = useState<any>(null);
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [activeWatchlistTitle, setActiveWatchlistTitle] = useState<string>('');

  const [activeFiles, setActiveFiles] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [activeInitialTime, setActiveInitialTime] = useState<number>(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const activeTheme = customModes[currentMode] || MODES[currentMode];

  const handleAddWatchlist = (newList: Watchlist | Watchlist[]) => {
    setWatchlists(prev => {
      const itemsToAdd = Array.isArray(newList) ? newList : [newList];
      const updatedPrev = [...prev];
      const completelyNew: Watchlist[] = [];

      itemsToAdd.forEach(item => {
        const existingIdx = updatedPrev.findIndex(existing => {
          if (existing.folderPath && item.folderPath && existing.folderPath.trim().toLowerCase() === item.folderPath.trim().toLowerCase()) {
            return true;
          }
          if (existing.folderName && item.folderName && existing.title && item.title && 
              existing.folderName.trim().toLowerCase() === item.folderName.trim().toLowerCase() && 
              existing.title.trim().toLowerCase() === item.title.trim().toLowerCase()) {
            return true;
          }
          return false;
        });

        if (existingIdx !== -1) {
          // Merge files
          const existing = updatedPrev[existingIdx];
          const fileMap = new Map();
          existing.files.forEach(f => fileMap.set((f as any).customPath || f.name, f));
          item.files.forEach(f => fileMap.set((f as any).customPath || f.name, f));
          const mergedFiles = Array.from(fileMap.values());
          
          // Merge seasons
          const mergedSeasons = existing.seasons ? [...existing.seasons] : [];
          if (item.seasons) {
             item.seasons.forEach(s => {
                const existingSeason = mergedSeasons.find(ms => ms.name === s.name);
                if (existingSeason) {
                   const sFileMap = new Map();
                   existingSeason.files.forEach(f => sFileMap.set((f as any).customPath || f.name, f));
                   s.files.forEach(f => sFileMap.set((f as any).customPath || f.name, f));
                   existingSeason.files = Array.from(sFileMap.values());
                } else {
                   mergedSeasons.push(s);
                }
             });
          }

          const updated = {
            ...existing,
            files: mergedFiles,
            seasons: mergedSeasons.length > 0 ? mergedSeasons : undefined,
            episodesCount: mergedFiles.length,
            seriesCount: mergedSeasons.length > 0 ? mergedSeasons.length : 1,
          };
          
          updatedPrev.splice(existingIdx, 1);
          completelyNew.push(updated);
        } else {
          completelyNew.push(item);
        }
      });

      if (completelyNew.length === 0) {
        return updatedPrev;
      }
      return [...completelyNew, ...updatedPrev];
    });
  };

  const handleUpdateWatchlist = (updatedList: Watchlist) => {
    setWatchlists(prev => prev.map(w => w.id === updatedList.id ? updatedList : w));
  };

  const handleDeleteWatchlist = (id: string) => {
    setWatchlists(prev => prev.filter(w => w.id !== id));
  };

  const handleAddSession = (newSession: Session) => {
    setSessions(prev => [newSession, ...prev]);
  };

  const handleUpdateSession = (updatedSession: Session) => {
    setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const handlePlay = (
    file?: any, 
    title?: string, 
    watchlistTitle?: string, 
    files?: any[], 
    index?: number,
    sessionId?: string,
    watchlistId?: string,
    initialTime?: number,
    channelId?: string
  ) => {
    if (currentView !== 'player') {
      setPreviousView(currentView);
    }
    setIsFloating(false);
    setActiveFile(file || null);
    setActiveTitle(title || 'مقطع 1');
    setActiveWatchlistTitle(watchlistTitle || 'قائمة التشغيل');
    setActiveFiles(files || []);
    setActiveIndex(index || 0);
    setActiveInitialTime(initialTime || 0);
    setActiveSessionId(sessionId || null);
    setActiveWatchlistId(watchlistId || null);
    setActiveChannelId(channelId || null);
    
    // Save state for auto-resume
    if (watchlistId && index !== undefined) {
      store.setLastPlaybackState({
        watchlistId,
        channelId,
        fileIndex: index,
        sessionId
      });
    }
    setCurrentView('player');
  };

  const handleStopPlayer = () => {
    store.setLastPlaybackState(null);
    setCurrentView(previousView);
  };

  const handlePlayChannelFromPlayer = (channel: Channel) => {
    const np = autoAssignWatchlistsToChannels(channels, watchlists);
    const resolvedChan = np.find(c => c.id === channel.id) || channel;
    const nowPlaying = getChannelNowPlaying(resolvedChan, watchlists);
    if (!nowPlaying) return;
    handlePlay(
      nowPlaying.currentFile,
      nowPlaying.currentEpisodeTitle,
      `${channel.title} - ${nowPlaying.currentWatchlistTitle}`,
      nowPlaying.allFiles,
      nowPlaying.currentEpisodeIndex,
      undefined,
      nowPlaying.currentWatchlistId,
      nowPlaying.initialTime,
      channel.id
    );
  };

  const handleProgressUpdate = useCallback((newIndex: number, currentTime?: number) => {
    if (activeSessionId) {
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, lastWatchedIndex: newIndex, lastWatchedTime: currentTime } : s));
    }
    if (activeWatchlistId) {
      setWatchlists(prev => prev.map(w => w.id === activeWatchlistId ? { 
        ...w, 
        lastWatchedIndex: newIndex, 
        lastWatchedTime: currentTime,
        lastWatched: `الحلقة ${newIndex + 1}`,
        progress: Math.min(100, Math.round(((newIndex + 1) / Math.max(1, w.episodesCount || w.files?.length || 1)) * 100)) 
      } : w));
    }
  }, [activeSessionId, activeWatchlistId]);

  const isBroadcastingView = currentView === 'channels' || currentView === 'schedule';

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden text-white font-sans selection:bg-white/30 dir-rtl">
      {/* Desktop Tauri TitleBar */}


      <AnimatePresence mode="wait">
        {isBroadcastingView ? (
          <motion.div
            key="broadcasting-neutral-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-gradient-to-br from-slate-950 via-zinc-900 to-stone-950"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.12),transparent_50%)]" />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          </motion.div>
        ) : (
          <motion.div
            key={`${currentMode}-${activeTheme.bgImage || 'no-bg'}-${activeTheme.gradient}`}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
          >
            {/* Base Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${activeTheme.gradient} opacity-85`} />

            {/* Mode Background Image */}
            {activeTheme.bgImage && (
              <div 
                className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
                style={{ 
                  backgroundImage: `url('${activeTheme.bgImage}')`,
                  opacity: (activeTheme.bgOpacity !== undefined ? activeTheme.bgOpacity : 50) / 100
                }}
              />
            )}

            {/* Dark Overlay for Readability */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          </motion.div>
        )}
      </AnimatePresence>

      
      {/* Dynamic Ambient Glass Glow Orbs driven by Custom Theme */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full dynamic-theme-orb-1 blur-[110px] opacity-70 pointer-events-none z-0 transition-all duration-700" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full dynamic-theme-orb-2 blur-[110px] opacity-60 pointer-events-none z-0 transition-all duration-700" />

      {/* Special Kids Mode Floating Cartoon Elements */}
      {currentMode === 'kids' && !isBroadcastingView && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-10 right-20 text-6xl opacity-30 select-none"
          >
            ⭐
          </motion.div>
          <motion.div 
            animate={{ y: [0, 25, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/3 left-16 text-7xl opacity-25 select-none"
          >
            🎈
          </motion.div>
          <motion.div 
            animate={{ y: [-10, 15, -10], rotate: [0, -15, 15, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-20 right-1/4 text-6xl opacity-30 select-none"
          >
            🎨
          </motion.div>
          <motion.div 
            animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-12 left-1/3 text-7xl select-none"
          >
            ✨
          </motion.div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-yellow-300/20 via-pink-400/10 to-transparent"></div>
        </div>
      )}
      
      {/* Texture overlay for premium feel */}
      <div className="absolute inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>

      {/* Main Layout */}
      <div className="relative z-10 flex-1 flex w-full h-full flex-row min-h-0 overflow-hidden">
        {currentView !== 'player' && (
          <Sidebar 
            currentView={currentView} 
            setCurrentView={setCurrentView} 
          />
        )}
        
        {currentView !== 'player' && (
          <main className="flex-1 h-full overflow-y-auto relative no-scrollbar">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={currentView}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.08 }}
                className="w-full min-h-full"
              >
                {currentView === 'home' && (
                  <HomeView 
                    currentMode={currentMode} 
                    setCurrentMode={setCurrentMode} 
                    customModes={customModes}
                    watchlists={watchlists}
                    onPlay={handlePlay}
                    onNavigate={setCurrentView}
                  />
                )}
                {currentView === 'channels' && (
                  <ChannelsView
                    initialTab="channels"
                    channels={channels}
                    watchlists={watchlists}
                    schedules={schedules}
                    onUpdateChannels={setChannels}
                    onUpdateSchedules={setSchedules}
                    onPlay={handlePlay}
                  />
                )}
                {currentView === 'schedule' && (
                  <ChannelsView
                    initialTab="schedule"
                    channels={channels}
                    watchlists={watchlists}
                    schedules={schedules}
                    onUpdateChannels={setChannels}
                    onUpdateSchedules={setSchedules}
                    onPlay={handlePlay}
                  />
                )}
                {currentView === 'library' && (
                  <LibraryView 
                    onPlay={handlePlay} 
                    watchlists={watchlists} 
                    schedules={schedules}
                    onUpdateSchedules={(newSchs) => {
                      setSchedules(newSchs);
                      store.setSchedules(newSchs);
                    }}
                    sessions={sessions}
                    onAddSession={handleAddSession}
                    onUpdateSession={handleUpdateSession}
                    currentMode={currentMode}
                    onSwitchMode={(newMode) => {
                      setCurrentMode(newMode);
                      store.setMode(newMode);
                    }}
                    customModes={customModes}
                    onUpdateModeTitle={(mode, newTitle) => setCustomModes(prev => ({ ...prev, [mode]: { ...prev[mode], title: newTitle } }))}
                    customCategories={customCategories[currentMode] || []}
                    allCustomCategories={customCategories}
                    onDeleteCategory={(cat) => handleDeleteCategory(currentMode, cat)}
                    onRenameCategory={(oldCat, newCat) => handleRenameCategory(currentMode, oldCat, newCat)}
                    onReorderCategories={(newCats) => handleReorderCategories(currentMode, newCats)}
                    onAddWatchlist={handleAddWatchlist}
                    onUpdateWatchlist={handleUpdateWatchlist}
                    onDeleteWatchlist={handleDeleteWatchlist}
                    onAddCategory={(cat) => handleAddCategory(currentMode, cat)}
                  />
                )}
                {currentView === 'create_watchlist' && (
                  <CreateWatchlistView 
                    onAddWatchlist={handleAddWatchlist} 
                    onUpdateWatchlist={handleUpdateWatchlist}
                    watchlists={watchlists}
                    currentMode={currentMode} 
                    customCategories={customCategories[currentMode] || []}
                    onAddCategory={(cat) => handleAddCategory(currentMode, cat)}
                    onDeleteCategory={(cat) => handleDeleteCategory(currentMode, cat)}
                  />
                )}
                {currentView === 'sessions' && (
                  <SmartSessionsView 
                    sessions={sessions}
                    onAddSession={handleAddSession}
                    onUpdateSession={handleUpdateSession}
                    onDeleteSession={handleDeleteSession}
                    watchlists={watchlists}
                    onPlay={handlePlay} 
                  />
                )}
                {currentView === 'settings' && (
                  <SettingsView 
                    currentMode={currentMode} 
                    setCurrentMode={setCurrentMode} 
                    customModes={customModes}
                    onUpdateModes={setCustomModes}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        )}
      </div>

      {/* Standalone Player Layer (Full Screen or Floating Overlay) */}
      {(currentView === 'player' || isFloating || isPipActive) && (
        <PlayerView 
          key={`${activeChannelId || 'nochan'}-${activeWatchlistId || 'nolist'}-${activeTitle || 'notitle'}`}
          onExit={() => {
            setIsFloating(true);
            const target = (previousView && previousView !== 'player') ? previousView : 'home';
            setCurrentView(target);
          }} 
          onRestoreView={() => {
            setIsFloating(false);
            if (currentView !== 'player') {
              setPreviousView(currentView);
            }
            setCurrentView('player');
          }}
          isFloating={isFloating && currentView !== 'player'}
          onToggleFloating={setIsFloating}
          onStopPlayer={() => {
            setIsFloating(false);
            setIsPipActive(false);
            setActiveFile(null);
            setActiveTitle('');
            setActiveChannelId(null);
            
            store.clearLastPlaybackState();
            setActiveFiles([]);
            setActiveWatchlistId(null);
            if (currentView === 'player') {
              const target = (previousView && previousView !== 'player') ? previousView : 'home';
              setCurrentView(target);
            }
          }}
          onPipStateChange={setIsPipActive}
          file={activeFile} 
          title={activeTitle} 
          watchlistTitle={activeWatchlistTitle} 
          files={activeFiles} 
          initialIndex={activeIndex} 
          initialTime={activeInitialTime}
          currentMode={currentMode}
          onProgressUpdate={handleProgressUpdate}
          channels={channels}
          currentChannelId={activeChannelId || undefined}
          watchlists={watchlists}
          schedules={schedules}
          onPlayChannel={handlePlayChannelFromPlayer}
          customModes={customModes}
        />
      )}

      {/* FLOATING RETURN LAUNCHER BUTTON (BOTTOM-LEFT) WHEN EXITED PLAYER */}
      {currentView !== 'player' && !isFloating && (activeFile || activeTitle || activeChannelId || isPipActive) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: -30 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8, x: -30 }}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-3"
        >
          <button
            onClick={() => {
              if (currentView !== 'player') {
                setPreviousView(currentView);
              }
              setCurrentView('player');
            }}
            className="group relative flex items-center gap-3 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-black font-black p-2.5 sm:px-4 sm:py-3 rounded-2xl shadow-[0_10px_30px_rgba(245,158,11,0.5)] border border-amber-300 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="انقر هنا لفتح المشغل والعودة للفيديو"
          >
            {/* Animated Pulse Indicator */}
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-300 border border-black/40"></span>
            </span>

            <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-md">
              <Play className="w-5 h-5 fill-amber-400 text-amber-400 translate-x-[1px]" />
            </div>

            <div className="flex flex-col text-right pr-1 hidden sm:flex">
              <span className="text-xs font-black text-black leading-tight">العودة للمشغل 🎬</span>
              <span className="text-[10px] text-black/80 font-bold">انقر لإعادة فتح النافذة</span>
            </div>
          </button>
        </motion.div>
      )}

      <ScheduleNotifier
        schedules={schedules}
        watchlists={watchlists}
        channels={channels}
        onPlay={handlePlay}
        onUpdateSchedules={(newSchs) => {
          setSchedules(newSchs);
          store.setSchedules(newSchs);
        }}
      />
    </div>
  );
}
