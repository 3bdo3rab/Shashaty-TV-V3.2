import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FolderTree, Monitor, HardDrive, Moon, Clock, Palette, X, Plus, RefreshCw, Trash2, Check, Folder, Play, CheckCircle2, Pencil, Save, RotateCcw, FolderPlus, DownloadCloud, UploadCloud, Image as ImageIcon, Sliders, Link as LinkIcon, Upload, Layers, Cpu, Maximize2, Minimize2, Copy, ShieldCheck, Activity, Sparkles, Wrench, Zap, Search, Edit2, AlertCircle, Sun, ChevronRight, LogOut, Video, LayoutList, Star, Settings2, FolderOpen, Tv } from 'lucide-react';
import { Mode, ModeConfig, Watchlist, Channel } from '../types';
import { MODE_SECTIONS } from '../data';
import { isTauri, minimizeWindow, toggleMaximizeWindow, closeWindow, setFullscreen } from '../utils/tauri';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { MODES, MODE_BACKGROUND_PRESETS } from '../data';
import { ConfirmModal } from '../components/ConfirmModal';
import { store } from '../utils/store';
import { isCrossOriginIframe } from '../utils/fileSystem';
import { useDialog } from '../contexts/DialogContext';
import { ProcessingRing } from '../components/ProcessingRing';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { KeyboardShortcutsModal } from '../components/KeyboardShortcutsModal';
import { Keyboard } from 'lucide-react';

interface SettingsViewProps {
  currentMode?: Mode;
  setCurrentMode?: (mode: Mode) => void;
  customModes?: Record<Mode, ModeConfig>;
  onUpdateModes?: (updated: Record<Mode, ModeConfig>) => void;
  onStartInspection?: () => void;
  qaInspectionEnabled?: boolean;
  setQaInspectionEnabled?: (enabled: boolean) => void;
}

interface LocalFolder {
  id: string;
  name: string;
  path: string;
  filesCount: number;
  lastScanned: string;
}

