export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  dateKey: string;
};

const WEEKDAY_FROM_SHORT: Record<string, number> = {
  Sun: 7,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO weekday for a calendar date: Monday = 1 … Sunday = 7. */
export function weekdayFromDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return js === 0 ? 7 : js;
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
  const bag: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const year = Number(bag.year);
  const month = Number(bag.month);
  const day = Number(bag.day);
  const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    year,
    month,
    day,
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday: WEEKDAY_FROM_SHORT[bag.weekday] ?? weekdayFromDateKey(dateKey),
    dateKey,
  };
}

/** Minutes from local midnight. `24:00` is 1440 and is valid only as a closing time. */
export function parseClock(value: string): number | null {
  if (value === '24:00') return 24 * 60;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatClock(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Convert a local wall-clock time to UTC.
 * Returns null when that local time does not exist (spring-forward gap).
 */
export function zonedLocalToUtc(
  dateKey: string,
  minutes: number,
  timeZone: string,
): Date | null {
  if (!isDateKey(dateKey)) return null;
  let dayKey = dateKey;
  let mins = minutes;
  if (mins === 1440) {
    dayKey = addDays(dateKey, 1);
    mins = 0;
  }
  if (mins < 0 || mins >= 1440) return null;
  const [year, month, day] = dayKey.split('-').map(Number);
  const hour = Math.floor(mins / 60);
  const minute = mins % 60;
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const parts = getZonedParts(new Date(utc), timeZone);
    const got = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const want = Date.UTC(year, month - 1, day, hour, minute);
    const diff = want - got;
    if (diff === 0) return new Date(utc);
    utc += diff;
  }
  const parts = getZonedParts(new Date(utc), timeZone);
  if (
    parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hour === hour &&
    parts.minute === minute
  ) {
    return new Date(utc);
  }
  return null;
}
