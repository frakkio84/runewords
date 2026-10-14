import {
  addDays,
  formatClock,
  getZonedParts,
  parseClock,
  weekdayFromDateKey,
  zonedLocalToUtc,
} from '../time';

export type WeeklyInterval = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
};

export type SpecialInterval = {
  date: string;
  isClosed: boolean;
  opensAt?: string;
  closesAt?: string;
  validFrom?: string;
  validUntil?: string;
};

/** `weekly === null` means the weekly schedule is unknown, not closed. */
export type Schedule = {
  weekly: WeeklyInterval[] | null;
  specials: SpecialInterval[];
  timeZone: string;
};

export type LocalMoment = {
  dateKey: string;
  minutes: number;
};

export type OpenStatus =
  | { status: 'open'; nextClosing: LocalMoment | null }
  | { status: 'closed'; nextOpening: LocalMoment | null }
  | { status: 'unknown' };

type ClockInterval = { opens: number; closes: number };

type DayDefinition = {
  kind: 'special' | 'weekly' | 'unknown';
  intervals: ClockInterval[];
};

type AbsoluteRange = { start: number; end: number };

const HORIZON_DAYS = 8;

const DAY_NAMES = [
  '',
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato',
  'domenica',
];

function isFullDay(opens: number, closes: number): boolean {
  return (opens === 0 && closes === 0) || (opens === 0 && closes === 1440);
}

function crossesMidnight(opens: number, closes: number): boolean {
  return closes < opens && !isFullDay(opens, closes);
}

export function toClockInterval(opensAt: string, closesAt: string): ClockInterval | null {
  const opens = parseClock(opensAt);
  const closes = parseClock(closesAt);
  if (opens === null || closes === null) return null;
  if (opens === closes && !isFullDay(opens, closes)) return null;
  if (closes === 1440 && opens === 1440) return null;
  return { opens, closes };
}

function appliesToDate(special: SpecialInterval, dateKey: string, timeZone: string): boolean {
  if (special.date !== dateKey) return false;
  if (!special.validFrom && !special.validUntil) return true;
  const start = zonedLocalToUtc(dateKey, 0, timeZone);
  const end = zonedLocalToUtc(addDays(dateKey, 1), 0, timeZone);
  if (!start || !end) return false;
  const from = special.validFrom ? Date.parse(special.validFrom) : Number.NEGATIVE_INFINITY;
  const until = special.validUntil ? Date.parse(special.validUntil) : Number.POSITIVE_INFINITY;
  if (Number.isNaN(from) || Number.isNaN(until)) return false;
  return from < end.getTime() && until > start.getTime();
}

function clockFromSpecials(specials: SpecialInterval[]): ClockInterval[] {
  if (specials.some((special) => special.isClosed && !special.opensAt && !special.closesAt)) {
    return [];
  }
  const intervals: ClockInterval[] = [];
  for (const special of specials) {
    if (!special.opensAt || !special.closesAt) continue;
    const clock = toClockInterval(special.opensAt, special.closesAt);
    if (clock) intervals.push(clock);
  }
  return intervals;
}

function definitionForDate(schedule: Schedule, dateKey: string): DayDefinition {
  const specials = schedule.specials.filter((special) =>
    appliesToDate(special, dateKey, schedule.timeZone),
  );
  if (specials.length > 0) {
    return { kind: 'special', intervals: clockFromSpecials(specials) };
  }
  if (schedule.weekly === null) return { kind: 'unknown', intervals: [] };
  const weekday = weekdayFromDateKey(dateKey);
  const intervals: ClockInterval[] = [];
  for (const row of schedule.weekly) {
    if (row.dayOfWeek !== weekday) continue;
    const clock = toClockInterval(row.opensAt, row.closesAt);
    if (clock) intervals.push(clock);
  }
  return { kind: 'weekly', intervals };
}

function ownRanges(definition: DayDefinition, dayIndex: number): AbsoluteRange[] {
  if (definition.kind === 'unknown') return [];
  const base = dayIndex * 1440;
  const ranges: AbsoluteRange[] = [];
  for (const interval of definition.intervals) {
    if (isFullDay(interval.opens, interval.closes)) {
      ranges.push({ start: base, end: base + 1440 });
    } else if (interval.closes > interval.opens) {
      ranges.push({ start: base + interval.opens, end: base + interval.closes });
    } else {
      ranges.push({ start: base + interval.opens, end: base + 1440 });
    }
  }
  return ranges;
}

function spillRanges(previous: DayDefinition, dayIndex: number): AbsoluteRange[] {
  if (previous.kind === 'unknown') return [];
  const base = dayIndex * 1440;
  const ranges: AbsoluteRange[] = [];
  for (const interval of previous.intervals) {
    if (crossesMidnight(interval.opens, interval.closes)) {
      ranges.push({ start: base, end: base + interval.closes });
    }
  }
  return ranges;
}

function mergeRanges(ranges: AbsoluteRange[]): AbsoluteRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: AbsoluteRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) merged.push({ ...range });
    else last.end = Math.max(last.end, range.end);
  }
  return merged;
}

function buildRanges(schedule: Schedule, startDateKey: string): AbsoluteRange[] {
  const pieces: AbsoluteRange[] = [];
  for (let dayIndex = 0; dayIndex < HORIZON_DAYS; dayIndex += 1) {
    const dateKey = addDays(startDateKey, dayIndex);
    const today = definitionForDate(schedule, dateKey);
    if (today.kind !== 'special') {
      const previous = definitionForDate(schedule, addDays(dateKey, -1));
      pieces.push(...spillRanges(previous, dayIndex));
    }
    pieces.push(...ownRanges(today, dayIndex));
  }
  return mergeRanges(pieces);
}

