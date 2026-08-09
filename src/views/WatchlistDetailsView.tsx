import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, X, RotateCcw, Clock, Film, Layers, Trash2, Pencil, Save, FolderPlus, Plus } from 'lucide-react';
import { Watchlist, WeeklyScheduleEntry, Mode } from '../types';
import { naturalCompare, sortSmartMediaFiles } from '../utils/sorter';
import { ConfirmModal } from '../components/ConfirmModal';
import { getEpisodeInspiredCover, getWatchlistCover, extractVideoFrameThumbnail } from '../utils/coverHelper';
import { useDialog } from '../contexts/DialogContext';
import { findScheduleConflict, parseTimeToMinutes, formatMinutesToTime } from '../utils/scheduleUtils';

interface WatchlistDetailsProps {
  watchlist: Watchlist | null;
  onClose: () => void;
  onPlay: (file?: any, title?: string, watchlistTitle?: string, files?: any[], index?: number, sessionId?: string, watchlistId?: string, initialTime?: number) => void;
  onDeleteWatchlist?: (id: string) => void;
  onUpdateWatchlist?: (watchlist: Watchlist) => void;
  schedules?: WeeklyScheduleEntry[];
  onUpdateSchedules?: (schedules: WeeklyScheduleEntry[]) => void;
  watchlists?: Watchlist[];
}

