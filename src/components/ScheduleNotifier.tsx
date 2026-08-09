import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WeeklyScheduleEntry, Watchlist, Channel } from '../types';
import { Play, Bell, X, Clock, Tv, Film, RotateCcw, CalendarX, Sparkles, Check, ChevronRight } from 'lucide-react';
import { getChannelNowPlaying } from '../utils/channelEngine';

interface ScheduleNotifierProps {
  schedules: WeeklyScheduleEntry[];
  watchlists: Watchlist[];
  channels: Channel[];
  onPlay: (
    file?: any,
    title?: string,
    watchlistTitle?: string,
    files?: any[],
    index?: number,
    sessionId?: string,
    watchlistId?: string,
    initialTime?: number
  ) => void;
  onUpdateSchedules?: (schedules: WeeklyScheduleEntry[]) => void;
}

export const ScheduleNotifier: React.FC<ScheduleNotifierProps> = ({
  schedules,
  watchlists,
  channels,
  onPlay,
  onUpdateSchedules,
}) => {
  const [activeAlert, setActiveAlert] = useState<{
    entry: WeeklyScheduleEntry;
    watchlist?: Watchlist;
    channel?: Channel;
    minutesLeft: number;
  } | null>(null);

  const [missedAlert, setMissedAlert] = useState<{
    entry: WeeklyScheduleEntry;
    watchlist?: Watchlist;
    channel?: Channel;
  } | null>(null);

  const [notifiedKeys, setNotifiedKeys] = useState<Set<string>>(new Set());
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  // Function to play sound chime + speech announcement
  const playAlertSoundAndSpeech = (title: string) => {
    try {
      // 1. Play TV Announcement Chime via Web Audio API
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        // Sequence of pleasant chime tones (E5 -> G#5 -> B5)
        const notes = [659.25, 830.61, 987.77];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.15);

          gain.gain.setValueAtTime(0, now + idx * 0.15);
          gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.15 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.6);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.15);
          osc.stop(now + idx * 0.15 + 0.6);
        });
      }


    } catch (e) {
      console.warn('Audio/Speech alert failed:', e);
    }
  };

  useEffect(() => {
    const checkSchedule = () => {
      if (!schedules || schedules.length === 0) return;

      const now = new Date();
      const currentDay = now.getDay(); // 0: Sunday, 1: Monday, ... 6: Saturday
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTotalMinutes = currentHours * 60 + currentMinutes;

      const todayStr = now.toISOString().split('T')[0];

      schedules.forEach((slot) => {
        if (slot.dayOfWeek !== currentDay) return;

        const [slotH, slotM] = slot.time.split(':').map(Number);
        if (isNaN(slotH) || isNaN(slotM)) return;

        const slotTotalMinutes = slotH * 60 + slotM;
        const diffMinutes = slotTotalMinutes - currentTotalMinutes;

        // If event is approaching in 0 to 10 minutes
        if (diffMinutes >= 0 && diffMinutes <= 10) {
          const notificationKey = `${todayStr}-${slot.id}-${slot.time}`;

          if (!notifiedKeys.has(notificationKey)) {
            // Check if Do Not Disturb (DND) / Cinema Mode is active
            const isDndActive = localStorage.getItem('app_dnd_enabled') === 'true';
            if (isDndActive) {
              return;
            }

            // Find linked watchlist or channel
            const linkedChannel = channels.find((c) => c.id === slot.channelId);
            const linkedWl = watchlists.find(
              (w) =>
                w.id === slot.watchlistId ||
                w.title.toLowerCase().includes(slot.title.toLowerCase())
            );

            setActiveAlert({
              entry: slot,
              watchlist: linkedWl,
              channel: linkedChannel,
              minutesLeft: diffMinutes,
            });

            setNotifiedKeys((prev) => new Set(prev).add(notificationKey));
            playAlertSoundAndSpeech(slot.title);
          }
        }
      });

      // Check for missed slots earlier today that were not watched and not yet dismissed in session
      if (!missedAlert) {
        const missedSlot = schedules.find((slot) => {
          if (slot.dayOfWeek !== currentDay) return false;
          if (slot.isWatched) return false;

          const [slotH, slotM] = slot.time.split(':').map(Number);
          if (isNaN(slotH) || isNaN(slotM)) return false;

          const slotTotalMinutes = slotH * 60 + slotM;
          // Slot time was passed by more than 5 minutes today
          if (currentTotalMinutes - slotTotalMinutes > 5) {
            const dismissed = sessionStorage.getItem(`dismissed_missed_${slot.id}`);
            return !dismissed;
          }
          return false;
        });

        if (missedSlot) {
          const linkedChannel = channels.find((c) => c.id === missedSlot.channelId);
          const linkedWl = watchlists.find(
            (w) =>
              w.id === missedSlot.watchlistId ||
              w.title.toLowerCase().includes(missedSlot.title.toLowerCase())
          );

          setMissedAlert({
            entry: missedSlot,
            watchlist: linkedWl,
            channel: linkedChannel,
          });
        }
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 20000); // Check every 20 seconds
    return () => clearInterval(interval);
  }, [schedules, watchlists, channels, notifiedKeys]);

  // Option 1: WATCH NOW
  const handlePlayNow = () => {
    if (!activeAlert) return;

    const { channel, entry } = activeAlert;
    
    // Check if it's a direct Watchlist stream (no channel)
    if (entry.watchlistId && !entry.channelId) {
      const targetWatchlist = watchlists.find(w => w.id === entry.watchlistId);
      if (targetWatchlist) {
        const allFiles = targetWatchlist.seasons && targetWatchlist.seasons.length > 0
          ? targetWatchlist.seasons.flatMap(s => s.files || [])
          : targetWatchlist.files || [];
          
        if (allFiles.length > 0) {
          const epIndex = (entry.episodeIndex || 0) % allFiles.length;
          const fileToPlay = allFiles[epIndex];

          onPlay(
            fileToPlay,
            fileToPlay.title || `حلقة ${epIndex + 1}`,
            targetWatchlist.title,
            allFiles,
            epIndex,
            targetWatchlist.coverUrl,
            targetWatchlist.id,
            0,
            undefined
          );
        }
      }
    } else {
      // Live Channel stream
      const targetChannel = channel || channels.find(c => c.id === entry.channelId) || channels[0];

      if (targetChannel) {
        const nowPlaying = getChannelNowPlaying(targetChannel, watchlists);
        if (nowPlaying) {
          onPlay(
            nowPlaying.currentFile,
            nowPlaying.currentEpisodeTitle,
            `${targetChannel.title} - ${nowPlaying.currentWatchlistTitle}`,
            nowPlaying.allFiles,
            nowPlaying.currentEpisodeIndex,
            undefined,
            nowPlaying.currentWatchlistId,
            nowPlaying.initialTime,
            targetChannel.id
          );
        } else {
          // Fallback to active alert watchlist or first watchlist if present
          const linkedWl = watchlists.find(w => w.id === entry.watchlistId) || watchlists[0];
          if (linkedWl) {
            const files = [...(linkedWl.files || []), ...(linkedWl.seasons?.flatMap(s => s.files || []) || [])];
            if (files.length > 0) {
              onPlay(files[0], files[0]?.name || files[0]?.title || 'فيديو مباشر', targetChannel.title, files, 0, undefined, linkedWl.id, 0, targetChannel.id);
            }
          }
        }
      }
    }

    setShowSnoozeMenu(false);
    setActiveAlert(null);
  };

  // Option 2: POSTPONE / SNOOZE (تأجيل)
  const handleSnoozeMinutes = (minutesToDelay: number) => {
    if (!activeAlert) return;

    const { entry } = activeAlert;
    const [h, m] = entry.time.split(':').map(Number);
    let totalM = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m) + minutesToDelay;
    totalM = totalM % (24 * 60);

    const newH = String(Math.floor(totalM / 60)).padStart(2, '0');
    const newM = String(totalM % 60).padStart(2, '0');
    const newTimeStr = `${newH}:${newM}`;

    if (onUpdateSchedules && schedules) {
      const updatedSchedules = schedules.map(s => {
        if (s.id === entry.id) {
          return { ...s, time: newTimeStr };
        }
        return s;
      });
      onUpdateSchedules(updatedSchedules);
    }

    setShowSnoozeMenu(false);
    setActiveAlert(null);

    // Announce delay
    try {
    } catch {}
  };

  // Option 3: CANCEL (إلغاء الموعد)
  const handleCancelSlot = () => {
    if (!activeAlert) return;

    const { entry } = activeAlert;

    // Suppress notification for today & remove from schedule if updater provided
    const todayStr = new Date().toISOString().split('T')[0];
    const key = `${todayStr}-${entry.id}-${entry.time}`;
    setNotifiedKeys(prev => new Set(prev).add(key));

    setShowSnoozeMenu(false);
    setActiveAlert(null);

    try {
    } catch {}
  };

  // Missed alert handlers
  const handlePlayMissedNow = () => {
    if (!missedAlert) return;
    const { watchlist, entry } = missedAlert;

    // Mark current slot as watched
    if (onUpdateSchedules && schedules) {
      const updatedSchedules = schedules.map((s) => {
        if (s.id === entry.id) {
          return {
            ...s,
            isWatched: true,
            watchedAtDayOfWeek: entry.dayOfWeek,
            watchedAtDate: new Date().toISOString(),
          };
        }
        return s;
      });
      onUpdateSchedules(updatedSchedules);
    }

    sessionStorage.setItem(`dismissed_missed_${entry.id}`, 'true');

    if (watchlist) {
      const allFiles = [
        ...(watchlist.files || []),
        ...(watchlist.seasons?.flatMap((s) => s.files || []) || []),
      ];
      if (allFiles.length > 0) {
        const epIdx = entry.episodeIndex !== undefined ? entry.episodeIndex : (watchlist.lastWatchedIndex || 0);
        const safeIdx = Math.min(allFiles.length - 1, Math.max(0, epIdx));
        const file = allFiles[safeIdx];
        const startOffsetSec = entry.startTimeOffset !== undefined ? entry.startTimeOffset : (watchlist.lastWatchedTime || 0);

        onPlay(
          file,
          file?.name || file?.title || `الحلقة ${safeIdx + 1}`,
          watchlist.title,
          allFiles,
          safeIdx,
          undefined,
          watchlist.id,
          startOffsetSec
        );
      }
    } else if (missedAlert.channel) {
      const ch = missedAlert.channel;
      const linkedLists = watchlists.filter((w) => ch.playlistIds?.includes(w.id));
      if (linkedLists.length > 0) {
        const firstWl = linkedLists[0];
        const allFiles = [
          ...(firstWl.files || []),
          ...(firstWl.seasons?.flatMap((s) => s.files || []) || []),
        ];
        if (allFiles.length > 0) {
          const epIdx = entry.episodeIndex !== undefined ? entry.episodeIndex : 0;
          const safeIdx = Math.min(allFiles.length - 1, Math.max(0, epIdx));
          const startOffsetSec = entry.startTimeOffset !== undefined ? entry.startTimeOffset : 0;

          onPlay(
            allFiles[safeIdx],
            allFiles[safeIdx]?.name || `المقطع ${safeIdx + 1}`,
            `${ch.title} - ${firstWl.title}`,
            allFiles,
            safeIdx,
            undefined,
            firstWl.id,
            startOffsetSec
          );
        }
      }
    }

    setMissedAlert(null);
  };

  const handlePostponeMissed = (minutesToDelay: number) => {
    if (!missedAlert) return;
    const { entry } = missedAlert;

    const now = new Date();
    let totalM = now.getHours() * 60 + now.getMinutes() + minutesToDelay;
    totalM = totalM % (24 * 60);

    const newH = String(Math.floor(totalM / 60)).padStart(2, '0');
    const newM = String(totalM % 60).padStart(2, '0');
    const newTimeStr = `${newH}:${newM}`;

    if (onUpdateSchedules && schedules) {
      const updatedSchedules = schedules.map((s) => {
        if (s.id === entry.id) {
          return { ...s, time: newTimeStr };
        }
        return s;
      });
      onUpdateSchedules(updatedSchedules);
    }

    sessionStorage.setItem(`dismissed_missed_${entry.id}`, 'true');
    setMissedAlert(null);
  };

  const handleDismissMissed = () => {
    if (!missedAlert) return;
    sessionStorage.setItem(`dismissed_missed_${missedAlert.entry.id}`, 'true');
    setMissedAlert(null);
  };

  if (!activeAlert && !missedAlert) return null;

  const coverImg =
    activeAlert?.watchlist?.coverImage || activeAlert?.channel?.bgCover || '';

  return (
    <>
      {/* 1. Active Schedule Alert Modal */}
      <AnimatePresence>
        {activeAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl dir-rtl text-right">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="w-full max-w-lg bg-zinc-950 rounded-3xl border border-amber-400/60 p-6 sm:p-7 shadow-[0_0_80px_rgba(245,158,11,0.35)] relative overflow-hidden"
            >
              {/* Animated Glow Border */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 animate-pulse" />

              {/* Header Tag */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                  <span className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 fill-black" />
                    <span>اقتراب موعد مجدول 📺</span>
                  </span>
                </div>

                <button
                  onClick={() => {
                    setShowSnoozeMenu(false);
                    setActiveAlert(null);
                  }}
                  className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Card Content */}
              <div className="flex gap-4 my-4 items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                {coverImg ? (
                  <img
                    src={coverImg}
                    alt={activeAlert.entry.title}
                    className="w-24 h-32 rounded-xl object-cover border border-white/20 shadow-xl shrink-0"
                  />
                ) : (
                  <div className="w-24 h-32 rounded-xl bg-gradient-to-br from-amber-500/20 via-purple-900/30 to-zinc-900 border border-white/15 flex items-center justify-center shrink-0">
                    <Film className="w-10 h-10 text-amber-300/60" />
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                    <Clock className="w-4 h-4 animate-spin-slow" />
                    <span>
                      {activeAlert.minutesLeft === 0
                        ? 'يبدأ العرض الآن!'
                        : `يبدأ خلال ${activeAlert.minutesLeft} دقائق (الساعة ${activeAlert.entry.time})`}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white leading-tight truncate">
                    {activeAlert.entry.title}
                  </h3>

                  {activeAlert.channel && (
                    <p className="text-xs text-amber-200/80 flex items-center gap-1 font-semibold">
                      <Tv className="w-3.5 h-3.5 text-amber-400" />
                      <span>القناة: {activeAlert.channel.title}</span>
                    </p>
                  )}

                  {activeAlert.watchlist && (
                    <p className="text-xs text-white/60 truncate font-medium">
                      المحتوى: {activeAlert.watchlist.title}
                    </p>
                  )}

                  {activeAlert.entry.episodeIndex !== undefined && (
                    <div className="pt-1 flex items-center gap-2 flex-wrap text-xs font-bold text-amber-200">
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/30">
                        الحلقة {activeAlert.entry.episodeIndex + 1}
                      </span>
                      {activeAlert.entry.startTimeOffset ? (
                        <span className="text-white/60">
                          (بدء من الدقيقة {Math.floor(activeAlert.entry.startTimeOffset / 60)})
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Snooze Sub-Menu Options */}
              <AnimatePresence>
                {showSnoozeMenu && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-2xl bg-purple-950/60 border border-purple-400/40 space-y-2 overflow-hidden"
                  >
                    <div className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                      <span>اختر مدة تأجيل موعد العرض:</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <button
                        onClick={() => handleSnoozeMinutes(15)}
                        className="py-2.5 rounded-xl bg-purple-500/30 hover:bg-purple-500 border border-purple-400/40 text-white font-extrabold transition-all cursor-pointer text-center"
                      >
                        +15 دقيقة
                      </button>
                      <button
                        onClick={() => handleSnoozeMinutes(30)}
                        className="py-2.5 rounded-xl bg-purple-500/30 hover:bg-purple-500 border border-purple-400/40 text-white font-extrabold transition-all cursor-pointer text-center"
                      >
                        +30 دقيقة
                      </button>
                      <button
                        onClick={() => handleSnoozeMinutes(60)}
                        className="py-2.5 rounded-xl bg-purple-500/30 hover:bg-purple-500 border border-purple-400/40 text-white font-extrabold transition-all cursor-pointer text-center"
                      >
                        +1 ساعة
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 3 Main Action Buttons: Watch (مشاهدة), Postpone (تأجيل), Cancel (إلغاء) */}
              <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-3 gap-2.5">
                {/* 1. WATCH (مشاهدة) */}
                <button
                  onClick={handlePlayNow}
                  className="py-3 px-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-extrabold hover:brightness-110 transition-all text-sm flex items-center justify-center gap-1.5 shadow-lg hover:scale-105 active:scale-95 cursor-pointer border border-amber-300"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>{activeAlert?.entry.watchlistId && !activeAlert?.entry.channelId ? 'مشاهدة الموعد' : 'مشاهدة القناة الحية'}</span>
                </button>

                {/* 2. POSTPONE (تأجيل) */}
                <button
                  onClick={() => setShowSnoozeMenu(prev => !prev)}
                  className={`py-3 px-3 rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer border hover:scale-105 active:scale-95 ${
                    showSnoozeMenu
                      ? 'bg-purple-600 text-white border-purple-300 shadow-lg ring-2 ring-purple-400/50'
                      : 'bg-purple-500/20 text-purple-200 border-purple-400/40 hover:bg-purple-500/40'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>تأجيل ⏳</span>
                </button>

                {/* 3. CANCEL (إلغاء) */}
                <button
                  onClick={handleCancelSlot}
                  className="py-3 px-3 rounded-2xl bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30 font-extrabold transition-all text-sm flex items-center justify-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
                >
                  <CalendarX className="w-4 h-4" />
                  <span>إلغاء 🚫</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Non-Intrusive Small Toast Window for Missed Schedule (Bottom-Left) */}
      <AnimatePresence>
        {missedAlert && !activeAlert && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-6 left-6 z-50 max-w-sm w-80 sm:w-96 bg-zinc-950/95 backdrop-blur-2xl border border-amber-500/50 rounded-2xl p-4 shadow-[0_10px_35px_rgba(245,158,11,0.25)] dir-rtl text-right text-white space-y-3 overflow-hidden"
          >
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-purple-500" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Clock className="w-4 h-4 animate-pulse" />
                </span>
                <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                  تلميح: فاتك موعد مجدول 📺
                </span>
              </div>
              <button
                onClick={handleDismissMissed}
                className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-white truncate">
                {missedAlert.entry.title}
              </h4>
              <p className="text-xs text-white/70">
                فاتك موعد عرض هذه الحلقة الساعة{' '}
                <span className="text-amber-300 font-bold">({missedAlert.entry.time})</span>.{' '}
                {missedAlert.entry.episodeIndex !== undefined && (
                  <span className="text-amber-300 font-bold">
                    [الحلقة {missedAlert.entry.episodeIndex + 1}]
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handlePlayMissedNow}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-300"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>مشاهدة الآن</span>
              </button>
              <button
                onClick={() => handlePostponeMissed(30)}
                className="py-2 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 border border-purple-400/30 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تأجيل 30د</span>
              </button>
              <button
                onClick={handleDismissMissed}
                className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-medium text-xs transition-all cursor-pointer"
              >
                تجاهل
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