const THEME_GRADIENT_PRESETS = [
  { name: 'غروب الشفق', gradient: 'from-orange-500 via-rose-500 to-purple-600', color: 'text-orange-100' },
  { name: 'أطفال زاهي', gradient: 'from-sky-400 via-fuchsia-400 to-amber-300', color: 'text-fuchsia-100' },
  { name: 'ليل هادئ', gradient: 'from-slate-900 via-indigo-950 to-blue-950', color: 'text-indigo-100' },
  { name: 'سينما فاخرة', gradient: 'from-zinc-950 via-black to-zinc-900', color: 'text-zinc-300' },
  { name: 'زمرد وواحة', gradient: 'from-emerald-800 via-teal-900 to-cyan-900', color: 'text-teal-100' },
  { name: 'حيوية وموسيقى', gradient: 'from-violet-600 via-fuchsia-700 to-orange-600', color: 'text-violet-100' },
  { name: 'ذهبي كلاسيك', gradient: 'from-amber-600 via-yellow-600 to-orange-700', color: 'text-amber-100' },
  { name: 'ياقوت ملكي', gradient: 'from-rose-900 via-red-950 to-stone-950', color: 'text-rose-100' },
  { name: 'محيط عميق', gradient: 'from-cyan-900 via-blue-950 to-indigo-950', color: 'text-cyan-100' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  currentMode = 'family', 
  setCurrentMode,
  customModes,
  onUpdateModes,
  onStartInspection,
  qaInspectionEnabled = false,
  setQaInspectionEnabled
}) => {
  const { showAlert, showConfirm } = useDialog();
  const [activeModal, setActiveModal] = useState<'folders' | 'modes' | 'autoplay' | 'backup' | 'tauri' | 'qa' | 'shortcuts' | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);


  // Always on Top & Windows Startup State
  const [alwaysOnTop, setAlwaysOnTopState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('app_always_on_top') === 'true';
    } catch {
      return false;
    }
  });

  const [autostartWindows, setAutostartWindowsState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('app_autostart_windows') === 'true';
    } catch {
      return false;
    }
  });

  const [liteMode, setLiteModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('app_lite_mode_enabled') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (liteMode) {
      document.documentElement.classList.add('lite-mode');
    } else {
      document.documentElement.classList.remove('lite-mode');
    }
  }, [liteMode]);

  const handleToggleAlwaysOnTop = async (enabled: boolean) => {
    setAlwaysOnTopState(enabled);
    try {
      localStorage.setItem('app_always_on_top', String(enabled));
      if (isTauri()) {
        await getCurrentWindow().setAlwaysOnTop(enabled);
      }
    } catch (err) {
      console.error('Failed to set always on top:', err);
    }
  };

  const handleToggleAutostartWindows = async (enabled: boolean) => {
    setAutostartWindowsState(enabled);
    try {
      localStorage.setItem('app_autostart_windows', String(enabled));
      if (isTauri()) {
        if (enabled) {
          await enable();
        } else {
          await disable();
        }
      }
    } catch (err) {
      console.error('Failed to set autostart:', err);
    }
  };

  const handleToggleLiteMode = (enabled: boolean) => {
    setLiteModeState(enabled);
    try {
      localStorage.setItem('app_lite_mode_enabled', String(enabled));
    } catch (err) {
      console.error('Failed to save lite mode state:', err);
    }
  };

  // Mode Editing State
  const modesMap = customModes || MODES;
  const [editingModeKey, setEditingModeKey] = useState<Mode | null>(null);
  const [isAddingNewMode, setIsAddingNewMode] = useState(false);
  const [editModeTitle, setEditModeTitle] = useState('');
  const [editModeGradient, setEditModeGradient] = useState('');
  const [editModeBgImage, setEditModeBgImage] = useState('');
  const [editModeBgOpacity, setEditModeBgOpacity] = useState(50);
  const modeBgInputRef = useRef<HTMLInputElement>(null);

  const handlePickLocalBgImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setEditModeBgImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Autoplay State
  const [autoNext, setAutoNext] = useState(() => {
    const saved = localStorage.getItem('app_auto_next');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [autoSkipIntro, setAutoSkipIntro] = useState(() => {
    const saved = localStorage.getItem('app_auto_skip_intro');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [resumePlayback, setResumePlayback] = useState(() => {
    const saved = localStorage.getItem('app_resume_playback');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [breakDuration, setBreakDuration] = useState(() => {
    return localStorage.getItem('app_break_duration') || '30 ثانية';
  });
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    return localStorage.getItem('app_playback_speed') || '1.0x';
  });
  
  const [backgroundPlayback, setBackgroundPlayback] = useState(() => {
    const saved = localStorage.getItem('app_background_playback');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => { localStorage.setItem('app_auto_next', JSON.stringify(autoNext)); }, [autoNext]);
  useEffect(() => { localStorage.setItem('app_background_playback', JSON.stringify(backgroundPlayback)); }, [backgroundPlayback]);
  useEffect(() => { localStorage.setItem('app_auto_skip_intro', JSON.stringify(autoSkipIntro)); }, [autoSkipIntro]);
  useEffect(() => { localStorage.setItem('app_resume_playback', JSON.stringify(resumePlayback)); }, [resumePlayback]);
  useEffect(() => { localStorage.setItem('app_break_duration', breakDuration); }, [breakDuration]);
  useEffect(() => { localStorage.setItem('app_playback_speed', playbackSpeed); }, [playbackSpeed]);
  
  const [showTransitionBumper, setShowTransitionBumper] = useState(() => {
    try {
      const saved = localStorage.getItem('app_show_transition_bumper');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('app_show_transition_bumper', JSON.stringify(showTransitionBumper));
    } catch (err) {
      console.error('Failed to save show_transition_bumper:', err);
    }
  }, [showTransitionBumper]);

  const handleExportData = async () => {
    try {
      const data = await store.exportData();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `app-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      await showAlert('حدث خطأ أثناء تصدير البيانات.');
      console.error(err);
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        await store.importData(data);
        await showAlert('تم استعادة البيانات بنجاح! سيتم إعادة تحميل التطبيق لتطبيق التغييرات.');
        window.location.reload();
      } catch (err) {
        await showAlert('حدث خطأ أثناء استيراد البيانات. يرجى التأكد من أن الملف صالح.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = async () => {
    const confirm1 = await showConfirm('تحذير: هل أنت متأكد من رغبتك في مسح كافة قوائم التشغيل؟ هذا الإجراء لا يمكن التراجع عنه!');
    if (!confirm1) return;
    
    const confirm2 = await showConfirm('هل أنت متأكد تماماً؟ سيتم حذف جميع القوائم بشكل نهائي.');
    if (!confirm2) return;

    try {
      await store.setWatchlists([]);
      await showAlert('تم مسح جميع قوائم التشغيل بنجاح. سيتم إعادة تحميل التطبيق.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      await showAlert('حدث خطأ أثناء مسح البيانات.');
    }
  };

  // Sleep Timer State
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Countdown effect
  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setSleepTimerMinutes(null);
          setTimeout(() => {
            showAlert('انتهى مؤقت النوم! تم إيقاف التشغيل تلقائياً.');
          }, 0);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds, showAlert]);

  const handleStartSleepTimer = (mins: number) => {
    setSleepTimerMinutes(mins);
    setRemainingSeconds(mins * 60);
    setActiveModal(null);
  };

  const handleCancelSleepTimer = () => {
    setSleepTimerMinutes(null);
    setRemainingSeconds(null);
  };





  // Mode Editing & Creation Handlers
  const handleStartCreateMode = () => {
    setIsAddingNewMode(true);
    setEditingModeKey(null);
    setEditModeTitle('');
    setEditModeGradient('from-orange-500 via-rose-500 to-purple-600');
    setEditModeBgImage('');
    setEditModeBgOpacity(50);
  };

  const handleStartEditMode = (modeKey: Mode) => {
    const modeObj = modesMap[modeKey] || MODES[modeKey as keyof typeof MODES];
    setIsAddingNewMode(false);
    setEditingModeKey(modeKey);
    setEditModeTitle(modeObj?.title || '');
    setEditModeGradient(modeObj?.gradient || 'from-orange-500 via-rose-500 to-purple-600');
    setEditModeBgImage(modeObj?.bgImage || '');
    setEditModeBgOpacity(modeObj?.bgOpacity !== undefined ? modeObj.bgOpacity : 50);
  };

  const handleSaveNewMode = async () => {
    if (!editModeTitle.trim()) {
      await showAlert('يرجى إدخال عنوان وضع التشغيل الجديد.');
      return;
    }

    const newKey: Mode = `custom_mode_${Date.now()}`;
    const updated: Record<Mode, ModeConfig> = {
      ...modesMap,
      [newKey]: {
        title: editModeTitle.trim(),
        gradient: editModeGradient || 'from-orange-500 via-rose-500 to-purple-600',
        themeColor: 'text-white',
        bgImage: editModeBgImage,
        bgOpacity: editModeBgOpacity
      }
    };

    if (onUpdateModes) {
      onUpdateModes(updated);
    }
    setIsAddingNewMode(false);
    await showAlert(`تمت إضافة وضع التشغيل الجديد "${editModeTitle.trim()}" بنجاح!`);
  };

  const handleDeleteCustomMode = async (modeKey: Mode) => {
    const modeTitle = modesMap[modeKey]?.title || modeKey;
    const confirm = await showConfirm(`هل أنت متأكد من رغبتك في حذف وضع التشغيل "${modeTitle}"؟`);
    if (!confirm) return;

    const updated = { ...modesMap };
    delete updated[modeKey];

    if (onUpdateModes) {
      onUpdateModes(updated);
    }
    if (currentMode === modeKey && setCurrentMode) {
      setCurrentMode('family');
    }
    await showAlert(`تم حذف الوضع "${modeTitle}" بنجاح.`);
  };

  const handleSaveModeEdit = async () => {
    if (!editingModeKey || !editModeTitle.trim()) {
      await showAlert('يرجى إدخال عنوان وضع التشغيل.');
      return;
    }

    const currentObj = modesMap[editingModeKey] || MODES[editingModeKey as keyof typeof MODES];
    const updated: Record<Mode, ModeConfig> = {
      ...modesMap,
      [editingModeKey]: {
        ...currentObj,
        title: editModeTitle.trim(),
        gradient: editModeGradient || currentObj.gradient,
        bgImage: editModeBgImage,
        bgOpacity: editModeBgOpacity
      }
    };

    if (onUpdateModes) {
      onUpdateModes(updated);
    }
    setEditingModeKey(null);
  };

  const handleResetModesDefault = () => {
    if (onUpdateModes) {
      onUpdateModes(MODES);
    }
    setEditingModeKey(null);
    setIsAddingNewMode(false);
  };

  const formatRemainingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const sections = [
    { id: 'tauri', title: 'إعدادات سطح المكتب (Tauri)', icon: Cpu, desc: 'التحكم بالشباك وشريط العنوان واستجابة نظام Tauri Desktop' },
    { id: 'modes', title: 'أوضاع التشغيل وخلفياتها', icon: Palette, desc: 'تخصيص ألوان وخلفيات الأوضاع المختلفة' },
    { id: 'shortcuts', title: 'اختصارات الكيبورد', icon: Keyboard, desc: 'تخصيص أزرار التحكم بالتطبيق لتناسب تفضيلاتك' },
        { id: 'autoplay', title: 'إعدادات التشغيل التلقائي', icon: Monitor, desc: 'التحكم بالانتقال للحلقة التالية والاستراحات الافتراضية' },
    { id: 'backup', title: 'النسخ الاحتياطي والاستعادة', icon: DownloadCloud, desc: 'تصدير واستيراد بيانات التطبيق' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 sm:p-8 lg:p-12 h-full relative w-full pb-24"
    >

      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight drop-shadow-md mb-2 sm:mb-4">الإعدادات</h1>
          <p className="text-lg sm:text-xl text-white/70">تخصيص تجربة الترفيه المنزلي الخاصة بك</p>
        </div>
      </header>

      {/* Main Settings Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {sections.map((sec) => (
          <motion.button 
            key={sec.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setActiveModal(sec.id as any)}
            className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] text-right flex items-start gap-4 sm:gap-6 hover:bg-white/10 transition-all group cursor-pointer hover:scale-[1.02]"
          >
            <div className="p-4 glass rounded-2xl group-hover:bg-white group-hover:text-black transition-colors shadow-lg shrink-0">
              <sec.icon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-2">{sec.title}</h3>
              <p className="text-white/60 line-clamp-2">{sec.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* MODALS FOR EACH SETTING CARD */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-2xl rounded-[2.5rem] p-8 relative max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl border border-white/20"
            >
              {/* Close Button - positioned cleanly on top-left with z-30 */}
              <button 
                onClick={() => setActiveModal(null)} 
                className="absolute top-6 left-6 p-3 glass rounded-full hover:bg-white hover:text-black transition-colors z-30 cursor-pointer"
                title="إغلاق النافذة"
              >
                <X className="w-6 h-6" />
              </button>

              {/* MODES & THEMES MODAL */}
              {activeModal === 'modes' && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pl-14">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-white/10 rounded-2xl shrink-0">
                        <Palette className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold">أوضاع التشغيل والثيمات</h2>
                        <p className="text-white/60 text-sm mt-1">إضافة أوضاع جديدة وتخصيص الألوان والخلفيات</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button 
                        onClick={handleStartCreateMode}
                        className="bg-amber-400 text-black px-4 py-2.5 rounded-xl text-xs font-extrabold hover:bg-amber-300 transition-colors flex items-center gap-2 cursor-pointer shrink-0 shadow-md"
                        title="إضافة وضع تشغيل جديد"
                      >
                        <Plus className="w-4 h-4" /> 
                        <span>إضافة وضع جديد</span>
                      </button>
                      <button 
                        onClick={handleResetModesDefault}
                        className="glass px-4 py-2.5 rounded-xl text-xs font-bold text-white/80 hover:text-white hover:bg-white/20 transition-colors flex items-center gap-2 cursor-pointer shrink-0 border border-white/20 shadow-md"
                        title="استعادة الأوضاع الافتراضية"
                      >
                        <RotateCcw className="w-4 h-4 text-amber-300" /> 
                        <span>استعادة الافتراضي</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode Creator Sub-View */}
                  {isAddingNewMode ? (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-6 glass rounded-2xl border border-white/20 space-y-6">
                      <div className="flex justify-between items-center pb-4 border-b border-white/10">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-amber-300">
                          <Plus className="w-5 h-5" /> إضافة وضع تشغيل جديد
                        </h3>
                        <button onClick={() => setIsAddingNewMode(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white cursor-pointer">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="text-sm font-semibold text-white/80 mb-1.5 block">تسمية وضع التشغيل الجديد *</label>
                          <input 
                            type="text" 
                            value={editModeTitle} 
                            onChange={(e) => setEditModeTitle(e.target.value)}
                            placeholder="مثال: وضع الأنمي، سهرة الخميس، رياضة..."
                            className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-white/80 mb-2 block">اختيار ثيم التدرج اللوني (Theme Gradient)</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-h-48 overflow-y-auto no-scrollbar p-1">
                            {THEME_GRADIENT_PRESETS.map((preset) => {
                              const isSelected = editModeGradient === preset.gradient;
                              return (
                                <button
                                  key={preset.name}
                                  type="button"
                                  onClick={() => setEditModeGradient(preset.gradient)}
                                  className={`p-3 rounded-xl border text-right flex items-center gap-3 transition-all cursor-pointer ${
                                    isSelected 
                                      ? 'border-white ring-2 ring-white bg-white/20 shadow-lg' 
                                      : 'border-white/10 glass hover:bg-white/10'
                                  }`}
                                >
                                  <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${preset.gradient} shrink-0 shadow-md`} />
                                  <span className="text-xs font-bold text-white truncate">{preset.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Custom Background Image Section */}
                        <div className="space-y-3 pt-3 border-t border-white/10">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-white/90 flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-sky-400" /> صورة خلفية مخصصة (اختياري)
                            </label>
                            {editModeBgImage && (
                              <button 
                                type="button" 
                                onClick={() => setEditModeBgImage('')} 
                                className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer"
                              >
                                إزالة الصورة (التدرج فقط)
                              </button>
                            )}
                          </div>

                          {/* Upload Local Image or Custom URL */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div>
                              <span className="text-xs text-white/60 mb-1.5 block">رفع صورة من جهازك:</span>
                              <input 
                                type="file" 
                                ref={modeBgInputRef} 
                                accept="image/*"
                                onChange={handlePickLocalBgImage} 
                                className="hidden" 
                              />
                              <button
                                type="button"
                                onClick={() => modeBgInputRef.current?.click()}
                                className="w-full glass hover:bg-white/20 py-2.5 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 border border-white/20 transition-all cursor-pointer"
                              >
                                <Upload className="w-4 h-4 text-amber-300" />
                                <span>اختر صورة من الجهاز</span>
                              </button>
                            </div>

                            <div>
                              <span className="text-xs text-white/60 mb-1.5 block">أو أدخل رابط صورة مخصص (URL):</span>
                              <div className="relative">
                                <input 
                                  type="text" 
                                  value={editModeBgImage} 
                                  onChange={(e) => setEditModeBgImage(e.target.value)}
                                  placeholder="https://example.com/background.jpg"
                                  className="w-full bg-black/40 border border-white/20 rounded-xl pl-3 pr-8 py-2.5 text-xs text-white focus:outline-none focus:border-white font-mono"
                                />
                                <LinkIcon className="w-3.5 h-3.5 text-white/40 absolute right-2.5 top-3" />
                              </div>
                            </div>
                          </div>

                          {/* Opacity Slider */}
                          {editModeBgImage && (
                            <div className="pt-2">
                              <div className="flex justify-between items-center text-xs font-semibold text-white/80 mb-1">
                                <span className="flex items-center gap-1.5">
                                  <Sliders className="w-3.5 h-3.5 text-amber-300" /> درجة شفافية ووضوح الصورة
                                </span>
                                <span className="text-amber-300 font-bold">{editModeBgOpacity}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="10" 
                                max="100" 
                                value={editModeBgOpacity} 
                                onChange={(e) => setEditModeBgOpacity(Number(e.target.value))}
                                className="w-full accent-amber-400 cursor-pointer"
                              />
                            </div>
                          )}
                        </div>

                        {/* Live Preview */}
                        <div>
                          <label className="text-xs font-semibold text-white/60 mb-2 block">معاينة خلفية الوضع الحية</label>
                          <div className="relative h-28 rounded-2xl overflow-hidden shadow-2xl border border-white/30 flex items-center justify-between p-6">
                            <div className={`absolute inset-0 bg-gradient-to-tr ${editModeGradient}`} />
                            {editModeBgImage && (
                              <div 
                                className="absolute inset-0 bg-cover bg-center transition-all"
                                style={{ 
                                  backgroundImage: `url('${editModeBgImage}')`,
                                  opacity: editModeBgOpacity / 100
                                }}
                              />
                            )}
                            <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
                            <h4 className="relative z-10 font-extrabold text-2xl text-white drop-shadow-lg">
                              {editModeTitle || 'عنوان الوضع الجديد'}
                            </h4>
                            <span className="relative z-10 px-3.5 py-1.5 bg-black/40 backdrop-blur-md rounded-xl text-xs font-bold text-white/90 border border-white/20">
                              معاينة الوضع
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <button onClick={() => setIsAddingNewMode(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-white/70 hover:text-white glass cursor-pointer">
                          إلغاء
                        </button>
                        <button onClick={handleSaveNewMode} className="bg-amber-400 text-black px-6 py-2.5 rounded-xl font-extrabold text-sm flex items-center gap-2 hover:scale-105 transition-transform shadow-lg cursor-pointer">
                          <Save className="w-4 h-4" /> حفظ وإضافة الوضع
                        </button>
                      </div>
                    </motion.div>
                  ) : editingModeKey ? (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-6 glass rounded-2xl border border-white/20 space-y-6">
                      <div className="flex justify-between items-center pb-4 border-b border-white/10">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Pencil className="w-5 h-5 text-amber-400" /> تخصيص خلفية وثيم وضع ({modesMap[editingModeKey]?.title || editingModeKey})
                        </h3>
                        <button onClick={() => setEditingModeKey(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white cursor-pointer">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="text-sm font-semibold text-white/80 mb-1.5 block">تسمية وضع التشغيل (الاسم الظاهر)</label>
                          <input 
                            type="text" 
                            value={editModeTitle} 
                            onChange={(e) => setEditModeTitle(e.target.value)}
                            placeholder="مثال: وضع العائلة والجمعة"
                            className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-white/80 mb-2 block">اختيار ثيم التدرج اللوني (Theme Gradient)</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-h-48 overflow-y-auto no-scrollbar p-1">
                            {THEME_GRADIENT_PRESETS.map((preset) => {
                              const isSelected = editModeGradient === preset.gradient;
                              return (
                                <button
                                  key={preset.name}
                                  type="button"
                                  onClick={() => setEditModeGradient(preset.gradient)}
                                  className={`p-3 rounded-xl border text-right flex items-center gap-3 transition-all cursor-pointer ${
                                    isSelected 
                                      ? 'border-white ring-2 ring-white bg-white/20 shadow-lg' 
                                      : 'border-white/10 glass hover:bg-white/10'
                                  }`}
                                >
                                  <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${preset.gradient} shrink-0 shadow-md`} />
                                  <span className="text-xs font-bold text-white truncate">{preset.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Custom Background Image Section */}
                        <div className="space-y-3 pt-3 border-t border-white/10">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-white/90 flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-sky-400" /> تخصيص صورة الخلفية لوضع ({modesMap[editingModeKey]?.title})
                            </label>
                            {editModeBgImage && (
                              <button 
                                type="button" 
                                onClick={() => setEditModeBgImage('')} 
                                className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer"
                              >
                                إزالة الصورة (التدرج فقط)
                              </button>
                            )}
                          </div>

                          {/* Presets Grid for this Mode */}
                          <div>
                            <span className="text-xs text-white/60 mb-2 block">خلفيات مقترحة تناسب هذا الوضع:</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                              {(MODE_BACKGROUND_PRESETS[editingModeKey] || []).map((preset) => {
                                const isSelected = editModeBgImage === preset.url;
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setEditModeBgImage(preset.url)}
                                    className={`relative h-20 rounded-xl overflow-hidden border text-right p-2 transition-all cursor-pointer group ${
                                      isSelected
                                        ? 'border-white ring-2 ring-white shadow-lg scale-[1.02]'
                                        : 'border-white/10 hover:border-white/40'
                                    }`}
                                  >
                                    {preset.url ? (
                                      <img src={preset.url} alt={preset.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                      <div className={`absolute inset-0 bg-gradient-to-tr ${editModeGradient}`} />
                                    )}
                                    <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors" />
                                    <span className="relative z-10 text-[11px] font-bold text-white drop-shadow-md leading-tight block">
                                      {preset.name}
                                    </span>
                                    {isSelected && (
                                      <div className="absolute bottom-1.5 left-1.5 z-10 bg-green-500 text-white rounded-full p-0.5">
                                        <Check className="w-3 h-3" />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Upload Local Image or Custom URL */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div>
                              <span className="text-xs text-white/60 mb-1.5 block">رفع صورة من جهازك:</span>
                              <input 
                                type="file" 
                                ref={modeBgInputRef} 
                                accept="image/*"
                                onChange={handlePickLocalBgImage} 
                                className="hidden" 
                              />
                              <button
                                type="button"
                                onClick={() => modeBgInputRef.current?.click()}
                                className="w-full glass hover:bg-white/20 py-2.5 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 border border-white/20 transition-all cursor-pointer"
                              >
                                <Upload className="w-4 h-4 text-amber-300" />
                                <span>اختر صورة من الجهاز</span>
                              </button>
                            </div>

                            <div>
                              <span className="text-xs text-white/60 mb-1.5 block">أو أدخل رابط صورة مخصص (URL):</span>
                              <div className="relative">
                                <input 
                                  type="text" 
                                  value={editModeBgImage} 
                                  onChange={(e) => setEditModeBgImage(e.target.value)}
                                  placeholder="https://example.com/background.jpg"
                                  className="w-full bg-black/40 border border-white/20 rounded-xl pl-3 pr-8 py-2.5 text-xs text-white focus:outline-none focus:border-white font-mono"
                                />
                                <LinkIcon className="w-3.5 h-3.5 text-white/40 absolute right-2.5 top-3" />
                              </div>
                            </div>
                          </div>

                          {/* Opacity Slider */}
                          {editModeBgImage && (
                            <div className="pt-2">
                              <div className="flex justify-between items-center text-xs font-semibold text-white/80 mb-1">
                                <span className="flex items-center gap-1.5">
                                  <Sliders className="w-3.5 h-3.5 text-amber-300" /> درجة شفافية ووضوح الصورة
                                </span>
                                <span className="text-amber-300 font-bold">{editModeBgOpacity}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="10" 
                                max="100" 
                                value={editModeBgOpacity} 
                                onChange={(e) => setEditModeBgOpacity(Number(e.target.value))}
                                className="w-full accent-amber-400 cursor-pointer"
                              />
                            </div>
                          )}
                        </div>

                        {/* Live Preview */}
                        <div>
                          <label className="text-xs font-semibold text-white/60 mb-2 block">معاينة خلفية الوضع الحية</label>
                          <div className="relative h-28 rounded-2xl overflow-hidden shadow-2xl border border-white/30 flex items-center justify-between p-6">
                            {/* Base Gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-tr ${editModeGradient}`} />
                            
                            {/* Bg Image */}
                            {editModeBgImage && (
                              <div 
                                className="absolute inset-0 bg-cover bg-center transition-all"
                                style={{ 
                                  backgroundImage: `url('${editModeBgImage}')`,
                                  opacity: editModeBgOpacity / 100
                                }}
                              />
                            )}

                            {/* Dark Overlay */}
                            <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />

                            <h4 className="relative z-10 font-extrabold text-2xl text-white drop-shadow-lg">
                              {editModeTitle || 'عنوان الوضع'}
                            </h4>
                            <span className="relative z-10 px-3.5 py-1.5 bg-black/40 backdrop-blur-md rounded-xl text-xs font-bold text-white/90 border border-white/20">
                              معاينة الخلفية
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <button onClick={() => setEditingModeKey(null)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-white/70 hover:text-white glass cursor-pointer">
                          إلغاء
                        </button>
                        <button onClick={handleSaveModeEdit} className="bg-white text-black px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:scale-105 transition-transform shadow-lg cursor-pointer">
                          <Save className="w-4 h-4" /> حفظ وضع التشغيل والخلفية
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(Object.keys(modesMap) as Mode[]).map((modeKey) => {
                        const mode = modesMap[modeKey] || MODES[modeKey as keyof typeof MODES];
                        const isSelected = currentMode === modeKey;
                        const isDefaultMode = modeKey in MODES;
                        return (
                          <div 
                            key={modeKey}
                            className={`p-5 rounded-2xl border transition-all flex items-center justify-between relative overflow-hidden group ${
                              isSelected 
                                ? 'bg-white/20 border-white shadow-xl ring-2 ring-white/50' 
                                : 'glass border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {/* Card Background Preview if image exists */}
                            {mode?.bgImage && (
                              <div 
                                className="absolute inset-0 bg-cover bg-center opacity-25 group-hover:opacity-40 transition-opacity"
                                style={{ backgroundImage: `url('${mode.bgImage}')` }}
                              />
                            )}

                            <div 
                              onClick={() => { if (setCurrentMode) setCurrentMode(modeKey); }}
                              className="flex items-center gap-3 flex-1 cursor-pointer z-10"
                            >
                              <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${mode?.gradient || 'from-orange-500 to-purple-600'} shadow-md shrink-0 flex items-center justify-center border border-white/20 overflow-hidden`}>
                                {mode?.bgImage && <ImageIcon className="w-4 h-4 text-white/80" />}
                              </div>
                              <div>
                                <h4 className="font-bold text-lg text-white drop-shadow-sm">{mode?.title || modeKey}</h4>
                                <p className="text-xs text-white/70 font-medium">
                                  {mode?.bgImage ? 'مخصص خلفية بصورة' : (isDefaultMode ? 'وضع افتراضي' : 'وضع مخصص')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 z-10">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleStartEditMode(modeKey); }}
                                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors cursor-pointer glass"
                                title="تعديل تسمية وخلفية الوضع"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {!isDefaultMode && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteCustomMode(modeKey); }}
                                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-xl transition-colors cursor-pointer glass"
                                  title="حذف هذا الوضع المخصص"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              {isSelected && <CheckCircle2 className="w-6 h-6 text-green-400" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 3. AUTOPLAY MODAL */}
              {activeModal === 'autoplay' && (
                <div className="pl-12 space-y-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 bg-white/10 rounded-2xl">
                      <Monitor className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold">إعدادات التشغيل التلقائي</h2>
                      <p className="text-white/60 text-sm mt-1">تفضيلات مشغل الفيديوهات والانتقال التلقائي</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 glass rounded-2xl">
                      <div>
                        <h4 className="font-bold">التشغيل في الخلفية</h4>
                        <p className="text-xs text-white/60 mt-0.5">استمرار تشغيل الصوت عند تصغير التطبيق أو فتح نافذة أخرى</p>
                      </div>
                      <button 
                        type="button"
                        dir="ltr"
                        onClick={() => setBackgroundPlayback(!backgroundPlayback)}
                        className={`w-14 h-8 rounded-full p-1 transition-colors flex items-center shrink-0 cursor-pointer ${
                          backgroundPlayback ? 'bg-green-500 justify-end' : 'bg-white/20 justify-start'
                        }`}
                      >
                        <div className="w-6 h-6 bg-white rounded-full shadow-md transition-all" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 glass rounded-2xl">
                      <div>
                        <h4 className="font-bold">تشغيل الحلقة التالية تلقائياً</h4>
                        <p className="text-xs text-white/60 mt-0.5">الانتقال التلقائي بعد نهاية الحلقة الحالية</p>
                      </div>
                      <button 
                        type="button"
                        dir="ltr"
                        onClick={() => setAutoNext(!autoNext)}
                        className={`w-14 h-8 rounded-full p-1 transition-colors flex items-center shrink-0 cursor-pointer ${
                          autoNext ? 'bg-green-500 justify-end' : 'bg-white/20 justify-start'
                        }`}
                      >
                        <div className="w-6 h-6 bg-white rounded-full shadow-md transition-all" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 glass rounded-2xl">
                      <div>
                        <h4 className="font-bold">تفعيل الصورة الفاصلة بين الحلقات</h4>
                        <p className="text-xs text-white/60 mt-0.5">عرض بطاقة العرض الفاصلة مع غلاف الحلقة التالية والعد التنازلي قبل بدء العرض</p>
                      </div>
                      <button 
                        type="button"
                        dir="ltr"
                        onClick={() => setShowTransitionBumper(!showTransitionBumper)}
                        className={`w-14 h-8 rounded-full p-1 transition-colors flex items-center shrink-0 cursor-pointer ${
                          showTransitionBumper ? 'bg-green-500 justify-end' : 'bg-white/20 justify-start'
                        }`}
                      >
                        <div className="w-6 h-6 bg-white rounded-full shadow-md transition-all" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 glass rounded-2xl">
                      <div>
                        <h4 className="font-bold">متابعة الاستئناف من موضع التوقف</h4>
                        <p className="text-xs text-white/60 mt-0.5">حفظ آخر دقيقة شوهدت والبدء منها تلقائياً</p>
                      </div>
                      <button 
                        type="button"
                        dir="ltr"
                        onClick={() => setResumePlayback(!resumePlayback)}
                        className={`w-14 h-8 rounded-full p-1 transition-colors flex items-center shrink-0 cursor-pointer ${
                          resumePlayback ? 'bg-green-500 justify-end' : 'bg-white/20 justify-start'
                        }`}
                      >
                        <div className="w-6 h-6 bg-white rounded-full shadow-md transition-all" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 glass rounded-2xl">
                      <div>
                        <h4 className="font-bold">سرعة التشغيل الافتراضية</h4>
                        <p className="text-xs text-white/60 mt-0.5">السرعة الافتراضية لتشغيل جميع الفيديوهات</p>
                      </div>
                      <select 
                        value={playbackSpeed} 
                        onChange={(e) => setPlaybackSpeed(e.target.value)}
                        className="bg-black/40 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-white [&>option]:text-black cursor-pointer"
                      >
                        <option value="0.75x">0.75x</option>
                        <option value="1.0x">1.0x (العادي)</option>
                        <option value="1.25x">1.25x</option>
                        <option value="1.5x">1.5x</option>
                        <option value="2.0x">2.0x</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. BACKUP MODAL */}
              {activeModal === 'backup' && (
                <div className="pl-12 space-y-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 bg-white/10 rounded-2xl">
                      <DownloadCloud className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold">النسخ الاحتياطي والاستعادة</h2>
                      <p className="text-white/60 text-sm mt-1">تصدير بيانات التطبيق أو استعادتها من نسخة سابقة</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="glass-card p-6 rounded-2xl flex flex-col items-center text-center gap-4">
                      <div className="p-4 bg-green-500/20 rounded-full">
                        <DownloadCloud className="w-8 h-8 text-green-400" />
                      </div>
                      <h3 className="text-lg font-bold">تصدير البيانات</h3>
                      <p className="text-sm text-white/60">سيتم حفظ جميع قوائم المشاهدة، الإعدادات، والتقدم بملف واحد.</p>
                      <button 
                        onClick={handleExportData}
                        className="bg-white text-black font-bold px-6 py-2 rounded-xl mt-auto hover:scale-105 transition-transform w-full"
                      >
                        تصدير كملف
                      </button>
                    </div>

                    <div className="glass-card p-6 rounded-2xl flex flex-col items-center text-center gap-4 border border-white/10">
                      <div className="p-4 bg-blue-500/20 rounded-full">
                        <UploadCloud className="w-8 h-8 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-bold">استعادة البيانات</h3>
                      <p className="text-sm text-white/60">استرجاع قوائمك وإعداداتك من ملف نسخة احتياطية سابق.</p>
                      <input 
                        type="file" 
                        ref={backupInputRef} 
                        onChange={handleImportData} 
                        accept=".json"
                        className="hidden" 
                      />
                      <button 
                        onClick={() => backupInputRef.current?.click()}
                        className="glass font-bold px-6 py-2 rounded-xl mt-auto hover:bg-white hover:text-black transition-colors w-full"
                      >
                        اختيار ملف
                      </button>
                    </div>

                    <div className="glass-card p-6 rounded-2xl flex flex-col items-center text-center gap-4 border border-red-500/30">
                      <div className="p-4 bg-red-500/20 rounded-full">
                        <Trash2 className="w-8 h-8 text-red-400" />
                      </div>
                      <h3 className="text-lg font-bold text-red-400">مسح المحتوى</h3>
                      <p className="text-sm text-white/60">حذف كافة قوائم التشغيل والملفات المرتبطة بها (لا يمكن التراجع).</p>
                      <button 
                        onClick={handleClearAllData}
                        className="bg-red-500/20 text-red-400 font-bold px-6 py-2 rounded-xl mt-auto hover:bg-red-500 hover:text-white transition-colors w-full border border-red-500/30"
                      >
                        مسح جميع القوائم
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAURI DESKTOP MODAL */}
              {activeModal === 'tauri' && (
                <div className="pl-6 sm:pl-12">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 bg-amber-400/20 rounded-2xl border border-amber-400/30">
                      <Cpu className="w-8 h-8 text-amber-300" />
                    </div>
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold">إعدادات نظام سطح المكتب (Tauri)</h2>
                      <p className="text-white/60 text-sm mt-1">تجهيز الواجهة للعمل كتطبيق سطح مكتب خفيف وسريع بنظام Tauri v2</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="glass-card p-5 rounded-2xl border border-white/10 bg-white/5 space-y-4">
                      <h4 className="font-bold text-sm text-amber-300">⚙️ خيارات سطح المكتب والنظام:</h4>
                      
                      <div className="space-y-3">
                        {/* Always on Top Toggle */}
                        <div className="flex justify-between items-center p-3.5 bg-black/40 rounded-xl border border-white/10">
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-2">
                              <span>دائمًا في المقدمة (Always on Top)</span>
                              {alwaysOnTop && <span className="text-[9px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">مفعّل</span>}
                            </div>
                            <div className="text-xs text-white/60">بقاء نافذة التطبيق أعلى الشاشة وقوق باقي البرامج.</div>
                          </div>
                          <button 
                            type="button"
                            dir="ltr"
                            onClick={() => handleToggleAlwaysOnTop(!alwaysOnTop)}
                            className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center shrink-0 cursor-pointer ${
                              alwaysOnTop ? 'bg-amber-500 justify-end' : 'bg-white/20 justify-start'
                            }`}
                          >
                            <div className="w-5 h-5 bg-white rounded-full shadow-md transition-all" />
                          </button>
                        </div>

                        {/* Autostart Toggle */}
                        <div className="flex justify-between items-center p-3.5 bg-black/40 rounded-xl border border-white/10">
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-2">
                              <span>تشغيل التطبيق مع بدء Windows</span>
                              {autostartWindows && <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-400/30">مفعّل</span>}
                            </div>
                            <div className="text-xs text-white/60">بدء تشغيل التطبيق تلقائيًا عند إقلاع نظام التشغيل.</div>
                          </div>
                          <button 
                            type="button"
                            dir="ltr"
                            onClick={() => handleToggleAutostartWindows(!autostartWindows)}
                            className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center shrink-0 cursor-pointer ${
                              autostartWindows ? 'bg-indigo-500 justify-end' : 'bg-white/20 justify-start'
                            }`}
                          >
                            <div className="w-5 h-5 bg-white rounded-full shadow-md transition-all" />
                          </button>
                        </div>

                        {/* Lite / Simplified Mode Toggle */}
                        <div className="flex justify-between items-center p-3.5 bg-black/40 rounded-xl border border-white/10">
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-2">
                              <span>تفعيل الوضع المبسط</span>
                              {liteMode && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">مفعّل</span>}
                            </div>
                            <div className="text-xs text-white/60">نمط خفيف وسريع بدون تأثيرات بصرية وبدون توهج أو انتقالات حركة لزيادة السلاسة.</div>
                          </div>
                          <button 
                            type="button"
                            dir="ltr"
                            onClick={() => handleToggleLiteMode(!liteMode)}
                            className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center shrink-0 cursor-pointer ${
                              liteMode ? 'bg-emerald-500 justify-end' : 'bg-white/20 justify-start'
                            }`}
                          >
                            <div className="w-5 h-5 bg-white rounded-full shadow-md transition-all" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
                            {/* SHORTCUTS MODAL */}
              {activeModal === 'shortcuts' && (
                <KeyboardShortcutsModal onClose={() => setActiveModal(null)} />
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>


      
    </motion.div>
  );
};

export default SettingsView;

