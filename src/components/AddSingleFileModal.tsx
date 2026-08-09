import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Tv, Baby, Film, Globe, BookOpen, Music, Sparkles, Plus, CheckCircle2, UploadCloud, FileVideo, FileAudio, ImageIcon } from 'lucide-react';
import { Mode, Watchlist } from '../types';
import { MODE_SECTIONS } from '../data';
import { sortSmartMediaFiles } from '../utils/sorter';
import { open } from '@tauri-apps/plugin-dialog';
import { isCrossOriginIframe } from '../utils/fileSystem';
import { extractVideoFrameThumbnail, generateVideoCardPoster } from '../utils/coverHelper';

const MODE_OPTIONS: { key: Mode; name: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'family', name: 'المسلسلات', icon: Tv },
  { key: 'kids', name: 'أطفالي', icon: Baby },
  { key: 'cinema', name: 'الأفلام', icon: Film },
  { key: 'docs', name: 'الوثائقيات', icon: Globe },
  { key: 'quran', name: 'القرآن الكريم', icon: BookOpen },
  { key: 'music', name: 'الموسيقى', icon: Music },
  { key: 'night', name: 'عائلتي', icon: Sparkles },
];

interface AddSingleFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: Mode;
  customCategories: string[];
  watchlists: Watchlist[];
  onAddCategory: (category: string) => void;
  onAddWatchlist: (list: Watchlist) => void;
  onUpdateWatchlist?: (id: string, updates: Partial<Watchlist>) => void;
}