export default function WatchlistDetailsView({ 
  watchlist, 
  onClose, 
  onPlay,
  onDeleteWatchlist,
  onUpdateWatchlist,
  schedules = [],
  onUpdateSchedules,
  watchlists = []
}: WatchlistDetailsProps) {
  const { showAlert, showConfirm } = useDialog();
  const [activeSeasonIndex, setActiveSeasonIndex] = useState<number>(0);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSection, setEditSection] = useState('');

  // Schedule Modal State inside Playlist View
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [scheduleDay, setScheduleDay] = useState<number>(new Date().getDay());
  const [scheduleTime, setScheduleTime] = useState('20:00');
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleWatchlistId, setScheduleWatchlistId] = useState('');
  const [scheduleEpisodeIndex, setScheduleEpisodeIndex] = useState<number>(0);
  const [scheduleMode, setScheduleMode] = useState<Mode | ''>('');
  const [scheduleOffset, setScheduleOffset] = useState<number>(0);
  
  // Re-select Folder state inside details view
  const editFolderInputRef = useRef<HTMLInputElement>(null);
  const [newFolderName, setNewFolderName] = useState<string | null>(null);
  const [newFiles, setNewFiles] = useState<any[] | null>(null);
  const [newSeasons, setNewSeasons] = useState<{ name: string; files: any[] }[] | null>(null);

  if (!watchlist) return null;

  const handleOpenScheduleForEpisode = (epTitle: string, epIndex: number) => {
    setScheduleDay(new Date().getDay());
    setScheduleTime('20:00');
    setScheduleTitle(`${watchlist.title} - ${epTitle}`);
    setScheduleWatchlistId(watchlist.id);
    setScheduleEpisodeIndex(epIndex);
    setScheduleMode((watchlist.targetMode as Mode) || '');
    setScheduleOffset(0);
    setIsAddScheduleOpen(true);
  };

  const handleSaveScheduleFromDetails = async () => {
    if (!scheduleTitle.trim()) {
      showAlert('يرجى كتابة عنوان للمحتوى المجدول');
      return;
    }
    if (!scheduleTime) {
      showAlert('يرجى تحديد توقيت العرض');
      return;
    }

    const durMins = 60;
    const conflict = findScheduleConflict(scheduleDay, scheduleTime, durMins, schedules);

    if (conflict) {
      showAlert(`يوجد تعارض مع موعد آخر في نفس اليوم (${conflict.slot.title} من ${conflict.existingStartTime} إلى ${conflict.existingEndTime}). يرجى اختيار وقت مختلف.`);
      return;
    }

    // Check duplicate episode across days
    const DAYS_NAMES: Record<number, string> = {
      0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت'
    };

    const targetEpIdx = scheduleEpisodeIndex ?? 0;
    const targetEpNum = targetEpIdx + 1;
    const existingSlotForSameEp = schedules.find(s => {
      const sameWl = Boolean(scheduleWatchlistId && s.watchlistId && s.watchlistId === scheduleWatchlistId);
      const sameTitle = s.title.trim().toLowerCase() === scheduleTitle.trim().toLowerCase();
      const wlTitleMatch = watchlist.title.trim().toLowerCase() === s.title.trim().toLowerCase();

      if (!sameWl && !sameTitle && !wlTitleMatch) return false;

      const sEpIdx = s.episodeIndex ?? 0;
      return sEpIdx === targetEpIdx;
    });

    if (existingSlotForSameEp) {
      const existingDayName = DAYS_NAMES[existingSlotForSameEp.dayOfWeek] || 'الاثنين';
      const targetDayName = DAYS_NAMES[scheduleDay] || 'اليوم';
      const isSameDay = existingSlotForSameEp.dayOfWeek === scheduleDay;

      const alertText = isSameDay
        ? `تنبيه: هذه الحلقة (${scheduleTitle.trim()} - الحلقة ${targetEpNum}) مضافة وموجودة مسبقاً في جدول نفس اليوم (يوم ${existingDayName}) الساعة (${existingSlotForSameEp.time})!`
        : `تنبيه: هذه الحلقة (${scheduleTitle.trim()} - الحلقة ${targetEpNum}) مضافة وموجودة مسبقاً في جدول يوم ${existingDayName} الساعة (${existingSlotForSameEp.time})!`;

      const confirmAdd = await showConfirm(
        `${alertText}\n\nهل ترغب في إضافتها مجدداً في جدول يوم ${targetDayName}؟`,
        'تنبيه تكرار موعد حلقة',
        'نعم، أضفها مجدداً',
        'إلغاء'
      );

      if (!confirmAdd) {
        return;
      }
    }

    const startM = parseTimeToMinutes(scheduleTime);
    const endM = startM + durMins;

    const newEntry: WeeklyScheduleEntry = {
      id: Date.now().toString(),
      dayOfWeek: scheduleDay,
      time: scheduleTime,
      durationMinutes: durMins,
      endTime: formatMinutesToTime(endM),
      title: scheduleTitle.trim(),
      watchlistId: scheduleWatchlistId || undefined,
      episodeIndex: scheduleEpisodeIndex,
      startTimeOffset: scheduleOffset * 60,
      mode: (scheduleMode as Mode) || undefined,
    };

    if (onUpdateSchedules) {
      onUpdateSchedules([...schedules, newEntry]);
    }
    setIsAddScheduleOpen(false);
    showAlert(`تمت إضافة الموعد "${scheduleTitle.trim()}" بنجاح إلى جدول البث!`);
  };

  const handleStartEdit = () => {
    setEditTitle(watchlist.title);
    setEditSection(watchlist.section || 'عام');
    setNewFolderName(watchlist.folderName || watchlist.folderPath || null);
    setNewFiles(null);
    setNewSeasons(null);
    setIsEditing(true);
  };

  const handleReselectFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []) as any[];
    if (rawFiles.length === 0) return;

    // Filter valid media files
    const mediaExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.ts', '.m4v', '.wmv'];
    const mediaFiles = rawFiles.filter(f => 
      mediaExtensions.some(ext => f.name.toLowerCase().endsWith(ext))
    );

    const firstPath = rawFiles[0].webkitRelativePath || '';
    const folderTitle = firstPath.split('/')[0] || rawFiles[0].name || 'مجلد جديد';
    
    // Group seasons if subfolders exist
    const seasonsMap: Record<string, any[]> = {};
    const topFiles: any[] = [];

    rawFiles.forEach((file: any) => {
      const parts = (file.webkitRelativePath || '').split('/');
      if (parts.length > 2) {
        const seasonName = parts[1];
        if (!seasonsMap[seasonName]) seasonsMap[seasonName] = [];
        seasonsMap[seasonName].push(file);
      } else {
        if (mediaExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
          topFiles.push(file);
        }
      }
    });

    const seasonsList = Object.keys(seasonsMap).map(sName => ({
      name: sName,
      files: sortSmartMediaFiles(seasonsMap[sName])
    }));

    const finalFiles = mediaFiles.length > 0 ? mediaFiles : rawFiles;
    
    setNewFolderName(folderTitle);
    setNewFiles(finalFiles);
    setNewSeasons(seasonsList);

    // Auto update title if user hasn't edited title manually
    if (editTitle === watchlist.title) {
      setEditTitle(folderTitle);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      await showAlert('يرجى إدخال اسم القائمة.');
      return;
    }

    const updatedFiles = newFiles !== null ? newFiles : (watchlist.files || []);
    const updatedSeasons = newSeasons !== null ? newSeasons : (watchlist.seasons || []);
    const updatedFolderName = newFolderName !== null ? newFolderName : (watchlist.folderName || watchlist.title);
    
    // Auto cover if new files selected
    let updatedCover = watchlist.coverImage;
    if (newFiles !== null && updatedFiles.length > 0) {
      const allFiles = [...updatedFiles, ...updatedSeasons.flatMap((s: any) => s.files || [])];
      const firstFile = allFiles.find(f => f instanceof File || (f && ((f as any).rawFile instanceof File || (f as any).blobUrl)));
      if (firstFile) {
        try {
          const thumb = await extractVideoFrameThumbnail(firstFile);
          if (thumb) updatedCover = thumb;
        } catch (e) {
          console.warn('Video frame thumbnail extraction error:', e);
        }
      }
      if (!updatedCover) {
        updatedCover = getWatchlistCover({ title: editTitle, section: editSection, files: updatedFiles, seasons: updatedSeasons });
      }
    }

    const totalEpCount = updatedFiles.length > 0 ? updatedFiles.length : watchlist.episodesCount;
    const seriesCount = updatedSeasons.length > 0 ? updatedSeasons.length : (watchlist.seriesCount || 1);

    if (onUpdateWatchlist) {
      onUpdateWatchlist({
        ...watchlist,
        title: editTitle.trim(),
        section: editSection.trim() || 'عام',
        folderName: updatedFolderName,
        folderPath: `/${updatedFolderName}`,
        files: updatedFiles,
        seasons: updatedSeasons,
        episodesCount: totalEpCount,
        seriesCount: seriesCount,
        coverImage: updatedCover
      });
    }
    setIsEditing(false);
  };

  const handleConfirmDelete = () => {
    if (onDeleteWatchlist) {
      onDeleteWatchlist(watchlist.id);
    }
    setShowConfirmDelete(false);
    onClose();
  };

  // Natural numeric sorting for seasons and files
  let rawSeasons = watchlist.seasons && watchlist.seasons.length > 0 ? [...watchlist.seasons] : [];
  
  // If there are also loose files in watchlist.files that are not inside any season, add a season tab for them
  if (rawSeasons.length > 0 && watchlist.files && watchlist.files.length > 0) {
    const seasonFilesSet = new Set(rawSeasons.flatMap(s => (s.files || []).map((f: any) => f.name || f.customPath || f.webkitRelativePath)));
    const looseFiles = watchlist.files.filter((f: any) => !seasonFilesSet.has(f.name || f.customPath || f.webkitRelativePath));
    if (looseFiles.length > 0) {
      if (!rawSeasons.some(s => s.name === 'الملفات المباشرة' || s.name === 'مقاطع رئيسية')) {
        rawSeasons = [{ name: 'الملفات المباشرة', files: looseFiles }, ...rawSeasons];
      }
    }
  }

  const sortedSeasons = rawSeasons.length > 0
    ? rawSeasons.sort((a, b) => naturalCompare(a.name, b.name)).map(s => ({
        name: s.name,
        files: sortSmartMediaFiles(s.files || [])
      }))
    : [];

  const hasSeasons = sortedSeasons.length > 0;
  
  // Current active files depending on selected season or default list
  const currentFiles = hasSeasons 
    ? sortedSeasons[activeSeasonIndex]?.files || [] 
    : sortSmartMediaFiles(watchlist.files || []);

  // Episodes mapping
  const mockEpisodes = currentFiles.length > 0 
    ? currentFiles.map((file, i) => {
        const name = file.name || 'ملف غير معروف';
        return {
          id: i + 1,
          title: file.title || name.replace(/\.[^/.]+$/, ""), // remove extension
          duration: '00:00',
          description: 'ملف محلي',
          originalFile: file
        };
      })
    : Array.from({ length: watchlist.episodesCount || 1 }).map((_, i) => ({
        id: i + 1,
        title: `الحلقة ${i + 1}`,
        duration: '45:00',
        description: 'ملخص الحلقة يتم عرضه هنا.',
        originalFile: null
      }));

  const lastIndex = watchlist.lastWatchedIndex || 0;
  const initialPlayFile = mockEpisodes[lastIndex] || mockEpisodes[0];

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 md:p-8 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[90vw] max-h-[92vh] rounded-[2.5rem] overflow-y-auto flex flex-col relative pb-10 sm:pb-0 bg-zinc-950/95 backdrop-blur-2xl border border-white/20 shadow-2xl"
        >
          {/* Header Image */}
          <div className="relative h-60 sm:h-72 shrink-0">
            <img src={getWatchlistCover(watchlist)} className="w-full h-full object-cover" alt={watchlist.title} />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            
            <div className="absolute top-4 sm:top-6 left-4 sm:left-6 flex items-center gap-2 sm:gap-3 z-10">
              <button 
                onClick={handleStartEdit}
                className="px-3 sm:px-4 py-1.5 sm:py-2 glass rounded-full hover:bg-white hover:text-black transition-colors font-bold text-xs sm:text-sm flex items-center gap-1.5"
                title="تعديل القائمة"
              >
                <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>تعديل</span>
              </button>
              <button 
                onClick={() => setShowConfirmDelete(true)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 glass bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white rounded-full transition-colors font-bold text-xs sm:text-sm flex items-center gap-1.5 border border-red-500/30"
                title="حذف القائمة"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>حذف</span>
              </button>
            </div>

            <button 
              onClick={onClose}
              className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2.5 sm:p-3 glass rounded-full hover:bg-white hover:text-black transition-colors z-10"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-8 left-4 sm:left-8">
              <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs sm:text-sm font-semibold mb-2 inline-block">
                {watchlist.section}
              </span>
              <h1 className="text-2xl sm:text-4xl font-bold text-white shadow-sm mb-1 sm:mb-2">{watchlist.title}</h1>
              <p className="text-xs sm:text-base text-white/80">
                {(() => {
                  const seasonsNum = (watchlist.seasons && watchlist.seasons.length > 0) ? watchlist.seasons.length : (watchlist.seriesCount || 1);
                  return `${seasonsNum} ${seasonsNum === 1 ? 'موسم' : 'مواسم'}`;
                })()} • {watchlist.episodesCount} حلقة • الوقت المتبقي: {watchlist.timeRemaining}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col md:flex-row gap-8">
            {/* Left Column: Info & Actions */}
            <div className="w-full md:w-1/3 flex flex-col gap-6 shrink-0">
              <button 
                onClick={() => onPlay(initialPlayFile?.originalFile, initialPlayFile?.title, watchlist.title, currentFiles, lastIndex, undefined, watchlist.id, watchlist.lastWatchedTime || 0)}
                className="w-full py-4 bg-white text-black rounded-xl font-bold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                <Play className="w-6 h-6 fill-black" />
                {lastIndex > 0 ? `متابعة (الحلقة ${lastIndex + 1})` : 'تشغيل'}
              </button>
              
              <button 
                onClick={() => onPlay(mockEpisodes[0]?.originalFile, mockEpisodes[0]?.title, watchlist.title, currentFiles, 0, undefined, watchlist.id, 0)}
                className="w-full py-3 glass rounded-xl font-semibold hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                بدء من البداية
              </button>

              <div className="glass-panel p-6 rounded-2xl mt-4">
                <h3 className="font-bold text-lg mb-4 text-white/90">معلومات القائمة</h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-white/50 text-sm block mb-1">آخر مشاهدة</span>
                    <span className="font-semibold">{watchlist.lastWatched || `الحلقة ${lastIndex + 1}`}</span>
                  </div>
                  <div>
                    <span className="text-white/50 text-sm block mb-1">نسبة الإنجاز</span>
                    <div className="w-full bg-white/10 rounded-full h-2 mt-2 overflow-hidden">
                      <div className="bg-green-400 h-full rounded-full" style={{ width: `${watchlist.progress || 0}%` }} />
                    </div>
                    <span className="text-xs text-green-400 mt-1 block">{watchlist.progress || 0}% مكتمل</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Episodes List */}
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Film className="w-6 h-6 text-white/70" />
                  الحلقات المتاحة
                </h3>

                {hasSeasons && (
                  <div className="flex items-center gap-2.5 bg-black/60 border border-white/20 rounded-2xl px-4 py-2 shadow-lg shrink-0">
                    <Layers className="w-5 h-5 text-amber-400 shrink-0" />
                    <span className="text-sm font-bold text-white/80 whitespace-nowrap">اختر الموسم:</span>
                    <select
                      value={activeSeasonIndex}
                      onChange={(e) => setActiveSeasonIndex(Number(e.target.value))}
                      className="bg-zinc-900 text-white font-extrabold text-sm sm:text-base px-3 py-1.5 rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer min-w-[160px]"
                    >
                      {sortedSeasons.map((s, idx) => (
                        <option key={idx} value={idx} className="bg-zinc-900 text-white font-bold py-1">
                          📁 {s.name} ({s.files.length} حلقة)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                {mockEpisodes.map((ep, i) => (
                  <div 
                    key={ep.id}
                    className={`p-4 glass rounded-xl flex items-center justify-between gap-4 hover:bg-white/10 transition-colors group ${
                      i === lastIndex ? 'border-2 border-green-400/50 bg-green-500/10' : ''
                    }`}
                  >
                    <div 
                      className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                      onClick={() => onPlay(ep.originalFile, ep.title, watchlist.title, currentFiles, i, undefined, watchlist.id)}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold transition-colors shrink-0 ${
                        i === lastIndex ? 'bg-green-400 text-black' : 'bg-white/10 text-white/60 group-hover:bg-white group-hover:text-black'
                      }`}>
                        {ep.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-lg flex items-center gap-2 truncate">
                          {ep.title}
                          {i === lastIndex && (
                            <span className="text-xs bg-green-400/20 text-green-300 px-2 py-0.5 rounded font-normal shrink-0">
                              المحطة الحالية
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-2.5 mt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenScheduleForEpisode(ep.title, i);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-amber-400/10 hover:bg-amber-400 hover:text-black text-amber-300 border border-amber-400/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-md group/clk shrink-0"
                            title="إضافة هذا المقطع إلى جدول البث"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-400 group-hover/clk:text-black transition-colors" />
                            <span className="text-xs font-extrabold">جدولة</span>
                          </button>
                          <p className="text-sm text-white/50 line-clamp-1">{ep.description}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-sm text-white/40 flex items-center gap-1 font-mono">
                        {ep.duration}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* SCHEDULE SLOT CREATION MODAL FROM PLAYLIST ITEM */}
        <AnimatePresence>
          {isAddScheduleOpen && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setIsAddScheduleOpen(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl bg-zinc-900 rounded-3xl border border-amber-400/40 p-6 shadow-2xl text-right dir-rtl max-h-[90vh] overflow-y-auto no-scrollbar"
              >
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-white">إضافة موعد لجدول البث</h3>
                      <p className="text-xs text-white/50">جدولة العرض التلقائي لهذا الفيديو</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddScheduleOpen(false)}
                    className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* 1. DAY SELECTION FIELD AT THE TOP */}
                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-1.5">اليوم</label>
                    <select
                      value={scheduleDay}
                      onChange={(e) => setScheduleDay(Number(e.target.value))}
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

                  {/* 2. TITLE & TIME FIELDS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-amber-300 mb-1.5">اسم المحتوى أو الموعد</label>
                      <input
                        type="text"
                        value={scheduleTitle}
                        onChange={(e) => setScheduleTitle(e.target.value)}
                        placeholder="عنوان الفقرة..."
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-amber-400 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-amber-300 mb-1.5">توقيت العرض (الساعة)</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-400 text-sm font-bold cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* 3. SIDE-BY-SIDE FIELDS FOR MODE, CONTENT, AND EPISODE */}
                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-2">تحديد المحتوى والوضع (من المكتبة)</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Mode Field */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/70 mb-1">الوضع</label>
                        <select
                          value={scheduleMode}
                          onChange={(e) => setScheduleMode(e.target.value as Mode | '')}
                          className="w-full px-3.5 py-3 rounded-xl bg-zinc-800 border border-white/10 text-white focus:outline-none focus:border-amber-400 text-xs sm:text-sm font-bold cursor-pointer truncate"
                        >
                          <option value="">-- بدون تحديد --</option>
                          <option value="kids">أطفالي</option>
                          <option value="night">عائلتي</option>
                          <option value="family">المسلسلات</option>
                          <option value="cinema">الأفلام</option>
                          <option value="docs">الوثائقيات</option>
                          <option value="quran">القرآن الكريم</option>
                          <option value="music">الموسيقى</option>
                        </select>
                      </div>

                      {/* Content Field */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/70 mb-1">المحتوى / القائمة</label>
                        <select
                          value={scheduleWatchlistId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setScheduleWatchlistId(id);
                            const foundWl = (watchlists.length > 0 ? watchlists : [watchlist]).find(w => w.id === id);
                            if (foundWl) {
                              setScheduleTitle(foundWl.title);
                              if (foundWl.targetMode) {
                                setScheduleMode(foundWl.targetMode);
                              }
                            }
                            setScheduleEpisodeIndex(0);
                          }}
                          className="w-full px-3.5 py-3 rounded-xl bg-zinc-800 border border-white/10 text-white focus:outline-none focus:border-amber-400 text-xs sm:text-sm font-bold cursor-pointer truncate"
                        >
                          {(watchlists.length > 0 ? watchlists : [watchlist]).map(w => (
                            <option key={w.id} value={w.id}>{w.title} ({w.episodesCount || 0} مقطع)</option>
                          ))}
                        </select>
                      </div>

                      {/* Episode Field */}
                      <div>
                        <label className="block text-[11px] font-bold text-white/70 mb-1">الحلقة / الملف</label>
                        {(() => {
                          const selectedWl = (watchlists.length > 0 ? watchlists : [watchlist]).find(w => w.id === scheduleWatchlistId) || watchlist;
                          const files = selectedWl ? [
                            ...(selectedWl.files || []),
                            ...(selectedWl.seasons?.flatMap(s => s.files || []) || [])
                          ] : [];

                          if (files.length > 0) {
                            return (
                              <select
                                value={scheduleEpisodeIndex}
                                onChange={(e) => setScheduleEpisodeIndex(Number(e.target.value))}
                                className="w-full px-3.5 py-3 rounded-xl bg-zinc-800 border border-white/10 text-white focus:outline-none focus:border-amber-400 text-xs sm:text-sm font-bold cursor-pointer truncate"
                              >
                                {files.map((f, idx) => (
                                  <option key={idx} value={idx}>
                                    🎬 الحلقة {idx + 1}: {f.name || f.title || `المقطع ${idx + 1}`}
                                  </option>
                                ))}
                              </select>
                            );
                          }

                          return (
                            <select
                              disabled
                              className="w-full px-3.5 py-3 rounded-xl bg-zinc-800/50 border border-white/5 text-white/40 text-xs sm:text-sm font-bold cursor-not-allowed"
                            >
                              <option value={0}>-- اختر المحتوى أولاً --</option>
                            </select>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Start Offset Minutes */}
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <label className="block text-xs font-bold text-amber-300 mb-1.5">بدء العرض من دقيقة محددة (اختياري)</label>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={scheduleOffset}
                        onChange={(e) => setScheduleOffset(Math.max(0, Number(e.target.value)))}
                        className="w-28 px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-amber-400 text-xs text-center font-bold"
                      />
                      <span className="text-xs text-white/70 font-medium">دقيقة (الافتراضي 0 للبدء من أول المقطع)</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setIsAddScheduleOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors text-sm cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveScheduleFromDetails}
                    className="px-6 py-2.5 rounded-xl bg-amber-400 text-black font-extrabold hover:bg-amber-300 transition-colors text-sm cursor-pointer shadow-lg flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> حفظ الموعد
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <ConfirmModal 
          isOpen={showConfirmDelete}
          title="حذف قائمة التشغيل"
          message={`هل أنت تأكد من رغبتك في حذف قائمة "${watchlist.title}"؟ لا يمكن التراجع عن هذه الخطوة.`}
          confirmText="نعم، حذف القائمة"
          cancelText="إلغاء"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowConfirmDelete(false)}
        />

        {/* Centered Edit Watchlist Modal */}
        {isEditing && (
          <div 
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md"
            onClick={() => setIsEditing(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-xl p-6 sm:p-8 rounded-[2rem] border border-amber-400/40 shadow-2xl space-y-5 text-right relative bg-zinc-950/95 backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-extrabold text-lg sm:text-xl text-amber-300 flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-amber-400" /> تعديل بيانات قائمة التشغيل
                </h3>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-white/80 mb-1.5 block">اسم قائمة التشغيل</label>
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-black/70 border border-white/20 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/80 mb-1.5 block">التصنيف / القسم</label>
                  <input 
                    type="text" 
                    value={editSection}
                    onChange={(e) => setEditSection(e.target.value)}
                    className="w-full bg-black/70 border border-white/20 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/80 mb-1.5 block">مجلد القائمة في الهارد</label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <button 
                      type="button"
                      onClick={() => editFolderInputRef.current?.click()}
                      className="bg-amber-400 hover:bg-amber-500 text-black px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 hover:scale-105 transition-transform cursor-pointer shrink-0 shadow-md"
                    >
                      <FolderPlus className="w-4 h-4" /> إعادة تحديد المجلد
                    </button>
                    <span className="text-xs font-mono text-white/90 truncate bg-black/70 px-3.5 py-2.5 rounded-xl flex-1 border border-white/10">
                      📁 {newFolderName || watchlist.folderName || watchlist.folderPath || 'لم يتم اختيار مجلد'}
                    </span>
                    <input 
                      type="file" 
                      ref={(node) => {
                        (editFolderInputRef as any).current = node;
                        if (node) {
                          node.setAttribute('webkitdirectory', '');
                          node.setAttribute('directory', '');
                        }
                      }}
                      onChange={handleReselectFolderChange}
                      className="hidden" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button 
                  onClick={() => setIsEditing(false)} 
                  className="px-5 py-2.5 rounded-xl text-xs font-bold glass text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleSaveEdit} 
                  className="bg-amber-400 hover:bg-amber-500 text-black px-6 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 hover:scale-105 transition-transform cursor-pointer shadow-lg"
                >
                  <Save className="w-4 h-4" /> حفظ التغييرات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
