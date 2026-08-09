import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FolderOpen, UploadCloud, FolderPlus, CheckCircle2, Layers, Plus, Trash2, X, Tv, Baby, Film, Globe, BookOpen, Music, Sparkles, ChevronDown, ChevronLeft, ChevronRight, Folder, FileVideo, FileAudio, FolderTree, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { Watchlist, FileItem, Mode } from '../types';
import { MODE_SECTIONS } from '../data';
import { processMediaDirectory } from '../utils/fileSystem';
import { getEpisodeInspiredCover, extractVideoFrameThumbnail, generateVideoCardPoster } from '../utils/coverHelper';
import { open } from '@tauri-apps/plugin-dialog';

import { naturalCompare, sortSmartMediaFiles } from '../utils/sorter';
import { isCrossOriginIframe } from '../utils/fileSystem';
import { store } from '../utils/store';
import { useDialog } from '../contexts/DialogContext';
import { ProcessingRing } from '../components/ProcessingRing';
import { AddSingleFileModal } from '../components/AddSingleFileModal';

const MODE_OPTIONS: { key: Mode; name: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'family', name: 'المسلسلات', icon: Tv },
  { key: 'kids', name: 'أطفالي', icon: Baby },
  { key: 'cinema', name: 'الأفلام', icon: Film },
  { key: 'docs', name: 'الوثائقيات', icon: Globe },
  { key: 'quran', name: 'القرآن الكريم', icon: BookOpen },
  { key: 'music', name: 'الموسيقى', icon: Music },
  { key: 'night', name: 'عائلتي', icon: Sparkles },
];

export interface FolderTreePreviewProps {
  rootFolderName: string;
  watchlists: Watchlist[];
  onUpdateWatchlists?: (updated: Watchlist[]) => void;
}

