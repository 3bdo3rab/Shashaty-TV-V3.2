import React, { useState } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Settings2, Clock, Repeat, ListOrdered, Plus, X, Layers, CheckCircle2, Trash2, Pencil, RotateCcw, Search, Filter, BookOpen, Music, Film, Globe, Star, Radio, Sparkles, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft, GripVertical, Copy, LayoutList, LayoutGrid, ArrowUp, ArrowDown } from 'lucide-react';
import { Session, Watchlist, ScheduleSlot, Mode } from '../types';
import { naturalCompare, sortSmartMediaFiles, normalizeArabicText } from '../utils/sorter';
import { ConfirmModal } from '../components/ConfirmModal';

const CATEGORY_NAMES: Record<string, string> = {
  kids: 'أطفالي 👶',
  night: 'عائلتي 🌙',
  family: 'المسلسلات 👨‍👩‍👧‍👦',
  cinema: 'الأفلام 🎬',
  docs: 'الوثائقيات 🌍',
  quran: 'القرآن الكريم 📖',
  music: 'الموسيقى 🎵'
};

const MODE_ICONS: Record<Mode, any> = {
  kids: Star,
  night: Sparkles,
  family: Radio,
  cinema: Film,
  docs: Globe,
  quran: BookOpen,
  music: Music
};

interface SmartSessionsViewProps {
  sessions: Session[];
  onAddSession: (session: Session) => void;
  onUpdateSession?: (session: Session) => void;
  onDeleteSession: (id: string) => void;
  watchlists: Watchlist[];
  onPlay: (file?: any, title?: string, watchlistTitle?: string, files?: any[], index?: number, sessionId?: string, watchlistId?: string) => void;
}

