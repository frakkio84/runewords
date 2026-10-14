import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cafeCatalog } from '../testing';
import { searchBusinesses } from './search';

describe('search', () => {
  it('filters by name, category, distance and open now, and keeps unknown hours', () => {
    const catalog = cafeCatalog();
    const unknown = {
      ...catalog.businesses[0],
      id: 'books',
      name: 'Libreria Nanni',
      category: 'libreria',
      latitude: 44.52,
      longitude: 11.36,
      scheduleKnown: false,
      hoursSource: null,
      hoursVersion: 0,
    };
    const withUnknown = { ...catalog, businesses: [...catalog.businesses, unknown] };
    const now = new Date('2026-10-14T09:00:00.000Z');

    const byName = searchBusinesses(withUnknown, { text: 'zanarini', now });
    assert.equal(byName.total, 1);
    assert.equal(byName.items[0]?.business.id, 'cafe');
    assert.equal(byName.items[0]?.open.status, 'open');

    const byCategory = searchBusinesses(withUnknown, { category: 'libreria', now });
    assert.equal(byCategory.total, 1);
    assert.equal(byCategory.items[0]?.statusLabel, 'Orari non disponibili');

    const nearby = searchBusinesses(withUnknown, {
      latitude: 44.4933,
      longitude: 11.3434,
      radiusMeters: 2000,
      now,
    });
    assert.deepEqual(
      nearby.items.map((item) => item.business.id),
      ['cafe'],
    );

    const openNow = searchBusinesses(withUnknown, { openNow: true, now });
    assert.equal(openNow.total, 1);
    assert.equal(openNow.items[0]?.business.id, 'cafe');

    const closedMoment = searchBusinesses(withUnknown, {
      openNow: true,
      now: new Date('2026-10-14T12:00:00.000Z'),
    });
    assert.equal(closedMoment.total, 0);

    const page = searchBusinesses(withUnknown, { now, limit: 1, offset: 1 });
    assert.equal(page.total, 2);
    assert.equal(page.items.length, 1);
  });
});