export const FolderTreePreview: React.FC<FolderTreePreviewProps> = ({ 
  rootFolderName, 
  watchlists,
  onUpdateWatchlists
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { root: true };
    watchlists.forEach((w) => {
      initial[`w-${w.id}`] = true;
      if (w.seasons) {
        w.seasons.forEach((_, idx) => {
          initial[`s-${w.id}-${idx}`] = true;
        });
      }
    });
    return initial;
  });

  const [draggedItem, setDraggedItem] = useState<{
    type: 'watchlist' | 'season';
    watchlistId: string;
    seasonIndex?: number;
  } | null>(null);

  const [dragOverItem, setDragOverItem] = useState<{
    type: 'watchlist' | 'season';
    watchlistId: string;
    seasonIndex?: number;
  } | null>(null);

  const toggleNode = (nodeId: string) => {
    setExpanded(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = { root: true };
    watchlists.forEach((w) => {
      next[`w-${w.id}`] = true;
      if (w.seasons) {
        w.seasons.forEach((_, idx) => {
          next[`s-${w.id}-${idx}`] = true;
        });
      }
    });
    setExpanded(next);
  };

  const collapseAll = () => {
    setExpanded({ root: true });
  };

  // Reorder season helper
  const moveSeason = (watchlistId: string, fromIndex: number, toIndex: number) => {
    if (!onUpdateWatchlists) return;
    const updated = watchlists.map((w) => {
      if (w.id === watchlistId && w.seasons) {
        if (toIndex < 0 || toIndex >= w.seasons.length) return w;
        const newSeasons = [...w.seasons];
        const [moved] = newSeasons.splice(fromIndex, 1);
        newSeasons.splice(toIndex, 0, moved);

        const updatedFiles = newSeasons.flatMap((s) => s.files);

        return {
          ...w,
          seasons: newSeasons,
          files: updatedFiles.length > 0 ? updatedFiles : w.files
        };
      }
      return w;
    });
    onUpdateWatchlists(updated);
  };

  // Reorder watchlist helper
  const moveWatchlist = (fromIndex: number, toIndex: number) => {
    if (!onUpdateWatchlists) return;
    if (toIndex < 0 || toIndex >= watchlists.length) return;
    const updated = [...watchlists];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onUpdateWatchlists(updated);
  };

  // Season Drag & Drop Handlers
  const handleSeasonDragStart = (e: React.DragEvent, watchlistId: string, seasonIndex: number) => {
    e.stopPropagation();
    setDraggedItem({ type: 'season', watchlistId, seasonIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSeasonDragOver = (e: React.DragEvent, watchlistId: string, seasonIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItem && draggedItem.type === 'season' && draggedItem.watchlistId === watchlistId) {
      if (draggedItem.seasonIndex !== seasonIndex) {
        setDragOverItem({ type: 'season', watchlistId, seasonIndex });
      }
    }
  };

  const handleSeasonDrop = (e: React.DragEvent, targetWatchlistId: string, targetSeasonIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      draggedItem &&
      draggedItem.type === 'season' &&
      draggedItem.watchlistId === targetWatchlistId &&
      draggedItem.seasonIndex !== undefined
    ) {
      moveSeason(targetWatchlistId, draggedItem.seasonIndex, targetSeasonIndex);
    }
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Watchlist Drag & Drop Handlers
  const handleWatchlistDragStart = (e: React.DragEvent, watchlistId: string, wIdx: number) => {
    e.stopPropagation();
    setDraggedItem({ type: 'watchlist', watchlistId, seasonIndex: wIdx });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleWatchlistDragOver = (e: React.DragEvent, watchlistId: string, wIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItem && draggedItem.type === 'watchlist') {
      if (draggedItem.seasonIndex !== wIdx) {
        setDragOverItem({ type: 'watchlist', watchlistId, seasonIndex: wIdx });
      }
    }
  };

  const handleWatchlistDrop = (e: React.DragEvent, targetWIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItem && draggedItem.type === 'watchlist' && draggedItem.seasonIndex !== undefined) {
      moveWatchlist(draggedItem.seasonIndex, targetWIdx);
    }
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const totalSeasons = watchlists.reduce((acc, w) => acc + (w.seasons ? w.seasons.length : 1), 0);
  const totalFiles = watchlists.reduce((acc, w) => acc + w.episodesCount, 0);

  return (
    <div 
      onClick={(e) => e.stopPropagation()} 
      className="w-full bg-slate-950/90 border border-purple-500/30 rounded-3xl p-4 sm:p-5 text-right shadow-2xl space-y-3 my-4 relative z-20"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-400/30 text-purple-300">
            <FolderTree className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h4 className="font-extrabold text-white text-base flex items-center gap-2">
              <span>شجرة المحتوى والتقسيم الهيكلي</span>
              <span className="text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 rounded-full">
                معاينة المجلدات
              </span>
            </h4>
            <p className="text-xs text-white/60">
              يمكنك سحب وإفلات المواسم أو استخدام الأسهم لإعادة ترتيب المواسم قبل الحفظ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); expandAll(); }}
            className="text-[11px] bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1 shadow-md relative z-30"
          >
            <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
            <span>توسيع الكل</span>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); collapseAll(); }}
            className="text-[11px] bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1 shadow-md relative z-30"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>طي الكل</span>
          </button>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="bg-purple-500/20 border border-purple-400/30 text-purple-200 px-3 py-1 rounded-xl font-bold flex items-center gap-1.5">
          <Tv className="w-3.5 h-3.5 text-amber-400" />
          {watchlists.length} قائمة تشغيل (مسلسل)
        </span>
        <span className="bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 px-3 py-1 rounded-xl font-bold flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-300" />
          إجمالي المواسم: {totalSeasons}
        </span>
        <span className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 px-3 py-1 rounded-xl font-bold flex items-center gap-1.5">
          <FileVideo className="w-3.5 h-3.5 text-emerald-400" />
          إجمالي الحلقات: {totalFiles}
        </span>
        <span className="bg-amber-500/10 border border-amber-400/20 text-amber-300 px-2.5 py-1 rounded-xl text-[11px] font-medium mr-auto hidden sm:inline-flex items-center gap-1">
          <GripVertical className="w-3 h-3" />
          اسحب المجلدات لإعادة ترتيب المواسم
        </span>
      </div>

      {/* Tree View with Scrollbar */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-black/90 border border-white/10 rounded-2xl p-3 sm:p-4 max-h-80 sm:max-h-96 overflow-y-auto font-sans text-xs text-right space-y-2 dir-rtl relative z-20 touch-pan-y shadow-inner"
        style={{ maxHeight: '380px', overflowY: 'auto' }}
      >
        {/* Root Node */}
        <div className="space-y-2">
          <div 
            onClick={(e) => { e.stopPropagation(); toggleNode('root'); }}
            className="flex items-center gap-2 text-amber-300 font-extrabold cursor-pointer hover:bg-white/10 p-2 rounded-xl transition-colors bg-amber-500/10 border border-amber-500/20"
          >
            {expanded['root'] ? <ChevronDown className="w-4 h-4 shrink-0 text-amber-400" /> : <ChevronLeft className="w-4 h-4 shrink-0 text-amber-400" />}
            <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm truncate">{rootFolderName}</span>
            <span className="text-[10px] text-amber-200/70 font-normal bg-amber-500/20 px-2 py-0.5 rounded-md mr-auto shrink-0 border border-amber-400/20">
              المجلد الرئيسي المستورد
            </span>
          </div>

          {/* Level 1 Nodes: Playlists / Shows */}
          {expanded['root'] && (
            <div className="pr-3 sm:pr-4 border-r-2 border-purple-500/30 space-y-2 mr-2">
              {watchlists.map((w, wIdx) => {
                const wKey = `w-${w.id}`;
                const isWExpanded = !!expanded[wKey];
                const hasSeasons = w.seasons && w.seasons.length > 0;
                const isWatchlistDragged = draggedItem?.type === 'watchlist' && draggedItem.seasonIndex === wIdx;
                const isWatchlistDragOver = dragOverItem?.type === 'watchlist' && dragOverItem.seasonIndex === wIdx;

                return (
                  <div 
                    key={w.id} 
                    draggable={watchlists.length > 1}
                    onDragStart={(e) => watchlists.length > 1 && handleWatchlistDragStart(e, w.id, wIdx)}
                    onDragOver={(e) => watchlists.length > 1 && handleWatchlistDragOver(e, w.id, wIdx)}
                    onDrop={(e) => watchlists.length > 1 && handleWatchlistDrop(e, wIdx)}
                    className={`space-y-1.5 transition-all rounded-2xl ${
                      isWatchlistDragged ? 'opacity-40 scale-98 border-2 border-dashed border-amber-400' : ''
                    } ${
                      isWatchlistDragOver ? 'ring-2 ring-purple-400 bg-purple-500/20' : ''
                    }`}
                  >
                    {/* Show / Watchlist Node Header */}
                    <div 
                      onClick={(e) => { e.stopPropagation(); toggleNode(wKey); }}
                      className="flex items-center justify-between gap-2 bg-white/5 hover:bg-white/10 p-2 sm:p-2.5 rounded-xl cursor-pointer border border-white/10 transition-all group"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        {watchlists.length > 1 && (
                          <div 
                            className="text-white/40 group-hover:text-amber-400 cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded transition-colors"
                            title="اسحب لإعادة ترتيب المسلسلات"
                          >
                            <GripVertical className="w-4 h-4 shrink-0" />
                          </div>
                        )}
                        {isWExpanded ? <ChevronDown className="w-3.5 h-3.5 text-amber-300 shrink-0" /> : <ChevronLeft className="w-3.5 h-3.5 text-white/60 shrink-0" />}
                        <Tv className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-bold text-white text-xs sm:text-sm truncate">{w.title}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {watchlists.length > 1 && (
                          <div className="flex items-center gap-0.5 bg-black/40 border border-white/10 rounded-lg p-0.5 ml-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); moveWatchlist(wIdx, wIdx - 1); }}
                              disabled={wIdx === 0}
                              className="p-1 text-white/70 hover:text-white disabled:opacity-30 disabled:hover:text-white/70 hover:bg-white/10 rounded transition-colors cursor-pointer"
                              title="تحريك لأعلى"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); moveWatchlist(wIdx, wIdx + 1); }}
                              disabled={wIdx === watchlists.length - 1}
                              className="p-1 text-white/70 hover:text-white disabled:opacity-30 disabled:hover:text-white/70 hover:bg-white/10 rounded transition-colors cursor-pointer"
                              title="تحريك لأسفل"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <span className="bg-purple-500/30 text-purple-200 border border-purple-400/30 text-[10px] px-2 py-0.5 rounded-md font-bold">
                          قائمة تشغيل
                        </span>
                        {hasSeasons && (
                          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                            <Layers className="w-3 h-3 text-indigo-400" />
                            <span>{w.seasons!.length} {w.seasons!.length === 1 ? 'موسم' : 'مواسم'}</span>
                          </span>
                        )}
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] px-2 py-0.5 rounded-md font-extrabold">
                          {w.episodesCount} حلقة
                        </span>
                      </div>
                    </div>

                    {/* Level 2 Nodes: Seasons or Files */}
                    {isWExpanded && (
                      <div className="pr-3 sm:pr-4 border-r-2 border-indigo-500/30 space-y-2 mr-2 pt-1 pb-1">
                        {hasSeasons ? (
                          w.seasons!.map((s, sIdx) => {
                            const sKey = `s-${w.id}-${sIdx}`;
                            const isSExpanded = !!expanded[sKey];
                            const isSeasonDragged = draggedItem?.type === 'season' && draggedItem.watchlistId === w.id && draggedItem.seasonIndex === sIdx;
                            const isSeasonDragOver = dragOverItem?.type === 'season' && dragOverItem.watchlistId === w.id && dragOverItem.seasonIndex === sIdx;

                            return (
                              <div 
                                key={sIdx} 
                                draggable
                                onDragStart={(e) => handleSeasonDragStart(e, w.id, sIdx)}
                                onDragOver={(e) => handleSeasonDragOver(e, w.id, sIdx)}
                                onDrop={(e) => handleSeasonDrop(e, w.id, sIdx)}
                                className={`space-y-1 transition-all rounded-xl border ${
                                  isSeasonDragged ? 'opacity-40 border-amber-400 border-dashed bg-amber-500/10' : 'border-white/5'
                                } ${
                                  isSeasonDragOver ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/50' : ''
                                }`}
                              >
                                {/* Season Node Header */}
                                <div 
                                  onClick={(e) => { e.stopPropagation(); toggleNode(sKey); }}
                                  className="flex items-center justify-between gap-2 bg-slate-900/80 hover:bg-white/10 p-2 rounded-lg cursor-pointer text-white/90 transition-all group"
                                >
                                  <div className="flex items-center gap-2 truncate min-w-0">
                                    <div 
                                      className="text-white/40 group-hover:text-amber-400 cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded transition-colors shrink-0"
                                      title="اسحب لإعادة ترتيب هذا الموسم"
                                    >
                                      <GripVertical className="w-3.5 h-3.5" />
                                    </div>
                                    {isSExpanded ? <ChevronDown className="w-3 h-3 text-indigo-300 shrink-0" /> : <ChevronLeft className="w-3 h-3 text-white/50 shrink-0" />}
                                    <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span className="font-bold text-xs text-indigo-200 truncate">{s.name}</span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Reorder Buttons */}
                                    <div className="flex items-center gap-0.5 bg-black/60 border border-white/10 rounded-md p-0.5">
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); moveSeason(w.id, sIdx, sIdx - 1); }}
                                        disabled={sIdx === 0}
                                        className="p-1 text-white/70 hover:text-white disabled:opacity-30 disabled:hover:text-white/70 hover:bg-white/10 rounded transition-colors cursor-pointer"
                                        title="تقديم الموسم لأعلى"
                                      >
                                        <ArrowUp className="w-3 h-3 text-amber-300" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); moveSeason(w.id, sIdx, sIdx + 1); }}
                                        disabled={sIdx === w.seasons!.length - 1}
                                        className="p-1 text-white/70 hover:text-white disabled:opacity-30 disabled:hover:text-white/70 hover:bg-white/10 rounded transition-colors cursor-pointer"
                                        title="تأخير الموسم لأسفل"
                                      >
                                        <ArrowDown className="w-3 h-3 text-amber-300" />
                                      </button>
                                    </div>

                                    <span className="text-[10px] text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 px-2 py-0.5 rounded-md font-semibold shrink-0">
                                      موسم ({s.files.length} حلقة)
                                    </span>
                                  </div>
                                </div>

                                {/* Level 3 Nodes: Episodes */}
                                {isSExpanded && (
                                  <div className="pr-3 border-r border-white/10 space-y-0.5 mr-2 py-1">
                                    {s.files.map((f, fIdx) => {
                                      const isAudio = f.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|wma)$/i) || (f.type && f.type.startsWith('audio/'));
                                      const matchEpi = f.name.match(/(?:الحلقة|ep|episode)[\s_.-]*(\d+)/i);
                                      const epiTag = matchEpi ? `الحلقة ${matchEpi[1]}` : null;
                                      return (
                                        <div key={fIdx} className="flex items-center justify-between gap-2 text-[11px] text-white/70 py-1.5 px-2 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/5">
                                          <div className="flex items-center gap-2 overflow-hidden">
                                            {isAudio ? <FileAudio className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <FileVideo className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                            <span className="truncate font-mono dir-ltr text-right text-white/80">{f.name}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            {epiTag && <span className="bg-white/10 text-white/90 text-[9px] px-1.5 py-0.5 rounded font-bold">{epiTag}</span>}
                                            {isAudio ? (
                                              <span className="bg-blue-500/20 text-blue-300 text-[9px] px-1.5 py-0.5 rounded font-bold border border-blue-500/30">صوت 🎵</span>
                                            ) : (
                                              <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">فيديو 🎬</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="space-y-0.5 py-1">
                            {w.files.map((f, fIdx) => {
                              const isAudio = f.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|wma)$/i) || (f.type && f.type.startsWith('audio/'));
                              const matchEpi = f.name.match(/(?:الحلقة|ep|episode)[\s_.-]*(\d+)/i);
                              const epiTag = matchEpi ? `الحلقة ${matchEpi[1]}` : null;
                              return (
                                <div key={fIdx} className="flex items-center justify-between gap-2 text-[11px] text-white/70 py-1.5 px-2 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/5">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    {isAudio ? <FileAudio className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <FileVideo className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                    <span className="truncate font-mono dir-ltr text-right text-white/80">{f.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {epiTag && <span className="bg-white/10 text-white/90 text-[9px] px-1.5 py-0.5 rounded font-bold">{epiTag}</span>}
                                    {isAudio ? (
                                      <span className="bg-blue-500/20 text-blue-300 text-[9px] px-1.5 py-0.5 rounded font-bold border border-blue-500/30">صوت 🎵</span>
                                    ) : (
                                      <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">فيديو 🎬</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper to build Watchlists automatically from folder hierarchy
export const buildWatchlistsFromFiles = (
  allFiles: File[], 
  rootFolderName: string, 
  targetMode: Mode = 'family', 
  section: string = 'عام'
): Watchlist[] => {
  if (!allFiles || allFiles.length === 0) return [];

  const getRelativeParts = (file: File): string[] => {
    const rawPath = (file as any).customPath || file.webkitRelativePath || file.name || '';
    let parts = rawPath.split('/').filter(Boolean);
    if (parts.length > 0 && parts[0].toLowerCase() === rootFolderName.toLowerCase()) {
      parts.shift();
    }
    return parts.length > 0 ? parts : [file.name];
  };

  const maxPartsLength = Math.max(...allFiles.map(f => getRelativeParts(f).length));
  
  const topLevelFolders = Array.from(new Set(
    allFiles
      .map(f => getRelativeParts(f))
      .filter(parts => parts.length > 1)
      .map(parts => parts[0])
  ));

  const isMultiShowContainer = topLevelFolders.length > 1 || (topLevelFolders.length === 1 && maxPartsLength >= 3);

  if (isMultiShowContainer) {
    const showsMap = new Map<string, File[]>();
    const rootDirectFiles: File[] = [];

    allFiles.forEach(file => {
      const parts = getRelativeParts(file);
      if (parts.length > 1) {
        const showName = parts[0];
        if (!showsMap.has(showName)) showsMap.set(showName, []);
        showsMap.get(showName)!.push(file);
      } else {
        rootDirectFiles.push(file);
      }
    });

    const watchlists: Watchlist[] = [];

    showsMap.forEach((showFiles, showName) => {
      const sortedFiles = sortSmartMediaFiles(showFiles);
      const seasonsMap = new Map<string, File[]>();
      const looseFiles: File[] = [];

      sortedFiles.forEach(f => {
        const parts = getRelativeParts(f);
        if (parts.length >= 3) {
          const seasonName = parts[1];
          if (!seasonsMap.has(seasonName)) seasonsMap.set(seasonName, []);
          seasonsMap.get(seasonName)!.push(f);
        } else {
          looseFiles.push(f);
        }
      });

      const seasons = Array.from(seasonsMap.entries())
        .map(([name, sFiles]) => ({ name, files: sortSmartMediaFiles(sFiles) }))
        .sort((a, b) => naturalCompare(a.name, b.name));

      let finalSeasons = seasons.length > 0 ? seasons : undefined;
      if (finalSeasons && looseFiles.length > 0) {
        finalSeasons = [{ name: 'الملفات المباشرة', files: sortSmartMediaFiles(looseFiles) }, ...finalSeasons];
      }

      const coverFile = looseFiles[0] || sortedFiles[0];
      const initialCover = coverFile ? getEpisodeInspiredCover(showName, section, sortedFiles) : '';

      watchlists.push({
        id: (Date.now() + Math.random() * 10000).toString(),
        title: showName,
        files: sortedFiles,
        seasons: finalSeasons,
        targetMode,
        section,
        coverImage: initialCover,
        seriesCount: finalSeasons ? finalSeasons.length : 1,
        episodesCount: sortedFiles.length,
        folderName: showName,
        folderPath: `/Media/${rootFolderName}/${showName}`,
        lastWatched: '-',
        progress: 0,
        timeRemaining: `${sortedFiles.length * 45} دقيقة`,
      });
    });

    if (rootDirectFiles.length > 0) {
      const sortedRoot = sortSmartMediaFiles(rootDirectFiles);
      sortedRoot.forEach((rf, idx) => {
        const titleName = rf.name.replace(/\.[^/.]+$/, "");
        watchlists.unshift({
          id: (Date.now() + 9000 + idx + Math.random() * 100).toString(),
          title: titleName,
          files: [rf],
          targetMode,
          section,
          coverImage: generateVideoCardPoster(titleName, rf.name),
          seriesCount: 1,
          episodesCount: 1,
          isSingleFile: true,
          folderName: rootFolderName,
          folderPath: `/Media/${rootFolderName}`,
          lastWatched: '-',
          progress: 0,
          timeRemaining: `فيديو مفرد 🎬`,
        });
      });
    }

    return watchlists;

  } else {
    // Single show folder
    const seasonsMap = new Map<string, File[]>();
    const looseFiles: File[] = [];

    allFiles.forEach(f => {
      const parts = getRelativeParts(f);
      if (parts.length >= 2) {
        const seasonName = parts[0];
        if (!seasonsMap.has(seasonName)) seasonsMap.set(seasonName, []);
        seasonsMap.get(seasonName)!.push(f);
      } else {
        looseFiles.push(f);
      }
    });

    const seasons = Array.from(seasonsMap.entries())
      .map(([name, sFiles]) => ({ name, files: sortSmartMediaFiles(sFiles) }))
      .sort((a, b) => naturalCompare(a.name, b.name));

    let finalSeasons = seasons.length > 0 ? seasons : undefined;
    if (finalSeasons && looseFiles.length > 0) {
      finalSeasons = [{ name: 'الملفات المباشرة', files: sortSmartMediaFiles(looseFiles) }, ...finalSeasons];
    }

    const sortedAllFiles = sortSmartMediaFiles(allFiles);
    const coverFile = looseFiles[0] || sortedAllFiles[0];
    const initialCover = coverFile ? getEpisodeInspiredCover(rootFolderName, section, sortedAllFiles) : '';

    const isSingle = false; // Never treat as single file when importing a folder
    return [{
      id: (Date.now()).toString(),
      title: isSingle ? sortedAllFiles[0].name.replace(/\.[^/.]+$/, "") : rootFolderName,
      files: sortedAllFiles,
      seasons: finalSeasons,
      targetMode,
      section,
      coverImage: initialCover,
      seriesCount: finalSeasons ? finalSeasons.length : 1,
      episodesCount: sortedAllFiles.length,
      isSingleFile: isSingle,
      folderName: rootFolderName,
      folderPath: `/Media/${rootFolderName}`,
      lastWatched: '-',
      progress: 0,
      timeRemaining: isSingle ? 'فيديو مفرد 🎬' : `${sortedAllFiles.length * 45} دقيقة`,
    }];
  }
};

interface CreateWatchlistViewProps {
  onAddWatchlist: (list: Watchlist | Watchlist[]) => void;
  onUpdateWatchlist?: (id: string, updates: Partial<Watchlist>) => void;
  watchlists?: Watchlist[];
  currentMode?: Mode;
  customCategories?: string[];
  onAddCategory?: (category: string) => void;
  onDeleteCategory?: (category: string) => void;
}

export const CreateWatchlistView: React.FC<CreateWatchlistViewProps> = ({ 
  onAddWatchlist,
  onUpdateWatchlist,
  watchlists = [],
  currentMode = 'family',
  customCategories = [],
  onAddCategory,
  onDeleteCategory
}) => {
  const { showAlert } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);

  const [isSingleFileModalOpen, setIsSingleFileModalOpen] = useState(false);

  const [listName, setListName] = useState('');
  const [selectedMode, setSelectedMode] = useState<Mode>(currentMode);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 100, text: '' });
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [importedFolder, setImportedFolder] = useState<string | null>(null);
  const [importedHandle, setImportedHandle] = useState<any>(null);
  const [importedFiles, setImportedFiles] = useState<any[]>([]);
  const [detectedSeasons, setDetectedSeasons] = useState<{ name: string; files: any[] }[]>([]);
  const [parsedWatchlists, setParsedWatchlists] = useState<Watchlist[]>([]);

  useEffect(() => {
    setSelectedMode(currentMode);
  }, [currentMode]);

  const isKidsMode = selectedMode === 'kids';
  
  // Base categories from MODE_SECTIONS (excluding 'الكل') + customCategories
  const baseSections = (MODE_SECTIONS[selectedMode] || MODE_SECTIONS.family).filter(s => s !== 'الكل');
  
  // Unique merged categories list
  const categories = Array.from(new Set([...baseSections, ...customCategories]));

  const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'عام');

  const handleAddIndividualFilesClick = async () => {
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
        const targetFiles = sortSmartMediaFiles(mediaFiles as any);
        if (targetFiles.length > 0) {
          const titleName = targetFiles[0].name.replace(/\.[^/.]+$/, "");
          const folderDisplayName = targetFiles.length === 1 ? titleName : 'ملفات مضافة';
          setImportedFolder(folderDisplayName);
          setImportedFiles(targetFiles as any);
          
          const watchlists = buildWatchlistsFromFiles(targetFiles as any, folderDisplayName, currentMode as Mode, selectedCategory);
          setParsedWatchlists(watchlists);
          
          if (watchlists.length === 1) {
            setListName(watchlists[0].title);
            setDetectedSeasons(watchlists[0].seasons || []);
          } else {
            setListName(folderDisplayName);
            setDetectedSeasons([]);
          }
        }
      }
    } catch (e) {
      console.warn('Tauri open dialog failed, falling back', e);
      if (singleFileInputRef.current) {
        singleFileInputRef.current.value = '';
        singleFileInputRef.current.click();
      }
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
        
        const watchlists = buildWatchlistsFromFiles(targetFiles, folderDisplayName, selectedMode, selectedCategory);
        setParsedWatchlists(watchlists);
        setImportedFolder(folderDisplayName);
        if (!listName) setListName(folderDisplayName);
        setImportedFiles(targetFiles);
        setDetectedSeasons([]);
      }
    }
  };

  const [isParentFolder, setIsParentFolder] = useState<boolean>(true);
  const [isAddedAsParent, setIsAddedAsParent] = useState<boolean>(false);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [selectedMode, customCategories]);

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
      e.stopPropagation();
    }
    try {
      const dirPath = await open({ directory: true });
      if (dirPath && typeof dirPath === 'string') {
        setImportedHandle(dirPath);
        const folderName = dirPath.split(/[/\\]/).pop() || '';
        // Use our new scanner with duplicate prevention
        setIsProcessing(true);
        setImportProgress({ current: 0, total: 100, text: 'بدء الاستيراد...' });
        const newWatchlists = await processMediaDirectory(dirPath, watchlists, (current, total, text) => {
          setImportProgress({ current, total, text });
        });
        setIsProcessing(false);
        
        if (!newWatchlists || newWatchlists.length === 0) {
          console.warn("No valid media files found in the selected directory:", dirPath);
          await showAlert('لم يتم العثور على أي ملفات وسائط (فيديو أو صوت) مدعومة في هذا المجلد.');
          // reset imported folder state so user can try again easily
          setImportedHandle(null);
          setImportedFolder('');
          setParsedWatchlists([]);
          setImportedFiles([]);
          return;
        }

        newWatchlists.forEach(wl => {
          if (selectedMode) wl.targetMode = selectedMode as Mode;
          if (selectedCategory) wl.section = selectedCategory;
        });

        setParsedWatchlists(newWatchlists);
        setImportedFolder(folderName);
        
        // Mock allFiles for UI state if needed, though we just use watchlists now
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
      }
    } catch (e: any) {
      console.warn('Folder selection cancelled or failed:', e);
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
      const watchlists = buildWatchlistsFromFiles(allFiles, folderName, selectedMode, selectedCategory);
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
    if (e.target.files && e.target.files.length > 0) {
      const allFileList = Array.from(e.target.files) as File[];
      const firstPath = allFileList[0].webkitRelativePath || '';
      const folderName = firstPath.split('/')[0] || 'ملفات فردية';

      const mediaFiles = allFileList.filter(file => 
        file.type.startsWith('video/') || 
        file.type.startsWith('audio/') || 
        file.name.match(/\.(mp4|mkv|webm|avi|mov|ts|m4v|flv|wmv|3gp|mp3|m4a|aac|wav|flac|ogg)$/i)
      );
      const targetFiles = mediaFiles.length > 0 ? mediaFiles : allFileList;

      const watchlists = buildWatchlistsFromFiles(targetFiles, folderName, selectedMode, selectedCategory);
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
    }
  };

  const handleSave = async () => {
    if (isProcessing) return;
    if (!importedFolder || parsedWatchlists.length === 0) {
      await showAlert('يرجى اختيار مجلد يحتوي على مقاطع فيديو أو مسلسلات.');
      return;
    }

    setIsProcessing(true);
    setImportProgress({ current: 0, total: parsedWatchlists.length, text: 'جاري الحفظ...' });
    try {
      const finalWatchlists = parsedWatchlists.map(w => ({
        ...w,
        targetMode: selectedMode,
        section: selectedCategory,
        title: parsedWatchlists.length === 1 && listName.trim() ? listName.trim() : w.title
      }));
      // Thumbnails will be lazily extracted by UI components
      
      setImportProgress({ current: 100, total: 100, text: 'اكتمل الحفظ بنجاح!' });

      onAddWatchlist(finalWatchlists);

      setListName('');
      setImportedFolder(null);
      setImportedFiles([]);
      setDetectedSeasons([]);
      setParsedWatchlists([]);

      if (finalWatchlists.length === 1) {
        await showAlert(`تم حفظ قائمة التشغيل "${finalWatchlists[0].title}" بنجاح في تصنيف "${selectedCategory}"! 🎉`);
      } else {
        await showAlert(`تم اكتشاف وتوليد ${finalWatchlists.length} قائمة تشغيل (مسلسلات) بنجاح من مجلد "${importedFolder}"! 🎉`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-4 sm:p-8 lg:p-12 min-h-full flex flex-col relative w-full pb-32 md:pb-12"
    >
      <ProcessingRing 
        isVisible={isProcessing} 
        progress={importProgress.current}
      />
      <h1 className="text-3xl sm:text-5xl font-bold tracking-tight drop-shadow-md mb-2 sm:mb-4">
        {isKidsMode ? 'إضافة محتوى للأطفال 🎈' : 'إضافة قائمة تشغيل جديدة'}
      </h1>
      <p className="text-lg sm:text-xl text-white/70 mb-8 sm:mb-12">
        {isKidsMode 
          ? 'اختر مجلد الكرتون أو البرامج التعليمية وسيتم حفظ جميع المواسم داخل نفس القائمة' 
          : 'اربط مجلداتك المحلية ليتم ترتيب مواسمها وحلقاتها في قائمة تشغيل واحدة'}
      </p>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Form section */}
        <div className="w-full xl:w-[60%] flex flex-col gap-6">
          {/* Mode Selector Card */}
          <div className="glass-card p-6 sm:p-8 rounded-[2rem] space-y-4 border border-amber-400/30 bg-zinc-950/70">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <label className="block text-base font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                <span>اختر وضع المكتبة المستهدف</span>
              </label>
              <span className="text-xs text-amber-300 font-extrabold bg-amber-500/20 border border-amber-400/40 px-3 py-1 rounded-full shadow-md">
                الوضع الحالي: {MODE_OPTIONS.find(m => m.key === selectedMode)?.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
              تحديد الوضع يضمن إدراج هذا المحتوى ضمن تبويب المكتبة المخصص له وتحديث تصنيفات التبويب تلقائياً
            </p>

            <div className="flex flex-wrap gap-2.5 pt-1 justify-center sm:justify-start">
              {MODE_OPTIONS.map((m) => {
                const isSel = selectedMode === m.key;
                const MIcon = m.icon;

                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setSelectedMode(m.key)}
                    className={`p-3 rounded-2xl border text-right flex flex-col items-center justify-center gap-2 transition-all cursor-pointer min-w-[72px] sm:min-w-[85px] flex-grow sm:flex-grow-0 ${
                      isSel
                        ? 'bg-gradient-to-b from-amber-400 via-orange-400 to-amber-500 text-black border-amber-300 shadow-xl scale-105 font-black ring-2 ring-amber-300/50'
                        : 'bg-black/60 text-white/80 border-white/10 hover:border-amber-400/60 hover:bg-zinc-900 hover:text-white'
                    }`}
                  >
                    <MIcon className={`w-5 h-5 ${isSel ? 'text-black font-bold' : 'text-amber-400'}`} />
                    <span className="text-xs text-center font-extrabold truncate w-full">{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-8 rounded-[2rem]">
            <label className="block text-sm font-medium text-white/70 mb-2">اسم القائمة / المسلسل</label>
            <input 
              type="text" 
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder={isKidsMode ? 'مثال: افتح يا سمسم' : 'مثال: صراع العروش'} 
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all text-lg" 
            />
          </div>

          <div className="glass-card p-8 rounded-[2rem]">
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-medium text-white/70">
                التصنيف / التبويب
              </label>
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

            {/* Form to add custom category */}
            {showAddCategoryInput && (
              <form onSubmit={handleAddNewCategorySubmit} className="flex gap-2 mb-4">
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
                  className="bg-white text-black px-4 py-2 rounded-xl text-sm font-bold hover:scale-105 transition-transform"
                >
                  حفظ
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddCategoryInput(false)}
                  className="glass p-2 rounded-xl hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* List of Categories */}
            <div className="flex flex-wrap gap-2.5 max-h-56 overflow-y-auto no-scrollbar">
              {categories.map((tag) => {
                const isCustom = customCategories.includes(tag);
                const isSelected = selectedCategory === tag;
                return (
                  <div 
                    key={tag}
                    className={`group relative flex items-center rounded-full transition-all ${
                      isSelected 
                        ? (isKidsMode ? 'bg-yellow-400 text-black font-extrabold shadow-lg scale-105' : 'bg-white text-black font-semibold shadow-lg') 
                        : 'glass text-white/90 hover:bg-white/20'
                    }`}
                  >
                    <button 
                      type="button"
                      onClick={() => setSelectedCategory(tag)}
                      className="px-5 py-2.5 text-sm"
                    >
                      {tag}
                    </button>
                    {isCustom && onDeleteCategory && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCategory(tag);
                          if (selectedCategory === tag && categories.length > 1) {
                            setSelectedCategory(categories.find(c => c !== tag) || 'عام');
                          }
                        }}
                        className={`p-1 pl-2 hover:text-red-400 transition-colors ${isSelected ? 'text-black/60 hover:text-red-600' : 'text-white/40'}`}
                        title="حذف هذا التصنيف"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="glass-card p-6 rounded-[2rem] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">الدمج الموحد للمواسم</h3>
              <p className="text-white/60 text-xs mt-0.5">يتم تجميع جميع المجلدات الفرعية والمواسم داخل هذه القائمة الواحدة</p>
            </div>
            <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-bold">مُفعّل</div>
          </div>
        </div>

        {/* Drag & Drop Area & Save Button Column */}
        <div className="w-full xl:w-[40%] flex flex-col gap-4 self-start">
          <div 
            onClick={(e) => !importedFolder ? handleAddFolderClick(e) : undefined}
            onDragOver={(e) => e.preventDefault()}
            onDrop={importedFolder ? (e) => e.preventDefault() : handleDrop}
            className={`glass-card rounded-[2rem] border-2 border-dashed ${importedFolder ? 'border-green-500/50 bg-green-500/5 p-4 sm:p-6' : 'border-white/20 hover:border-white/50 hover:bg-white/5 cursor-pointer p-6 sm:p-8'} flex flex-col items-center justify-center text-center group transition-all relative overflow-hidden`}
          >
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          
          {importedFolder ? (
            <>
              <div className="p-6 bg-green-500/20 rounded-full mb-4 text-green-400">
                <CheckCircle2 className="w-16 h-16" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-green-400">تم ربط المجلد بنجاح</h3>
              <p className="text-white/80 mb-4 font-mono bg-black/30 px-4 py-2 rounded-lg">{importedFolder}</p>
              
              {/* Interactive Folder Tree Preview */}
              <FolderTreePreview 
                rootFolderName={importedFolder} 
                watchlists={parsedWatchlists} 
                onUpdateWatchlists={setParsedWatchlists}
              />

              <button 
                onClick={(e) => { e.stopPropagation(); setImportedFolder(null); setDetectedSeasons([]); setParsedWatchlists([]); }}
                className="glass px-6 py-2 rounded-xl text-sm hover:bg-white/10 transition-colors cursor-pointer mt-2"
              >
                تغيير المجلد
              </button>
            </>
          ) : (
            <>
              <div className="p-6 bg-white/5 rounded-full mb-6 group-hover:scale-110 transition-transform duration-500">
                <UploadCloud className="w-20 h-20 text-white/90" />
              </div>
              
              <h3 className="text-3xl font-extrabold mb-8 tracking-wide">اختر المجلد</h3>
              
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center relative z-10">
                <button 
                  type="button"
                  onClick={(e) => handleAddFolderClick(e)}
                  className={`glass px-8 py-5 rounded-2xl flex items-center gap-3 transition-all font-black text-xl shadow-2xl hover:scale-105 active:scale-95 cursor-pointer ${
                    isKidsMode ? 'bg-yellow-400 text-black hover:bg-yellow-300' : 'bg-white/10 hover:bg-white hover:text-black border border-white/20'
                  }`}
                >
                  <FolderPlus className="w-7 h-7" /> 
                  <span>اختيار مجلد كامل</span>
                </button>

                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIsSingleFileModalOpen(true); }}
                  className="glass px-8 py-5 rounded-2xl flex items-center gap-3 transition-all font-black text-xl shadow-2xl hover:scale-105 active:scale-95 cursor-pointer bg-white/5 hover:bg-white hover:text-black border border-white/20 text-white"
                >
                  <FileVideo className="w-7 h-7" /> 
                  <span>إضافة ملف فردي</span>
                </button>
              </div>
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

          <div className="flex flex-col items-center justify-center gap-4 w-full mt-2">
            {isProcessing && (
              <div className="w-full bg-white/10 border border-amber-400/40 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden relative">
                  <div className="bg-amber-400 h-full animate-pulse w-full" />
                </div>
                <span className="text-xs text-amber-300 font-extrabold shrink-0">جاري سحب المحتوى...</span>
              </div>
            )}
            <button 
              onClick={handleSave}
              disabled={isProcessing || !listName.trim() || !importedFolder}
              className={`w-full px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.3)] ${
                isProcessing || !listName.trim() || !importedFolder
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:scale-105 cursor-pointer'
              } ${
                isKidsMode ? 'bg-yellow-400 text-black shadow-yellow-400/20' : 'bg-white text-black'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <span>حفظ القائمة</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <AddSingleFileModal 
        isOpen={isSingleFileModalOpen}
        onClose={() => setIsSingleFileModalOpen(false)}
        currentMode={selectedMode}
        customCategories={customCategories}
        watchlists={watchlists}
        onAddCategory={onAddCategory!}
        onAddWatchlist={onAddWatchlist}
        onUpdateWatchlist={onUpdateWatchlist}
      />
    </motion.div>
  );
};

export default CreateWatchlistView;
