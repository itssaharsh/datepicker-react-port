import { useCallback, useRef, useState, type FormEvent } from 'react';
import { InlineDatePicker } from './datepicker/InlineDatePicker';
import { PopupDatePicker, type PopupHandle } from './datepicker/PopupDatePicker';
import { formatDate, makeSettings, parseDate, type DaySettings } from './datepicker/engine';

const FIRST_NIGHT = new Date(2026, 10, 10); // bookings open on 10 Nov 2026
const LAST_NIGHT = new Date(2027, 10, 15);
const BOOKED = ['11/24/2026', '11/25/2026', '11/26/2026'];
const DAY = 24 * 60 * 60 * 1000;

const fmt = (date: Date) => formatDate('mm/dd/yy', date);

function booked(date: Date): DaySettings {
  if (BOOKED.indexOf(fmt(date)) !== -1) return [false, 'booked', 'Fully booked'];
  return [true, '', ''];
}

function parse(text: string): Date | null {
  try {
    return parseDate('mm/dd/yy', text);
  } catch {
    return null;
  }
}

const checkinSettings = makeSettings({
  minDate: FIRST_NIGHT,
  maxDate: LAST_NIGHT,
  defaultDate: new Date(2026, 10, 20),
  showButtonPanel: true,
  beforeShowDay: booked,
});

const checkoutSettings = makeSettings({
  minDate: new Date(2026, 10, 11),
  maxDate: new Date(2027, 10, 16),
  defaultDate: new Date(2026, 10, 22),
  showButtonPanel: true,
  beforeShowDay: booked,
});

const dobSettings = makeSettings({
  changeMonth: true,
  changeYear: true,
  yearRange: '1930:2008',
  dateFormat: 'dd/mm/yy',
  defaultDate: new Date(1990, 0, 1),
  maxDate: new Date(2008, 11, 31),
});

const availabilitySettings = makeSettings({
  minDate: FIRST_NIGHT,
  maxDate: LAST_NIGHT,
  defaultDate: new Date(2026, 10, 20),
  beforeShowDay: booked,
});

type Fields = { checkin: string; checkout: string; guest: string; dob: string };

export default function App() {
  const [fields, setFields] = useState<Fields>({ checkin: '', checkout: '', guest: '', dob: '' });
  // Event handlers read the fields the way the old page read the inputs: always the latest.
  const fieldsRef = useRef(fields);
  const setField = useCallback((key: keyof Fields, text: string) => {
    fieldsRef.current = { ...fieldsRef.current, [key]: text };
    setFields(fieldsRef.current);
  }, []);

  const [nights, setNights] = useState('Choose your dates');
  const [summary, setSummary] = useState<{ text: string; error: boolean }>({ text: '', error: false });
  const [openId, setOpenId] = useState<string | null>(null);
  const checkoutPicker = useRef<PopupHandle>(null);

  const openChange = (id: string) => (open: boolean) =>
    setOpenId((cur) => (open ? id : cur === id ? null : cur));

  function updateNights() {
    const inDate = parse(fieldsRef.current.checkin);
    const outDate = parse(fieldsRef.current.checkout);
    if (!inDate || !outDate) {
      setNights('Choose your dates');
      return;
    }
    const n = Math.round((outDate.getTime() - inDate.getTime()) / DAY);
    setNights(n === 1 ? '1 night' : n + ' nights');
  }

  // Check-out must be at least one night after check-in.
  function checkinChosen(dateText: string) {
    if (!dateText) {
      // Ctrl+End cleared check-in: any later check-out is allowed again.
      setField('checkout', checkoutPicker.current!.option({ minDate: new Date(2026, 10, 11) }, fieldsRef.current.checkout));
      updateNights();
      return;
    }
    const inDate = parseDate('mm/dd/yy', dateText)!;
    const earliestOut = new Date(inDate.getTime() + DAY);
    setField('checkout', checkoutPicker.current!.option({ minDate: earliestOut }, fieldsRef.current.checkout));
    const outDate = parse(fieldsRef.current.checkout);
    if (outDate && outDate <= inDate) setField('checkout', '');
    updateNights();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const inDate = parse(fields.checkin);
    const outDate = parse(fields.checkout);
    if (!inDate || !outDate) {
      setSummary({ text: 'Please choose check-in and check-out dates.', error: true });
      return;
    }
    const n = Math.round((outDate.getTime() - inDate.getTime()) / DAY);
    const who = fields.guest.trim();
    setSummary({
      text:
        'Booked ' + (n === 1 ? '1 night' : n + ' nights') + (who ? ' for ' + who : '') + ': ' + fields.checkin + ' to ' + fields.checkout + '.',
      error: false,
    });
  }

  return (
    <>
      <header>
        <h1>Lakeside Inn</h1>
        <p className="tag">Book a room</p>
      </header>
      <main>
        <form id="booking" autoComplete="off" onSubmit={onSubmit}>
          <h2>Your stay</h2>
          <div className="row">
            <label htmlFor="checkin">Check-in</label>
            <PopupDatePicker
              id="checkin"
              name="checkin"
              placeholder="mm/dd/yyyy"
              value={fields.checkin}
              onValueChange={(t) => setField('checkin', t)}
              onNativeChange={updateNights}
              settings={checkinSettings}
              onSelect={checkinChosen}
              open={openId === 'checkin'}
              onOpenChange={openChange('checkin')}
              anotherOpen={openId !== null && openId !== 'checkin'}
            />
          </div>
          <div className="row">
            <label htmlFor="checkout">Check-out</label>
            <PopupDatePicker
              ref={checkoutPicker}
              id="checkout"
              name="checkout"
              placeholder="mm/dd/yyyy"
              value={fields.checkout}
              onValueChange={(t) => setField('checkout', t)}
              onNativeChange={updateNights}
              settings={checkoutSettings}
              onSelect={updateNights}
              open={openId === 'checkout'}
              onOpenChange={openChange('checkout')}
              anotherOpen={openId !== null && openId !== 'checkout'}
            />
          </div>
          <p id="nights" className="nights">
            {nights}
          </p>
          <h2>About you</h2>
          <div className="row">
            <label htmlFor="guest">Full name</label>
            <input
              id="guest"
              name="guest"
              type="text"
              value={fields.guest}
              onChange={(e) => setField('guest', e.target.value)}
            />
          </div>
          <div className="row">
            <label htmlFor="dob">Date of birth</label>
            <PopupDatePicker
              id="dob"
              name="dob"
              placeholder="dd/mm/yyyy"
              value={fields.dob}
              onValueChange={(t) => setField('dob', t)}
              settings={dobSettings}
              open={openId === 'dob'}
              onOpenChange={openChange('dob')}
              anotherOpen={openId !== null && openId !== 'dob'}
            />
          </div>
          <button id="book" type="submit">
            Book
          </button>
          <p id="summary" className={summary.error ? 'summary error' : 'summary'} role="status">
            {summary.text}
          </p>
        </form>
        <aside>
          <h2>Availability</h2>
          <div id="availability">
            <InlineDatePicker
              settings={availabilitySettings}
              onSelect={(dateText) => {
                // Picking a free date on the availability calendar fills in check-in.
                setField('checkin', dateText);
                checkinChosen(dateText);
              }}
            />
          </div>
          <p className="legend">
            <span className="swatch booked-swatch"></span> Fully booked
          </p>
        </aside>
      </main>
    </>
  );
}
