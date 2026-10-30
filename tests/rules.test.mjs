import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRaceDay, parseCountdownTarget, countdownParts, isPast, sortByDate, currentIndex, stepIndex,
  splitPosition, formatRound, ordinal, sessionLabels, sessionCell, scheduleHeader, trophyKind,
  raceContext, ageOn, hoverImageIndex,
} from '../public/js/lib/rules.mjs';

const race = (dateActual, extra = {}) => ({ dateActual, ...extra });

test('parseRaceDay reads D/M/YYYY as a local day and ignores the time', () => {
  const d = parseRaceDay('1/11/2026 20:00');
  assert.equal(d.getFullYear(), 2026); assert.equal(d.getMonth(), 10); assert.equal(d.getDate(), 1);
  assert.equal(d.getHours(), 0);
  assert.equal(parseRaceDay(''), null);
  assert.equal(parseRaceDay('bad'), null);
});

test('countdown target is parsed as UTC, like the original Date.UTC call', () => {
  assert.equal(parseCountdownTarget('1/11/2026 20:00').toISOString(), '2026-11-01T20:00:00.000Z');
  assert.equal(parseCountdownTarget('22/11/2026 4:00').toISOString(), '2026-11-22T04:00:00.000Z');
});

test('countdownParts pads values and shows zeros once the race has started', () => {
  const target = new Date('2026-11-01T20:00:00Z');
  assert.deepEqual(countdownParts(target, new Date('2026-10-30T18:59:30Z')), ['02', '01', '00', '30']);
  assert.deepEqual(countdownParts(target, new Date('2026-11-02T00:00:00Z')), ['00', '00', '00', '00']);
  assert.deepEqual(countdownParts(target, target), ['00', '00', '00', '00']);
});

test('isPast compares the race day with local midnight today', () => {
  const now = new Date(2026, 9, 29, 15, 0);
  assert.equal(isPast(race('28/10/2026 23:00'), now), true);
  assert.equal(isPast(race('29/10/2026 1:00'), now), false, 'race day equal to today is not past');
  assert.equal(isPast(race(''), now), false);
});

test('sortByDate puts undated races last', () => {
  const s = sortByDate([race('3/5/2026 1:00', { n: 'b' }), race('', { n: 'x' }), race('8/3/2026 1:00', { n: 'a' })]);
  assert.deepEqual(s.map((r) => r.n), ['a', 'b', 'x']);
});

test('currentIndex is the first race today or later, else the last race', () => {
  const list = [race('8/3/2026 4:00'), race('1/11/2026 20:00'), race('6/12/2026 13:00')];
  assert.equal(currentIndex(list, new Date(2026, 9, 29)), 1);
  assert.equal(currentIndex(list, new Date(2026, 0, 1)), 0);
  assert.equal(currentIndex(list, new Date(2027, 0, 1)), 2);
});

test('next/previous loop around', () => {
  assert.equal(stepIndex(2, 3, 1), 0);
  assert.equal(stepIndex(0, 3, -1), 2);
  assert.equal(stepIndex(1, 3, 1), 2);
});

test('position formatting splits number and suffix; 1st is highlighted', () => {
  assert.deepEqual(splitPosition('5th'), { raw: '5th', num: '5', suffix: 'th', winner: false });
  assert.equal(splitPosition('1st').winner, true);
  assert.equal(splitPosition('11th').winner, false);
  assert.equal(splitPosition('DNF').num, null);
  assert.equal(splitPosition('').raw, '');
});

test('round formatting pads below ten', () => {
  assert.equal(formatRound(3), '03');
  assert.equal(formatRound('19'), '19');
  assert.equal(formatRound('x'), 'x');
});

test('ordinal suffixes', () => {
  assert.deepEqual([1, 2, 3, 4, 6, 11, 12, 13, 21, 22, 101].map(ordinal), ['1st', '2nd', '3rd', '4th', '6th', '11th', '12th', '13th', '21st', '22nd', '101st']);
});

test('sprint weekends rename Practice 2/3', () => {
  assert.equal(sessionLabels(true).practice2, 'Sprint Quali');
  assert.equal(sessionLabels(true).practice3, 'Sprint');
  assert.equal(sessionLabels(false).practice2, 'Practice 2');
});

test('past races show results in schedule cells, with fallback to the schedule', () => {
  const r = { raceDate: '8 Mar', raceTime: '4:00', raceTimePos: '5th', raceTimeResult: '1:23:58.542', qualDate: '7 Mar', qualTimePos: '' };
  assert.equal(sessionCell(r, 'raceDate', true), '5th');
  assert.equal(sessionCell(r, 'raceTime', true), '1:23:58.542');
  assert.equal(sessionCell(r, 'raceDate', false), '8 Mar');
  assert.equal(sessionCell(r, 'qualDate', true), '7 Mar', 'missing result keeps scheduled value');
});

test('schedule header keeps the original wording for past races', () => {
  assert.equal(scheduleHeader(false), 'Schedule');
  assert.equal(scheduleHeader(true), 'Schedule');
});

test('trophy colours for podium places only', () => {
  assert.deepEqual(['1st', '2nd', '3rd', '4th', 'DNF'].map(trophyKind), ['gold', 'grey', 'bronze', null, null]);
});

test('raceContext finds previous and next race', () => {
  const ctx = raceContext([race('25/10/2026 20:00', { id: 'us' }), race('1/11/2026 20:00', { id: 'mx' })], new Date(2026, 9, 29));
  assert.equal(ctx.previous.id, 'us');
  assert.equal(ctx.next.id, 'mx');
});

test('age is computed in whole years', () => {
  assert.equal(ageOn('1999-11-13', new Date(2026, 9, 29)), 26);
  assert.equal(ageOn('1999-11-13', new Date(2026, 10, 13)), 27);
});

test('hover image index is proportional to cursor X and clamped', () => {
  assert.equal(hoverImageIndex(0, 100, 10), 0);
  assert.equal(hoverImageIndex(55, 100, 10), 5);
  assert.equal(hoverImageIndex(100, 100, 10), 9);
  assert.equal(hoverImageIndex(-5, 100, 10), 0);
  assert.equal(hoverImageIndex(5, 100, 0), -1);
});
