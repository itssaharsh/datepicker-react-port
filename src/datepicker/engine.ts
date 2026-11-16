/*
 * Date logic for the date pickers: a dependency-free port of the parts of the
 * jQuery UI 1.13 Datepicker that the booking page relied on, so the pickers
 * keep behaving exactly as guests are used to.
 */

export type DateFormat = 'mm/dd/yy' | 'dd/mm/yy';
export type DaySettings = [boolean, string, string];

export interface Settings {
  minDate: Date | null;
  maxDate: Date | null;
  defaultDate: Date;
  dateFormat: DateFormat;
  changeMonth: boolean;
  changeYear: boolean;
  yearRange: string;
  showButtonPanel: boolean;
  beforeShowDay?: (date: Date) => DaySettings;
}

export function makeSettings(s: Partial<Settings> & { defaultDate: Date }): Settings {
  return {
    minDate: null,
    maxDate: null,
    dateFormat: 'mm/dd/yy',
    changeMonth: false,
    changeYear: false,
    yearRange: 'c-10:c+10',
    showButtonPanel: false,
    ...s,
  };
}

export interface Inst {
  selectedDay: number;
  selectedMonth: number;
  selectedYear: number;
  drawMonth: number;
  drawYear: number;
  currentDay: number;
  currentMonth: number;
  currentYear: number;
  lastVal: string | undefined;
  /** the render following a key press marks the cursor day ("days-cell-over") */
  keyOver: boolean;
}

export const emptyInst = (): Inst => ({
  selectedDay: 0,
  selectedMonth: 0,
  selectedYear: 0,
  drawMonth: 0,
  drawYear: 0,
  currentDay: 0,
  currentMonth: 0,
  currentYear: 0,
  lastVal: undefined,
  keyOver: false,
});