export const SmartSessionsView: React.FC<SmartSessionsViewProps> = ({ 
  sessions = [], 
  onAddSession,
  onUpdateSession,
  onDeleteSession,
  watchlists = [], 
  onPlay 
}) => {
  const { showAlert } = useDialog();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [creationType, setCreationType] = useState<'schedule' | 'watchlists'>('schedule');
  const [selectedWatchlistIds, setSelectedWatchlistIds] = useState<string[]>([]);
  const [slotViewMode, setSlotViewMode] = useState<'timeline' | 'cards'>('timeline');
  
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([
    { id: '1', mode: 'kids', watchlistId: '', watchlistTitle: '', durationMinutes: 30 },
    { id: '2', mode: 'quran', watchlistId: '', watchlistTitle: '', durationMinutes: 15 },
    { id: '3', mode: 'cinema', watchlistId: '', watchlistTitle: '', durationMinutes: 60 }
  ]);

  const [strategy, setStrategy] = useState<'alternate' | 'random' | 'sequential' | 'schedule'>('schedule');
  const [loopSequence, setLoopSequence] = useState(true);
  const [breakBetweenItems, setBreakBetweenItems] = useState(0);
  const [transitionType, setTransitionType] = useState<'episode' | 'time'>('episode');
  const [transitionMinutes, setTransitionMinutes] = useState<number>(30);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const toggleWatchlistSelection = (id: string) => {
    setSelectedWatchlistIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleOpenCreateModal = () => {
    setEditingSessionId(null);
    setSessionTitle('');
    setCreationType('schedule');
    setSelectedWatchlistIds([]);
    setScheduleSlots([
      { id: Date.now().toString() + '-1', mode: 'kids', watchlistId: watchlists.find(w => w.section === 'kids')?.id || '', watchlistTitle: watchlists.find(w => w.section === 'kids')?.title || '', durationMinutes: 30 },
      { id: Date.now().toString() + '-2', mode: 'quran', watchlistId: watchlists.find(w => w.section === 'quran')?.id || '', watchlistTitle: watchlists.find(w => w.section === 'quran')?.title || '', durationMinutes: 15 },
      { id: Date.now().toString() + '-3', mode: 'cinema', watchlistId: watchlists.find(w => w.section === 'cinema')?.id || '', watchlistTitle: watchlists.find(w => w.section === 'cinema')?.title || '', durationMinutes: 60 }
    ]);
    setStrategy('schedule');
    setLoopSequence(true);
    setBreakBetweenItems(0);
    setTransitionType('episode');
    setTransitionMinutes(30);
    setSearchQuery('');
    setSelectedCategoryFilter('all');
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (session: Session) => {
    setEditingSessionId(session.id);
    setSessionTitle(session.title);
    setCreationType(session.scheduleSlots && session.scheduleSlots.length > 0 ? 'schedule' : 'watchlists');
    setSelectedWatchlistIds(session.selectedWatchlistIds || session.items.map(i => i.watchlistId).filter(Boolean) as string[]);
    if (session.scheduleSlots && session.scheduleSlots.length > 0) {
      setScheduleSlots(session.scheduleSlots);
    }
    setStrategy(session.strategy || (session.scheduleSlots && session.scheduleSlots.length > 0 ? 'schedule' : 'alternate'));
    setLoopSequence(session.loopSequence);
    setBreakBetweenItems(session.breakBetweenItems || 0);
    setTransitionType(session.transitionType || 'episode');
    setTransitionMinutes(session.transitionMinutes || 30);
    setSearchQuery('');
    setSelectedCategoryFilter('all');
    setShowCreateModal(true);
  };

  const addScheduleSlot = () => {
    const newSlot: ScheduleSlot = {
      id: Date.now().toString(),
      mode: 'kids',
      watchlistId: '',
      watchlistTitle: '',
      durationMinutes: 30
    };
    setScheduleSlots(prev => [...prev, newSlot]);
  };

  const updateScheduleSlot = (id: string, updates: Partial<ScheduleSlot>) => {
    setScheduleSlots(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, ...updates };
      if (updates.mode && updates.mode !== s.mode) {
        // Mode changed -> Reset watchlist to force user to pick from new mode
        updated.watchlistId = '';
        updated.watchlistTitle = '';
      } else if (updates.watchlistId) {
        const found = watchlists.find(w => w.id === updates.watchlistId);
        if (found) {
          updated.watchlistTitle = found.title;
        }
      }
      return updated;
    }));
  };

  const removeScheduleSlot = async (id: string) => {
    if (scheduleSlots.length <= 1) {
      await showAlert('يجب أن تحتوي الجلسة على وضع واحد على الأقل.');
      return;
    }
    setScheduleSlots(prev => prev.filter(s => s.id !== id));
  };

  const duplicateScheduleSlot = (index: number) => {
    const slotToDup = scheduleSlots[index];
    const newSlot: ScheduleSlot = {
      ...slotToDup,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6)
    };
    setScheduleSlots(prev => {
      const updated = [...prev];
      updated.splice(index + 1, 0, newSlot);
      return updated;
    });
  };

  const applyPresetSequence = (presetKey: 'family' | 'relax' | 'kids_quran') => {
    const baseId = Date.now();
    if (presetKey === 'family') {
      setScheduleSlots([
        { id: baseId + '1', mode: 'kids', durationMinutes: 30, transitionType: 'time' },
        { id: baseId + '2', mode: 'quran', transitionType: 'episode', transitionEpisodes: 1 },
        { id: baseId + '3', mode: 'family', durationMinutes: 45, transitionType: 'time' },
        { id: baseId + '4', mode: 'cinema', transitionType: 'episode', transitionEpisodes: 1 }
      ]);
    } else if (presetKey === 'relax') {
      setScheduleSlots([
        { id: baseId + '1', mode: 'quran', transitionType: 'episode', transitionEpisodes: 1 },
        { id: baseId + '2', mode: 'docs', durationMinutes: 30, transitionType: 'time' },
        { id: baseId + '3', mode: 'music', durationMinutes: 20, transitionType: 'time' }
      ]);
    } else if (presetKey === 'kids_quran') {
      setScheduleSlots([
        { id: baseId + '1', mode: 'kids', durationMinutes: 20, transitionType: 'time' },
        { id: baseId + '2', mode: 'quran', transitionType: 'episode', transitionEpisodes: 1 }
      ]);
    }
  };

  const moveScheduleSlot = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= scheduleSlots.length) return;
    setScheduleSlots(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    });
  };

  const handleSaveSession = async () => {
    const finalTitle = sessionTitle.trim() || (creationType === 'schedule' ? `جلسة خارقة (${scheduleSlots.length} أوضاع)` : `جلسة عادية (${selectedWatchlistIds.length || watchlists.length} قوائم)`);

    if (creationType === 'schedule') {
      if (scheduleSlots.length === 0) {
        await showAlert('يرجى إضافة وضع واحد على الأقل في الجدول.');
        return;
      }

      const items = scheduleSlots.map(s => {
        const wl = watchlists.find(w => w.id === s.watchlistId);
        return {
          seriesName: s.watchlistTitle || wl?.title || `وضع ${CATEGORY_NAMES[s.mode] || s.mode}`,
          episodesCount: wl?.files?.length || wl?.episodesCount || 1,
          watchlistId: s.watchlistId,
          mode: s.mode,
          durationMinutes: s.durationMinutes
        };
      });

      const sessionData: Session = {
        id: editingSessionId || Date.now().toString(),
        title: finalTitle,
        items,
        scheduleSlots,
        loopSequence,
        breakBetweenItems,
        breakBetweenLoops: 0,
        strategy: 'schedule',
        lastWatchedIndex: 0,
        transitionType,
        transitionMinutes
      };

      if (editingSessionId && onUpdateSession) {
        onUpdateSession(sessionData);
      } else if (onAddSession) {
        onAddSession(sessionData);
      }
    } else {
      let activeWatchlistIds = selectedWatchlistIds;
      if (activeWatchlistIds.length === 0 && watchlists.length > 0) {
        activeWatchlistIds = watchlists.map(w => w.id);
      }

      if (activeWatchlistIds.length === 0) {
        await showAlert('يرجى إضافة قائمة تشغيل واحدة على الأقل للمكتبة أولاً.');
        return;
      }

      const selectedLists = watchlists.filter(w => activeWatchlistIds.includes(w.id));
      const items = selectedLists.map(w => ({
        seriesName: w.title,
        episodesCount: w.files?.length || w.episodesCount || 1,
        watchlistId: w.id
      }));

      const sessionData: Session = {
        id: editingSessionId || Date.now().toString(),
        title: finalTitle,
        items,
        loopSequence,
        breakBetweenItems,
        breakBetweenLoops: 0,
        selectedWatchlistIds: activeWatchlistIds,
        strategy: strategy === 'schedule' ? 'alternate' : strategy,
        lastWatchedIndex: 0,
        transitionType,
        transitionMinutes
      };

      if (editingSessionId && onUpdateSession) {
        onUpdateSession(sessionData);
      } else if (onAddSession) {
        onAddSession(sessionData);
      }
    }

    setEditingSessionId(null);
    setSessionTitle('');
    setSelectedWatchlistIds([]);
    setShowCreateModal(false);
  };

  // Launching a smart session with instant switching between schedule slots & watchlists
  const handleStartSession = async (session: Session, restartFromBeginning: boolean = false) => {
    let mergedQueue: any[] = [];

    // Reuse queue if resuming session
    if (!restartFromBeginning && session.queue && session.queue.length > 0) {
      mergedQueue = [...session.queue];
    } else {
      if (session.scheduleSlots && session.scheduleSlots.length > 0) {
        // Build Queue based on Schedule Slots
        session.scheduleSlots.forEach((slot, slotIdx) => {
          let wl = watchlists.find(w => w.id === slot.watchlistId);
          if (!wl) {
            wl = watchlists.find(w => w.section === slot.mode) || watchlists.find(w => w.targetMode === slot.mode) || watchlists[slotIdx % watchlists.length];
          }

          let rawFiles: any[] = [];
          if (wl) {
            if (wl.seasons && wl.seasons.length > 0) {
              const sortedSeasons = [...wl.seasons].sort((a, b) => naturalCompare(a.name, b.name));
              sortedSeasons.forEach(s => {
                rawFiles.push(...sortSmartMediaFiles(s.files || []));
              });
            } else if (wl.files && wl.files.length > 0) {
              rawFiles = sortSmartMediaFiles(wl.files);
            } else {
              rawFiles = Array.from({ length: wl.episodesCount || 3 }).map((_, i) => ({
                name: `${wl?.title} - حلقة ${i + 1}`
              }));
            }
          } else {
            // Fallback placeholder items for this slot mode
            const modeLabel = CATEGORY_NAMES[slot.mode] || slot.mode;
            rawFiles = [
              { name: `مقطع وضع ${modeLabel} - 1` },
              { name: `مقطع وضع ${modeLabel} - 2` }
            ];
          }

          rawFiles.forEach((f, i) => {
            const fileObj = f.file || f;
            const fileTitle = f.title || f.name?.replace(/\.[^/.]+$/, "") || `${wl?.title || 'مقطع'} - حلقة ${i + 1}`;
            mergedQueue.push({
              file: fileObj,
              title: fileTitle,
              watchlistName: `${slot.watchlistTitle || wl?.title || 'جدول الأوضاع'} (${CATEGORY_NAMES[slot.mode] || slot.mode})`,
              mode: slot.mode,
              durationMinutes: Number(slot.durationMinutes) || 30,
              transitionType: slot.transitionType || 'episode',
              transitionMinutes: slot.transitionMinutes || 10,
              transitionEpisodes: slot.transitionEpisodes || 1,
              slotId: slot.id,
              slotIndex: slotIdx
            });
          });
        });
      } else {
        // Collect watchlists for this session
        const targetWatchlists = session.selectedWatchlistIds && session.selectedWatchlistIds.length > 0
          ? watchlists.filter(w => session.selectedWatchlistIds!.includes(w.id))
          : watchlists;

        if (targetWatchlists.length === 0) {
          await showAlert('لا توجد قوائم تشغيل مرتبطة بهذه الجلسة. يرجى إضافة محتوى أولاً.');
          return;
        }

        const listsWithFiles = targetWatchlists.map(w => {
          let rawFiles: any[] = [];
          if (w.seasons && w.seasons.length > 0) {
            const sortedSeasons = [...w.seasons].sort((a, b) => naturalCompare(a.name, b.name));
            sortedSeasons.forEach(s => {
              rawFiles.push(...sortSmartMediaFiles(s.files || []));
            });
          } else if (w.files && w.files.length > 0) {
            rawFiles = sortSmartMediaFiles(w.files);
          } else {
            rawFiles = Array.from({ length: w.episodesCount || 3 }).map((_, i) => ({
              name: `${w.title} - حلقة ${i + 1}`
            }));
          }

          const filesArr = rawFiles.map((f, i) => {
            const fileObj = f.file || f;
            const fileTitle = f.title || f.name?.replace(/\.[^/.]+$/, "") || `${w.title} - حلقة ${i + 1}`;
            return {
              file: fileObj,
              title: fileTitle,
              watchlistName: w.title,
              mode: w.targetMode || 'family'
            };
          });

          return { watchlistTitle: w.title, files: filesArr };
        });

        if (session.strategy === 'random') {
          const allItems = listsWithFiles.flatMap(l => l.files);
          mergedQueue.push(...allItems.sort(() => Math.random() - 0.5));
        } else if (session.strategy === 'sequential') {
          listsWithFiles.forEach(l => mergedQueue.push(...l.files));
        } else {
          const maxLen = Math.max(...listsWithFiles.map(l => l.files.length));
          for (let i = 0; i < maxLen; i++) {
            for (const listObj of listsWithFiles) {
              if (listObj.files[i]) {
                mergedQueue.push(listObj.files[i]);
              }
            }
          }
        }
      }

      if (!session.scheduleSlots || session.scheduleSlots.length === 0) {
        if (session.transitionType === 'time' && session.transitionMinutes) {
          mergedQueue.forEach((item, idx) => {
            item.durationMinutes = session.transitionMinutes;
            item.slotId = `custom-slot-${idx}`;
            item.slotIndex = idx;
          });
        }
      }
    }

    if (mergedQueue.length === 0) {
      await showAlert('لم يتم العثور على مقاطع فيديو أو ملفات في القوائم المحددة.');
      return;
    }

    let startIndex = 0;
    let initialTime = 0;
    if (!restartFromBeginning && session.lastWatchedIndex !== undefined && session.lastWatchedIndex >= 0 && session.lastWatchedIndex < mergedQueue.length) {
      startIndex = session.lastWatchedIndex;
      initialTime = session.lastWatchedTime || 0;
    }

    // Save updated queue and progress
    const updatedSession = {
      ...session,
      queue: mergedQueue,
      lastWatchedIndex: startIndex,
      lastWatchedTime: initialTime
    };
    if (onUpdateSession) {
      onUpdateSession(updatedSession);
    }

    // Launch player immediately
    onPlay(
      mergedQueue[startIndex].file,
      mergedQueue[startIndex].title,
      `جلسة ذكية: ${session.title}`,
      mergedQueue,
      startIndex,
      session.id,
      undefined,
      initialTime
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 sm:p-8 lg:p-12 h-full relative w-full pb-32 md:pb-12"
    >
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight drop-shadow-md mb-2 sm:mb-4">الجلسات الذكية</h1>
          <p className="text-lg sm:text-xl text-white/70">جدولة وتغيير الأوضاع والمحتوى تلقائياً وفورياً بحسب جدولك المفضل</p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="bg-white text-black px-6 py-3 rounded-xl hover:scale-105 transition-all font-semibold flex items-center gap-2 shadow-lg cursor-pointer shrink-0"
        >
          <Plus className="w-5 h-5" /> جلسة جديدة
        </button>
      </header>

      {sessions.length === 0 ? (
        <div className="glass-card rounded-[2.5rem] p-12 text-center my-12 max-w-xl mx-auto flex flex-col items-center">
          <div className="p-6 bg-white/10 rounded-full mb-4">
            <Settings2 className="w-12 h-12 text-white/80" />
          </div>
          <h2 className="text-2xl font-bold mb-2">لا توجد جلسات ذكية مخصصة</h2>
          <p className="text-white/60 mb-6">
            اضغط على زر "جلسة جديدة" لإنشاء جدول زمني ذكي يربط بين الأوضاع وقوائم التشغيل بالتتابع المباشر.
          </p>
          <button 
            onClick={handleOpenCreateModal}
            className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform"
          >
            إنشاء أول جلسة ذكية
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {sessions.map((session, i) => {
            const hasProgress = (session.lastWatchedIndex !== undefined && session.lastWatchedIndex > 0) || (session.lastWatchedTime !== undefined && session.lastWatchedTime > 3);
            const isScheduleSession = session.scheduleSlots && session.scheduleSlots.length > 0;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={session.id}
                className={`p-6 sm:p-8 rounded-[2rem] relative overflow-hidden group flex flex-col justify-between transition-all border ${
                  isScheduleSession
                    ? 'bg-gradient-to-br from-amber-950/40 via-zinc-900/90 to-amber-900/20 border-amber-400/50 shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:border-amber-400/80'
                    : 'glass-card border-white/10'
                }`}
              >
                <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
                  isScheduleSession ? 'bg-amber-500/20 group-hover:bg-amber-500/30' : 'bg-white/5 group-hover:bg-white/10'
                }`} />
                
                <div className="relative z-10">
                  {/* Top Header: Session Title & Options */}
                  <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <h2 className="text-xl sm:text-2xl font-extrabold text-white shadow-sm leading-snug break-words">
                        {session.title}
                      </h2>
                      {isScheduleSession && <Sparkles className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={() => handleOpenEditModal(session)}
                        className="p-2.5 text-white/70 hover:text-white glass rounded-full transition-all hover:bg-white/20 cursor-pointer"
                        title="تعديل الجلسة"
                      >
                        <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <button 
                        onClick={() => setDeletingSessionId(session.id)}
                        className="p-2.5 text-white/40 hover:text-red-400 glass rounded-full transition-colors cursor-pointer"
                        title="حذف الجلسة"
                      >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Actions & Status Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isScheduleSession ? (
                        <span className="text-xs text-amber-200 bg-gradient-to-r from-amber-500/30 via-orange-500/30 to-amber-500/30 border border-amber-400/50 px-3 py-1.5 rounded-full inline-flex items-center gap-1 font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                          ⚡ جلسة خارقة (جدول زمني متتابع)
                        </span>
                      ) : (
                        <span className="text-xs text-blue-200 bg-blue-500/20 border border-blue-400/30 px-3 py-1.5 rounded-full inline-block font-semibold">
                          {session.strategy === 'random' ? 'جلسة عادية (عرض عشوائي) 🎲' : 'جلسة عادية (تناوب قوائم) 🔄'}
                        </span>
                      )}
                      {hasProgress && (
                        <span className="text-xs text-green-300 bg-green-500/20 border border-green-500/30 px-3 py-1.5 rounded-full inline-block font-semibold animate-pulse">
                          متابعة من المقطع {(session.lastWatchedIndex || 0) + 1} 🎯
                        </span>
                      )}
                    </div>

                    {/* Play / Resume Controls */}
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                      {hasProgress && (
                        <button 
                          onClick={() => handleStartSession(session, true)} 
                          className="px-3.5 py-2.5 text-white/80 hover:text-amber-300 glass rounded-full transition-all flex items-center gap-1.5 text-xs sm:text-sm font-bold cursor-pointer hover:bg-white/10 shrink-0"
                          title="إعادة التشغيل من البداية"
                        >
                          <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="whitespace-nowrap">من البداية</span>
                        </button>
                      )}

                      <button 
                        onClick={() => handleStartSession(session, false)} 
                        className={`h-11 sm:h-12 px-5 sm:px-6 rounded-full flex items-center justify-center gap-2 font-bold hover:scale-105 transition-all shadow-xl cursor-pointer shrink-0 ${
                          hasProgress
                            ? 'bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-600 text-black shadow-[0_0_20px_rgba(16,185,129,0.5)] border border-emerald-300'
                            : isScheduleSession
                              ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)] border border-amber-300 hover:shadow-[0_0_25px_rgba(245,158,11,0.7)]'
                              : 'bg-white text-black'
                        }`}
                        title={hasProgress ? "متابعة المشاهدة من حيث توقفت" : "بدء الجلسة"}
                      >
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-black shrink-0" />
                        <span className="text-xs sm:text-base font-extrabold whitespace-nowrap">
                          {hasProgress 
                            ? `متابعة الجلسة (${(session.lastWatchedIndex || 0) + 1})` 
                            : isScheduleSession ? "تشغيل الخارقة ⚡" : "تشغيل الجلسة 🔄"
                          }
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 mb-8">
                    {isScheduleSession ? (
                      session.scheduleSlots!.map((slot, idx) => {
                        const IconComponent = MODE_ICONS[slot.mode] || Clock;
                        return (
                          <div key={idx} className="flex items-center justify-between gap-4 p-4 glass rounded-xl border border-white/10">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
                                <IconComponent className="w-5 h-5 text-amber-300" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-base line-clamp-1">{CATEGORY_NAMES[slot.mode] || slot.mode}</h4>
                                <p className="text-white/60 text-xs mt-0.5 line-clamp-1">
                                  القائمة: <span className="text-amber-200 font-semibold">{slot.watchlistTitle || 'جميع القوائم'}</span>
                                </p>
                              </div>
                            </div>
                            <div className="px-3 py-1 bg-white/10 rounded-lg text-xs font-bold text-white shrink-0">
                              {slot.durationMinutes || 30} دقيقة
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      session.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4 glass rounded-xl">
                          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-white/80 shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg">{item.seriesName}</h4>
                            <p className="text-white/50 text-sm">القائمة المشاركة في التناوب</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-4 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <Repeat className={`w-5 h-5 ${session.loopSequence ? 'text-green-400' : ''}`} />
                      {session.loopSequence ? 'تكرار الجلسة تلقائياً' : 'مرة واحدة'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/70 mr-auto">
                      <ListOrdered className="w-5 h-5" />
                      {isScheduleSession ? `${session.scheduleSlots!.length} أوضاع مبدلة` : `${session.items.length} قوائم مدمجة`}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal for Creating / Editing a Smart Session */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-6xl xl:max-w-7xl rounded-[2.5rem] p-6 sm:p-8 relative max-h-[92vh] overflow-y-auto no-scrollbar shadow-2xl border border-white/20"
            >
              <button 
                onClick={() => setShowCreateModal(false)}
                className="absolute top-6 left-6 p-3 glass rounded-full hover:bg-white hover:text-black transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-white/10 rounded-2xl">
                  <Settings2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold">{editingSessionId ? 'تعديل الجلسة الذكية' : 'إنشاء جلسة ذكية مخصصة'}</h2>
                  <p className="text-white/60 text-sm mt-1">حدد قوائم التشغيل المخصصة لكل وضع بالاسم والمدة بالتناوب الفوري</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Session Title Input */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">اسم الجلسة الذكية</label>
                  <input 
                    type="text" 
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    placeholder="مثال: جدول اليوم العائلي الشامل (أطفال + قرآن + سينما)"
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 text-base sm:text-lg"
                  />
                </div>

                {/* Session Type Switcher */}
                <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setCreationType('schedule')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 ${
                      creationType === 'schedule' ? 'bg-white text-black shadow-lg' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>جلسة خارقة ⚡</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationType('watchlists')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 ${
                      creationType === 'watchlists' ? 'bg-white text-black shadow-lg' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>جلسة عادية 🔄</span>
                  </button>
                </div>

                {creationType === 'schedule' ? (
                  /* Mode Schedule Slots Editor - Innovative Redesign */
                  <div className="space-y-5">
                    {/* Header & Controls Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/90 p-4 rounded-2xl border border-white/10 shadow-lg">
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                          <span>ترتيب وتسلسل الأوضاع (الجلسة الخارقة)</span>
                          <span className="text-xs text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30 font-bold">
                            {scheduleSlots.length} أوضاع
                          </span>
                        </h3>
                        <p className="text-xs text-white/60 mt-0.5">
                          حدد الترتيب الزمني وطريقة الانتقال التلقائي بين الأوضاع
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* Toggle View Mode */}
                        <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/10 text-xs">
                          <button
                            type="button"
                            onClick={() => setSlotViewMode('timeline')}
                            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              slotViewMode === 'timeline' ? 'bg-amber-400 text-black shadow-md' : 'text-white/60 hover:text-white'
                            }`}
                            title="عرض الترتيب الرأسي المباشر"
                          >
                            <LayoutList className="w-3.5 h-3.5" />
                            <span>رأسي 📜</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSlotViewMode('cards')}
                            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              slotViewMode === 'cards' ? 'bg-amber-400 text-black shadow-md' : 'text-white/60 hover:text-white'
                            }`}
                            title="عرض البطاقات الأفقية المتتابعة"
                          >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span>أفقي 🎞️</span>
                          </button>
                        </div>

                        {/* Add New Slot */}
                        <button
                          type="button"
                          onClick={addScheduleSlot}
                          className="text-xs bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black font-extrabold px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105"
                        >
                          <Plus className="w-4 h-4" />
                          <span>إضافة وضع جديد</span>
                        </button>
                      </div>
                    </div>

                    {/* Live Sequence Chain Ribbon (شريط مسار التسلسل التفاعلي) */}
                    <div className="bg-black/60 p-3 rounded-2xl border border-amber-500/30 overflow-x-auto no-scrollbar shadow-inner">
                      <div className="flex items-center gap-2 text-xs min-w-max">
                        <span className="text-[11px] font-bold text-amber-400/90 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-400/20 shrink-0">
                          مسار البث المباشر ⚡
                        </span>
                        {scheduleSlots.map((slot, idx) => {
                          const modeLabel = CATEGORY_NAMES[slot.mode] || slot.mode;
                          const isTime = slot.transitionType === 'time';
                          const transitionInfo = isTime 
                            ? `${slot.transitionMinutes || slot.durationMinutes || 30} د` 
                            : `${slot.transitionEpisodes || 1} حلقة`;

                          return (
                            <React.Fragment key={slot.id}>
                              <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/15 text-white transition-all">
                                <span className="w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="font-extrabold">{modeLabel}</span>
                                <span className="text-[10px] text-amber-300/80 bg-black/40 px-2 py-0.5 rounded-md font-mono">
                                  {transitionInfo}
                                </span>
                              </div>
                              {idx < scheduleSlots.length - 1 ? (
                                <ArrowLeft className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                              ) : (
                                <div className="flex items-center gap-1 text-[11px] text-green-400 font-bold bg-green-500/10 px-2.5 py-1 rounded-xl border border-green-500/20 shrink-0">
                                  <RotateCcw className="w-3 h-3 animate-spin" />
                                  <span>تكرار الجلسة</span>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Presets Section */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                      <span className="text-xs text-white/50 font-bold shrink-0">نماذج جاهزة:</span>
                      <button
                        type="button"
                        onClick={() => applyPresetSequence('family')}
                        className="text-xs bg-white/5 hover:bg-amber-500/20 text-white/80 hover:text-amber-200 border border-white/10 hover:border-amber-400/40 px-3 py-1 rounded-full transition-all shrink-0 cursor-pointer"
                      >
                        ⚡ عائلية شاملة (أطفال ➔ قرآن ➔ مسلسلات)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetSequence('relax')}
                        className="text-xs bg-white/5 hover:bg-amber-500/20 text-white/80 hover:text-amber-200 border border-white/10 hover:border-amber-400/40 px-3 py-1 rounded-full transition-all shrink-0 cursor-pointer"
                      >
                        🌙 جلسة هادئة (قرآن ➔ وثائقيات ➔ موسيقى)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetSequence('kids_quran')}
                        className="text-xs bg-white/5 hover:bg-amber-500/20 text-white/80 hover:text-amber-200 border border-white/10 hover:border-amber-400/40 px-3 py-1 rounded-full transition-all shrink-0 cursor-pointer"
                      >
                        👶 أطفال + قرآن
                      </button>
                    </div>

                    {/* Main Slots Editor Content */}
                    {slotViewMode === 'timeline' ? (
                      /* VERTICAL TIMELINE VIEW (عرض التسلسل الرأسي المباشر) */
                      <div className="space-y-3 relative before:absolute before:right-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-amber-400 before:via-indigo-500 before:to-amber-400/20 before:z-0">
                        <AnimatePresence>
                          {scheduleSlots.map((slot, index) => {
                            const isFirst = index === 0;
                            const isLast = index === scheduleSlots.length - 1;

                            return (
                              <motion.div
                                key={slot.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="relative z-10 pr-12"
                              >
                                {/* Timeline Node Badge */}
                                <div className="absolute right-3 top-5 w-7 h-7 rounded-full bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.6)] border-2 border-black z-20">
                                  {index + 1}
                                </div>

                                {/* Slot Card */}
                                <div className="glass rounded-2xl border border-amber-400/30 p-4 bg-zinc-950/80 shadow-xl space-y-3">
                                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-amber-300 bg-amber-500/20 border border-amber-400/30 px-3 py-1 rounded-xl">
                                        الوضع #{index + 1}
                                      </span>
                                      {slot.watchlistTitle && (
                                        <span className="text-xs text-white/70 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl truncate max-w-[180px]">
                                          {slot.watchlistTitle}
                                        </span>
                                      )}
                                    </div>

                                    {/* Reorder Up/Down, Duplicate & Delete Actions */}
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={isFirst}
                                        onClick={() => moveScheduleSlot(index, 'up')}
                                        className="px-2.5 py-1 text-xs font-bold text-white/80 hover:text-white bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/40 rounded-lg transition-all disabled:opacity-20 cursor-pointer flex items-center gap-1"
                                        title="تقديم للأعلى (أولاً) ⬆️"
                                      >
                                        <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="hidden sm:inline">أعلى</span>
                                      </button>

                                      <button
                                        type="button"
                                        disabled={isLast}
                                        onClick={() => moveScheduleSlot(index, 'down')}
                                        className="px-2.5 py-1 text-xs font-bold text-white/80 hover:text-white bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/40 rounded-lg transition-all disabled:opacity-20 cursor-pointer flex items-center gap-1"
                                        title="تأخير للأسفل (بعداً) ⬇️"
                                      >
                                        <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="hidden sm:inline">أسفل</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => duplicateScheduleSlot(index)}
                                        className="p-1.5 text-white/60 hover:text-amber-300 hover:bg-white/10 rounded-lg transition-colors cursor-pointer mr-1"
                                        title="نسخ هذا الوضع"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => removeScheduleSlot(slot.id)}
                                        className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                        title="حذف هذا الوضع"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Mode Selector */}
                                    <div>
                                      <label className="block text-xs font-bold text-amber-300/90 mb-1">اختر الوضع:</label>
                                      <select
                                        value={slot.mode}
                                        onChange={(e) => updateScheduleSlot(slot.id, { mode: e.target.value as Mode })}
                                        className="w-full bg-black/80 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-400 font-extrabold"
                                      >
                                        <option value="kids" className="bg-zinc-900 text-white">👶 أطفالي</option>
                                        <option value="night" className="bg-zinc-900 text-white">🌙 عائلتي</option>
                                        <option value="family" className="bg-zinc-900 text-white">👨‍👩‍👧‍👦 المسلسلات</option>
                                        <option value="cinema" className="bg-zinc-900 text-white">🎬 الأفلام</option>
                                        <option value="docs" className="bg-zinc-900 text-white">🌍 الوثائقيات</option>
                                        <option value="quran" className="bg-zinc-900 text-white">📖 القرآن الكريم</option>
                                        <option value="music" className="bg-zinc-900 text-white">🎵 الموسيقى</option>
                                      </select>
                                    </div>

                                    {/* Watchlist Selector */}
                                    <div>
                                      <label className="block text-xs font-bold text-white/80 mb-1">قائمة التشغيل المحددة:</label>
                                      <select
                                        value={slot.watchlistId || ''}
                                        onChange={(e) => updateScheduleSlot(slot.id, { watchlistId: e.target.value })}
                                        className="w-full bg-black/80 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400 font-bold"
                                      >
                                        <option value="" className="bg-zinc-900 text-white/70">
                                          -- جميع قوائم وضع {CATEGORY_NAMES[slot.mode] || slot.mode} --
                                        </option>
                                        {(() => {
                                          const modeWatchlists = watchlists.filter(w => w.section === slot.mode || w.targetMode === slot.mode);
                                          if (modeWatchlists.length === 0) {
                                            return (
                                              <option disabled value="" className="bg-zinc-900 text-amber-300/60 font-normal">
                                                ⚠️ لا توجد قوائم مضافة للوضع
                                              </option>
                                            );
                                          }
                                          return modeWatchlists.map(w => (
                                            <option key={w.id} value={w.id} className="bg-zinc-900 text-white font-semibold">
                                              {w.title} ({w.files?.length || w.episodesCount || 0} مقطع)
                                            </option>
                                          ));
                                        })()}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Transition Type Config */}
                                  <div className="p-3 bg-black/50 rounded-xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-white/80">الانتقال للوضع التالي:</span>
                                      <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10">
                                        <button
                                          type="button"
                                          onClick={() => updateScheduleSlot(slot.id, { transitionType: 'episode' })}
                                          className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                                            (!slot.transitionType || slot.transitionType === 'episode') 
                                              ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/60 shadow-md' 
                                              : 'text-white/60 hover:text-white'
                                          }`}
                                        >
                                          نهاية الحلقة 🎬
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateScheduleSlot(slot.id, { transitionType: 'time' })}
                                          className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                                            slot.transitionType === 'time' 
                                              ? 'bg-amber-500/30 text-amber-200 border border-amber-400/60 shadow-md' 
                                              : 'text-white/60 hover:text-white'
                                          }`}
                                        >
                                          مرور وقت ⏱️
                                        </button>
                                      </div>
                                    </div>

                                    {/* Transition Values */}
                                    <div>
                                      {(!slot.transitionType || slot.transitionType === 'episode') ? (
                                        <div className="flex items-center gap-2">
                                          <label className="text-xs font-bold text-white/90">عدد الحلقات:</label>
                                          <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={slot.transitionEpisodes || 1}
                                            onChange={(e) => updateScheduleSlot(slot.id, { transitionEpisodes: Math.max(1, Number(e.target.value) || 1) })}
                                            className="w-16 bg-black/90 text-amber-300 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 text-center border border-white/30"
                                          />
                                          <span className="text-xs text-amber-300 font-bold">حلقة</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <label className="text-xs font-bold text-white/90">المدة (دقائق):</label>
                                          <input
                                            type="number"
                                            min="1"
                                            value={slot.transitionMinutes || slot.durationMinutes || 30}
                                            onChange={(e) => updateScheduleSlot(slot.id, { transitionMinutes: Number(e.target.value) })}
                                            className="w-16 bg-black/90 text-amber-300 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 text-center border border-white/30"
                                          />
                                          <span className="text-xs text-amber-300 font-bold">دقيقة</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    ) : (
                      /* HORIZONTAL CARDS VIEW (عرض البطاقات الأفقية المتتابعة) */
                      <div className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-2 snap-x no-scrollbar touch-pan-x px-1">
                        {scheduleSlots.map((slot, index) => {
                          return (
                            <div key={slot.id} className="flex items-center gap-4 shrink-0">
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="w-[300px] sm:w-[340px] shrink-0 snap-center p-4 glass rounded-3xl border border-amber-400/30 shadow-xl space-y-3 relative flex flex-col justify-between bg-zinc-950/80"
                              >
                                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                                  <span className="text-xs font-extrabold text-amber-300 bg-amber-500/25 border border-amber-400/40 px-3 py-1 rounded-xl shadow-inner">
                                    الوضع #{index + 1}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => moveScheduleSlot(index, 'up')}
                                      className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-20 cursor-pointer"
                                      title="تقديم لليمين ➡️"
                                    >
                                      <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === scheduleSlots.length - 1}
                                      onClick={() => moveScheduleSlot(index, 'down')}
                                      className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-20 cursor-pointer"
                                      title="تأخير لليسار ⬅️"
                                    >
                                      <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => duplicateScheduleSlot(index)}
                                      className="text-white/60 hover:text-amber-300 p-1.5 rounded-lg transition-colors cursor-pointer"
                                      title="نسخ هذا الوضع"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeScheduleSlot(slot.id)}
                                      className="text-white/40 hover:text-red-400 p-1.5 rounded-lg transition-colors cursor-pointer"
                                      title="حذف هذا الوضع"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-[11px] font-bold text-amber-300/80 mb-1">اختر الوضع</label>
                                    <select
                                      value={slot.mode}
                                      onChange={(e) => updateScheduleSlot(slot.id, { mode: e.target.value as Mode })}
                                      className="w-full bg-black/70 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-400 font-extrabold"
                                    >
                                      <option value="kids" className="bg-zinc-900 text-white">👶 أطفالي</option>
                                      <option value="night" className="bg-zinc-900 text-white">🌙 عائلتي</option>
                                      <option value="family" className="bg-zinc-900 text-white">👨‍👩‍👧‍👦 المسلسلات</option>
                                      <option value="cinema" className="bg-zinc-900 text-white">🎬 الأفلام</option>
                                      <option value="docs" className="bg-zinc-900 text-white">🌍 الوثائقيات</option>
                                      <option value="quran" className="bg-zinc-900 text-white">📖 القرآن الكريم</option>
                                      <option value="music" className="bg-zinc-900 text-white">🎵 الموسيقى</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-bold text-white/70 mb-1">قائمة التشغيل المحددة</label>
                                    <select
                                      value={slot.watchlistId || ''}
                                      onChange={(e) => updateScheduleSlot(slot.id, { watchlistId: e.target.value })}
                                      className="w-full bg-black/70 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400 font-bold"
                                    >
                                      <option value="" className="bg-zinc-900 text-white/60">
                                        -- جميع قوائم وضع {CATEGORY_NAMES[slot.mode] || slot.mode} --
                                      </option>
                                      {(() => {
                                        const modeWatchlists = watchlists.filter(w => w.section === slot.mode || w.targetMode === slot.mode);
                                        if (modeWatchlists.length === 0) {
                                          return (
                                            <option disabled value="" className="bg-zinc-900 text-amber-300/60 font-normal">
                                              ⚠️ لا توجد قوائم مضافة للوضع
                                            </option>
                                          );
                                        }
                                        return modeWatchlists.map(w => (
                                          <option key={w.id} value={w.id} className="bg-zinc-900 text-white font-semibold">
                                            {w.title} ({w.files?.length || w.episodesCount || 0} مقطع)
                                          </option>
                                        ));
                                      })()}
                                    </select>
                                  </div>

                                  <div className="p-3 bg-black/40 rounded-2xl border border-white/10 space-y-2.5">
                                    <label className="block text-[11px] font-bold text-white/70">طريقة الانتقال للوضع التالي:</label>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => updateScheduleSlot(slot.id, { transitionType: 'episode' })}
                                        className={`py-1.5 rounded-xl border text-xs font-extrabold text-center transition-all cursor-pointer ${
                                          (!slot.transitionType || slot.transitionType === 'episode') ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/60 shadow-md' : 'glass border-white/10 hover:bg-white/10 text-white/60'
                                        }`}
                                      >
                                        نهاية الحلقة 🎬
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateScheduleSlot(slot.id, { transitionType: 'time' })}
                                        className={`py-1.5 rounded-xl border text-xs font-extrabold text-center transition-all cursor-pointer ${
                                          slot.transitionType === 'time' ? 'bg-amber-500/30 text-amber-200 border-amber-400/60 shadow-md' : 'glass border-white/10 hover:bg-white/10 text-white/60'
                                        }`}
                                      >
                                        مرور وقت ⏱️
                                      </button>
                                    </div>

                                    {(!slot.transitionType || slot.transitionType === 'episode') && (
                                      <div className="flex items-center justify-between gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10 mt-2">
                                        <label className="text-xs font-bold text-white/90">عدد الحلقات:</label>
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={slot.transitionEpisodes || 1}
                                            onChange={(e) => updateScheduleSlot(slot.id, { transitionEpisodes: Math.max(1, Number(e.target.value) || 1) })}
                                            className="w-16 bg-black/80 text-white rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 text-center border border-white/30"
                                          />
                                          <span className="text-[11px] text-amber-300 font-bold">حلقة</span>
                                        </div>
                                      </div>
                                    )}

                                    {slot.transitionType === 'time' && (
                                      <div className="flex items-center justify-between gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10 mt-2">
                                        <label className="text-xs font-bold text-white/90">المدة (دقائق):</label>
                                        <input
                                          type="number"
                                          min="1"
                                          value={slot.transitionMinutes || slot.durationMinutes || 30}
                                          onChange={(e) => updateScheduleSlot(slot.id, { transitionMinutes: Number(e.target.value) })}
                                          className="w-16 bg-black/80 text-white rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 text-center border border-white/30"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>

                              {index < scheduleSlots.length - 1 && (
                                <div className="flex flex-col items-center justify-center text-amber-400/80 shrink-0 px-1">
                                  <div className="p-2 bg-amber-500/20 rounded-full border border-amber-400/40 animate-pulse">
                                    <ArrowLeft className="w-5 h-5" />
                                  </div>
                                  <span className="text-[10px] font-extrabold text-amber-300/70 mt-1">التالي</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Classic Watchlist List Selection */
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-white/80">
                        حدد قوائم التشغيل للمشاركة في الجلسة (اختر 2 أو أكثر)
                      </label>
                      <span className="text-xs bg-white/10 text-white/90 px-3 py-1 rounded-full border border-white/10 font-bold">
                        تم تحديد: {selectedWatchlistIds.length} من {watchlists.length}
                      </span>
                    </div>

                    {watchlists.length === 0 ? (
                      <div className="p-6 text-center glass rounded-2xl text-white/60">
                        لا توجد قوائم تشغيل متاحة حالياً. يرجى إضافة محتوى أولاً من قسم "إضافة محتوى".
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Search & Category Filter Header */}
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="w-4 h-4 text-white/40 absolute right-3.5 top-3 pointer-events-none" />
                            <input 
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="بحث باسم القائمة..."
                              className="w-full bg-black/40 border border-white/10 rounded-xl pr-10 pl-8 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-white/40"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs">
                            <button
                              type="button"
                              onClick={() => setSelectedCategoryFilter('all')}
                              className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-all border ${
                                selectedCategoryFilter === 'all' ? 'bg-white text-black border-white shadow-md' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              الكل ({watchlists.length})
                            </button>
                            {Object.entries(CATEGORY_NAMES).map(([catKey, catLabel]) => {
                              const count = watchlists.filter(w => w.section === catKey || w.targetMode === catKey).length;
                              if (count === 0) return null;
                              return (
                                <button
                                  key={catKey}
                                  type="button"
                                  onClick={() => setSelectedCategoryFilter(catKey)}
                                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-all border ${
                                    selectedCategoryFilter === catKey ? 'bg-white text-black border-white shadow-md' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                                  }`}
                                >
                                  {catLabel} ({count})
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Filtered Watchlists Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto no-scrollbar p-1">
                          {watchlists
                            .filter(w => {
                              const matchesSearch = !searchQuery.trim() || normalizeArabicText(w.title).includes(normalizeArabicText(searchQuery));
                              const matchesCategory = selectedCategoryFilter === 'all' || w.section === selectedCategoryFilter || w.targetMode === selectedCategoryFilter;
                              return matchesSearch && matchesCategory;
                            })
                            .map((w) => {
                              const isSelected = selectedWatchlistIds.includes(w.id);
                              return (
                                <div 
                                  key={w.id}
                                  onClick={() => toggleWatchlistSelection(w.id)}
                                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                    isSelected ? 'bg-white/20 border-white shadow-lg font-bold' : 'glass border-white/10 hover:bg-white/10'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <Layers className={`w-4 h-4 shrink-0 ${isSelected ? 'text-green-400' : 'text-white/50'}`} />
                                    <div className="min-w-0">
                                      <span className="text-sm line-clamp-1 block leading-tight">{w.title}</span>
                                      <span className="text-[10px] text-white/50 block mt-0.5 font-normal">
                                        {CATEGORY_NAMES[w.section] || w.section || 'عام'} • {w.files?.length || w.episodesCount || 0} مقطع
                                      </span>
                                    </div>
                                  </div>
                                  {isSelected ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mr-2" />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full border border-white/20 shrink-0 mr-2" />
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-white/80 mb-2">نمط التناوب</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button 
                          onClick={() => setStrategy('alternate')}
                          className={`p-3 rounded-xl border text-sm font-semibold text-center transition-all ${
                            strategy === 'alternate' ? 'bg-white text-black border-white' : 'glass border-white/10 hover:bg-white/10'
                          }`}
                        >
                          حلقة بحلقة 🔄
                        </button>
                        <button 
                          onClick={() => setStrategy('random')}
                          className={`p-3 rounded-xl border text-sm font-semibold text-center transition-all ${
                            strategy === 'random' ? 'bg-white text-black border-white' : 'glass border-white/10 hover:bg-white/10'
                          }`}
                        >
                          خلط عشوائي 🎲
                        </button>
                        <button 
                          onClick={() => setStrategy('sequential')}
                          className={`p-3 rounded-xl border text-sm font-semibold text-center transition-all ${
                            strategy === 'sequential' ? 'bg-white text-black border-white' : 'glass border-white/10 hover:bg-white/10'
                          }`}
                        >
                          متتالي 📜
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-white/80 mb-2">طريقة الانتقال (شرط تجاوز المقطع)</label>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <button 
                          onClick={() => setTransitionType('episode')}
                          className={`p-3 rounded-xl border text-sm font-semibold text-center transition-all ${
                            transitionType === 'episode' ? 'bg-indigo-500 text-white border-indigo-400' : 'glass border-white/10 hover:bg-white/10'
                          }`}
                        >
                          نهاية الحلقة 🎬
                        </button>
                        <button 
                          onClick={() => setTransitionType('time')}
                          className={`p-3 rounded-xl border text-sm font-semibold text-center transition-all ${
                            transitionType === 'time' ? 'bg-indigo-500 text-white border-indigo-400' : 'glass border-white/10 hover:bg-white/10'
                          }`}
                        >
                          مرور وقت محدد ⏱️
                        </button>
                      </div>
                      
                      {transitionType === 'time' && (
                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 mt-2">
                          <label className="text-sm">الوقت المخصص لكل مقطع (دقائق):</label>
                          <input 
                            type="number" 
                            min="1"
                            max="600"
                            value={transitionMinutes}
                            onChange={(e) => setTransitionMinutes(Number(e.target.value))}
                            className="bg-black/40 border border-white/20 rounded-lg px-3 py-1.5 w-24 text-center focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center p-4 glass rounded-2xl">
                  <span>تكرار الجلسة عند انتهائها</span>
                  <button 
                    type="button"
                    dir="ltr"
                    onClick={() => setLoopSequence(!loopSequence)}
                    className={`w-14 h-8 rounded-full p-1 transition-colors flex items-center shrink-0 cursor-pointer ${
                      loopSequence ? 'bg-green-500 justify-end' : 'bg-white/20 justify-start'
                    }`}
                  >
                    <div className="w-6 h-6 bg-white rounded-full shadow-md transition-all" />
                  </button>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
                  <button 
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-3 glass rounded-xl hover:bg-white/20 transition-colors font-medium w-full sm:w-auto"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={handleSaveSession}
                    className="px-8 py-3 bg-white text-black rounded-xl font-bold hover:scale-105 transition-transform shadow-lg w-full sm:w-auto text-center cursor-pointer"
                  >
                    {editingSessionId ? 'حفظ التعديلات' : 'حفظ الجلسة الذكية'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={deletingSessionId !== null}
        title="حذف الجلسة الذكية"
        message="هل أنت تأكد من رغبتك في حذف هذه الجلسة الذكية؟ لن يتم حذف قوائم التشغيل أو الملفات الأصلية."
        confirmText="نعم، حذف الجلسة"
        cancelText="إلغاء"
        onConfirm={() => {
          if (deletingSessionId) {
            onDeleteSession(deletingSessionId);
            setDeletingSessionId(null);
          }
        }}
        onCancel={() => setDeletingSessionId(null)}
      />
    </motion.div>
  );
};

export default SmartSessionsView;
