// This app serves a single India shop, so "today"/"this month" always means
// IST (UTC+5:30) regardless of what timezone the server process runs in —
// hardcoding the offset avoids the day boundary silently shifting between a
// local dev machine and a UTC production host (the same class of bug fixed
// in src/lib/ocr.ts's receipt timestamp parsing).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istWallClockComponents(): { year: number; month: number; date: number } {
  const shifted = new Date(Date.now() + IST_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), date: shifted.getUTCDate() };
}

export function startOfIstDayUtc(): Date {
  const { year, month, date } = istWallClockComponents();
  return new Date(Date.UTC(year, month, date, 0, 0, 0) - IST_OFFSET_MS);
}

export function startOfIstMonthUtc(): Date {
  const { year, month } = istWallClockComponents();
  return new Date(Date.UTC(year, month, 1, 0, 0, 0) - IST_OFFSET_MS);
}
