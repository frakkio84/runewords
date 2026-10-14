export type DayRange = { opensAt: string; closesAt: string };

function normalizeClock(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 24 || minute > 59) return null;
  if (hour === 24 && minute !== 0) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseDayRanges(value: string): { ok: true; ranges: DayRange[] } | { ok: false; message: string } {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'chiuso') {
    return { ok: true, ranges: [] };
  }
  const ranges: DayRange[] = [];
  for (const part of trimmed.split(/[,;]+/)) {
    const piece = part.trim();
    if (!piece) continue;
    const match = /^(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})$/.exec(piece);
    if (!match) return { ok: false, message: `Fascia non valida: ${piece}. Usa 09:00-13:00.` };
    const opensAt = normalizeClock(match[1]);
    const closesAt = normalizeClock(match[2]);
    if (!opensAt || !closesAt) return { ok: false, message: `Orario non valido: ${piece}.` };
    ranges.push({ opensAt, closesAt });
  }
  return { ok: true, ranges };
}
