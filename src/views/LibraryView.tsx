import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { MODE_SECTIONS, MODE_LIBRARY_TITLES, MODES } from '../data';
import { Watchlist, Mode, ModeConfig, WeeklyScheduleEntry, Session } from '../types';
import { Play, RotateCcw, Edit3, FolderPlus, X, Plus, UploadCloud, CheckCircle2, Layers, Trash2, Pencil, Save, Tv, Film, Globe, Baby, BookOpen, Music, Folder, Search, GripVertical, ChevronRight, ChevronLeft, Check, ChevronDown, CheckSquare, Square, Sparkles, Clock, Calendar, RefreshCw, FolderSearch, FolderCheck, List } from 'lucide-react';
import WatchlistDetailsView from './WatchlistDetailsView';
import { FolderTreePreview, buildWatchlistsFromFiles } from './CreateWatchlistView';
import { getEpisodeInspiredCover, getWatchlistCover, extractVideoFrameThumbnail } from '../utils/coverHelper';
import { ConfirmModal } from '../components/ConfirmModal';
import { sortSmartMediaFiles, naturalCompare, normalizeArabicText } from '../utils/sorter';
import { store } from '../utils/store';
import { useDialog } from '../contexts/DialogContext';
import { ProcessingRing } from '../components/ProcessingRing';
import { LazyWatchlistCover } from '../components/LazyWatchlistCover';
import { getFilesFromDirectoryHandle, isCrossOriginIframe, processMediaDirectory } from '../utils/fileSystem';
import { open } from '@tauri-apps/plugin-dialog';

const ALL_MODES: Mode[] = ['family', 'kids', 'cinema', 'docs', 'quran', 'music', 'night'];