export const AddSingleFileModal: React.FC<AddSingleFileModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  customCategories,
  watchlists,
  onAddCategory,
  onAddWatchlist,
  onUpdateWatchlist
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  // Step 1: File
  const [importedFiles, setImportedFiles] = useState<any[]>([]);
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  
  // Step 2: Details
  const [title, setTitle] = useState('');
  const [selectedMode, setSelectedMode] = useState<Mode>(currentMode);
  const categories = Array.from(new Set([...(MODE_SECTIONS[selectedMode] || MODE_SECTIONS.family).filter(s => s !== 'الكل'), ...customCategories]));
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Step 3: Cover
  const [customCover, setCustomCover] = useState<string | null>(null);
  const [isExtractingCover, setIsExtractingCover] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setImportedFiles([]);
      setTitle('');
      setSelectedMode(currentMode);
      setCustomCover(null);
      setIsExtractingCover(false);
      const cats = Array.from(new Set([...(MODE_SECTIONS[currentMode] || MODE_SECTIONS.family).filter(s => s !== 'الكل'), ...customCategories]));
      setSelectedCategory(cats[0] || 'عام');
    }
  }, [isOpen, currentMode, customCategories]);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [selectedMode, customCategories]);

  if (!isOpen) return null;

  const handleAddFiles = async () => {
    if (isCrossOriginIframe()) {
      if (singleFileInputRef.current) {
        singleFileInputRef.current.value = '';
        singleFileInputRef.current.click();
      }
      return;
    }
    try {
      const selectedPaths = await open({
        multiple: true,
        filters: [{
          name: 'Media Files',
          extensions: ['mkv', 'mp4', 'avi', 'mov', 'webm', 'ts', 'm4v', 'flv', 'wmv', '3gp', 'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg']
        }]
      });
      if (Array.isArray(selectedPaths) && selectedPaths.length > 0) {
        const mediaFiles = selectedPaths.map(path => {
          const name = path.split(/[/\\]/).pop() || '';
          return { name, absolutePath: path, path, type: 'video/mp4' }; 
        });
        processSelectedFiles(mediaFiles);
      }
    } catch (e) {
      console.warn('Tauri open dialog failed, falling back', e);
      if (singleFileInputRef.current) {
        singleFileInputRef.current.value = '';
        singleFileInputRef.current.click();
      }
    }
  };

  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files) as File[];
      const mediaFiles = fileList.filter(file => 
        file.type.startsWith('video/') || 
        file.type.startsWith('audio/') || 
        file.name.match(/\.(mp4|mkv|webm|avi|mov|ts|m4v|flv|wmv|3gp|mp3|m4a|aac|wav|flac|ogg)$/i)
      );
      processSelectedFiles(mediaFiles.length > 0 ? mediaFiles : fileList);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.items || e.dataTransfer.items.length === 0) return;
    const newFiles: File[] = [];
    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      const item = e.dataTransfer.items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          const isMedia = file.type.startsWith('video/') || file.type.startsWith('audio/') || file.name.match(/\.(mp4|mkv|webm|avi|mov|ts|m4v|flv|wmv|3gp|mp3|m4a|aac|wav|flac|ogg)$/i);
          if (isMedia) newFiles.push(file);
        }
      }
    }
    if (newFiles.length > 0) {
      processSelectedFiles(newFiles);
    }
  };

  const processSelectedFiles = (files: any[]) => {
    const targetFiles = sortSmartMediaFiles(files as any);
    if (targetFiles.length > 0) {
      setImportedFiles(targetFiles);
      // Auto-fill title from the first file without extension
      let baseName = targetFiles[0].name || '';
      baseName = baseName.replace(/\.[^/.]+$/, ""); // remove extension
      // Clean up common release group tags for better auto-title
      baseName = baseName.replace(/[\._-]/g, ' ').replace(/\s+/g, ' ').trim();
      setTitle(baseName);
      setStep(2);
    }
  };

  const handleExtractCover = async () => {
    if (importedFiles.length > 0) {
      setIsExtractingCover(true);
      try {
        const firstFile = importedFiles.find(f => f instanceof File || (f && ((f as any).rawFile instanceof File || (f as any).blobUrl || (f as any).absolutePath)));
        if (firstFile) {
          const thumb = await extractVideoFrameThumbnail(firstFile);
          if (thumb) setCustomCover(thumb);
        }
      } catch (e) {
        console.warn('Extraction failed', e);
      }
      setIsExtractingCover(false);
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setCustomCover(url);
    }
  };

  const handleAddNewCategorySubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    onAddCategory(trimmed);
    setSelectedCategory(trimmed);
    setNewCategoryInput('');
    setShowAddCategoryInput(false);
  };

  const handleSave = () => {
    if (importedFiles.length === 0 || !title.trim()) return;

    const titleName = title.trim();
    
    // Check if we want to merge into an existing playlist with the EXACT SAME title in the same category and mode
    const existing = watchlists.find(w => w.targetMode === selectedMode && w.section === selectedCategory && w.title.toLowerCase() === titleName.toLowerCase());

    if (existing && onUpdateWatchlist) {
      const mergedFiles = sortSmartMediaFiles([...(existing.files || []), ...importedFiles]);
      onUpdateWatchlist(existing.id, {
        files: mergedFiles,
        episodesCount: mergedFiles.length,
        timeRemaining: `${mergedFiles.length * 45} دقيقة`,
        isSingleFile: false,
        coverImage: customCover || existing.coverImage
      });
    } else {
      const newWatchlist: Watchlist = {
        id: (Date.now() + Math.random() * 10000).toString(),
        title: titleName,
        files: importedFiles,
        targetMode: selectedMode,
        section: selectedCategory,
        coverImage: customCover || '', // Will be lazily generated if empty
        seriesCount: 1,
        episodesCount: importedFiles.length,
        isSingleFile: importedFiles.length === 1,
        folderName: 'ملفات مفردة',
        folderPath: `/Media/ملفات مفردة/${titleName}`,
        lastWatched: '-',
        progress: 0,
        timeRemaining: importedFiles.length === 1 ? 'فيديو مفرد 🎬' : `${importedFiles.length * 45} دقيقة`,
      };
      onAddWatchlist(newWatchlist);
    }
    
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-slate-900 border border-white/20 shadow-2xl rounded-3xl w-full max-w-2xl overflow-hidden dir-rtl flex flex-col"
          style={{ maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 sm:p-5 bg-black/40 border-b border-white/10 shrink-0">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
                <FileVideo className="w-6 h-6 text-amber-400" />
                إضافة ملفات مفردة (فيديو / صوت)
              </h2>
              <p className="text-xs sm:text-sm text-white/60 mt-1">
                إضافة ذكية وسريعة مع إمكانية التخصيص
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            
            {/* Step 1: File Selection */}
            <div className={`transition-opacity ${step < 1 ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? 'bg-amber-400 text-black' : 'bg-green-500 text-white'}`}>
                    {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                  </div>
                  <h3 className="font-bold text-lg">اختيار الملفات</h3>
                </div>
                {importedFiles.length > 0 && (
                  <button onClick={() => setImportedFiles([])} className="text-xs text-red-400 hover:text-red-300">مسح التحديد</button>
                )}
              </div>
              
              <div className="mr-8">
                {importedFiles.length === 0 ? (
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={handleAddFiles}
                    className="border-2 border-dashed border-white/20 hover:border-amber-400/50 hover:bg-amber-500/5 bg-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                  >
                    <UploadCloud className="w-12 h-12 text-white/60 mb-3" />
                    <span className="text-base font-bold">انقر لاختيار الملفات أو قم بسحبها وإفلاتها هنا</span>
                    <span className="text-xs text-white/50 mt-2">يدعم كافة صيغ الفيديو والصوت</span>
                    <input 
                      type="file" 
                      ref={singleFileInputRef}
                      onChange={handleFallbackChange}
                      className="hidden" 
                      multiple
                      accept="video/*,audio/*,.mkv,.mp4,.avi,.mov,.webm,.ts,.m4v,.flv,.wmv,.3gp,.mp3,.m4a,.aac,.wav,.flac,.ogg"
                    />
                  </div>
                ) : (
                  <div className="bg-black/40 border border-white/10 rounded-xl p-3 max-h-32 overflow-y-auto">
                    <div className="space-y-1.5">
                      {importedFiles.map((f, idx) => {
                        const isAudio = f.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|wma)$/i) || (f.type && f.type.startsWith('audio/'));
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs text-white/80 py-1">
                            {isAudio ? <FileAudio className="w-4 h-4 text-blue-400 shrink-0" /> : <FileVideo className="w-4 h-4 text-emerald-400 shrink-0" />}
                            <span className="truncate flex-1 font-mono dir-ltr text-right">{f.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Details */}
            <div className={`transition-opacity ${step < 2 ? 'opacity-30 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-amber-400 text-black' : step > 2 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
                  {step > 2 ? <CheckCircle2 className="w-4 h-4" /> : '2'}
                </div>
                <h3 className="font-bold text-lg">تفاصيل العرض والتصنيف</h3>
              </div>
              
              <div className="mr-8 space-y-4">
                {/* Title and Playlist Selection */}
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-1.5">عنوان قائمة التشغيل (اكتب اسماً جديداً)</label>
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="اسم العرض أو الفيديو..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                  
                  {watchlists.filter(w => w.targetMode === selectedMode && w.section === selectedCategory).length > 0 && (
                    <div>
                      <label className="block text-xs text-white/60 mb-1.5">أو اختر قائمة موجودة للإضافة إليها:</label>
                      <select 
                        value={watchlists.find(w => w.title === title && w.targetMode === selectedMode && w.section === selectedCategory)?.title || ""}
                        onChange={(e) => {
                          if (e.target.value) setTitle(e.target.value);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400/50 appearance-none cursor-pointer"
                      >
                        <option value="" disabled className="text-black bg-white">-- اختر قائمة تشغيل موجودة --</option>
                        {watchlists
                          .filter(w => w.targetMode === selectedMode && w.section === selectedCategory)
                          .map(w => (
                            <option key={w.id} value={w.title} className="text-black bg-white">
                              {w.title}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  )}
                </div>

                {/* Mode Select */}
                <div>
                  <label className="block text-xs text-white/60 mb-1.5">نمط العرض (Mode)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {MODE_OPTIONS.map((m) => {
                      const isSel = selectedMode === m.key;
                      const MIcon = m.icon;
                      return (
                        <button
                          key={m.key}
                          onClick={() => setSelectedMode(m.key)}
                          className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center gap-1 transition-all ${
                            isSel
                              ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-black border-amber-300 shadow-md font-bold'
                              : 'bg-white/5 text-white/80 border-white/10 hover:border-amber-400/60'
                          }`}
                        >
                          <MIcon className={`w-4 h-4 ${isSel ? 'text-black' : 'text-amber-400'}`} />
                          <span className="text-[10px] font-bold truncate w-full">{m.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category Select */}
                <div>
                  <label className="block text-xs text-white/60 mb-1.5">التصنيف الفرعي</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((tag) => (
                      <button 
                        key={tag}
                        onClick={() => setSelectedCategory(tag)}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          selectedCategory === tag 
                            ? 'bg-white text-black shadow-md' 
                            : 'bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                    <button 
                      onClick={() => setShowAddCategoryInput(true)}
                      className="px-3 py-2 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة جديد
                    </button>
                  </div>

                  {showAddCategoryInput && (
                    <form onSubmit={handleAddNewCategorySubmit} className="flex gap-2 max-w-sm mt-3">
                      <input 
                        type="text" 
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        placeholder="اسم التصنيف الجديد..."
                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                        autoFocus
                      />
                      <button type="submit" className="bg-white text-black px-4 py-2 rounded-xl text-sm font-bold">حفظ</button>
                      <button type="button" onClick={() => setShowAddCategoryInput(false)} className="px-2 hover:bg-white/10 rounded-xl"><X className="w-4 h-4" /></button>
                    </form>
                  )}
                </div>

                {step === 2 && (
                  <button onClick={() => setStep(3)} disabled={!title.trim()} className="bg-white/10 hover:bg-white/20 text-white w-full py-2.5 rounded-xl text-sm font-bold mt-2 disabled:opacity-50">
                    متابعة لتحديد الغلاف
                  </button>
                )}
              </div>
            </div>

            {/* Step 3: Cover (Optional) */}
            <div className={`transition-opacity ${step < 3 ? 'opacity-30 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 3 ? 'bg-amber-400 text-black' : 'bg-white/20 text-white/60'}`}>
                  3
                </div>
                <h3 className="font-bold text-lg">صورة الغلاف (اختياري)</h3>
              </div>
              
              <div className="mr-8 flex items-center gap-4">
                <div className="w-24 h-32 rounded-xl bg-black border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
                  {customCover ? (
                     <img src={customCover} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-white/20" />
                  )}
                  {isExtractingCover && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2 flex-1">
                  <button 
                    onClick={handleExtractCover}
                    disabled={isExtractingCover || importedFiles.length === 0}
                    className="bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Tv className="w-4 h-4" /> استخراج لقطة من الفيديو تلقائياً
                  </button>
                  
                  <label className="bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-300 text-sm font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <UploadCloud className="w-4 h-4" /> رفع صورة من الجهاز
                    <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} />
                  </label>
                  <p className="text-[10px] text-white/50 text-center mt-1">إذا لم تقم بتحديد صورة، سيتم استخراجها في الخلفية لاحقاً.</p>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-white/10 bg-black/40 flex justify-end gap-3 shrink-0">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/20 transition-colors"
            >
              إلغاء
            </button>
            <button 
              onClick={handleSave}
              disabled={step < 2 || importedFiles.length === 0 || !title.trim()}
              className="px-8 py-2.5 rounded-xl font-bold text-sm bg-amber-400 text-black hover:bg-amber-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(251,191,36,0.3)] flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> حفظ وإضافة للمكتبة
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
