import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { Calendar } from './Calendar';
import {
  adjustInstDate,
  buildView,
  emptyInst,
  formatCurrent,
  formatDate,
  getDate,
  parseDate,
  setDate,
  setDateFromField,
  setKeyEvent,
  takeKeyEvent,
  type Inst,
  type Period,
  type Settings,
} from './engine';

export interface PopupHandle {
  /** Like $(input).datepicker('option', patch): applies the patch, re-clamps the field's date, returns the new text. */
  option(patch: Partial<Settings>, currentText: string): string;
}

interface Props {
  ref?: Ref<PopupHandle>;
  id: string;
  name: string;
  placeholder?: string;
  value: string;
  onValueChange(text: string): void;
  /** the native "change" event (fires on blur / commit after typing) */
  onNativeChange?(): void;
  settings: Settings;
  onSelect?(text: string): void;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** another picker took over; hide immediately instead of fading */
  anotherOpen: boolean;
}

const FADE_MS = 200;
const POSSIBLE_CHARS = '0123456789/';

export function PopupDatePicker(props: Props) {
  const { id, name, placeholder, value, open, onOpenChange, anotherOpen } = props;
  const [settings, setSettings] = useState<Settings>(props.settings);
  const settingsRef = useRef(settings);
  const [inst, setInst] = useState<Inst>(emptyInst);
  const instRef = useRef(inst);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const suppressFocus = useRef(false);
  const latest = useRef(props);
  latest.current = props;

  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const commit = useCallback((next: Inst) => {
    const withKey = { ...next, keyOver: takeKeyEvent() };
    instRef.current = withKey;
    setInst(withKey);
  }, []);

  const refocus = () => {
    const input = inputRef.current;
    if (input && document.activeElement !== input) {
      suppressFocus.current = true;
      input.focus();
      suppressFocus.current = false;
    }
  };

  const hide = () => latest.current.onOpenChange(false);

  const show = () => {
    if (openRef.current) return;
    const input = inputRef.current!;
    commit(setDateFromField(settingsRef.current, instRef.current, input.value));
    latest.current.onOpenChange(true);
  };

  const adjust = (offset: number, period: Period) => {
    commit(adjustInstDate(settingsRef.current, instRef.current, offset, period));
    refocus();
  };

  const selectDate = (text: string) => {
    latest.current.onValueChange(text);
    latest.current.onSelect?.(text);
    hide();
    const input = inputRef.current;
    if (input) {
      suppressFocus.current = true;
      input.focus();
      suppressFocus.current = false;
    }
  };

  const selectDay = (day: number, month: number, year: number) => {
    const s = settingsRef.current;
    const next = {
      ...instRef.current,
      selectedDay: day,
      currentDay: day,
      selectedMonth: month,
      currentMonth: month,
      selectedYear: year,
      currentYear: year,
    };
    instRef.current = next;
    selectDate(formatDate(s.dateFormat, new Date(year, month, day)));
  };

  const gotoToday = () => {
    const d = new Date();
    const next = {
      ...instRef.current,
      selectedDay: d.getDate(),
      drawMonth: d.getMonth(),
      selectedMonth: d.getMonth(),
      drawYear: d.getFullYear(),
      selectedYear: d.getFullYear(),
    };
    commit(adjustInstDate(settingsRef.current, next));
    refocus();
  };

  useImperativeHandle(
    props.ref,
    () => ({
      option(patch, currentText) {
        if (openRef.current) latest.current.onOpenChange(false);
        const inst1 = setDateFromField(settingsRef.current, instRef.current, currentText, true);
        const date = getDate(inst1, currentText);
        const merged = { ...settingsRef.current, ...patch };
        settingsRef.current = merged;
        setSettings(merged);
        const r = setDate(merged, inst1, date);
        commit(r.inst);
        return r.text;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit],
  );

  /* ---- keyboard ---- */

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    setKeyEvent(true);
    let handled = true;
    const s = settingsRef.current;
    const ctrl = e.ctrlKey || e.metaKey;
    if (openRef.current) {
      switch (e.keyCode) {
        case 9:
          hide();
          handled = false;
          break;
        case 13: {
          const view = buildView(s, instRef.current);
          const sel = view.rows.flat().find((c) => c.over && !c.isCurrent);
          if (sel && !sel.unselectable) {
            selectDay(sel.day, instRef.current.selectedMonth, instRef.current.selectedYear);
          }
          if (latest.current.onSelect) {
            const f = formatCurrent(s, instRef.current);
            instRef.current = f.inst;
            latest.current.onSelect(f.text);
          } else {
            hide();
          }
          break;
        }
        case 27:
          hide();
          break;
        case 33:
          adjust(e.ctrlKey ? -12 : -1, 'M');
          break;
        case 34:
          adjust(e.ctrlKey ? 12 : 1, 'M');
          break;
        case 35:
          if (ctrl) selectDate('');
          handled = ctrl;
          break;
        case 36:
          if (ctrl) gotoToday();
          handled = ctrl;
          break;
        case 37:
          if (ctrl) adjust(-1, 'D');
          handled = ctrl;
          if (e.altKey) adjust(e.ctrlKey ? -12 : -1, 'M');
          break;
        case 38:
          if (ctrl) adjust(-7, 'D');
          handled = ctrl;
          break;
        case 39:
          if (ctrl) adjust(1, 'D');
          handled = ctrl;
          if (e.altKey) adjust(e.ctrlKey ? 12 : 1, 'M');
          break;
        case 40:
          if (ctrl) adjust(7, 'D');
          handled = ctrl;
          break;
        default:
          handled = false;
      }
    } else if (e.keyCode === 36 && e.ctrlKey) {
      show();
    } else {
      handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  /* only digits and "/" can be typed (constrainInput) */
  const onKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    const chr = String.fromCharCode(e.charCode ?? e.keyCode);
    if (!(e.ctrlKey || e.metaKey || chr < ' ' || POSSIBLE_CHARS.indexOf(chr) > -1)) e.preventDefault();
  };

  /* typing a complete date moves the calendar to it */
  const onKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
    const text = e.currentTarget.value;
    if (text !== instRef.current.lastVal) {
      try {
        if (parseDate(settingsRef.current.dateFormat, text)) {
          commit(setDateFromField(settingsRef.current, instRef.current, text));
        }
      } catch {
        /* partial input: ignore */
      }
    }
  };

  /* ---- native change event ---- */
  useEffect(() => {
    const el = inputRef.current!;
    const fn = () => latest.current.onNativeChange?.();
    el.addEventListener('change', fn);
    return () => el.removeEventListener('change', fn);
  }, []);

  /* ---- click outside closes ---- */
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && (popupRef.current?.contains(t) || inputRef.current === t)) return;
      onOpenChange(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open, onOpenChange]);

  /* ---- fade out ---- */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      setClosing(false);
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    if (anotherOpen) {
      setClosing(false);
      return;
    }
    setClosing(true);
    const t = setTimeout(() => setClosing(false), FADE_MS);
    return () => clearTimeout(t);
  }, [open, anotherOpen]);

  /* ---- placement: just below the input, nudged to stay inside the viewport ---- */
  useLayoutEffect(() => {
    if (!open) return;
    const input = inputRef.current;
    const popup = popupRef.current;
    if (!input || !popup) return;
    const rect = input.getBoundingClientRect();
    const sx = window.scrollX;
    const sy = window.scrollY;
    const dpW = popup.offsetWidth;
    const dpH = popup.offsetHeight;
    const inH = input.offsetHeight;
    const viewW = document.documentElement.clientWidth + sx;
    const viewH = document.documentElement.clientHeight + sy;
    let left = rect.left + sx;
    let top = rect.top + sy + inH;
    left -= Math.min(left, left + dpW > viewW && viewW > dpW ? Math.abs(left + dpW - viewW) : 0);
    top -= Math.min(top, top + dpH > viewH && viewH > dpH ? Math.abs(dpH + inH) : 0);
    setPos({ left, top });
  }, [open]);

  const mounted = open || closing;

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        placeholder={placeholder}
        className="hasDatepicker"
        value={value}
        onChange={(e) => props.onValueChange(e.target.value)}
        onFocus={() => {
          if (suppressFocus.current) return;
          show();
        }}
        onKeyDown={onKeyDown}
        onKeyPress={onKeyPress}
        onKeyUp={onKeyUp}
      />
      {mounted &&
        createPortal(
          <div
            ref={popupRef}
            id="ui-datepicker-div"
            className={`ui-datepicker ui-widget ui-widget-content ui-helper-clearfix ui-corner-all ${open ? 'dp-fade-in' : 'dp-fade-out'}`}
            style={{
              display: 'block',
              position: 'absolute',
              zIndex: 1,
              left: pos ? pos.left : 0,
              top: pos ? pos.top : -1000,
            }}
          >
            <Calendar
              settings={settings}
              inst={inst}
              popup
              onPrev={() => adjust(-1, 'M')}
              onNext={() => adjust(1, 'M')}
              onMonth={(m) => {
                commit(adjustInstDate(settingsRef.current, { ...instRef.current, selectedMonth: m, drawMonth: m }));
                refocus();
              }}
              onYear={(y) => {
                commit(adjustInstDate(settingsRef.current, { ...instRef.current, selectedYear: y, drawYear: y }));
                refocus();
              }}
              onToday={gotoToday}
              onDone={hide}
              onDay={selectDay}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