const MODE_DETAILS: Record<Mode, { name: string; icon: React.FC<{ className?: string }>; desc: string; badgeColor: string; bgGradient: string }> = {
  family: { name: 'المسلسلات', icon: Tv, desc: 'مسلسلات الدراما والسهرات العائلية', badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-400/30', bgGradient: 'from-orange-950/80 via-rose-950/60 to-purple-950/80' },
  kids: { name: 'أطفالي', icon: Baby, desc: 'عالم الكرتون والأنيميشن الآمن', badgeColor: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30', bgGradient: 'from-sky-950/80 via-pink-950/60 to-amber-950/80' },
  cinema: { name: 'الأفلام', icon: Film, desc: 'السينما المنزلية والأفلام العالمية', badgeColor: 'bg-zinc-700/30 text-zinc-200 border-zinc-500/30', bgGradient: 'from-zinc-900/90 via-stone-900/90 to-black' },
  docs: { name: 'الوثائقيات', icon: Globe, desc: 'الطبيعة، العلوم والتاريخ', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30', bgGradient: 'from-emerald-950/80 via-teal-950/70 to-stone-950/90' },
  quran: { name: 'القرآن الكريم', icon: BookOpen, desc: 'التلاوات العطرة والبرامج الإيمانية', badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-400/30', bgGradient: 'from-teal-950/80 via-cyan-950/70 to-emerald-950/90' },
  music: { name: 'الموسيقى', icon: Music, desc: 'المقاطع الصوتية والأغاني والإنشاد', badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-400/30', bgGradient: 'from-violet-950/80 via-fuchsia-950/70 to-orange-950/80' },
  night: { name: 'عائلتي', icon: Sparkles, desc: 'سهرات هادئة ومحتوى مميز', badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30', bgGradient: 'from-indigo-950/80 via-blue-950/70 to-slate-950/90' },
};

interface LibraryViewProps {
  onPlay: (file?: any, title?: string, watchlistTitle?: string, files?: any[], index?: number, sessionId?: string, watchlistId?: string, initialTime?: number) => void;
  watchlists: Watchlist[];
  schedules?: WeeklyScheduleEntry[];
  onUpdateSchedules?: (schedules: WeeklyScheduleEntry[]) => void;
  sessions?: Session[];
  onAddSession?: (session: Session) => void;
  onUpdateSession?: (session: Session) => void;
  currentMode?: Mode;
  onSwitchMode?: (mode: Mode) => void;
  customModes?: Record<Mode, ModeConfig>;
  onUpdateModeTitle?: (mode: Mode, newTitle: string) => void;
  customCategories?: string[];
  allCustomCategories?: Record<Mode, string[]>;
  onDeleteCategory?: (category: string) => void;
  onRenameCategory?: (oldCategory: string, newCategory: string) => void;
  onReorderCategories?: (newCategories: string[]) => void;
  onAddWatchlist?: (list: Watchlist | Watchlist[]) => void;
  onUpdateWatchlist?: (list: Watchlist) => void;
  onDeleteWatchlist?: (id: string) => void;
  onAddCategory?: (category: string) => void;
}

const ModeItem = ({ mKey, currentMode, mInfo, modeWatchlistsCount, onSwitchMode, setActiveSection }: any) => {
  const dragControls = useDragControls();
  const isCurrent = currentMode === mKey;
  const MIcon = mInfo.icon;
  
  return (
    <Reorder.Item
      value={mKey}
      dragListener={false}
      dragControls={dragControls}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-extrabold transition-all shrink-0 border select-none ${
        isCurrent
          ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-black border-amber-300 shadow-lg shadow-amber-500/25 scale-105'
          : 'bg-black/60 text-white/80 border-white/15 hover:border-amber-400/60 hover:bg-zinc-900 hover:text-white'
      }`}
    >
      <div 
        className="cursor-grab active:cursor-grabbing p-1 -ml-2 text-white/40 hover:text-white/80 touch-none"
        onPointerDown={(e) => dragControls.start(e)}
        style={{ touchAction: 'none' }}
      >
        <GripVertical className="w-4 h-4" />
      </div>
      
      <div
        className="flex items-center gap-2 cursor-pointer w-full h-full"
        onClick={() => {
          if (onSwitchMode) onSwitchMode(mKey);
          setActiveSection('الكل');
        }}
      >
        <MIcon className={`w-4 h-4 ${isCurrent ? 'text-black font-bold' : 'text-amber-400'}`} />
        <span>{mInfo.name}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
          isCurrent ? 'bg-black/25 text-black' : 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
        }`}>
          {modeWatchlistsCount}
        </span>
      </div>
    </Reorder.Item>
  );
};

export const LibraryView: React.FC<LibraryViewProps> = ({ 
  onPlay, 
  watchlists,
  schedules = [],
  onUpdateSchedules,
  sessions = [],
  onAddSession,
  onUpdateSession,
  currentMode = 'family',
  onSwitchMode,
  customModes,
  onUpdateModeTitle,
  customCategories = [],
  allCustomCategories,
  onDeleteCategory,
  onRenameCategory,
  onReorderCategories,
  onAddWatchlist,
  onUpdateWatchlist,
  onDeleteWatchlist,
  onAddCategory
}) => {
  const [activeSection, setActiveSection] = useState<string>('الكل');
  const [libraryTypeFilter, setLibraryTypeFilter] = useState<'all' | 'playlists' | 'singles'>('all');
  
  // Custom mode order
  const [orderedModes, setOrderedModes] = useState<Mode[]>(() => {
    try {
      const saved = localStorage.getItem('shashaty_library_ordered_modes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === ALL_MODES.length) {
          // Verify it contains all expected modes
          const isValid = ALL_MODES.every(m => parsed.includes(m));
          if (isValid) return parsed;
        }
      }
    } catch (e) {}
    return ALL_MODES;
  });

  const handleReorderModes = (newOrder: Mode[]) => {
    setOrderedModes(newOrder);
    localStorage.setItem('shashaty_library_ordered_modes', JSON.stringify(newOrder));
  };
  const [selectedList, setSelectedList] = useState<Watchlist | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('جاري معالجة وسائط المكتبة...');
  const [importProgress, setImportProgress] = useState({ current: 0, total: 100, text: '' });

  // Smart Mode Switcher Modal State
  const [isModeSelectorModalOpen, setIsModeSelectorModalOpen] = useState(false);

  // Tab Rename & Editing Mode State
  const [isEditingTabs, setIsEditingTabs] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingSectionValue, setEditingSectionValue] = useState<string>('');

  // Mode Title Edit State
  const [isEditingModeTitle, setIsEditingModeTitle] = useState(false);
  const [modeTitleInput, setModeTitleInput] = useState('');

  const currentModeTitle = customModes?.[currentMode]?.title || MODE_LIBRARY_TITLES[currentMode] || 'المكتبة';

  const handleStartEditModeTitle = () => {
    setModeTitleInput(currentModeTitle);
    setIsEditingModeTitle(true);
  };

  const handleSaveModeTitle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (onUpdateModeTitle && modeTitleInput.trim()) {
      onUpdateModeTitle(currentMode, modeTitleInput.trim());
    }
    setIsEditingModeTitle(false);
  };

  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const delta = e.deltaY || e.deltaX;
      if (delta !== 0) {
        e.preventDefault();
        el.scrollBy({
          left: delta,
          behavior: 'auto'
        });
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleStartRenameSection = (sectionName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (sectionName === 'الكل') return;
    setEditingSection(sectionName);
    setEditingSectionValue(sectionName);
  };

  const handleSaveRenameSection = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingSection) return;
    const trimmed = editingSectionValue.trim();
    if (!trimmed || trimmed === editingSection) {
      setEditingSection(null);
      return;
    }

    if (onRenameCategory) {
      onRenameCategory(editingSection, trimmed);
    }
    setHiddenSections(prev => [...prev, editingSection]);
    if (activeSection === editingSection) {
      setActiveSection(trimmed);
    }
    setEditingSection(null);
  };

  // Delete & Edit Watchlist States
  const [deletingWatchlist, setDeletingWatchlist] = useState<Watchlist | null>(null);
  const [editingWatchlist, setEditingWatchlist] = useState<Watchlist | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editTargetMode, setEditTargetMode] = useState<Mode>('family');

  const editWatchlistFileInputRef = useRef<HTMLInputElement>(null);
  const [editWatchlistFolderName, setEditWatchlistFolderName] = useState<string | null>(null);
  const [editWatchlistFiles, setEditWatchlistFiles] = useState<any[] | null>(null);
  const [editWatchlistSeasons, setEditWatchlistSeasons] = useState<{ name: string; files: any[] }[] | null>(null);

  // Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { showAlert, showConfirm } = useDialog();
  const [listName, setListName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('عام');
  const [importedFolder, setImportedFolder] = useState<string | null>(null);
  const [importedHandle, setImportedHandle] = useState<any>(null);
  const [importedFiles, setImportedFiles] = useState<any[]>([]);
  const [detectedSeasons, setDetectedSeasons] = useState<{ name: string; files: any[] }[]>([]);
  const [parsedWatchlists, setParsedWatchlists] = useState<Watchlist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilterType, setSearchFilterType] = useState<'all' | 'watchlists' | 'files'>('all');
  const [selectedSearchWatchlistIds, setSelectedSearchWatchlistIds] = useState<string[]>([]);
  const [selectedSearchFileKeys, setSelectedSearchFileKeys] = useState<string[]>([]);
  
  // Smart Session Add Modal State from Search
  const [isBatchAddToSessionModalOpen, setIsBatchAddToSessionModalOpen] = useState(false);
  const [targetSessionId, setTargetSessionId] = useState<string>('new');
  const [newSessionTitle, setNewSessionTitle] = useState('');

  // Scan Linked Folders for New Files Modal State
  const [scannedNewFilesResults, setScannedNewFilesResults] = useState<{
    watchlist: Watchlist;
    newFiles: any[]
  }[]>([]);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  const handleScanLinkedFoldersForNewFiles = async () => {
    const modeWatchlists = watchlists;
    if (modeWatchlists.length === 0) {
      await showAlert(`لا يوجد أي قوائم تشغيل في المكتبة للقيام بفحصها.`);
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingMessage(`يتم الآن فحص وتحديث مسارات ${MODE_DETAILS[currentMode]?.name || currentMode}...`);

      const results: { watchlist: Watchlist; newFiles: any[] }[] = [];
      const scannedPaths = new Set<string>();

      for (const wl of modeWatchlists) {
        if (wl.isSingleFile) continue;

        // Deduce root path from the first available file
        const existingFiles = wl.seasons && wl.seasons.length > 0
          ? wl.seasons.flatMap(s => s.files || [])
          : wl.files || [];

        const firstFile = existingFiles.find(f => f && (f.path || f.absolutePath));
        if (!firstFile) continue;

        const fullPath = firstFile.path || firstFile.absolutePath;
        let rootPath = '';

        if (wl.folderName) {
          const idx = fullPath.lastIndexOf(wl.folderName);
          if (idx !== -1) {
            rootPath = fullPath.substring(0, idx + wl.folderName.length);
          }
        }
        
        if (!rootPath) {
          const lastSlash = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
          rootPath = lastSlash !== -1 ? fullPath.substring(0, lastSlash) : '';
        }

        if (!rootPath || scannedPaths.has(rootPath)) continue;
        scannedPaths.add(rootPath);

        try {
          const allScannedFiles = await invoke<any[]>('scan_media_directory', { path: rootPath });
          
          if (allScannedFiles.length > 0) {
            // Process the scanned files to match our frontend format
            const formattedScannedFiles = allScannedFiles.map(f => {
              let relPath = f.path.replace(rootPath, '');
              if (relPath.startsWith('/') || relPath.startsWith('\\')) relPath = relPath.substring(1);
              return {
                name: f.name,
                size: f.size,
                type: f.file_type,
                absolutePath: f.path,
                path: f.path,
                customPath: `${wl.folderName || 'Folder'}/${relPath.replace(/\\/g, '/')}`,
                title: f.name.replace(/\.[^/.]+$/, "")
              };
            });

            // Find matching watchlists that belong to this rootPath (by folderName)
            const watchlistsInPath = modeWatchlists.filter(w => !w.isSingleFile && w.folderName && rootPath.endsWith(w.folderName));
            const wlsToProcess = watchlistsInPath.length > 0 ? watchlistsInPath : [wl];

            for (const targetWl of wlsToProcess) {
              const targetExistingFiles = targetWl.seasons && targetWl.seasons.length > 0
                ? targetWl.seasons.flatMap(s => s.files || [])
                : targetWl.files || [];

              const existingNames = new Set(targetExistingFiles.map((f: any) => (f.name || f.title || '').trim().toLowerCase()));
              const targetSearchKey = (targetWl.folderName || targetWl.title || '').toLowerCase().trim();

              const matchingFiles = formattedScannedFiles.filter((scannedFile: any) => {
                const customPath = (scannedFile.customPath || scannedFile.name || '').toLowerCase();
                return customPath.includes(targetSearchKey) || targetSearchKey.includes(scannedFile.name?.toLowerCase());
              });

              const brandNewFiles = matchingFiles.filter(f => !existingNames.has((f.name || '').trim().toLowerCase()));

              if (brandNewFiles.length > 0) {
                // Ensure we don't add duplicate results for the same watchlist
                if (!results.some(r => r.watchlist.id === targetWl.id)) {
                  results.push({
                    watchlist: targetWl,
                    newFiles: sortSmartMediaFiles(brandNewFiles)
                  });
                }
              }
            }
          }
        } catch (scanErr) {
          console.warn(`Failed to scan deduced path ${rootPath}:`, scanErr);
        }
      }

      setIsProcessing(false);

      if (results.length === 0) {
        await showAlert(`لا يوجد ملفات جديدة! جميع المجلدات المرتبطة بالمكتبة محدثة بالكامل.`);
      } else {
        setScannedNewFilesResults(results);
        setIsScanModalOpen(true);
      }
    } catch (e: any) {
      setIsProcessing(false);
      if (e && (e.name === 'SecurityError' || (e.message && e.message.includes('cross origin')) || e.name === 'NotAllowedError')) {
        await showAlert('خطأ في الصلاحيات. لا يمكن فحص المجلدات بسبب قيود المتصفح.');
      } else if (e && e.name !== 'AbortError' && !e.message?.includes('user aborted') && !e.message?.includes('cancel')) {
        console.warn('Error scanning folders:', e);
        await showAlert('حدث خطأ أثناء فحص المجلدات. يرجى التأكد من أن المجلدات لا تزال موجودة في مسارها.');
      }
    }
  };

  const handleSyncSingleWatchlistNewFiles = (item: { watchlist: Watchlist; newFiles: any[] }) => {
    const { watchlist, newFiles } = item;
    const existingFiles = watchlist.files || [];
    const updatedFiles = sortSmartMediaFiles([...existingFiles, ...newFiles]);
    const totalEpCount = updatedFiles.length;

    const updatedWatchlist: Watchlist = {
      ...watchlist,
      files: updatedFiles,
      episodesCount: totalEpCount,
    };

    if (onUpdateWatchlist) {
      onUpdateWatchlist(updatedWatchlist);
    }

    const remaining = scannedNewFilesResults.filter(r => r.watchlist.id !== watchlist.id);
    setScannedNewFilesResults(remaining);
    if (remaining.length === 0) {
      setIsScanModalOpen(false);
    }

    showAlert(`تمت مزامنة قائمة "${watchlist.title}" وتمت إضافة ${newFiles.length} ملف جديد بنجاح! 🎉`);
  };

  const handleCancelSingleWatchlistNewFiles = (watchlistId: string) => {
    const remaining = scannedNewFilesResults.filter(r => r.watchlist.id !== watchlistId);
    setScannedNewFilesResults(remaining);
    if (remaining.length === 0) {
      setIsScanModalOpen(false);
    }
  };

  // Normalized Search Query
  const normalizedSearchQuery = useMemo(() => normalizeArabicText(searchQuery.trim()), [searchQuery]);

  // Today Schedules for Daily Digest Widget
  const todayIndex = new Date().getDay();
  const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const todayName = ARABIC_DAYS[todayIndex];

  const todaySchedules = useMemo(() => {
    if (!schedules || schedules.length === 0) return [];
    return schedules
      .filter(s => s.dayOfWeek === todayIndex)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [schedules, todayIndex]);

  // 1. Search Matching Watchlists / Series
  const searchMatchingWatchlists = useMemo(() => {
    if (!normalizedSearchQuery) return [];
    return watchlists.filter(w => {
      const titleMatch = normalizeArabicText(w.title).includes(normalizedSearchQuery);
      const sectionMatch = w.section ? normalizeArabicText(w.section).includes(normalizedSearchQuery) : false;
      const folderMatch = w.folderName ? normalizeArabicText(w.folderName).includes(normalizedSearchQuery) : false;
      return titleMatch || sectionMatch || folderMatch;
    });
  }, [watchlists, normalizedSearchQuery]);

  // 2. Search Matching Individual Files / Episodes
  const searchMatchingFiles = useMemo(() => {
    if (!normalizedSearchQuery) return [];
    const results: { key: string; file: any; watchlist: Watchlist; epIndex: number; title: string; duration: string; filesList: any[] }[] = [];

    watchlists.forEach(w => {
      const allFiles = [
        ...(w.files || []),
        ...(w.seasons?.flatMap(s => s.files || []) || [])
      ];
      allFiles.forEach((file, idx) => {
        const fileName = file.name || file.title || `الحلقة ${idx + 1}`;
        if (normalizeArabicText(fileName).includes(normalizedSearchQuery)) {
          const key = `${w.id}-${idx}`;
          results.push({
            key,
            file,
            watchlist: w,
            epIndex: idx,
            title: fileName,
            duration: file.duration || `${(idx + 1) * 3 + 20} دقيقة`,
            filesList: allFiles
          });
        }
      });
    });

    return results;
  }, [watchlists, normalizedSearchQuery]);

  // Visible Search Counts
  const visibleSearchWatchlists = searchFilterType === 'files' ? [] : searchMatchingWatchlists;
  const visibleSearchFiles = searchFilterType === 'watchlists' ? [] : searchMatchingFiles;
  const totalVisibleSearchCount = visibleSearchWatchlists.length + visibleSearchFiles.length;

  const isAllVisibleSelected = useMemo(() => {
    if (totalVisibleSearchCount === 0) return false;
    let watchlistsSelected = true;
    if (searchFilterType !== 'files' && visibleSearchWatchlists.length > 0) {
      watchlistsSelected = visibleSearchWatchlists.every(w => selectedSearchWatchlistIds.includes(w.id));
    }
    let filesSelected = true;
    if (searchFilterType !== 'watchlists' && visibleSearchFiles.length > 0) {
      filesSelected = visibleSearchFiles.every(f => selectedSearchFileKeys.includes(f.key));
    }
    return watchlistsSelected && filesSelected;
  }, [searchFilterType, visibleSearchWatchlists, visibleSearchFiles, selectedSearchWatchlistIds, selectedSearchFileKeys, totalVisibleSearchCount]);

  const handleToggleSelectAllSearch = () => {
    if (isAllVisibleSelected) {
      if (searchFilterType !== 'files') {
        setSelectedSearchWatchlistIds(prev => prev.filter(id => !visibleSearchWatchlists.some(w => w.id === id)));
      }
      if (searchFilterType !== 'watchlists') {
        setSelectedSearchFileKeys(prev => prev.filter(k => !visibleSearchFiles.some(f => f.key === k)));
      }
    } else {
      if (searchFilterType !== 'files') {
        const allWIds = visibleSearchWatchlists.map(w => w.id);
        setSelectedSearchWatchlistIds(prev => Array.from(new Set([...prev, ...allWIds])));
      }
      if (searchFilterType !== 'watchlists') {
        const allFKeys = visibleSearchFiles.map(f => f.key);
        setSelectedSearchFileKeys(prev => Array.from(new Set([...prev, ...allFKeys])));
      }
    }
  };

  const toggleSearchWatchlistSelect = (id: string) => {
    setSelectedSearchWatchlistIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSearchFileSelect = (key: string) => {
    setSelectedSearchFileKeys(prev => 
      prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]
    );
  };

  const handleBatchAddToSession = () => {
    const totalSelected = selectedSearchWatchlistIds.length + selectedSearchFileKeys.length;
    if (totalSelected === 0) {
      showAlert('يرجى تحديد عنصر واحد على الأقل من نتائج البحث أولاً.');
      return;
    }
    setTargetSessionId(sessions && sessions.length > 0 ? sessions[0].id : 'new');
    setNewSessionTitle(`جلسة بحث - ${searchQuery.trim()}`);
    setIsBatchAddToSessionModalOpen(true);
  };

  const handleConfirmBatchAddToSession = () => {
    const totalSelectedCount = selectedSearchWatchlistIds.length + selectedSearchFileKeys.length;
    if (totalSelectedCount === 0) return;

    const selectedWatchlists = watchlists.filter(w => selectedSearchWatchlistIds.includes(w.id));
    const selectedFiles = searchMatchingFiles.filter(f => selectedSearchFileKeys.includes(f.key));

    if (targetSessionId === 'new') {
      const title = newSessionTitle.trim() || `جلسة ذكية ${new Date().toLocaleDateString('ar-EG')}`;
      
      const newItems: any[] = [
        ...selectedWatchlists.map(w => ({
          seriesName: w.title,
          episodesCount: w.episodesCount || 10,
          watchlistId: w.id,
          mode: w.targetMode || 'family'
        })),
        ...selectedFiles.map(f => ({
          seriesName: `${f.watchlist.title} - ${f.title}`,
          episodesCount: 1,
          watchlistId: f.watchlist.id,
          mode: f.watchlist.targetMode || 'family'
        }))
      ];

      const newWatchlistIds = Array.from(new Set([
        ...selectedSearchWatchlistIds,
        ...selectedFiles.map(f => f.watchlist.id)
      ]));

      const newSession: Session = {
        id: Date.now().toString(),
        title,
        items: newItems,
        loopSequence: true,
        breakBetweenItems: 0,
        breakBetweenLoops: 0,
        selectedWatchlistIds: newWatchlistIds,
        strategy: 'alternate',
        lastWatchedIndex: 0,
        lastWatchedTime: 0
      };

      if (onAddSession) {
        onAddSession(newSession);
      }
      showAlert(`تم إنشاء الجلسة الذكية الجديد "${title}" وإضافة ${totalSelectedCount} عنصر إليها بنجاح! 🎉`);
    } else {
      const existingSession = (sessions || []).find(s => s.id === targetSessionId);
      if (!existingSession) return;

      const existingWatchlistIds = new Set(existingSession.selectedWatchlistIds || []);
      const newWatchlistIds = [...(existingSession.selectedWatchlistIds || [])];

      selectedSearchWatchlistIds.forEach(id => {
        if (!existingWatchlistIds.has(id)) {
          existingWatchlistIds.add(id);
          newWatchlistIds.push(id);
        }
      });

      selectedFiles.forEach(f => {
        if (!existingWatchlistIds.has(f.watchlist.id)) {
          existingWatchlistIds.add(f.watchlist.id);
          newWatchlistIds.push(f.watchlist.id);
        }
      });

      const updatedItems = [
        ...existingSession.items,
        ...selectedWatchlists.filter(w => !existingSession.items.some(i => i.watchlistId === w.id)).map(w => ({
          seriesName: w.title,
          episodesCount: w.episodesCount || 10,
          watchlistId: w.id,
          mode: w.targetMode || 'family'
        })),
        ...selectedFiles.map(f => ({
          seriesName: `${f.watchlist.title} - ${f.title}`,
          episodesCount: 1,
          watchlistId: f.watchlist.id,
          mode: f.watchlist.targetMode || 'family'
        }))
      ];

      const updatedSession: Session = {
        ...existingSession,
        selectedWatchlistIds: newWatchlistIds,
        items: updatedItems
      };

      if (onUpdateSession) {
        onUpdateSession(updatedSession);
      }
      showAlert(`تمت إضافة ${totalSelectedCount} عنصر إلى الجلسة الذكية "${existingSession.title}" بنجاح! ✨`);
    }

    setIsBatchAddToSessionModalOpen(false);
    setSelectedSearchWatchlistIds([]);
    setSelectedSearchFileKeys([]);
  };

  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const [isParentFolder, setIsParentFolder] = useState<boolean>(true);
  const [isAddedAsParent, setIsAddedAsParent] = useState<boolean>(false);

  const checkIfParentFolder = async (folderName: string): Promise<boolean> => {
    if (!folderName) return true;
    try {
      const parentHandles = await store.getParentDirectoryHandles();
      const isParentInHandles = parentHandles.some((h: any) => h && h.name && h.name.toLowerCase() === folderName.toLowerCase());

      let localFolders: any[] = [];
      try {
        const saved = localStorage.getItem('app_local_folders');
        if (saved) localFolders = JSON.parse(saved);
      } catch {}

      const isParentInLocal = localFolders.some((f: any) => 
        f.name && (
          f.name.toLowerCase() === folderName.toLowerCase() || 
          (f.path && f.path.toLowerCase().endsWith(folderName.toLowerCase()))
        )
      );

      return isParentInHandles || isParentInLocal;
    } catch (e) {
      return false;
    }
  };

  const checkAndSetParentStatus = (folderName: string) => {
    checkIfParentFolder(folderName).then(isParent => {
      setIsParentFolder(isParent);
      setIsAddedAsParent(false);
    });
  };

  const handleConfirmAddAsParentFolder = async () => {
    if (!importedFolder) return;
    try {
      if (importedHandle) {
        const existingHandles = await store.getParentDirectoryHandles();
        if (!existingHandles.some((h: any) => h.name === importedHandle.name)) {
          await store.setParentDirectoryHandles([...existingHandles, importedHandle]);
        }
      }

      let localFolders: any[] = [];
      try {
        const saved = localStorage.getItem('app_local_folders');
        if (saved) localFolders = JSON.parse(saved);
      } catch {}

      if (!localFolders.some((f: any) => f.name && f.name.toLowerCase() === importedFolder.toLowerCase())) {
        const newFolder = {
          id: Date.now().toString(),
          name: importedFolder,
          path: `/Media/${importedFolder}`,
          filesCount: importedFiles.length || 0,
          lastScanned: 'الآن'
        };
        localFolders.push(newFolder);
        localStorage.setItem('app_local_folders', JSON.stringify(localFolders));
      }

      setIsAddedAsParent(true);
      setIsParentFolder(true);
      await showAlert(`تمت إضافة المجلد "${importedFolder}" إلى المجلدات الأساسية (الأب) في الإعدادات بنجاح! ✨`);
    } catch (err) {
      console.error('Failed to add as parent folder:', err);
    }
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);

  const handleAddIndividualFilesClick = () => {
    if (singleFileInputRef.current) {
      singleFileInputRef.current.value = '';
      singleFileInputRef.current.click();
    }
  };

  const handleSingleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files) as File[];
      const mediaFiles = fileList.filter(file => 
        file.type.startsWith('video/') || 
        file.type.startsWith('audio/') || 
        file.name.match(/\.(mp4|mkv|webm|avi|mov|ts|m4v|flv|wmv|3gp|mp3|m4a|aac|wav|flac|ogg)$/i)
      );
      const targetFiles = sortSmartMediaFiles(mediaFiles.length > 0 ? mediaFiles : fileList);
      if (targetFiles.length > 0) {
        const titleName = targetFiles[0].name.replace(/\.[^/.]+$/, "");
        const folderDisplayName = targetFiles.length === 1 ? titleName : 'مجموعة مقاطع مفردة';
        const watchlists = buildWatchlistsFromFiles(targetFiles, folderDisplayName, currentMode as Mode, selectedCategory);
        setParsedWatchlists(watchlists);
        setImportedFolder(folderDisplayName);
        if (!listName) setListName(folderDisplayName);
        setImportedFiles(targetFiles);
        setDetectedSeasons([]);
      }
    }
  };

  const [isAddingHeaderCategory, setIsAddingHeaderCategory] = useState(false);
  const [headerCategoryInput, setHeaderCategoryInput] = useState('');
  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const [deletingSection, setDeletingSection] = useState<string | null>(null);

  // Tab Drag and Drop Reordering state
  const [customTabOrder, setCustomTabOrder] = useState<string[]>([]);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);

  const handleTabDrop = (dragged: string, target: string) => {
    if (!dragged || !target || dragged === target || dragged === 'الكل' || target === 'الكل') {
      setDraggedTab(null);
      setDragOverTab(null);
      return;
    }
    const currentOrder = allSections.filter(s => s !== 'الكل');
    const fromIdx = currentOrder.indexOf(dragged);
    const toIdx = currentOrder.indexOf(target);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedTab(null);
      setDragOverTab(null);
      return;
    }

    const updated = [...currentOrder];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);

    setCustomTabOrder(updated);
    setDraggedTab(null);
    setDragOverTab(null);

    if (onReorderCategories) {
      onReorderCategories(updated);
    }
  };

  const handleMoveTab = (section: string, direction: 'prev' | 'next') => {
    if (section === 'الكل') return;
    const currentOrder = allSections.filter(s => s !== 'الكل');
    const idx = currentOrder.indexOf(section);
    if (idx === -1) return;

    const targetIdx = direction === 'prev' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return;

    const updated = [...currentOrder];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);

    setCustomTabOrder(updated);

    if (onReorderCategories) {
      onReorderCategories(updated);
    }
  };

  const handleDeleteSection = (sectionToDelete: string) => {
    if (sectionToDelete === 'الكل') return;
    if (onDeleteCategory) {
      onDeleteCategory(sectionToDelete);
    }
    setHiddenSections(prev => [...prev, sectionToDelete]);
    if (activeSection === sectionToDelete) {
      setActiveSection('الكل');
    }
  };

  const handleHeaderAddCategorySubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = headerCategoryInput.trim();
    if (!trimmed) return;
    if (onAddCategory) {
      onAddCategory(trimmed);
    }
    setHiddenSections(prev => prev.filter(s => s !== trimmed));
    setActiveSection(trimmed);
    setHeaderCategoryInput('');
    setIsAddingHeaderCategory(false);
  };

  const isKidsMode = currentMode === 'kids';

  // Reset section when mode changes
  useEffect(() => {
    const base = (MODE_SECTIONS[currentMode] || MODE_SECTIONS.family).filter(s => s !== 'الكل');
    const cats = Array.from(new Set([...base, ...customCategories]));
    const un: string[] = [];
    cats.forEach(sec => {
      if (sec && !un.includes(sec)) un.push(sec);
    });
    
    const sorted = [...un].sort((a, b) => {
      const indexA = customTabOrder.indexOf(a);
      const indexB = customTabOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });

    setActiveSection('الكل');
  }, [currentMode]);

  // Determine categories strictly based on mode
  const baseSections = (MODE_SECTIONS[currentMode] || MODE_SECTIONS.family).filter(s => s !== 'الكل');
  const categoriesList = Array.from(new Set([...baseSections, ...customCategories]));

  // Collect all sections for top bar pills
  const rawSections = [
    'الكل',
    ...categoriesList, 
    ...watchlists.filter(w => w.targetMode === currentMode || (!w.targetMode && !isKidsMode)).map(w => w.section)
  ];
  const unorderedSections: string[] = [];
  rawSections.forEach(sec => {
    if (sec && !unorderedSections.includes(sec) && !hiddenSections.includes(sec)) {
      unorderedSections.push(sec);
    }
  });

  const otherUnordered = unorderedSections.filter(s => s !== 'الكل');
  const sortedOthers = [...otherUnordered].sort((a, b) => {
    const indexA = customTabOrder.indexOf(a);
    const indexB = customTabOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return 0;
  });

  const allSections = unorderedSections.includes('الكل') ? [...sortedOthers, 'الكل'] : sortedOthers;

  const matchesSearch = (list: Watchlist) => {
    if (!searchQuery.trim()) return true;
    const q = normalizeArabicText(searchQuery);
    if (!q) return true;

    const titleMatch = normalizeArabicText(list.title).includes(q);
    const sectionMatch = list.section ? normalizeArabicText(list.section).includes(q) : false;
    const folderMatch = list.folderName ? normalizeArabicText(list.folderName).includes(q) : false;
    const filesMatch = list.files ? list.files.some((f: any) => normalizeArabicText(f.name || f.webkitRelativePath || '').includes(q)) : false;
    const seasonsMatch = list.seasons ? list.seasons.some(s => normalizeArabicText(s.name).includes(q) || s.files.some((f: any) => normalizeArabicText(f.name || '').includes(q))) : false;
    
    return titleMatch || sectionMatch || folderMatch || filesMatch || seasonsMatch;
  };

  // Base mode watchlists
  const modeBaseWatchlists = watchlists.filter(list => {
    if (isKidsMode) {
      return list.targetMode === 'kids' || 
        ['عربي', 'إسلامي', 'أجنبي معرّب', 'أجنبي', 'تعليمي', 'أغاني', 'أطفال', 'كرتون'].includes(list.section);
    } else {
      const isKidsList = list.targetMode === 'kids' || ['عربي', 'إسلامي', 'أجنبي معرّب', 'أجنبي', 'تعليمي', 'أغاني', 'أطفال', 'كرتون'].includes(list.section);
      if (isKidsList) return false;
      if (list.targetMode && list.targetMode !== currentMode) return false;
      return true;
    }
  });

  const totalSinglesCount = modeBaseWatchlists.filter(list => (list.isSingleFile === true)).length;
  const totalPlaylistsCount = modeBaseWatchlists.length - totalSinglesCount;
  const totalModeCount = modeBaseWatchlists.length;

  // Filter watchlists dynamically so modes and types don't mix
  const filteredWatchlists = watchlists.filter(list => {
    if (!matchesSearch(list)) return false;

    const isSingle = (list.isSingleFile === true);
    if (libraryTypeFilter === 'playlists' && isSingle) return false;
    if (libraryTypeFilter === 'singles' && !isSingle) return false;

    if (isKidsMode) {
      const isKidsList = list.targetMode === 'kids' || 
        ['عربي', 'إسلامي', 'أجنبي معرّب', 'أجنبي', 'تعليمي', 'أغاني', 'أطفال', 'كرتون'].includes(list.section);
      
      if (!isKidsList) return false;
      if (activeSection === 'الكل') return true;
      return list.section === activeSection;
    } else {
      const isKidsList = list.targetMode === 'kids' || ['عربي', 'إسلامي', 'أجنبي معرّب', 'أجنبي', 'تعليمي', 'أغاني', 'أطفال', 'كرتون'].includes(list.section);
      if (isKidsList) return false;

      if (list.targetMode && list.targetMode !== currentMode) return false;

      if (activeSection === 'الكل') return true;
      return list.section === activeSection;
    }
  });

  // Group single video files into a special combined playlist for unified library display
  const sortedWatchlists = useMemo(() => {
    const isSingleList = (list: Watchlist) => 
      (list.isSingleFile === true);

    const singleFileWatchlists = filteredWatchlists.filter(isSingleList);
    const regularWatchlists = filteredWatchlists.filter(w => !isSingleList(w));

    // Sort regular playlists alphabetically
    const sortedRegular = [...regularWatchlists].sort((a, b) => {
      return naturalCompare(a.title, b.title);
    });

    if (singleFileWatchlists.length === 0) {
      return sortedRegular;
    }

    // Combine all single video files into ONE special playlist card
    const allSingleFiles = singleFileWatchlists.flatMap(w => {
      if (w.files && w.files.length > 0) return w.files;
      return [{
        name: w.title,
        title: w.title,
        size: '0 MB',
        coverImage: w.coverImage
      }];
    });

    const firstCover = singleFileWatchlists.find(w => w.coverImage)?.coverImage || getWatchlistCover(singleFileWatchlists[0]);

    const combinedSinglePlaylist: Watchlist = {
      id: 'combined_single_files_playlist',
      title: 'قائمة الملفات المنفردة 🎬',
      section: activeSection === 'الكل' ? 'عام' : activeSection,
      targetMode: currentMode,
      isSingleFile: false,
      seriesCount: 1,
      episodesCount: allSingleFiles.length,
      files: allSingleFiles,
      coverImage: firstCover,
      lastWatched: '',
      progress: 0,
      timeRemaining: '',
      folderName: 'قائمة الملفات المنفردة',
      folderPath: '/قائمة الملفات المنفردة'
    };

    if (libraryTypeFilter === 'singles') {
      return [combinedSinglePlaylist];
    }

    if (libraryTypeFilter === 'playlists') {
      return sortedRegular;
    }

    // Default 'all': Show combined single files playlist card first, followed by regular playlists
    return [combinedSinglePlaylist, ...sortedRegular];
  }, [filteredWatchlists, libraryTypeFilter, activeSection, currentMode]);

  const handleStartEditWatchlist = (e: React.MouseEvent, list: Watchlist) => {
    e.stopPropagation();
    setEditingWatchlist(list);
    setEditTitle(list.title);
    setEditSection(list.section || 'عام');
    setEditTargetMode(list.targetMode || currentMode);
    setEditWatchlistFolderName(list.folderName || list.folderPath || null);
    setEditWatchlistFiles(null);
    setEditWatchlistSeasons(null);
  };

  const handleEditFolderReselect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []) as any[];
    if (rawFiles.length === 0) return;

    const mediaExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.ts', '.m4v', '.wmv'];
    const mediaFiles = rawFiles.filter(f => 
      mediaExtensions.some(ext => f.name.toLowerCase().endsWith(ext))
    );

    const firstPath = rawFiles[0].webkitRelativePath || '';
    const folderTitle = firstPath.split('/')[0] || rawFiles[0].name || 'مجلد جديد';
    
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

    setEditWatchlistFolderName(folderTitle);
    setEditWatchlistFiles(finalFiles);
    setEditWatchlistSeasons(seasonsList);

    if (editingWatchlist && editTitle === editingWatchlist.title) {
      setEditTitle(folderTitle);
    }
  };

  const handleSaveEditWatchlist = async () => {
    if (!editingWatchlist || !editTitle.trim()) {
      await showAlert('يرجى إدخال اسم قائمة التشغيل.');
      return;
    }

    const updatedFiles = editWatchlistFiles !== null ? editWatchlistFiles : (editingWatchlist.files || []);
    const updatedSeasons = editWatchlistSeasons !== null ? editWatchlistSeasons : (editingWatchlist.seasons || []);
    const updatedFolderName = editWatchlistFolderName !== null ? editWatchlistFolderName : (editingWatchlist.folderName || editingWatchlist.title);
    
    let updatedCover = editingWatchlist.coverImage;
    if (editWatchlistFiles !== null && updatedFiles.length > 0) {
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
        updatedCover = getWatchlistCover({ title: editTitle, section: editSection, files: updatedFiles, seasons: updatedSeasons, targetMode: editTargetMode });
      }
    }

    const totalEpCount = updatedFiles.length > 0 ? updatedFiles.length : editingWatchlist.episodesCount;
    const seriesCount = updatedSeasons.length > 0 ? updatedSeasons.length : (editingWatchlist.seriesCount || 1);

    if (onUpdateWatchlist) {
      onUpdateWatchlist({
        ...editingWatchlist,
        title: editTitle.trim(),
        section: editSection.trim() || 'عام',
        targetMode: editTargetMode,
        folderName: updatedFolderName,
        folderPath: `/${updatedFolderName}`,
        files: updatedFiles,
        seasons: updatedSeasons,
        episodesCount: totalEpCount,
        seriesCount: seriesCount,
        coverImage: updatedCover
      });
    }
    setEditingWatchlist(null);
  };

  const handleConfirmDeleteWatchlist = () => {
    if (deletingWatchlist && onDeleteWatchlist) {
      if (deletingWatchlist.id === 'combined_single_files_playlist') {
        const isSingleList = (list: Watchlist) => 
          (list.isSingleFile === true);
        const singles = filteredWatchlists.filter(isSingleList);
        singles.forEach(s => onDeleteWatchlist(s.id));
      } else {
        onDeleteWatchlist(deletingWatchlist.id);
      }
    }
    setDeletingWatchlist(null);
  };

  const openCreateModal = (categoryOverride?: string) => {
    const initialCategory = categoryOverride && categoryOverride !== 'الكل' 
      ? categoryOverride 
      : (activeSection !== 'الكل' ? activeSection : (categoriesList[0] || 'عام'));
    setSelectedCategory(initialCategory);
    setListName('');
    setImportedFolder(null);
    setImportedFiles([]);
    setDetectedSeasons([]);
    setParsedWatchlists([]);
    setShowAddCategoryInput(false);
    setNewCategoryInput('');
    setIsCreateModalOpen(true);
  };

  const handleAddNewCategorySubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (onAddCategory) {
      onAddCategory(trimmed);
    }
    setSelectedCategory(trimmed);
    setNewCategoryInput('');
    setShowAddCategoryInput(false);
  };

  const handleAddFolderClick = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isCrossOriginIframe()) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
      return;
    }

    try {
      const dirPath = await open({ directory: true });
      if (dirPath && typeof dirPath === 'string') {
        setImportedHandle(dirPath);
        const folderName = dirPath.split(/[/\\]/).pop() || 'مجلد';

        setProcessingMessage('جاري تحليل محتويات المجلد...');
        setIsProcessing(true);
        const newWatchlists = await processMediaDirectory(dirPath, watchlists, (current, total, text) => {
          setImportProgress({ current, total, text });
        });
        setIsProcessing(false);
        newWatchlists.forEach(wl => {
          if (currentMode) wl.targetMode = currentMode as Mode;
          if (selectedCategory) wl.section = selectedCategory;
        });

        setParsedWatchlists(newWatchlists);
        setImportedFolder(folderName);
        
        const allFiles = newWatchlists.flatMap(w => w.files || []);
        setImportedFiles(allFiles as any);
        
        if (newWatchlists.length === 1) {
          setListName(newWatchlists[0].title);
          setDetectedSeasons(newWatchlists[0].seasons || []);
        } else {
          setListName(folderName);
          setDetectedSeasons([]);
        }

        checkAndSetParentStatus(folderName);
        return;
      }
    } catch (err: any) {
      console.error('open dialog unavailable or cancelled:', err);
      if (showAlert) {
        await showAlert('حدث خطأ أثناء فتح نافذة اختيار المجلد أو أثناء فحصه. يرجى التأكد من الصلاحيات.', 'خطأ');
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.items || e.dataTransfer.items.length === 0) return;

    const allFiles: File[] = [];
    let folderName = '';

    const processEntry = async (entry: any, path = '') => {
      if (entry.isFile) {
        return new Promise<void>((resolve) => {
          entry.file((file: File) => {
            const isMedia = file.type.startsWith('video/') || file.type.startsWith('audio/') || file.name.match(/\.(mp4|mkv|webm|avi|mov|ts|m4v|flv|wmv|3gp|mp3|m4a|aac|wav|flac|ogg)$/i);
            if (isMedia) {
              const fullPath = path ? `${path}/${file.name}` : file.name;
              try { Object.defineProperty(file, 'customPath', { value: fullPath, writable: true }); } catch { (file as any).customPath = fullPath; }
              try { Object.defineProperty(file, 'webkitRelativePath', { value: fullPath, writable: true }); } catch { (file as any).webkitRelativePath = fullPath; }
              allFiles.push(file);
            }
            resolve();
          });
        });
      } else if (entry.isDirectory) {
        if (!folderName && !path) folderName = entry.name;
        const dirReader = entry.createReader();
        const entries: any[] = await new Promise((resolve) => {
          dirReader.readEntries((res: any[]) => resolve(res));
        });
        for (const child of entries) {
          await processEntry(child, path ? `${path}/${entry.name}` : entry.name);
        }
      }
    };

    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      const item = e.dataTransfer.items[i];
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        await processEntry(entry);
      }
    }

    if (!folderName && allFiles.length > 0) {
      folderName = 'ملفات فردية';
    }

    if (folderName && allFiles.length > 0) {
      const watchlists = buildWatchlistsFromFiles(allFiles, folderName, currentMode as Mode, selectedCategory);
      setParsedWatchlists(watchlists);
      setImportedFolder(folderName);
      setImportedFiles(allFiles);
      if (watchlists.length === 1) {
        setListName(watchlists[0].title);
        setDetectedSeasons(watchlists[0].seasons || []);
      } else {
        setListName(folderName);
        setDetectedSeasons([]);
      }
      checkAndSetParentStatus(folderName);
    }
  };

  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allFileList = Array.from(files) as File[];
    const firstFilePath = allFileList[0].webkitRelativePath || '';
    const folderName = firstFilePath.split('/')[0] || 'ملفات فردية';

    const mediaFiles = allFileList.filter(file => 
      file.type.startsWith('video/') || 
      file.type.startsWith('audio/') || 
      file.name.match(/\.(mp4|mkv|webm|avi|mov|ts|m4v|flv|wmv|3gp|mp3|m4a|aac|wav|flac|ogg)$/i)
    );
    const targetFiles = mediaFiles.length > 0 ? mediaFiles : allFileList;

    const watchlists = buildWatchlistsFromFiles(targetFiles, folderName, currentMode as Mode, selectedCategory);
    setParsedWatchlists(watchlists);
    setImportedFolder(folderName);
    setImportedFiles(targetFiles);

    if (watchlists.length === 1) {
      setListName(watchlists[0].title);
      setDetectedSeasons(watchlists[0].seasons || []);
    } else {
      setListName(folderName);
      setDetectedSeasons([]);
    }

    checkAndSetParentStatus(folderName);
  };

  const handleSaveWatchlist = async () => {
    if (isProcessing) return;
    if (!importedFolder || parsedWatchlists.length === 0) {
      await showAlert('يرجى اختيار مجلد يحتوي على مقاطع فيديو أو مسلسلات.');
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('جاري حفظ الهيكل وقوائم التشغيل...');

    try {
      const finalWatchlists = parsedWatchlists.map(w => ({
        ...w,
        targetMode: currentMode as Mode,
        section: selectedCategory,
        title: parsedWatchlists.length === 1 && listName.trim() ? listName.trim() : w.title,
        id: w.id || (Date.now() + Math.random() * 1000).toString()
      }));

      // Thumbnails will be lazily extracted by the UI components (e.g. WatchlistCard) when they render
      setImportProgress({ current: finalWatchlists.length, total: finalWatchlists.length, text: 'اكتملت المعالجة!' });

      if (onAddWatchlist) {
        onAddWatchlist(finalWatchlists);
      }

      setIsCreateModalOpen(false);
      setActiveSection(selectedCategory);
      setListName('');
      setImportedFolder(null);
      setImportedFiles([]);
      setDetectedSeasons([]);
      setParsedWatchlists([]);

      if (finalWatchlists.length === 1) {
        await showAlert(`تمت إضافة قائمة التشغيل "${finalWatchlists[0].title}" بنجاح! 🎉`);
      } else {
        await showAlert(`تم إنشاء ${finalWatchlists.length} قائمة تشغيل منفصلة بنجاح! 🎉`);
      }
    } catch (err) {
      console.error('Failed to save watchlists:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardClick = (list: Watchlist) => {
    setSelectedList(list);
  };

  const getSectionIcon = (sectionName: string) => {
    if (sectionName === 'الكل') return Layers;
    if (sectionName.includes('مسلسل')) return Tv;
    if (sectionName.includes('فيلم') || sectionName.includes('سينما')) return Film;
    if (sectionName.includes('وثائقي')) return Globe;
    if (sectionName.includes('أنمي') || sectionName.includes('كرتون') || sectionName.includes('أطفال') || sectionName.includes('حكايات') || sectionName.includes('قصص')) return Baby;
    if (sectionName.includes('قرآن') || sectionName.includes('إسلامي') || sectionName.includes('تلاوا') || sectionName.includes('أذكار')) return BookOpen;
    if (sectionName.includes('موسيقى') || sectionName.includes('أغاني') || sectionName.includes('أناشيد') || sectionName.includes('طرب')) return Music;
    return Folder;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 sm:p-8 lg:p-12 h-full relative w-full max-w-full overflow-x-hidden pb-28 md:pb-12"
    >
      <ProcessingRing 
        isVisible={isProcessing} 
        message={processingMessage} 
        subMessage={importProgress.text || "الرجاء الانتظار..."} progress={importProgress.current} total={importProgress.total} 
      />
      <header className="mb-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
          {/* Library Name & Edit Button */}
          <div className="flex items-center gap-3 shrink-0">
            {isEditingModeTitle ? (
              <form onSubmit={handleSaveModeTitle} className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={modeTitleInput} 
                  onChange={(e) => setModeTitleInput(e.target.value)} 
                  className="bg-black/50 text-white px-4 py-2 rounded-xl text-2xl sm:text-4xl md:text-5xl font-bold focus:outline-none border border-white/30 w-full sm:w-80"
                  autoFocus
                  onBlur={handleSaveModeTitle}
                />
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight drop-shadow-md whitespace-nowrap">
                  {currentModeTitle}
                </h1>
                <button 
                  onClick={handleStartEditModeTitle}
                  className="p-2 glass rounded-full hover:bg-white/20 transition-colors text-white/70 hover:text-white shrink-0 cursor-pointer"
                  title="تعديل اسم المكتبة"
                >
                  <Pencil className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            )}
          </div>

          {/* Folder Scan & Sync Button (Renamed to "فحص") */}
          <button
            type="button"
            onClick={handleScanLinkedFoldersForNewFiles}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 hover:bg-emerald-400 text-emerald-300 hover:text-black border border-emerald-400/40 font-extrabold text-xs sm:text-sm transition-all shadow-md cursor-pointer shrink-0 group"
            title="فحص المجلدات المرتبطة وتحديث ملفات الفيديو أو الصوت الجديدة"
          >
            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            <span>فحص 🔍</span>
          </button>
        </div>

        {/* Search Bar directly under Library name */}
        <div className="relative w-full max-w-2xl">
          <Search className="w-5 h-5 text-amber-400/70 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن مسلسل، حلقة، أو قائمة..."
            className="w-full bg-black/50 border border-white/20 focus:border-amber-400 rounded-2xl pr-11 pl-10 py-3 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/40 transition-all backdrop-blur-md shadow-lg"
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1 rounded-full cursor-pointer"
              title="مسح البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-xs sm:text-sm text-white/70 -mt-2">
          {isKidsMode ? 'عالم المحتوى الكرتوني والتعليمي الخاص بك!' : 'تصفح المحتوى المحلي الخاص بك وتصنيفاته'}
        </p>
      </header>
        
      {/* Smart Mode Switcher Ribbon Bar */}
      <div className="relative z-50 mb-6 bg-zinc-950/80 p-3 sm:p-4 rounded-3xl border border-amber-400/30 shadow-2xl space-y-2.5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-xs sm:text-sm font-extrabold text-white/90">
              التنقل السريع بين أوضاع المكتبة: <span className="text-amber-300 font-bold">({MODE_DETAILS[currentMode]?.name})</span>
            </span>
          </div>

        </div>

        <Reorder.Group 
          axis="x"
          values={orderedModes}
          onReorder={handleReorderModes}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 touch-pan-x"
        >
          {orderedModes.map((mKey) => {
            const mInfo = MODE_DETAILS[mKey];
            const modeWatchlistsCount = watchlists.filter(w => (w.targetMode || 'family') === mKey).length;

            return (
              <ModeItem
                key={mKey}
                mKey={mKey}
                currentMode={currentMode}
                mInfo={mInfo}
                modeWatchlistsCount={modeWatchlistsCount}
                onSwitchMode={onSwitchMode}
                setActiveSection={setActiveSection}
              />
            );
          })}
        </Reorder.Group>
      </div>

      {/* DAILY DIGEST WIDGET (ملخص البث اليومي) */}
      {todaySchedules.length > 0 && searchQuery.trim() === '' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-5 sm:p-6 rounded-3xl bg-zinc-950/80 border border-amber-400/50 backdrop-blur-2xl shadow-[0_0_50px_rgba(245,158,11,0.15)] relative overflow-hidden"
        >
          {/* Subtle Ambient Glow Mesh */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-4 flex-wrap gap-2 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/30 to-amber-400/10 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-md">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                  <span>📺 ملخص البث المجدول اليوم</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-lg bg-amber-400 text-black font-extrabold shadow-sm">
                    يوم {todayName} ({todaySchedules.length} مواعيد)
                  </span>
                </h2>
                <p className="text-xs text-white/70 font-medium mt-0.5">
                  استعرض مواعيد سهرة اليوم المستوحاة من مكتبتك مع خيار التشغيل المباشر
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
            {todaySchedules.map((slot) => {
              const linkedWl = watchlists.find(w => w.id === slot.watchlistId || w.title.toLowerCase().includes(slot.title.toLowerCase()));
              const coverImg = linkedWl?.coverImage || getEpisodeInspiredCover(slot.title);

              return (
                <div
                  key={slot.id}
                  className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-3 group hover:border-amber-400/40"
                >
                  {coverImg ? (
                    <img src={coverImg} alt={slot.title} className="w-12 h-16 rounded-xl object-cover border border-white/20 shrink-0 shadow-md" />
                  ) : (
                    <div className="w-12 h-16 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                      <Tv className="w-6 h-6 text-amber-300" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 mb-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>الساعة {slot.time}</span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white truncate group-hover:text-amber-300 transition-colors">
                      {slot.title}
                    </h4>
                    <p className="text-[11px] text-white/60 truncate font-medium mt-0.5">
                      الحلقة {slot.episodeIndex !== undefined ? slot.episodeIndex + 1 : 1}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      let wl = linkedWl;
                      if (wl) {
                        const allFiles = [...(wl.files || []), ...(wl.seasons?.flatMap(s => s.files || []) || [])];
                        if (allFiles.length > 0) {
                          const epIdx = slot.episodeIndex !== undefined ? slot.episodeIndex : (wl.lastWatchedIndex || 0);
                          const safeIdx = Math.min(allFiles.length - 1, Math.max(0, epIdx));
                          onPlay(allFiles[safeIdx], slot.title, wl.title, allFiles, safeIdx, undefined, wl.id, slot.startTimeOffset || 0);
                        }
                      }
                    }}
                    className="p-2.5 rounded-xl bg-amber-400/20 hover:bg-amber-400 text-amber-300 hover:text-black transition-all cursor-pointer border border-amber-400/30 shrink-0 shadow-sm"
                    title="تشغيل الموعد الآن"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* SEARCH RESULTS HUB WHEN SEARCH QUERY IS PRESENT */}
      {searchQuery.trim() !== '' ? (
        <div className="space-y-6 pb-28">
          {/* Search Header Bar with Filter Tabs and Selection Controls */}
          <div className="glass-card rounded-3xl p-4 sm:p-6 border border-amber-400/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Search className="w-5 h-5 text-amber-400" />
                <h2 className="text-xl sm:text-2xl font-bold text-white">نتائج البحث عن: "{searchQuery}"</h2>
              </div>
              <p className="text-xs sm:text-sm text-white/70">
                وجدنا <span className="text-amber-300 font-bold">{searchMatchingWatchlists.length}</span> قائمة/مسلسل و <span className="text-amber-300 font-bold">{searchMatchingFiles.length}</span> حلقة/ملف
              </p>
            </div>

            {/* Filter Tabs & Selection Actions */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Type Filter Buttons */}
              <div className="flex items-center bg-black/50 p-1 rounded-2xl border border-white/10 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSearchFilterType('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    searchFilterType === 'all' ? 'bg-amber-400 text-black font-extrabold shadow-md' : 'text-white/70 hover:text-white'
                  }`}
                >
                  الكل ({searchMatchingWatchlists.length + searchMatchingFiles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSearchFilterType('watchlists')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    searchFilterType === 'watchlists' ? 'bg-amber-400 text-black font-extrabold shadow-md' : 'text-white/70 hover:text-white'
                  }`}
                >
                  📺 قوائم/مسلسلات ({searchMatchingWatchlists.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSearchFilterType('files')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    searchFilterType === 'files' ? 'bg-amber-400 text-black font-extrabold shadow-md' : 'text-white/70 hover:text-white'
                  }`}
                >
                  🎬 ملفات/حلقات ({searchMatchingFiles.length})
                </button>
              </div>

              {/* Select All Checkbox Button */}
              {totalVisibleSearchCount > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAllSearch}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isAllVisibleSelected
                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  {isAllVisibleSelected ? (
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Square className="w-4 h-4 text-white/70" />
                  )}
                  <span>{isAllVisibleSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</span>
                </button>
              )}

              {/* Batch Add to Smart Session Button */}
              {(selectedSearchWatchlistIds.length > 0 || selectedSearchFileKeys.length > 0) && (
                <motion.button
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  type="button"
                  onClick={handleBatchAddToSession}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs sm:text-sm hover:scale-105 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 fill-black" />
                  <span>إضافة المحدد إلى جلسة ذكية ({selectedSearchWatchlistIds.length + selectedSearchFileKeys.length})</span>
                </motion.button>
              )}
            </div>
          </div>

          {/* Empty Search Results */}
          {searchMatchingWatchlists.length === 0 && searchMatchingFiles.length === 0 && (
            <div className="py-16 text-center glass rounded-[2.5rem] border border-white/10 p-8 space-y-4">
              <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-400/30">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">لا توجد نتائج بحث مطابقة</h3>
              <p className="text-sm text-white/70 max-w-md mx-auto">
                لم نجد أي قائمة تشغيل أو حلقة تطابق "<span className="text-amber-300 font-bold">{searchQuery}</span>"
              </p>
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-6 py-2.5 rounded-2xl bg-amber-400 text-black font-extrabold text-sm hover:scale-105 transition-transform cursor-pointer shadow-lg"
              >
                مسح البحث لعرض كافة القوائم
              </button>
            </div>
          )}

          {/* SECTION 1: MATCHING WATCHLISTS / SERIES */}
          {(searchFilterType === 'all' || searchFilterType === 'watchlists') && searchMatchingWatchlists.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                <Tv className="w-5 h-5" />
                <span>قوائم التشغيل والمسلسلات ({searchMatchingWatchlists.length})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {searchMatchingWatchlists.map(list => {
                  const isSelected = selectedSearchWatchlistIds.includes(list.id);
                  return (
                    <motion.div
                      key={list.id}
                      whileHover={{ scale: 1.02 }}
                      className={`glass-card rounded-2xl p-4 border relative flex flex-col justify-between transition-all ${
                        isSelected ? 'border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-400/10' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleSearchWatchlistSelect(list.id)}
                        className={`absolute top-3 left-3 z-20 p-1.5 rounded-xl transition-all cursor-pointer ${
                          isSelected ? 'bg-amber-400 text-black font-bold scale-110' : 'bg-black/60 text-white/60 hover:text-white hover:bg-black'
                        }`}
                        title={isSelected ? 'إلغاء التحديد' : 'تحديد للجلسة الذكية'}
                      >
                        {isSelected ? <CheckSquare className="w-5 h-5 stroke-[2.5]" /> : <Square className="w-5 h-5" />}
                      </button>

                      {/* Cover & Details */}
                      <div className="cursor-pointer" onClick={() => setSelectedList(list)}>
                        <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-black/40">
                          <img 
                            src={getWatchlistCover(list)} 
                            alt={list.title} 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                          <span className="absolute bottom-2 right-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-black/60 text-amber-300 border border-amber-400/30">
                            {list.section || 'عام'}
                          </span>
                          <span className="absolute bottom-2 left-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white">
                            {list.episodesCount || list.files?.length || 0} حلقة
                          </span>
                        </div>

                        <h4 className="font-bold text-white text-base mb-1 truncate">{list.title}</h4>
                        <p className="text-xs text-white/60 truncate">{list.folderName || 'مجلد مخصص'}</p>
                      </div>

                      {/* Quick Play Button */}
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-white/50">{list.seriesCount || 1} مواسم</span>
                        <button
                          type="button"
                          onClick={() => {
                            const firstFile = list.files?.[0] || list.seasons?.[0]?.files?.[0];
                            if (firstFile) {
                              onPlay(firstFile, firstFile.name || list.title, list.title, list.files || [], 0, undefined, list.id);
                            } else {
                              setSelectedList(list);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>تشغيل</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: MATCHING FILES / EPISODES */}
          {(searchFilterType === 'all' || searchFilterType === 'files') && searchMatchingFiles.length > 0 && (
            <div className="space-y-4 mt-8">
              <h3 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                <Film className="w-5 h-5" />
                <span>الحلقات والملفات الفردية المتطابقة ({searchMatchingFiles.length})</span>
              </h3>

              <div className="space-y-2">
                {searchMatchingFiles.map(item => {
                  const isSelected = selectedSearchFileKeys.includes(item.key);
                  return (
                    <div
                      key={item.key}
                      className={`glass-card rounded-2xl p-3 sm:p-4 border flex items-center justify-between gap-4 transition-all ${
                        isSelected ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleSearchFileSelect(item.key)}
                          className={`p-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                            isSelected ? 'bg-amber-400 text-black font-bold' : 'bg-black/50 text-white/50 hover:text-white'
                          }`}
                        >
                          {isSelected ? <CheckSquare className="w-5 h-5 stroke-[2.5]" /> : <Square className="w-5 h-5" />}
                        </button>

                        {/* Episode Info */}
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-sm sm:text-base truncate">{item.title}</h4>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-white/60">
                            <span className="text-amber-300 font-bold truncate">📺 {item.watchlist.title}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.duration}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <button
                        type="button"
                        onClick={() => onPlay(item.file, item.title, item.watchlist.title, item.filesList, item.epIndex, undefined, item.watchlist.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-black font-extrabold text-xs hover:scale-105 transition-all shrink-0 cursor-pointer shadow-md"
                      >
                        <Play className="w-4 h-4 fill-black" />
                        <span className="hidden sm:inline">تشغيل الآن</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Watchlists & Standalone Files Cards Grid */
        <div className="space-y-6">
          {searchQuery.trim() === '' && (
            <div className="relative z-50 flex items-center justify-between flex-wrap gap-3 bg-zinc-950/80 p-3.5 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white/60 ml-2">تصفية نوع المحتوى:</span>
                <button
                  type="button"
                  onClick={() => setLibraryTypeFilter('all')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
                    libraryTypeFilter === 'all'
                      ? 'bg-amber-400 text-black shadow-lg shadow-amber-500/20 scale-105'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>كافة المحتويات</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20 font-black">{totalModeCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLibraryTypeFilter('playlists')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
                    libraryTypeFilter === 'playlists'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105 border border-indigo-400'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <List className="w-4 h-4 text-indigo-300" />
                  <span>قوائم التشغيل 📺</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30 text-indigo-200 font-black">{totalPlaylistsCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLibraryTypeFilter('singles')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
                    libraryTypeFilter === 'singles'
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-lg shadow-amber-400/30 scale-105 border border-amber-300'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Film className="w-4 h-4 text-amber-950 fill-amber-950" />
                  <span>ملفات فيديو مفردة 🎬</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30 text-amber-950 font-black">{totalSinglesCount}</span>
                </button>
              </div>

              <div className="text-xs text-amber-300/80 font-semibold px-2">
                {libraryTypeFilter === 'singles' && 'تُعرض هنا مقاطع الفيديو المستقلة المميزة عن قوائم التشغيل'}
                {libraryTypeFilter === 'playlists' && 'تُعرض هنا المجلدات وقوائم التشغيل التي تحتوي حلقات متعددة'}
              </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Category Dropdown & Selector (زر الكل في آخر السيكشن على اليسار) */}
            <div className="relative flex items-center shrink-0 z-40">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-md border text-xs sm:text-sm font-extrabold ${
                    isKidsMode
                      ? 'bg-yellow-400 text-black border-yellow-300 shadow-yellow-400/20'
                      : 'bg-zinc-900/90 text-white border-amber-400/30 hover:border-amber-400/70 hover:bg-zinc-800'
                  }`}
                >
                  {(() => {
                    const ActiveIcon = getSectionIcon(activeSection);
                    return <ActiveIcon className="w-4 h-4 text-amber-400 shrink-0" />;
                  })()}
                  <div className="flex items-center gap-1.5">
                    <span>{activeSection}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isKidsMode ? 'bg-black/10 text-black' : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    }`}>
                      {filteredWatchlists.length}
                    </span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu Overlay */}
                <AnimatePresence>
                  {isCategoryDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-30" 
                        onClick={() => setIsCategoryDropdownOpen(false)}
                        onPointerDown={() => setIsCategoryDropdownOpen(false)}
                        onMouseDown={() => setIsCategoryDropdownOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-zinc-950/95 border border-amber-400/40 rounded-2xl shadow-2xl backdrop-blur-xl z-40 overflow-hidden"
                      >
                        <div className="p-2 space-y-1 max-h-80 overflow-y-auto no-scrollbar">
                          {allSections.map((section) => {
                            const isSelected = activeSection === section;
                            const isEditingThis = editingSection === section;
                            const SectionIcon = getSectionIcon(section);
                            const count = watchlists.filter(w => section === 'الكل' || (w.section || w.category || 'عام') === section).length;

                            if (isEditingThis) {
                              return (
                                <form
                                  key={section}
                                  onSubmit={(e) => {
                                    handleSaveRenameSection(e);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center justify-between gap-1.5 p-2 bg-black/90 rounded-xl border border-amber-400 my-0.5"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <SectionIcon className="w-4 h-4 text-amber-400 shrink-0" />
                                    <input
                                      type="text"
                                      value={editingSectionValue}
                                      onChange={(e) => setEditingSectionValue(e.target.value)}
                                      className="bg-transparent text-white px-2 py-0.5 text-xs focus:outline-none w-full font-bold border-b border-amber-400/50"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="submit"
                                      className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 cursor-pointer"
                                      title="حفظ الاسم"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSection(null)}
                                      className="p-1.5 rounded-lg bg-white/10 text-white/70 hover:text-white cursor-pointer"
                                      title="إلغاء"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </form>
                              );
                            }

                            return (
                              <div
                                key={section}
                                className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                                  isSelected
                                    ? 'bg-amber-400 text-black font-extrabold shadow-md'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSection(section);
                                    setIsCategoryDropdownOpen(false);
                                  }}
                                  className="flex items-center gap-2.5 flex-1 min-w-0 text-right cursor-pointer"
                                >
                                  <SectionIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-black' : 'text-amber-400'}`} />
                                  <span className="truncate">{section}</span>
                                </button>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {section !== 'الكل' && (
                                    <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        onClick={(e) => handleStartRenameSection(section, e)}
                                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                          isSelected 
                                            ? 'text-black/70 hover:text-black hover:bg-black/10' 
                                            : 'text-white/60 hover:text-amber-300 hover:bg-white/10'
                                        }`}
                                        title="تعديل اسم التبويب"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingSection(section);
                                        }}
                                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                          isSelected 
                                            ? 'text-black/70 hover:text-red-800 hover:bg-black/10' 
                                            : 'text-white/60 hover:text-red-400 hover:bg-white/10'
                                        }`}
                                        title="حذف التبويب"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}

                                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                                    isSelected ? 'bg-black/20 text-black font-extrabold' : 'bg-white/10 text-white/70'
                                  }`}>
                                    {count}
                                  </span>
                                  {isSelected && <Check className="w-4 h-4 text-black stroke-[3]" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="p-2 bg-black/40 border-t border-white/10">
                          {isAddingHeaderCategory ? (
                            <form 
                              onSubmit={(e) => {
                                handleHeaderAddCategorySubmit(e);
                              }} 
                              className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-amber-400/60"
                            >
                              <input
                                type="text"
                                value={headerCategoryInput}
                                onChange={(e) => setHeaderCategoryInput(e.target.value)}
                                placeholder="اسم التبويب الجديد..."
                                className="bg-transparent text-white px-2.5 py-1 text-xs focus:outline-none w-full font-bold"
                                autoFocus
                              />
                              <button 
                                type="submit" 
                                className="text-xs px-2.5 py-1 rounded-lg bg-amber-400 text-black font-extrabold cursor-pointer shrink-0"
                              >
                                حفظ
                              </button>
                              <button 
                                type="button" 
                                onClick={() => setIsAddingHeaderCategory(false)} 
                                className="text-white/60 hover:text-white p-1 cursor-pointer shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsAddingHeaderCategory(true)}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 transition-all cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              <span>إضافة تبويب جديد</span>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-8 pb-32 md:pb-20">


          {/* Empty Search State */}
          {filteredWatchlists.length === 0 && searchQuery && (
            <div className="col-span-full py-16 text-center glass rounded-[2.5rem] border border-white/10 p-8 space-y-4 my-4">
              <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-400/30">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">لا توجد نتائج بحث مطابقة</h3>
              <p className="text-sm text-white/70 max-w-md mx-auto">
                لم نجد أي قائمة تشغيل أو مسلسل يطابق البحث عن "<span className="text-amber-300 font-bold">{searchQuery}</span>"
              </p>
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-6 py-2.5 rounded-2xl bg-amber-400 text-black font-extrabold text-sm hover:scale-105 transition-transform cursor-pointer shadow-lg"
              >
                مسح البحث لعرض كافة القوائم
              </button>
            </div>
          )}

          {/* Watchlists & Standalone Single Video Cards */}
          {sortedWatchlists.map((list, i) => {
            const isSingle = (list.isSingleFile === true);
            const firstFile = (list.files && list.files[0]) || (list.seasons && list.seasons[0]?.files?.[0]);
            const extName = (firstFile?.name || list.title || '').split('.').pop()?.toUpperCase() || 'MP4';

            if (isSingle) {
              // Compact, Innovative Card Design for Single Video Files
              return (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  key={list.id} 
                  onClick={() => handleCardClick(list)}
                  className="rounded-2xl overflow-hidden group flex flex-col cursor-pointer transition-all min-h-[250px] sm:min-h-[280px] h-full relative bg-gradient-to-b from-amber-950/30 via-zinc-950/90 to-black border border-amber-400/40 hover:border-amber-400 shadow-[0_8px_25px_rgba(245,158,11,0.15)] hover:shadow-[0_15px_35px_rgba(245,158,11,0.3)] hover:scale-[1.02]"
                >
                  <LazyWatchlistCover 
                    watchlist={list} 
                    className="relative h-36 sm:h-40 w-full"
                    onCoverGenerated={(id, cover) => {
                      if (onUpdateWatchlist) {
                        onUpdateWatchlist({ ...list, coverImage: cover });
                      }
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent pointer-events-none" />

                    {/* Edit & Delete Actions */}
                    <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                      <button 
                        onClick={(e) => handleStartEditWatchlist(e, list)}
                        className="p-1.5 glass bg-black/70 text-white/90 hover:text-white rounded-full transition-colors hover:bg-black border border-white/20"
                        title="تعديل"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingWatchlist(list);
                        }}
                        className="p-1.5 glass bg-red-500/40 text-red-200 hover:text-white hover:bg-red-500 rounded-full transition-colors border border-red-500/50"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* File Format & Single Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                      <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black px-2.5 py-1 rounded-full text-[10px] shadow-md border border-amber-300 flex items-center gap-1">
                        <Film className="w-3 h-3 fill-black text-black" />
                        <span>فيديو مفرد</span>
                      </span>
                      <span className="bg-black/70 backdrop-blur-md text-amber-300 font-mono text-[10px] px-2 py-1 rounded-full border border-amber-400/30 font-bold">
                        {extName}
                      </span>
                    </div>

                    {/* Center Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <div className="w-11 h-11 bg-amber-400 text-black rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-black translate-x-[1px]" />
                      </div>
                    </div>
                  </LazyWatchlistCover>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white truncate group-hover:text-amber-300 transition-colors" title={list.title}>
                        {list.title}
                      </h3>
                      <p className="text-[11px] text-white/50 mt-0.5 truncate">
                        {list.section}
                      </p>
                    </div>

                    <div className="mt-3">
                      <div className="w-full bg-white/10 rounded-full h-1.5 mb-2 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${list.progress}%` }} />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-white/60">
                        <span>{list.progress}% مكتمل</span>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const filesList = list.seasons && list.seasons.length > 0 ? list.seasons.flatMap(s => s.files || []) : list.files || [];
                            const startIdx = list.lastWatchedIndex || 0;
                            const targetFile = filesList[startIdx] || filesList[0];
                            const targetTitle = targetFile?.title || targetFile?.name?.replace(/\.[^/.]+$/, "") || list.title;
                            onPlay(targetFile, targetTitle, list.title, filesList, startIdx, undefined, list.id, list.lastWatchedTime || 0);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400 text-amber-300 hover:text-black font-extrabold transition-all cursor-pointer border border-amber-400/30 flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>تشغيل</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                key={list.id} 
                onClick={() => handleCardClick(list)}
                className="rounded-[2rem] overflow-hidden group flex flex-col cursor-pointer transition-all min-h-[380px] sm:min-h-[420px] h-full relative glass-card border border-indigo-500/30 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-400/40"
              >
                <LazyWatchlistCover 
                  watchlist={list} 
                  className="relative h-52 sm:h-60 w-full"
                  onCoverGenerated={(id, cover) => {
                    if (onUpdateWatchlist) {
                      onUpdateWatchlist({ ...list, coverImage: cover });
                    }
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent pointer-events-none" />
                  
                  {/* Top overlay buttons for Edit & Delete */}
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                      onClick={(e) => handleStartEditWatchlist(e, list)}
                      className="p-2 glass bg-black/60 text-white/90 hover:text-white rounded-full transition-colors hover:bg-black/90 shadow-md border border-white/20"
                      title="تعديل قائمة التشغيل"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingWatchlist(list);
                      }}
                      className="p-2 glass bg-red-500/40 text-red-200 hover:text-white hover:bg-red-500 rounded-full transition-colors shadow-md border border-red-500/50"
                      title="حذف قائمة التشغيل"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Card Type Distinction Badge: Single File vs Playlist */}
                  {isSingle ? (
                    <span className="absolute top-4 left-4 bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black px-3.5 py-1.5 rounded-full text-xs shadow-xl border border-amber-300 flex items-center gap-1.5 z-10">
                      <Film className="w-4 h-4 fill-black text-black" />
                      <span>ملف فيديو مفرد 🎬</span>
                    </span>
                  ) : (
                    <span className="absolute top-4 left-4 bg-indigo-600/90 backdrop-blur-md text-white font-extrabold px-3.5 py-1.5 rounded-full text-xs shadow-xl border border-indigo-400/50 flex items-center gap-1.5 z-10">
                      <List className="w-4 h-4 text-indigo-200" />
                      <span>قائمة تشغيل 📺</span>
                    </span>
                  )}

                  <div className="absolute bottom-4 right-4 left-4">
                    <h3 className="text-xl sm:text-2xl font-black text-white shadow-sm truncate">{list.title}</h3>
                    {isSingle ? (
                      <p className="text-amber-300 text-xs font-bold mt-1 flex items-center gap-1.5">
                        <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded text-[10px] font-black">{extName}</span>
                        <span>ملف فيديو مستقل</span>
                      </p>
                    ) : (
                      <p className="text-white/80 text-sm mt-1">
                        {(() => {
                          const seasonsNum = (list.seasons && list.seasons.length > 0) ? list.seasons.length : (list.seriesCount || 1);
                          return `${seasonsNum} ${seasonsNum === 1 ? 'موسم' : 'مواسم'}`;
                        })()} • {list.episodesCount} حلقة
                      </p>
                    )}
                  </div>

                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4 backdrop-blur-sm">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        const filesList = list.seasons && list.seasons.length > 0 
                          ? list.seasons.flatMap(s => s.files || []) 
                          : list.files || [];
                        const startIdx = list.lastWatchedIndex || 0;
                        const targetFile = filesList[startIdx] || filesList[0];
                        const targetTitle = targetFile?.title || targetFile?.name?.replace(/\.[^/.]+$/, "") || list.title;
                        onPlay(targetFile, targetTitle, list.title, filesList, startIdx, undefined, list.id, list.lastWatchedTime || 0); 
                      }} 
                      className="p-4 bg-amber-400 text-black rounded-full hover:scale-110 transition-transform shadow-xl flex items-center gap-2 px-6 font-black"
                      title={isSingle ? 'تشغيل الفيديو' : (list.lastWatchedIndex && list.lastWatchedIndex > 0 ? `متابعة من الحلقة ${list.lastWatchedIndex + 1}` : 'تشغيل القائمة')}
                    >
                      <Play className="w-6 h-6 fill-black" />
                      <span>{isSingle ? 'تشغيل' : (list.lastWatchedIndex && list.lastWatchedIndex > 0 ? 'متابعة' : 'تشغيل')}</span>
                    </button>
                  </div>
                </LazyWatchlistCover>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2 text-sm text-white/60">
                      <span>التصنيف:</span>
                      <span className="text-white font-medium">{list.section}</span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-white/10 rounded-full h-2 mb-2 overflow-hidden">
                      <div className={`h-full rounded-full ${isSingle ? 'bg-amber-400' : (isKidsMode ? 'bg-yellow-400' : 'bg-indigo-400')}`} style={{ width: `${list.progress}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-white/50">
                      <span>{list.progress}% مكتمل</span>
                      <span>{isSingle ? 'فيديو مفرد 🎬' : `المتبقي: ${list.timeRemaining}`}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                    {(() => {
                      const filesList = list.seasons && list.seasons.length > 0 
                        ? list.seasons.flatMap(s => s.files || []) 
                        : list.files || [];
                      const startIdx = list.lastWatchedIndex || 0;
                      const hasProgress = (list.lastWatchedIndex && list.lastWatchedIndex > 0) || (list.lastWatchedTime && list.lastWatchedTime > 0);
                      const targetFile = filesList[startIdx] || filesList[0];
                      const targetTitle = targetFile?.title || targetFile?.name?.replace(/\.[^/.]+$/, "") || list.title;

                      return (
                        <>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (hasProgress) {
                                onPlay(targetFile, targetTitle, list.title, filesList, startIdx, undefined, list.id, list.lastWatchedTime || 0);
                              } else {
                                const firstFile = filesList[0];
                                const firstTitle = firstFile?.title || firstFile?.name?.replace(/\.[^/.]+$/, "") || list.title;
                                onPlay(firstFile, firstTitle, list.title, filesList, 0, undefined, list.id, 0);
                              }
                            }} 
                            className={`flex-1 glass py-2 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                              isSingle
                                ? 'bg-amber-400/20 text-amber-300 hover:bg-amber-400 hover:text-black border border-amber-400/40'
                                : (isKidsMode ? 'bg-yellow-400/20 text-yellow-200 hover:bg-yellow-400 hover:text-black' : 'hover:bg-white hover:text-black')
                            }`}
                          >
                            <Play className="w-4 h-4 fill-current" /> {isSingle ? 'تشغيل' : (hasProgress ? 'متابعة' : 'تشغيل')}
                          </button>

                          {!isSingle && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const firstFile = filesList[0];
                                const firstTitle = firstFile?.title || firstFile?.name?.replace(/\.[^/.]+$/, "") || "الحلقة 1";
                                onPlay(firstFile, firstTitle, list.title, filesList, 0, undefined, list.id, 0);
                              }}
                              className="glass p-2.5 rounded-xl hover:bg-white/20 transition-colors" 
                              title="بدء من البداية"
                            >
                              <RotateCcw className="w-5 h-5 text-white/80" />
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            );
          })}
          </div>
        </div>
      )}

      <WatchlistDetailsView 
        watchlist={selectedList} 
        onClose={() => setSelectedList(null)} 
        onPlay={onPlay} 
        onUpdateWatchlist={onUpdateWatchlist}
        onDeleteWatchlist={onDeleteWatchlist}
        schedules={schedules}
        onUpdateSchedules={onUpdateSchedules}
        watchlists={watchlists}
      />

      <ConfirmModal 
        isOpen={deletingWatchlist !== null}
        onCancel={() => setDeletingWatchlist(null)}
        onConfirm={handleConfirmDeleteWatchlist}
        title="حذف قائمة التشغيل"
        message={`هل أنت تأكد من رغبتك في حذف قائمة "${deletingWatchlist?.title || ''}"؟ لن يتم حذف الملفات الأصلية من جهازك.`}
      />

      <ConfirmModal 
        isOpen={deletingSection !== null}
        onCancel={() => setDeletingSection(null)}
        onConfirm={() => {
          if (deletingSection) {
            handleDeleteSection(deletingSection);
            setDeletingSection(null);
          }
        }}
        title="حذف التصنيف / التبويب"
        message={`هل أنت تأكد من رغبتك في حذف تبويب "${deletingSection || ''}"؟ لن يتم حذف القوائم التي بداخله.`}
      />

      {/* Modal for Editing Watchlist */}
      <AnimatePresence>
        {editingWatchlist && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md" onClick={() => setEditingWatchlist(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-xl rounded-[2.5rem] p-8 relative space-y-6 shadow-2xl border border-white/20 text-right"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Pencil className="w-6 h-6 text-amber-400" /> تعديل قائمة التشغيل
                </h3>
                <button onClick={() => setEditingWatchlist(null)} className="p-2 glass rounded-full hover:bg-white/20">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-white/80 mb-1.5 block">عنوان قائمة التشغيل</label>
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white text-base"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-white/80 mb-1.5 block">التصنيف / القسم</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {Array.from(new Set([
                      ...(MODE_SECTIONS[editTargetMode] || MODE_SECTIONS.family).filter(s => s !== 'الكل'),
                      ...(allCustomCategories?.[editTargetMode] || [])
                    ])).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setEditSection(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          editSection === cat ? 'bg-white text-black shadow-md' : 'glass text-white/70 hover:bg-white/20'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <input 
                    type="text" 
                    value={editSection}
                    onChange={(e) => setEditSection(e.target.value)}
                    placeholder="أو اكتب تصنيفاً مخصصاً..."
                    className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-white/80 mb-1.5 block">المكتبة (الوضع المستهدف)</label>
                  <div className="relative">
                    <select
                      value={editTargetMode}
                      onChange={(e) => setEditTargetMode(e.target.value as Mode)}
                      className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white appearance-none cursor-pointer"
                    >
                      {Object.entries(customModes || {}).map(([modeKey, config]) => (
                        <option key={modeKey} value={modeKey} className="bg-zinc-900 text-white">
                          {(config as any).title}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-white/80 mb-1.5 block">مجلد القائمة في الهارد</label>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => editWatchlistFileInputRef.current?.click()}
                      className="bg-amber-400 text-black px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:scale-105 transition-transform cursor-pointer shrink-0 shadow-md"
                    >
                      <FolderPlus className="w-4 h-4" /> إعادة تحديد المجلد
                    </button>
                    <span className="text-xs font-mono text-white/80 truncate bg-black/50 px-4 py-2.5 rounded-xl flex-1 border border-white/10">
                      📁 {editWatchlistFolderName || editingWatchlist.folderName || editingWatchlist.folderPath || 'لم يتم تغيير المجلد'}
                    </span>
                    <input 
                      type="file" 
                      ref={(node) => {
                        (editWatchlistFileInputRef as any).current = node;
                        if (node) {
                          node.setAttribute('webkitdirectory', '');
                          node.setAttribute('directory', '');
                        }
                      }}
                      onChange={handleEditFolderReselect}
                      className="hidden" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button onClick={() => setEditingWatchlist(null)} className="glass px-5 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white cursor-pointer">
                  إلغاء
                </button>
                <button onClick={handleSaveEditWatchlist} className="bg-white text-black px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:scale-105 transition-transform cursor-pointer shadow-lg">
                  <Save className="w-4 h-4" /> حفظ التعديلات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Creating Watchlist directly in current tab */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md"
            onClick={() => setIsCreateModalOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8 relative flex flex-col gap-6"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h2 className="text-3xl font-bold">
                  {isKidsMode ? 'إضافة قائمة كرتون جديدة 🎈' : 'إضافة قائمة تشغيل جديدة'}
                </h2>
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 glass rounded-full hover:bg-white/20"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Title input */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">اسم القائمة / المسلسل</label>
                <input 
                  type="text" 
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="مثال: صراع العروش أو سبونج بوب..." 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 text-lg" 
                />
              </div>

              {/* Category selector */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-white/70">التصنيف / التبويب</label>
                  {!showAddCategoryInput && (
                    <button 
                      type="button"
                      onClick={() => setShowAddCategoryInput(true)}
                      className="text-xs bg-white/10 hover:bg-white hover:text-black px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة تصنيف جديد
                    </button>
                  )}
                </div>

                {showAddCategoryInput && (
                  <form onSubmit={handleAddNewCategorySubmit} className="flex gap-2 mb-3">
                    <input 
                      type="text" 
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      placeholder="اسم التصنيف الجديد..."
                      className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                      autoFocus
                    />
                    <button 
                      type="submit"
                      className="bg-white text-black px-4 py-2 rounded-xl text-sm font-bold hover:scale-105"
                    >
                      حفظ
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowAddCategoryInput(false)}
                      className="glass p-2 rounded-xl"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                )}

                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto no-scrollbar">
                  {categoriesList.map((tag) => (
                    <button 
                      key={tag}
                      type="button"
                      onClick={() => setSelectedCategory(tag)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                        selectedCategory === tag 
                          ? (isKidsMode ? 'bg-yellow-400 text-black shadow-md scale-105' : 'bg-white text-black shadow-md') 
                          : 'glass text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Folder Selector / Drag & Drop */}
              <div 
                onClick={(e) => !importedFolder ? handleAddFolderClick(e) : undefined}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={`glass-card rounded-[2rem] border-2 border-dashed ${
                  importedFolder ? 'border-green-500/50 bg-green-500/5 p-4 sm:p-6' : 'border-white/20 hover:border-white/50 cursor-pointer p-8'
                } text-center flex flex-col items-center justify-center transition-all`}
              >
                {importedFolder ? (
                  <div className="w-full text-right space-y-4">
                    <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 p-3.5 sm:p-4 rounded-2xl w-full">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-8 h-8 text-green-400 shrink-0" />
                        <div>
                          <h4 className="text-base sm:text-lg font-bold text-green-400">تم اختيار المجلد وهيكل المحتوى بنجاح</h4>
                          <p className="text-white/80 font-mono text-xs dir-ltr">{importedFolder}</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setImportedFolder(null); setDetectedSeasons([]); setImportedFiles([]); setParsedWatchlists([]); }}
                        className="glass px-3 py-1.5 rounded-xl text-xs hover:bg-white/20 text-white font-bold transition-all cursor-pointer shrink-0"
                      >
                        تغيير المجلد
                      </button>
                    </div>

                    {/* Interactive Folder Tree Preview */}
                    <FolderTreePreview 
                      rootFolderName={importedFolder} 
                      watchlists={parsedWatchlists} 
                      onUpdateWatchlists={setParsedWatchlists}
                    />
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-14 h-14 text-white/80 mb-3" />
                    <h4 className="text-xl sm:text-2xl font-extrabold mb-5">اختر المجلد الفرعي (قائمة التشغيل)</h4>
                    <button 
                      type="button"
                      onClick={(e) => handleAddFolderClick(e)}
                      className={`glass px-8 py-3.5 rounded-2xl text-base sm:text-lg font-black flex items-center gap-3 shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                        isKidsMode ? 'bg-yellow-400 text-black hover:bg-yellow-300' : 'bg-white/10 hover:bg-white hover:text-black border border-white/20'
                      }`}
                    >
                      <FolderPlus className="w-6 h-6" /> <span>اختيار مجلد</span>
                    </button>
                  </>
                )}

                <input 
                  type="file" 
                  ref={(node) => {
                    fileInputRef.current = node;
                    if (node) {
                      node.setAttribute('webkitdirectory', '');
                      node.setAttribute('directory', '');
                    }
                  }}
                  onChange={handleFallbackChange}
                  className="hidden" 
                  multiple
                />

                <input 
                  type="file" 
                  ref={singleFileInputRef}
                  onChange={handleSingleFilesChange}
                  className="hidden" 
                  multiple
                  accept="video/*,audio/*,.mkv,.mp4,.avi,.mov,.webm,.ts,.m4v,.flv,.wmv,.3gp,.mp3,.m4a,.aac,.wav,.flac,.ogg"
                />
              </div>

              {/* Info Notice Box Below Folder Selection Card */}
              {!importedFolder && (
                <div className="mt-3.5 bg-white/5 border border-white/10 rounded-2xl p-4 text-center w-full shadow-lg backdrop-blur-xl">
                  <p className="text-xs sm:text-sm text-white/90 font-bold leading-relaxed">
                    المجلد الفرعي هو مجلد خاص بمسلسل أو برنامج واحد (مثل مجلد "Breaking Bad").
                  </p>
                  <p className="text-[11px] sm:text-xs text-white/60 leading-relaxed mt-1">
                    سيتم سحب الحلقات والمواسم بداخله وربطها في قائمة تشغيل واحدة.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-white/10">
                {isProcessing && (
                  <div className="bg-white/10 border border-amber-400/40 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden relative">
                      <div className="bg-amber-400 h-full animate-pulse w-full" />
                    </div>
                    <span className="text-xs text-amber-300 font-extrabold shrink-0">جاري معالجة وحفظ القائمة...</span>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isProcessing}
                    className="glass px-6 py-3 rounded-xl font-semibold hover:bg-white/20 disabled:opacity-40"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveWatchlist}
                    disabled={isProcessing || !importedFolder || parsedWatchlists.length === 0}
                    className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                      isProcessing || !importedFolder || parsedWatchlists.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'
                    } ${
                      isKidsMode ? 'bg-yellow-400 text-black' : 'bg-white text-black'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>جاري حفظ القائمة...</span>
                      </>
                    ) : (
                      <span>حفظ القائمة</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: BATCH ADD SEARCH RESULTS TO SMART SESSION */}
      <AnimatePresence>
        {isBatchAddToSessionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-lg rounded-3xl p-6 border border-amber-400/40 shadow-2xl relative overflow-hidden text-right"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-amber-400/20 text-amber-300 rounded-2xl border border-amber-400/30">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">إضافة إلى جلسة ذكية</h3>
                    <p className="text-xs text-white/60">
                      تم تحديد {selectedSearchWatchlistIds.length} مسلسل/قائمة و {selectedSearchFileKeys.length} حلقة/ملف
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBatchAddToSessionModalOpen(false)}
                  className="p-2 text-white/50 hover:text-white rounded-full hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Target Session Option */}
                <div>
                  <label className="block text-xs font-bold text-white/80 mb-2">اختر الجلسة الذكية المستهدفة:</label>
                  <select
                    value={targetSessionId}
                    onChange={(e) => setTargetSessionId(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400 font-bold"
                  >
                    <option value="new">➕ إنشاء جلسة ذكية جديدة...</option>
                    {(sessions || []).map(sess => (
                      <option key={sess.id} value={sess.id}>
                        ⚡ {sess.title} ({sess.items?.length || 0} عنصر)
                      </option>
                    ))}
                  </select>
                </div>

                {/* If creating new session, show title input */}
                {targetSessionId === 'new' && (
                  <div>
                    <label className="block text-xs font-bold text-white/80 mb-2">اسم الجلسة الذكية الجديدة:</label>
                    <input
                      type="text"
                      value={newSessionTitle}
                      onChange={(e) => setNewSessionTitle(e.target.value)}
                      placeholder="مثال: جلسة مسلسلات السهرة..."
                      className="w-full bg-black/60 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400 font-bold"
                    />
                  </div>
                )}

                <div className="bg-white/5 rounded-2xl p-3 border border-white/10 text-xs text-white/70 space-y-1">
                  <p className="font-bold text-amber-300">💡 ما الذي سيحدث؟</p>
                  <p>سيتم دمج وتسلسل هذه العناصر داخل الجلسة الذكية ليتم دمجها وتشغيلها بتناوب تلقائي وذكي!</p>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleConfirmBatchAddToSession}
                  className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-2xl text-sm transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>تأكيد الإضافة والجداول</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchAddToSessionModalOpen(false)}
                  className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-sm transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: SMART MODE SELECTOR BENTO GRID */}
      <AnimatePresence>
        {isModeSelectorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card w-full max-w-4xl rounded-3xl p-6 sm:p-8 border border-amber-400/40 shadow-2xl relative bg-zinc-950/95 space-y-6 my-auto text-right"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-400/20 border border-amber-400/40 rounded-2xl text-amber-300">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white">تغيير وضع المكتبة الذكي ⚡</h2>
                    <p className="text-xs sm:text-sm text-white/60 mt-0.5">
                      اختر الوضع المناسب لتصفح قوائم المسلسلات، الكرتون، الأفلام، أو القرآن بخصائصها وتصنيفاتها المخصصة
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModeSelectorModalOpen(false)}
                  className="p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modes Bento Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto no-scrollbar p-1">
                {orderedModes.map((mKey) => {
                  const isCurrent = currentMode === mKey;
                  const mInfo = MODE_DETAILS[mKey];
                  const MIcon = mInfo.icon;
                  const count = watchlists.filter(w => (w.targetMode || 'family') === mKey).length;

                  return (
                    <motion.div
                      key={mKey}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => {
                        if (onSwitchMode) onSwitchMode(mKey);
                        setActiveSection('الكل');
                        setIsModeSelectorModalOpen(false);
                      }}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between bg-gradient-to-br ${mInfo.bgGradient} ${
                        isCurrent 
                          ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/10' 
                          : 'border-white/15 hover:border-amber-400/60 hover:shadow-lg'
                      }`}
                    >
                      {/* Active Badge */}
                      {isCurrent && (
                        <div className="absolute top-3 left-3 bg-amber-400 text-black text-[10px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>الوضع النشط</span>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-3 rounded-2xl border ${mInfo.badgeColor}`}>
                            <MIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-white text-base sm:text-lg">{mInfo.name}</h3>
                            <span className="text-[11px] text-amber-300/90 font-bold">
                              {count} قوائم مجهزة
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed mb-4">
                          {mInfo.desc}
                        </p>
                      </div>

                      <button
                        type="button"
                        className={`w-full py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          isCurrent
                            ? 'bg-amber-400 text-black shadow-lg'
                            : 'bg-white/10 hover:bg-amber-400 hover:text-black text-white border border-white/20'
                        }`}
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>{isCurrent ? 'الوضع الحالي مفعل' : 'تفعيل هذا الوضع ⚡'}</span>
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-white/10 text-center">
                <button
                  type="button"
                  onClick={() => setIsModeSelectorModalOpen(false)}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SCAN RESULTS MODAL FOR NEW FILES */}
      <AnimatePresence>
        {isScanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl" onClick={() => setIsScanModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-3xl rounded-[2.5rem] p-6 sm:p-8 relative space-y-6 shadow-2xl border border-emerald-400/40 text-right max-h-[85vh] flex flex-col justify-between overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <FolderSearch className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                      تم العثور على ملفات وسائط جديدة 🚀
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-300 font-bold mt-0.5">
                      وضع المكتبة: ({MODE_DETAILS[currentMode]?.name}) • تم اكتشاف تحديثات في {scannedNewFilesResults.length} قائمة تشغيل
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsScanModalOpen(false)} 
                  className="p-2.5 glass rounded-full hover:bg-white/20 text-white/70 hover:text-white cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* List of Playlists with New Files */}
              <div className="space-y-4 overflow-y-auto no-scrollbar flex-1 pr-1 pl-1">
                {scannedNewFilesResults.map((item) => {
                  const { watchlist, newFiles } = item;
                  return (
                    <div 
                      key={watchlist.id}
                      className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-emerald-400/30 hover:border-emerald-400/60 transition-all space-y-3 shadow-lg"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base sm:text-lg font-extrabold text-white">{watchlist.title}</h4>
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                              {watchlist.section}
                            </span>
                          </div>
                          <p className="text-xs text-white/60 mt-0.5">
                            مسار المجلد: <span className="text-amber-200 font-mono">{watchlist.folderPath || watchlist.folderName || 'مجلد محلي'}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-3 py-1 rounded-full text-xs font-black shrink-0">
                          <Plus className="w-3.5 h-3.5" />
                          <span>{newFiles.length} ملفات جديدة</span>
                        </div>
                      </div>

                      {/* File names preview */}
                      <div className="bg-black/50 p-3 rounded-xl border border-white/5 space-y-1">
                        <span className="text-[11px] font-bold text-white/50 block mb-1">عينة من الملفات المكتشفة:</span>
                        {newFiles.slice(0, 3).map((f: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-white/80 font-medium truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="truncate">{f.name || f.title || `ملف جديد ${idx + 1}`}</span>
                          </div>
                        ))}
                        {newFiles.length > 3 && (
                          <p className="text-[11px] text-emerald-300/80 font-bold pt-1">
                            + {newFiles.length - 3} ملفات إضافية أخرى...
                          </p>
                        )}
                      </div>

                      {/* Action Buttons for this playlist */}
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSyncSingleWatchlistNewFiles(item)}
                          className="flex-1 py-2.5 px-4 bg-emerald-400 hover:bg-emerald-300 text-black font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                          <span>مزامنة وإضافة الملفات للقائمة 🔄</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCancelSingleWatchlistNewFiles(watchlist.id)}
                          className="py-2.5 px-4 bg-white/10 hover:bg-red-500/30 text-white/80 hover:text-red-200 border border-white/20 hover:border-red-400/50 font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          title="تجاهل التحديث لهذه القائمة"
                        >
                          <X className="w-4 h-4" />
                          <span>إلغاء / تجاهل</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-white/10 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsScanModalOpen(false)}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LibraryView;


