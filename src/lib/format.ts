const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "LKR 12,345.50" — formatted by hand so it behaves the same on every device. */
export function formatMoney(amount: number, currency: string): string {
  const negative = amount < 0;
  const fixed = Math.abs(amount).toFixed(2);
  const [int, dec] = fixed.split('.');
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = dec === '00' ? withCommas : `${withCommas}.${dec}`;
  return `${negative ? '-' : ''}${currency ? currency + ' ' : ''}${body}`;
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getTime();
}

export function monthRange(year: number, month: number): [number, number] {
  return [new Date(year, month, 1).getTime(), new Date(year, month + 1, 1).getTime()];
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export function formatDay(ms: number): string {
  const d = new Date(ms);
  const today = startOfDay(Date.now());
  const day = startOfDay(ms);
  if (day === today) return 'Today';
  if (day === today - 86400000) return 'Yesterday';
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
}

/** Always an absolute date, e.g. "10 Nov 2026". */
export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function toIsoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse "YYYY-MM-DD" into a local-midday timestamp; null if invalid. */
export function fromIsoDate(s: string): number | null {
  const m = s.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(m[3]) ? null : d.getTime();
}
