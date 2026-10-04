const pad = (n: number) => String(n).padStart(2, "0");

export function formatTime(ts: number | null | undefined): string {
  if (!ts) return "–";
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "–";
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${formatTime(ts)}`;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "19:32" today, "Hôm qua 08:10", otherwise "dd/mm/yyyy hh:mm". */
export function formatRelative(ts: number | null | undefined, now: number): string {
  if (!ts) return "–";
  const today = startOfDay(now || Date.now());
  if (ts >= today) return `Hôm nay ${formatTime(ts)}`;
  if (ts >= today - 86_400_000) return `Hôm qua ${formatTime(ts)}`;
  return formatDateTime(ts);
}

export function isToday(ts: number, now: number): boolean {
  return ts >= startOfDay(now || Date.now());
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : `${value}%`;
}
