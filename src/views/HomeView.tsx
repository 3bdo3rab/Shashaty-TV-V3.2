import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mode, Watchlist, ViewState } from '../types';
import { MODES } from '../data';
import { Baby, Users, Moon, Film, Globe, BookOpen, Music, Sparkles, Tv, Play, RefreshCw, X, Clapperboard, Clock, Tag } from 'lucide-react';
import { useDialog } from '../contexts/DialogContext';

interface HomeViewProps {
  currentMode: Mode;
  setCurrentMode: (mode: Mode) => void;
  customModes?: Record<Mode, { title: string; gradient: string; themeColor: string }>;
  watchlists?: Watchlist[];
  onPlay?: (
    file?: any, 
    title?: string, 
    watchlistTitle?: string, 
    files?: any[], 
    index?: number,
    sessionId?: string,
    watchlistId?: string,
    initialTime?: number
  ) => void;
  onNavigate?: (view: ViewState) => void;
}

const ICONS = {
  kids: Baby,
  night: Moon,
  family: Users,
  cinema: Film,
  docs: Globe,
  quran: BookOpen,
  music: Music,
};

export const HomeView: React.FC<HomeViewProps> = ({
  currentMode,
  setCurrentMode,
  customModes,
  watchlists = [],
  onPlay,
  onNavigate
}) => {
  const { showAlert } = useDialog();
  const modesData = customModes || MODES;

  // Surprise Me Modal
  const [isSurpriseOpen, setIsSurpriseOpen] = useState(false);
  const [surpriseResult, setSurpriseResult] = useState<{ watchlist: Watchlist; file: any; epIndex: number } | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  // Trigger Surprise Me
  const handleSurpriseMe = () => {
    if (!watchlists || watchlists.length === 0) {
      showAlert('المكتبة فارغة! يرجى إضافة محتوى أو قوائم تشغيل أولاً.');
      return;
    }
    setIsSurpriseOpen(true);
    setIsSpinning(true);
    setSurpriseResult(null);

    setTimeout(() => {
      const randomWl = watchlists[Math.floor(Math.random() * watchlists.length)];
      const allFiles = [
        ...(randomWl.files || []),
        ...(randomWl.seasons?.flatMap(s => s.files || []) || [])
      ];
      if (allFiles.length > 0) {
        const randomEpIdx = Math.floor(Math.random() * allFiles.length);
        setSurpriseResult({
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
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      className="p-4 sm:p-8 lg:p-12 min-h-full flex flex-col pt-6 sm:pt-10 relative w-full overflow-y-auto no-scrollbar dir-rtl text-right"
    >
      {/* Top Welcome Header */}
      <div className="mb-8 sm:mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold mb-3 tracking-tight drop-shadow-xl text-white">
            مرحباً بك
          </h1>
          <p className="text-base sm:text-2xl text-white/80 drop-shadow-md font-medium">
            منصتك التلفزيونية الشخصية لإدارة وتشغيل مكتبتك المحلية
          </p>
        </div>

        {/* Surprise Me & Channels Quick Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSurpriseMe}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-extrabold shadow-[0_10px_35px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-95 transition-all text-sm sm:text-base border border-white/30 cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-amber-200 animate-spin" style={{ animationDuration: '3s' }} />
            <span>🎲 فاجئني</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('channels')}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white/15 text-white font-extrabold hover:bg-white/25 transition-all text-sm sm:text-base border border-white/20 backdrop-blur-md cursor-pointer"
            >
              <Tv className="w-5 h-5 text-amber-300" />
              <span>📺 القنوات التلفزيونية</span>
            </button>
          )}
        </div>
      </div>

      {/* MODES SELECTION GRID */}
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold text-white mb-4">أوضاع المشاهدة</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 xl:gap-8 pb-12">
          {(Object.keys(modesData) as Mode[]).map((modeKey, index) => {
            const mode = modesData[modeKey] || MODES[modeKey];
            const Icon = (ICONS as any)[modeKey] || Sparkles;
            const isActive = currentMode === modeKey;

            return (
              <motion.button
                key={modeKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setCurrentMode(modeKey)}
                className={`relative overflow-hidden rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 text-right flex flex-col h-44 sm:h-56 transition-all duration-500 hover:scale-105 hover:-translate-y-2 group cursor-pointer
                  ${isActive ? 'ring-4 ring-white/50 shadow-[0_0_40px_rgba(255,255,255,0.3)]' : 'glass-card hover:bg-white/10'}
                `}
              >
                {/* Background image preview if available */}
                {mode.bgImage && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-25 group-hover:opacity-40 transition-opacity"
                    style={{ backgroundImage: `url('${mode.bgImage}')` }}
                  />
                )}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent opacity-50 mix-blend-overlay" />
                )}
                <div className="flex-1 relative z-10">
                  <Icon className={`w-10 h-10 sm:w-12 sm:h-12 ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white transition-colors'}`} strokeWidth={1.5} />
                </div>
                <h3 className={`text-xl sm:text-2xl lg:text-3xl font-bold mt-4 z-10 whitespace-nowrap overflow-hidden text-ellipsis ${isActive ? 'text-white drop-shadow-md' : 'text-white/90'}`}>
                  {mode.title}
                </h3>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* SURPRISE ME MODAL */}
      <AnimatePresence>
        {isSurpriseOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl"
          >
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

              <h3 className="text-2xl font-extrabold text-white mb-2">🎲 اختيار فاجئني</h3>

              {isSpinning ? (
                <div className="py-8 space-y-3">
                  <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-bold text-amber-300">جاري الدوران واختيار مقطع عشوائي...</p>
                </div>
              ) : surpriseResult ? (
                <div className="py-4 space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <h4 className="text-lg font-extrabold text-white">{surpriseResult.watchlist.title}</h4>
                    <p className="text-xs text-amber-300 font-medium mt-1">
                      {surpriseResult.file?.name || surpriseResult.file?.title || `الحلقة ${surpriseResult.epIndex + 1}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSurpriseMe}
                      className="flex-1 py-3 px-4 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>اختر غيره</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsSurpriseOpen(false);
                        if (onPlay) {
                          const allFiles = [
                            ...(surpriseResult.watchlist.files || []),
                            ...(surpriseResult.watchlist.seasons?.flatMap(s => s.files || []) || [])
                          ];
                          onPlay(
                            surpriseResult.file,
                            surpriseResult.file?.name || `الحلقة ${surpriseResult.epIndex + 1}`,
                            surpriseResult.watchlist.title,
                            allFiles,
                            surpriseResult.epIndex,
                            undefined,
                            surpriseResult.watchlist.id
                          );
                        }
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default HomeView;
