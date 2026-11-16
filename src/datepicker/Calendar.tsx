import { useState } from 'react';
import {
  DAY_NAMES,
  DAY_NAMES_MIN,
  MONTH_NAMES,
  MONTH_NAMES_SHORT,
  buildView,
  canAdjustMonth,
  dst,
  isInRange,
  monthOptions,
  yearOptions,
  type Inst,
  type Settings,
} from './engine';

export interface CalendarProps {
  settings: Settings;
  inst: Inst;
  /** popups get a "Done" button in the button panel; the inline calendar does not */
  popup: boolean;
  onPrev(): void;
  onNext(): void;
  onMonth(month: number): void;
  onYear(year: number): void;
  onToday(): void;
  onDone(): void;
  onDay(day: number, month: number, year: number): void;
}

const cls = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

export function Calendar(p: CalendarProps) {
  const { settings: s, inst } = p;
  const view = buildView(s, inst);
  const { drawMonth, drawYear } = view;

  // The cursor day gets the hover look when the calendar is (re)drawn, until the mouse takes over.
  const [hov, setHov] = useState<{ inst: Inst; key: string | null } | null>(null);
  let overKey: string | null = null;
  for (const row of view.rows) {
    for (const c of row) {
      if (overKey === null && c.over && !c.unselectable) overKey = `${c.year}-${c.month}-${c.day}`;
    }
  }
  const hoverKey = hov && hov.inst === inst ? hov.key : overKey;

  const canPrev = canAdjustMonth(s, -1, drawYear, drawMonth);
  const canNext = canAdjustMonth(s, 1, drawYear, drawMonth);
  const today = dst(new Date());
  today.setHours(0, 0, 0, 0);

  const monthPart = s.changeMonth ? (
    <select
      className="ui-datepicker-month"
      value={drawMonth}
      onChange={(e) => p.onMonth(parseInt(e.target.value, 10))}
    >
      {monthOptions(s, drawYear).map((m) => (
        <option key={m} value={m}>
          {MONTH_NAMES_SHORT[m]}
        </option>
      ))}
    </select>
  ) : (
    <span className="ui-datepicker-month">{MONTH_NAMES[drawMonth]}</span>
  );

  const yearPart = s.changeYear ? (
    <select
      className="ui-datepicker-year"
      value={drawYear}
      onChange={(e) => p.onYear(parseInt(e.target.value, 10))}
    >
      {yearOptions(s, drawYear).map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  ) : (
    <span className="ui-datepicker-year">{drawYear}</span>
  );

  return (
    <>
      <div className="ui-datepicker-header ui-widget-header ui-helper-clearfix ui-corner-all">
        {canPrev ? (
          <a className="ui-datepicker-prev ui-corner-all" title="Prev" onClick={p.onPrev}>
            <span className="ui-icon ui-icon-circle-triangle-w">Prev</span>
          </a>
        ) : (
          <a className="ui-datepicker-prev ui-corner-all ui-state-disabled" title="Prev">
            <span className="ui-icon ui-icon-circle-triangle-w">Prev</span>
          </a>
        )}
        {canNext ? (
          <a className="ui-datepicker-next ui-corner-all" title="Next" onClick={p.onNext}>
            <span className="ui-icon ui-icon-circle-triangle-e">Next</span>
          </a>
        ) : (
          <a className="ui-datepicker-next ui-corner-all ui-state-disabled" title="Next">
            <span className="ui-icon ui-icon-circle-triangle-e">Next</span>
          </a>
        )}
        <div className="ui-datepicker-title">
          {monthPart}
          {!(s.changeMonth && s.changeYear) && ' '}
          {yearPart}
        </div>
      </div>
      <table className="ui-datepicker-calendar">
        <thead>
          <tr>
            {DAY_NAMES_MIN.map((n, i) => (
              <th key={n} scope="col" className={(i + 6) % 7 >= 5 ? 'ui-datepicker-week-end' : undefined}>
                <span title={DAY_NAMES[i]}>{n}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row, r) => (
            <tr key={r}>
              {row.map((c) => {
                const key = `${c.year}-${c.month}-${c.day}`;
                return (
                  <td
                    key={key}
                    className={cls(
                      c.weekEnd && 'ui-datepicker-week-end',
                      c.otherMonth && 'ui-datepicker-other-month',
                      c.over && 'ui-datepicker-days-cell-over',
                      c.unselectable && 'ui-datepicker-unselectable ui-state-disabled',
                      !c.otherMonth && c.extraClass,
                      c.isCurrent && 'ui-datepicker-current-day',
                      c.isToday && 'ui-datepicker-today',
                    )}
                    title={c.title || undefined}
                    onClick={
                      c.unselectable
                        ? undefined
                        : (e) => {
                            e.preventDefault();
                            p.onDay(c.day, c.month, c.year);
                          }
                    }
                  >
                    {c.otherMonth ? (
                      ' '
                    ) : c.unselectable ? (
                      <span className="ui-state-default">{c.day}</span>
                    ) : (
                      <a
                        className={cls(
                          'ui-state-default',
                          c.isToday && 'ui-state-highlight',
                          c.isCurrent && 'ui-state-active',
                          hoverKey === key && 'ui-state-hover',
                        )}
                        href="#"
                        aria-current={c.isCurrent ? 'true' : 'false'}
                        data-date={c.day}
                        onMouseEnter={() => setHov({ inst, key })}
                        onMouseLeave={() => setHov({ inst, key: null })}
                      >
                        {c.day}
                      </a>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {s.showButtonPanel && (
        <div className="ui-datepicker-buttonpane ui-widget-content">
          {isInRange(s, today) && (
            <button
              type="button"
              className="ui-datepicker-current ui-state-default ui-priority-secondary ui-corner-all"
              onClick={p.onToday}
            >
              Today
            </button>
          )}
          {p.popup && (
            <button
              type="button"
              className="ui-datepicker-close ui-state-default ui-priority-primary ui-corner-all"
              onClick={p.onDone}
            >
              Done
            </button>
          )}
        </div>
      )}
    </>
  );
}