function toMoment(startDateKey: string, offset: number): LocalMoment {
  const day = Math.floor(offset / 1440);
  const minutes = offset % 1440;
  return { dateKey: addDays(startDateKey, day), minutes };
}

function closingMoment(
  startDateKey: string,
  range: AbsoluteRange,
): LocalMoment | null {
  if (range.end >= HORIZON_DAYS * 1440) return null;
  return toMoment(startDateKey, range.end);
}

export function isOpenAt(schedule: Schedule, instant: Date): OpenStatus {
  const origin = getZonedParts(instant, schedule.timeZone);
  const minutes = origin.hour * 60 + origin.minute;
  const today = definitionForDate(schedule, origin.dateKey);
  const ranges = buildRanges(schedule, origin.dateKey);
  const current = ranges.find((range) => minutes >= range.start && minutes < range.end);
  if (current) {
    return { status: 'open', nextClosing: closingMoment(origin.dateKey, current) };
  }
  if (today.kind === 'unknown') return { status: 'unknown' };
  const next = ranges.find((range) => range.start > minutes);
  return {
    status: 'closed',
    nextOpening: next ? toMoment(origin.dateKey, next.start) : null,
  };
}

export function getNextOpening(schedule: Schedule, instant: Date): LocalMoment | null {
  const origin = getZonedParts(instant, schedule.timeZone);
  const minutes = origin.hour * 60 + origin.minute;
  const ranges = buildRanges(schedule, origin.dateKey);
  const current = ranges.find((range) => minutes >= range.start && minutes < range.end);
  if (current) {
    const following = ranges.find((range) => range.start >= current.end);
    return following ? toMoment(origin.dateKey, following.start) : null;
  }
  const next = ranges.find((range) => range.start > minutes);
  return next ? toMoment(origin.dateKey, next.start) : null;
}

export function getNextClosing(schedule: Schedule, instant: Date): LocalMoment | null {
  const origin = getZonedParts(instant, schedule.timeZone);
  const minutes = origin.hour * 60 + origin.minute;
  const ranges = buildRanges(schedule, origin.dateKey);
  const current = ranges.find((range) => minutes >= range.start && minutes < range.end);
  if (current) return closingMoment(origin.dateKey, current);
  const next = ranges.find((range) => range.start > minutes);
  if (!next || next.end >= HORIZON_DAYS * 1440) return null;
  return toMoment(origin.dateKey, next.end);
}

export function formatWhen(moment: LocalMoment, todayKey: string): string {
  const clock = formatClock(moment.minutes);
  if (moment.dateKey === todayKey) return `alle ${clock}`;
  if (moment.dateKey === addDays(todayKey, 1)) return `domani alle ${clock}`;
  const day = Number(moment.dateKey.slice(8, 10));
  const month = Number(moment.dateKey.slice(5, 7));
  const weekday = DAY_NAMES[weekdayFromDateKey(moment.dateKey)];
  return `${weekday} ${day}/${month} alle ${clock}`;
}

export function describeStatus(status: OpenStatus, todayKey: string): string {
  if (status.status === 'unknown') return 'Orari non disponibili';
  if (status.status === 'open') {
    if (!status.nextClosing) return 'Aperto 24 ore su 24';
    return `Aperto · chiude ${formatWhen(status.nextClosing, todayKey)}`;
  }
  if (!status.nextOpening) return 'Chiuso';
  return `Chiuso · apre ${formatWhen(status.nextOpening, todayKey)}`;
}

export function describeIntervals(intervals: WeeklyInterval[]): string {
  if (intervals.length === 0) return 'Chiuso';
  if (
    intervals.some((interval) => {
      const clock = toClockInterval(interval.opensAt, interval.closesAt);
      return clock !== null && isFullDay(clock.opens, clock.closes);
    })
  ) {
    return 'Aperto 24 ore';
  }
  return intervals.map((interval) => `${interval.opensAt}–${interval.closesAt}`).join(', ');
}

export function validateWeeklyIntervals(intervals: WeeklyInterval[]): string | null {
  const segments: Array<{ day: number; start: number; end: number }> = [];
  for (const interval of intervals) {
    if (!Number.isInteger(interval.dayOfWeek) || interval.dayOfWeek < 1 || interval.dayOfWeek > 7) {
      return 'Giorno della settimana non valido.';
    }
    const clock = toClockInterval(interval.opensAt, interval.closesAt);
    if (!clock) return 'Orario non valido. Usa il formato HH:mm.';
    if (isFullDay(clock.opens, clock.closes)) {
      segments.push({ day: interval.dayOfWeek, start: 0, end: 1440 });
    } else if (clock.closes > clock.opens) {
      segments.push({ day: interval.dayOfWeek, start: clock.opens, end: clock.closes });
    } else {
      segments.push({ day: interval.dayOfWeek, start: clock.opens, end: 1440 });
      const nextDay = interval.dayOfWeek === 7 ? 1 : interval.dayOfWeek + 1;
      segments.push({ day: nextDay, start: 0, end: clock.closes });
    }
  }
  const byDay = new Map<number, Array<{ start: number; end: number }>>();
  for (const segment of segments) {
    const list = byDay.get(segment.day) ?? [];
    list.push(segment);
    byDay.set(segment.day, list);
  }
  for (const list of byDay.values()) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].start < sorted[index - 1].end) {
        return 'Le fasce orarie si sovrappongono.';
      }
    }
  }
  return null;
}

export function sameIntervals(left: WeeklyInterval[], right: WeeklyInterval[]): boolean {
  const key = (interval: WeeklyInterval) =>
    `${interval.dayOfWeek}|${interval.opensAt}|${interval.closesAt}`;
  const a = left.map(key).sort();
  const b = right.map(key).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
