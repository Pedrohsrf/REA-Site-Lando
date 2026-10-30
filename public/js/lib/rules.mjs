// Business rules recovered from the original front-end bundle (lando-by-OFF+BRAND.05.js).
// Pure functions: shared by the server renderer, the browser and the tests.

/**
 * Calendar "Date Actual" field, format "D/M/YYYY H:MM".
 * The calendar sync treats it as a LOCAL calendar day (time ignored): new Date(y, m-1, d).
 */
export function parseRaceDay(dateActual) {
  if (!dateActual) return null;
  const parts = String(dateActual).trim().split(/[/ :]/);
  if (parts.length < 3) return null;
  const [d, m, y] = parts.map((p) => parseInt(p, 10));
  if ([d, m, y].some(Number.isNaN)) return null;
  return new Date(y, m - 1, d);
}

/**
 * Countdown target. The original parses the same "D/M/YYYY H:MM" string as UTC
 * (Date.UTC), although the page labels times as "*uk time".
 */
export function parseCountdownTarget(text) {
  const [datePart, timePart = '0:00'] = String(text).trim().split(' ');
  const [d, m, y] = datePart.split('/').map((p) => parseInt(p, 10));
  const [hh, mm] = timePart.split(':').map((p) => parseInt(p, 10));
  if ([d, m, y, hh, mm].some(Number.isNaN)) return null;
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
}

/** Days/hours/minutes/seconds left, zero padded. A target in the past shows all "00". */
export function countdownParts(target, now = new Date()) {
  const ms = target - now;
  if (!(ms >= 0)) return ['00', '00', '00', '00'];
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return [days, hours, minutes, seconds].map((n) => String(n).padStart(2, '0'));
}

/** Local midnight for "today", as the calendar sync does with setHours(0,0,0,0). */
export function startOfToday(now = new Date()) {
  const t = new Date(now);
  t.setHours(0, 0, 0, 0);
  return t;
}

/** A race is "in the past" when its day is strictly before today. */
export function isPast(race, now = new Date()) {
  const day = parseRaceDay(race.dateActual);
  return Boolean(day && day < startOfToday(now));
}

/** Sort by race day ascending; races without a valid date go last. */
export function sortByDate(races) {
  return [...races].sort((a, b) => {
    const da = parseRaceDay(a.dateActual);
    const db = parseRaceDay(b.dateActual);
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });
}

/** Index of the first race on/after today; when every race is past, the last one. */
export function currentIndex(sorted, now = new Date()) {
  const today = startOfToday(now);
  const i = sorted.findIndex((r) => {
    const d = parseRaceDay(r.dateActual);
    return d && d >= today;
  });
  return i === -1 ? sorted.length - 1 : i;
}

/** Next/previous controls loop around both ends. */
export function stepIndex(index, length, dir) {
  if (dir > 0) return index < length - 1 ? index + 1 : 0;
  return index > 0 ? index - 1 : length - 1;
}

/**
 * Position text "5th" -> {num:"5", suffix:"th", winner:false}. Only "\d+[a-zA-Z]+" is split;
 * any other value (DNF, DNS, NS, "") is returned unchanged. A "1" renders the suffix in lime.
 */
export function splitPosition(text) {
  const t = String(text ?? '').trim();
  const m = t.match(/^(\d+)([a-zA-Z]+)$/);
  if (!m) return { raw: t, num: null, suffix: null, winner: false };
  return { raw: t, num: m[1], suffix: m[2], winner: m[1] === '1' };
}

/** Round number zero padded below 10: 3 -> "03", 19 -> "19". Non numbers unchanged. */
export function formatRound(value) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return String(value);
  return n < 10 ? `0${n}` : `${n}`;
}

/** English ordinal for derived values (e.g. standings). */
export function ordinal(n) {
  const v = n % 100;
  const s = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${s}`;
}

/** Session labels: a visible sprint flag renames Practice 2/3 to Sprint Quali/Sprint. */
export function sessionLabels(sprint) {
  return {
    practice1: 'Practice 1',
    practice2: sprint ? 'Sprint Quali' : 'Practice 2',
    practice3: sprint ? 'Sprint' : 'Practice 3',
    qualifying: 'Qualifying',
    race: 'Race',
  };
}

const RESULT_MAP = {
  prac1Time: 'prac1TimeResult', prac1Date: 'prac1TimePos',
  prac2Time: 'prac2TimeResult', prac2Date: 'prac2TimePos',
  prac3Time: 'prac3TimeResult', prac3Date: 'prac3TimePos',
  qualTime: 'qualTimeResult', qualDate: 'qualTimePos',
  raceTime: 'raceTimeResult', raceDate: 'raceTimePos',
};

/**
 * Value shown in a visualiser schedule cell. For a past race, date cells show the
 * position and time cells show the result time, when a result exists; otherwise
 * the scheduled value is kept (the original falls back the same way).
 */
export function sessionCell(race, field, past) {
  if (past && RESULT_MAP[field]) {
    const v = race[RESULT_MAP[field]];
    if (v) return v;
  }
  return race[field] ?? '';
}

/**
 * Header over the schedule column. The original sets "Schedule" for past races too
 * (its log says "Changed Schedule to Results" but the code writes "Schedule").
 * FAITHFUL_RESULTS_LABEL keeps that behaviour; set to false to show "Results".
 */
export const FAITHFUL_RESULTS_LABEL = true;
export function scheduleHeader(past) {
  if (!past) return 'Schedule';
  return FAITHFUL_RESULTS_LABEL ? 'Schedule' : 'Results';
}

/** Trophy colour shown next to a finish: 1st gold, 2nd grey, 3rd bronze. */
export function trophyKind(finish) {
  const p = splitPosition(finish);
  if (!p.num) return null;
  return { 1: 'gold', 2: 'grey', 3: 'bronze' }[p.num] || null;
}

/** Previous race = last past race; next race = first upcoming race. */
export function raceContext(races, now = new Date()) {
  const sorted = sortByDate(races);
  const past = sorted.filter((r) => isPast(r, now));
  const upcoming = sorted.filter((r) => !isPast(r, now));
  return {
    sorted,
    past,
    upcoming,
    previous: past[past.length - 1] || null,
    next: upcoming[0] || null,
    currentIndex: currentIndex(sorted, now),
  };
}

/** Age in whole years on a given day. */
export function ageOn(birthDate, now = new Date()) {
  const b = new Date(birthDate);
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

/** Image index for the mouse-follow previews: proportional to cursor X across the row. */
export function hoverImageIndex(x, width, count) {
  if (!count) return -1;
  const f = Math.min(Math.max(0, x / width), 1);
  return Math.min(Math.floor(f * count), count - 1);
}
