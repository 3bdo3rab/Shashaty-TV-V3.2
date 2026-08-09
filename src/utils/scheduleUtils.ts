import { WeeklyScheduleEntry } from '../types';

export const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
};

export const formatMinutesToTime = (totalMins: number): string => {
  const normalized = (totalMins + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Check if two time intervals on the same day overlap.
 * Interval A: [startA, startA + durationA]
 * Interval B: [startB, startB + durationB]
 * Overlap condition: startA < endB && startB < endA
 */
export const checkTimeIntervalOverlap = (
  startMinutesA: number,
  durationMinutesA: number,
  startMinutesB: number,
  durationMinutesB: number
): boolean => {
  const endMinutesA = startMinutesA + Math.max(1, durationMinutesA);
  const endMinutesB = startMinutesB + Math.max(1, durationMinutesB);

  return startMinutesA < endMinutesB && startMinutesB < endMinutesA;
};

/**
 * Finds conflicting slot on the same day if any
 */
export const findScheduleConflict = (
  dayOfWeek: number,
  startTimeStr: string,
  durationMinutes: number,
  allSchedules: WeeklyScheduleEntry[],
  excludeSlotId?: string
): { slot: WeeklyScheduleEntry; existingStartTime: string; existingEndTime: string } | null => {
  const newStart = parseTimeToMinutes(startTimeStr);
  const newDur = Math.max(1, durationMinutes || 60);

  const sameDaySlots = allSchedules.filter(s => s.dayOfWeek === dayOfWeek && s.id !== excludeSlotId);

  for (const slot of sameDaySlots) {
    const existingStart = parseTimeToMinutes(slot.time);
    const existingDur = slot.durationMinutes || 60;
    const existingEndM = existingStart + existingDur;

    if (checkTimeIntervalOverlap(newStart, newDur, existingStart, existingDur)) {
      return {
        slot,
        existingStartTime: slot.time,
        existingEndTime: slot.endTime || formatMinutesToTime(existingEndM)
      };
    }
  }

  return null;
};
