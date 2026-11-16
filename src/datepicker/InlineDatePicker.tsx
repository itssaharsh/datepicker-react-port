import { useRef, useState } from 'react';
import { Calendar } from './Calendar';
import {
  adjustInstDate,
  defaultDateOf,
  emptyInst,
  formatDate,
  setDate,
  takeKeyEvent,
  type Inst,
  type Period,
  type Settings,
} from './engine';

interface Props {
  settings: Settings;
  onSelect(text: string): void;
}

/** An always-visible calendar (no input behind it). */
export function InlineDatePicker({ settings, onSelect }: Props) {
  const [inst, setInst] = useState<Inst>(() => setDate(settings, emptyInst(), defaultDateOf(settings)).inst);
  const instRef = useRef(inst);

  const commit = (next: Inst) => {
    const withKey = { ...next, keyOver: takeKeyEvent() };
    instRef.current = withKey;
    setInst(withKey);
  };
  const adjust = (offset: number, period: Period) => commit(adjustInstDate(settings, instRef.current, offset, period));

  return (
    <div
      className="ui-datepicker-inline ui-datepicker ui-widget ui-widget-content ui-helper-clearfix ui-corner-all"
      style={{ display: 'block' }}
    >
      <Calendar
        settings={settings}
        inst={inst}
        popup={false}
        onPrev={() => adjust(-1, 'M')}
        onNext={() => adjust(1, 'M')}
        onMonth={(m) => commit(adjustInstDate(settings, { ...instRef.current, selectedMonth: m, drawMonth: m }))}
        onYear={(y) => commit(adjustInstDate(settings, { ...instRef.current, selectedYear: y, drawYear: y }))}
        onToday={() => undefined}
        onDone={() => undefined}
        onDay={(day, month, year) => {
          instRef.current = {
            ...instRef.current,
            selectedDay: day,
            currentDay: day,
            selectedMonth: month,
            currentMonth: month,
            selectedYear: year,
            currentYear: year,
          };
          onSelect(formatDate(settings.dateFormat, new Date(year, month, day)));
          commit(instRef.current);
        }}
      />
    </div>
  );
}