/* jQuery UI keeps this flag globally: set by any key press, consumed by the next render. */
let keyEventPending = false;
export function setKeyEvent(v: boolean): void {
  keyEventPending = v;
}
export function takeKeyEvent(): boolean {
  const v = keyEventPending;
  keyEventPending = false;
  return v;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_NAMES_MIN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/* ---------- helpers ---------- */

export function dst(date: Date): Date {
  date.setHours(date.getHours() > 12 ? date.getHours() + 2 : 0);
  return date;
}

function midnight(date: Date): Date {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return dst(d);
}

export function daysInMonth(year: number, month: number): number {
  return 32 - dst(new Date(year, month, 32)).getDate();
}

const pad = (n: number, size: number) => {
  let s = '' + n;
  while (s.length < size) s = '0' + s;
  return s;
};

export function formatDate(format: DateFormat, date: Date): string {
  const d = pad(date.getDate(), 2);
  const m = pad(date.getMonth() + 1, 2);
  const y = pad(date.getFullYear(), 4);
  return format === 'mm/dd/yy' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

/** Same rules as $.datepicker.parseDate: returns null for "", throws on bad input. */
export function parseDate(format: DateFormat, value: string): Date | null {
  if (value === '') return null;
  const tokens = format === 'mm/dd/yy' ? ['m', '/', 'd', '/', 'y'] : ['d', '/', 'm', '/', 'y'];
  let i = 0;
  let year = -1;
  let month = -1;
  let day = -1;
  for (const tok of tokens) {
    if (tok === '/') {
      if (value.charAt(i) !== '/') throw new Error('Unexpected literal at position ' + i);
      i++;
      continue;
    }
    const size = tok === 'y' ? 4 : 2;
    const minSize = tok === 'y' ? 4 : 1;
    const num = value.substring(i).match(new RegExp('^\\d{' + minSize + ',' + size + '}'));
    if (!num) throw new Error('Missing number at position ' + i);
    i += num[0].length;
    const n = parseInt(num[0], 10);
    if (tok === 'y') year = n;
    else if (tok === 'm') month = n;
    else day = n;
  }
  if (i < value.length) {
    if (!/^\s+/.test(value.substr(i))) throw new Error('Extra/unparsed characters found in date');
  }
  if (year < 100) {
    const cur = new Date().getFullYear();
    const cutoff = (cur % 100) + 10;
    year += cur - (cur % 100) + (year <= cutoff ? 0 : -100);
  }
  const date = dst(new Date(year, month - 1, day));
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
    throw new Error('Invalid date');
  }
  return date;
}

/* ---------- state transitions ---------- */

export function restrictMinMax(s: Settings, date: Date): Date {
  const min = s.minDate ? midnight(s.minDate) : null;
  const max = s.maxDate ? midnight(s.maxDate) : null;
  const d = min && date < min ? min : date;
  return max && d > max ? max : d;
}

export function defaultDateOf(s: Settings): Date {
  return restrictMinMax(s, midnight(s.defaultDate));
}

export type Period = 'D' | 'M' | 'Y';

export function adjustInstDate(s: Settings, inst: Inst, offset = 0, period?: Period): Inst {
  const year = inst.selectedYear + (period === 'Y' ? offset : 0);
  const month = inst.selectedMonth + (period === 'M' ? offset : 0);
  const day = Math.min(inst.selectedDay, daysInMonth(year, month)) + (period === 'D' ? offset : 0);
  const date = restrictMinMax(s, dst(new Date(year, month, day)));
  return {
    ...inst,
    selectedDay: date.getDate(),
    drawMonth: date.getMonth(),
    selectedMonth: date.getMonth(),
    drawYear: date.getFullYear(),
    selectedYear: date.getFullYear(),
  };
}

export function setDateFromField(s: Settings, inst: Inst, text: string, noDefault = false): Inst {
  if (text === inst.lastVal) return inst;
  const defaultDate = defaultDateOf(s);
  let date = defaultDate;
  let dates = text;
  try {
    date = parseDate(s.dateFormat, text) || defaultDate;
  } catch {
    dates = noDefault ? '' : text;
  }
  return adjustInstDate(s, {
    ...inst,
    lastVal: text,
    selectedDay: date.getDate(),
    drawMonth: date.getMonth(),
    selectedMonth: date.getMonth(),
    drawYear: date.getFullYear(),
    selectedYear: date.getFullYear(),
    currentDay: dates ? date.getDate() : 0,
    currentMonth: dates ? date.getMonth() : 0,
    currentYear: dates ? date.getFullYear() : 0,
  });
}

/** Mirrors _formatDate: without a day, the cursor day becomes the current day. */
export function formatCurrent(s: Settings, inst: Inst): { text: string; inst: Inst } {
  const next: Inst = {
    ...inst,
    currentDay: inst.selectedDay,
    currentMonth: inst.selectedMonth,
    currentYear: inst.selectedYear,
  };
  return { text: formatDate(s.dateFormat, dst(new Date(next.currentYear, next.currentMonth, next.currentDay))), inst: next };
}

export function setDate(s: Settings, inst: Inst, date: Date | null): { inst: Inst; text: string } {
  const clear = !date;
  const newDate = restrictMinMax(s, date ? midnight(date) : midnight(new Date()));
  let next: Inst = {
    ...inst,
    selectedDay: newDate.getDate(),
    currentDay: newDate.getDate(),
    drawMonth: newDate.getMonth(),
    selectedMonth: newDate.getMonth(),
    currentMonth: newDate.getMonth(),
    drawYear: newDate.getFullYear(),
    selectedYear: newDate.getFullYear(),
    currentYear: newDate.getFullYear(),
  };
  next = adjustInstDate(s, next);
  const f = formatCurrent(s, next);
  return { inst: f.inst, text: clear ? '' : f.text };
}

export function getDate(inst: Inst, text: string): Date | null {
  return !inst.currentYear || text === '' ? null : new Date(inst.currentYear, inst.currentMonth, inst.currentDay);
}

/* ---------- view model ---------- */

function yearBounds(s: Settings): [number, number] {
  const parts = s.yearRange.split(':');
  const thisYear = new Date().getFullYear();
  let minYear = parseInt(parts[0], 10);
  let maxYear = parseInt(parts[1], 10);
  if (/[+-].*/.test(parts[0])) minYear += thisYear;
  if (/[+-].*/.test(parts[1] ?? '')) maxYear += thisYear;
  return [minYear, maxYear];
}

export function isInRange(s: Settings, date: Date): boolean {
  const [minYear, maxYear] = yearBounds(s);
  const min = s.minDate ? midnight(s.minDate) : null;
  const max = s.maxDate ? midnight(s.maxDate) : null;
  return (
    (!min || date.getTime() >= min.getTime()) &&
    (!max || date.getTime() <= max.getTime()) &&
    (!minYear || date.getFullYear() >= minYear) &&
    (!maxYear || date.getFullYear() <= maxYear)
  );
}

export function canAdjustMonth(s: Settings, offset: number, curYear: number, curMonth: number): boolean {
  const date = dst(new Date(curYear, curMonth + (offset < 0 ? offset : 1), 1));
  if (offset < 0) date.setDate(daysInMonth(date.getFullYear(), date.getMonth()));
  return isInRange(s, date);
}

export function yearOptions(s: Settings, drawYear: number): number[] {
  const thisYear = new Date().getFullYear();
  const parts = s.yearRange.split(':');
  const determine = (value: string) => {
    const y = /c[+-].*/.test(value)
      ? drawYear + parseInt(value.substring(1), 10)
      : /[+-].*/.test(value)
        ? thisYear + parseInt(value, 10)
        : parseInt(value, 10);
    return isNaN(y) ? thisYear : y;
  };
  let year = determine(parts[0]);
  let endYear = Math.max(year, determine(parts[1] || ''));
  year = s.minDate ? Math.max(year, midnight(s.minDate).getFullYear()) : year;
  endYear = s.maxDate ? Math.min(endYear, midnight(s.maxDate).getFullYear()) : endYear;
  const out: number[] = [];
  for (; year <= endYear; year++) out.push(year);
  return out;
}

export function monthOptions(s: Settings, drawYear: number): number[] {
  const min = s.minDate ? midnight(s.minDate) : null;
  const max = s.maxDate ? midnight(s.maxDate) : null;
  const inMin = !!min && min.getFullYear() === drawYear;
  const inMax = !!max && max.getFullYear() === drawYear;
  const out: number[] = [];
  for (let m = 0; m < 12; m++) {
    if ((!inMin || m >= min!.getMonth()) && (!inMax || m <= max!.getMonth())) out.push(m);
  }
  return out;
}

export interface Cell {
  date: Date;
  day: number;
  month: number;
  year: number;
  otherMonth: boolean;
  unselectable: boolean;
  over: boolean;
  isCurrent: boolean;
  isToday: boolean;
  weekEnd: boolean;
  extraClass: string;
  title: string;
}

export interface View {
  drawMonth: number;
  drawYear: number;
  rows: Cell[][];
}

export function buildView(s: Settings, inst: Inst): View {
  let drawMonth = inst.drawMonth;
  let drawYear = inst.drawYear;
  const min = s.minDate ? midnight(s.minDate) : null;
  const max = s.maxDate ? midnight(s.maxDate) : null;
  if (max) {
    let maxDraw = dst(new Date(max.getFullYear(), max.getMonth(), max.getDate()));
    maxDraw = min && maxDraw < min ? min : maxDraw;
    while (dst(new Date(drawYear, drawMonth, 1)) > maxDraw) {
      drawMonth--;
      if (drawMonth < 0) {
        drawMonth = 11;
        drawYear--;
      }
    }
  }
  const today = dst(midnight(new Date()));
  const currentDate = dst(!inst.currentDay ? new Date(9999, 9, 9) : new Date(inst.currentYear, inst.currentMonth, inst.currentDay));
  const selectedDate = dst(new Date(inst.selectedYear, inst.selectedMonth, inst.selectedDay));
  const defaultDate = defaultDateOf(s);
  const leadDays = (dst(new Date(drawYear, drawMonth, 1)).getDay() + 7) % 7;
  const numRows = Math.ceil((leadDays + daysInMonth(drawYear, drawMonth)) / 7);
  let print = dst(new Date(drawYear, drawMonth, 1 - leadDays));
  const rows: Cell[][] = [];
  for (let r = 0; r < numRows; r++) {
    const row: Cell[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const ds: DaySettings = s.beforeShowDay ? s.beforeShowDay(print) : [true, '', ''];
      const otherMonth = print.getMonth() !== drawMonth;
      const unselectable = otherMonth || !ds[0] || (!!min && print < min) || (!!max && print > max);
      const t = print.getTime();
      row.push({
        date: print,
        day: print.getDate(),
        month: print.getMonth(),
        year: print.getFullYear(),
        otherMonth,
        unselectable,
        over:
          (t === selectedDate.getTime() && drawMonth === inst.selectedMonth && inst.keyOver) ||
          (defaultDate.getTime() === t && defaultDate.getTime() === selectedDate.getTime()),
        isCurrent: !otherMonth && t === currentDate.getTime(),
        isToday: !otherMonth && t === today.getTime(),
        weekEnd: (dow + 6) % 7 >= 5,
        extraClass: otherMonth ? '' : ds[1],
        title: !otherMonth && ds[2] ? ds[2] : '',
      });
      print = dst(new Date(print.getFullYear(), print.getMonth(), print.getDate() + 1));
    }
    rows.push(row);
  }
  return { drawMonth, drawYear, rows };
}
