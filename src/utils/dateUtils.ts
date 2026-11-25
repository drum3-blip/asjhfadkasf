export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export function diffDays(startStr: string, endStr: string): number {
  const s = parseLocalDate(startStr).getTime();
  const e = parseLocalDate(endStr).getTime();
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

export function getTodayStr(): string {
  return formatLocalDate(new Date());
}

export function formatShortJP(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatMonthYearJP(year: number, monthZeroIndexed: number): string {
  return `${year}年${monthZeroIndexed + 1}月`;
}

export function getWeekdayJP(dateStr: string): string {
  const names = ['日', '月', '火', '水', '木', '金', '土'];
  return names[parseLocalDate(dateStr).getDay()] || '';
}

export function getDatesInRange(startStr: string, endStr: string): string[] {
  const result: string[] = [];
  const total = Math.max(0, diffDays(startStr, endStr));
  for (let i = 0; i <= total; i++) {
    result.push(addDays(startStr, i));
  }
  return result;
}

export function getEffectiveDeadline(item: {
  endDate: string;
  deadlineDate?: string;
}): string {
  return item.deadlineDate && item.deadlineDate.trim() ? item.deadlineDate : item.endDate;
}

export function isDeadlineOnlyItem(item: {
  startDate: string;
  endDate: string;
  deadlineDate?: string;
}): boolean {
  return Boolean(
    item.deadlineDate &&
      item.deadlineDate === item.startDate &&
      item.deadlineDate === item.endDate
  );
}
