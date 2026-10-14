import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, zonedLocalToUtc } from '../time';
import {
  describeIntervals,
  describeStatus,
  getNextClosing,
  getNextOpening,
  isOpenAt,
  type Schedule,
  validateWeeklyIntervals,
} from './schedule';

const ROME = 'Europe/Rome';

function at(iso: string): Date {
  return new Date(iso);
}

function weekly(
  intervals: Schedule['weekly'],
  specials: Schedule['specials'] = [],
): Schedule {
  return { weekly: intervals, specials, timeZone: ROME };
}

function everyDay(opensAt: string, closesAt: string) {
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({ dayOfWeek, opensAt, closesAt }));
}

describe('opening hours', () => {
  it('represents two shifts in the same day', () => {
    const schedule = weekly([
      { dayOfWeek: 1, opensAt: '09:00', closesAt: '13:00' },
      { dayOfWeek: 1, opensAt: '15:00', closesAt: '19:00' },
    ]);
    assert.equal(describeIntervals(schedule.weekly ?? []), '09:00–13:00, 15:00–19:00');
    assert.equal(isOpenAt(schedule, at('2026-10-12T08:00:00Z')).status, 'open');
    assert.equal(isOpenAt(schedule, at('2026-10-12T12:00:00Z')).status, 'closed');
    assert.equal(isOpenAt(schedule, at('2026-10-12T14:00:00Z')).status, 'open');
    assert.equal(isOpenAt(schedule, at('2026-10-12T17:00:00Z')).status, 'closed');
    const midday = isOpenAt(schedule, at('2026-10-12T12:00:00Z'));
    assert.equal(midday.status, 'closed');
    if (midday.status === 'closed') {
      assert.deepEqual(midday.nextOpening, { dateKey: '2026-10-12', minutes: 15 * 60 });
    }
  });

  it('keeps the correct state across midnight', () => {
    const schedule = weekly([{ dayOfWeek: 5, opensAt: '22:00', closesAt: '02:00' }]);
    assert.equal(isOpenAt(schedule, at('2026-10-16T19:00:00Z')).status, 'closed');
    assert.equal(isOpenAt(schedule, at('2026-10-16T21:00:00Z')).status, 'open');
    const late = isOpenAt(schedule, at('2026-10-16T21:00:00Z'));
    if (late.status === 'open') {
      assert.deepEqual(late.nextClosing, { dateKey: '2026-10-17', minutes: 2 * 60 });
    }
    assert.equal(isOpenAt(schedule, at('2026-10-16T23:00:00Z')).status, 'open');
    assert.equal(isOpenAt(schedule, at('2026-10-17T01:00:00Z')).status, 'closed');
    assert.equal(getNextClosing(schedule, at('2026-10-16T23:00:00Z'))?.minutes, 2 * 60);
  });

  it('lets a dated exception replace the weekly schedule', () => {
    const schedule = weekly(everyDay('09:00', '18:00'), [
      { date: '2026-10-14', isClosed: true },
    ]);
    assert.equal(isOpenAt(schedule, at('2026-10-13T10:00:00Z')).status, 'open');
    assert.equal(isOpenAt(schedule, at('2026-10-14T10:00:00Z')).status, 'closed');
    assert.equal(isOpenAt(schedule, at('2026-10-15T10:00:00Z')).status, 'open');

    const narrowed = weekly(everyDay('09:00', '18:00'), [
      { date: '2026-10-14', isClosed: false, opensAt: '10:00', closesAt: '12:00' },
    ]);
    assert.equal(isOpenAt(narrowed, at('2026-10-14T07:30:00Z')).status, 'closed');
    assert.equal(isOpenAt(narrowed, at('2026-10-14T09:00:00Z')).status, 'open');
    assert.equal(isOpenAt(narrowed, at('2026-10-14T11:00:00Z')).status, 'closed');
  });

  it('suppresses an overnight spill when the next day is an exception', () => {
    const schedule = weekly([{ dayOfWeek: 5, opensAt: '22:00', closesAt: '02:00' }], [
      { date: '2026-10-17', isClosed: true },
    ]);
    assert.equal(isOpenAt(schedule, at('2026-10-16T21:00:00Z')).status, 'open');
    assert.equal(isOpenAt(schedule, at('2026-10-16T23:00:00Z')).status, 'closed');
  });

  it('uses the business time zone and daylight-saving transitions', () => {
    const schedule = weekly(everyDay('09:00', '18:00'));
    assert.equal(isOpenAt(schedule, at('2026-01-15T07:59:00Z')).status, 'closed');
    assert.equal(isOpenAt(schedule, at('2026-01-15T08:00:00Z')).status, 'open');
    assert.equal(isOpenAt(schedule, at('2026-07-15T06:59:00Z')).status, 'closed');
    assert.equal(isOpenAt(schedule, at('2026-07-15T07:00:00Z')).status, 'open');

    const spring = weekly([{ dayOfWeek: 7, opensAt: '01:00', closesAt: '03:30' }]);
    assert.equal(isOpenAt(spring, at('2026-03-29T00:30:00Z')).status, 'open');
    assert.equal(isOpenAt(spring, at('2026-03-29T01:00:00Z')).status, 'open');
    assert.equal(isOpenAt(spring, at('2026-03-29T01:30:00Z')).status, 'closed');

    const autumn = weekly([{ dayOfWeek: 7, opensAt: '01:00', closesAt: '03:30' }]);
    assert.equal(isOpenAt(autumn, at('2026-10-25T00:30:00Z')).status, 'open');
    assert.equal(isOpenAt(autumn, at('2026-10-25T01:30:00Z')).status, 'open');
    assert.equal(isOpenAt(autumn, at('2026-10-25T02:00:00Z')).status, 'open');
    assert.equal(isOpenAt(autumn, at('2026-10-25T02:30:00Z')).status, 'closed');
  });

  it('does not treat unknown hours as closed', () => {
    const schedule = weekly(null);
    const status = isOpenAt(schedule, at('2026-10-14T10:00:00Z'));
    assert.equal(status.status, 'unknown');
    assert.equal(describeStatus(status, '2026-10-14'), 'Orari non disponibili');
    assert.equal(getNextOpening(schedule, at('2026-10-14T10:00:00Z')), null);
    assert.notEqual(describeStatus(status, '2026-10-14'), 'Chiuso');
  });

  it('treats an explicit empty week as closed and a 24 hour day as open', () => {
    const closed = weekly([]);
    assert.equal(isOpenAt(closed, at('2026-10-14T10:00:00Z')).status, 'closed');
    const always = weekly(everyDay('00:00', '24:00'));
    const status = isOpenAt(always, at('2026-10-14T01:00:00Z'));
    assert.equal(status.status, 'open');
    if (status.status === 'open') assert.equal(status.nextClosing, null);
    assert.equal(describeStatus(status, '2026-10-14'), 'Aperto 24 ore su 24');
    assert.equal(isOpenAt(weekly(everyDay('00:00', '00:00')), at('2026-10-14T22:00:00Z')).status, 'open');
  });

  it('ignores an exception outside its validity window', () => {
    const schedule = weekly(everyDay('09:00', '18:00'), [
      {
        date: '2026-10-14',
        isClosed: true,
        validFrom: '2026-10-01T00:00:00Z',
        validUntil: '2026-10-10T00:00:00Z',
      },
    ]);
    assert.equal(isOpenAt(schedule, at('2026-10-14T10:00:00Z')).status, 'open');
  });

  it('returns the following opening after the current interval', () => {
    const schedule = weekly([
      { dayOfWeek: 1, opensAt: '09:00', closesAt: '13:00' },
      { dayOfWeek: 1, opensAt: '15:00', closesAt: '19:00' },
    ]);
    assert.deepEqual(getNextOpening(schedule, at('2026-10-12T08:00:00Z')), {
      dateKey: '2026-10-12',
      minutes: 15 * 60,
    });
    assert.deepEqual(getNextClosing(schedule, at('2026-10-12T08:00:00Z')), {
      dateKey: '2026-10-12',
      minutes: 13 * 60,
    });
  });

  it('rejects overlapping or malformed intervals', () => {
    assert.equal(
      validateWeeklyIntervals([
        { dayOfWeek: 1, opensAt: '09:00', closesAt: '13:00' },
        { dayOfWeek: 1, opensAt: '12:00', closesAt: '15:00' },
      ]),
      'Le fasce orarie si sovrappongono.',
    );
    assert.equal(
      validateWeeklyIntervals([{ dayOfWeek: 1, opensAt: '25:00', closesAt: '26:00' }]),
      'Orario non valido. Usa il formato HH:mm.',
    );
    assert.equal(
      validateWeeklyIntervals([
        { dayOfWeek: 5, opensAt: '22:00', closesAt: '02:00' },
        { dayOfWeek: 6, opensAt: '01:00', closesAt: '04:00' },
      ]),
      'Le fasce orarie si sovrappongono.',
    );
    assert.equal(
      validateWeeklyIntervals([{ dayOfWeek: 1, opensAt: '09:00', closesAt: '12:00' }]),
      null,
    );
  });

  it('converts local Rome times and skips the spring-forward gap', () => {
    const winter = zonedLocalToUtc('2026-01-15', 9 * 60, ROME);
    assert.equal(winter?.toISOString(), '2026-01-15T08:00:00.000Z');
    const summer = zonedLocalToUtc('2026-07-15', 9 * 60, ROME);
    assert.equal(summer?.toISOString(), '2026-07-15T07:00:00.000Z');
    assert.equal(zonedLocalToUtc('2026-03-29', 2 * 60 + 30, ROME), null);
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  });
});
