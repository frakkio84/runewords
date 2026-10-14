import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentOpeningHours } from '../domain/catalog';
import { publishedHoursUnchanged, submitContribution } from '../domain/contributions/contributions';
import { isOpenAt } from '../domain/opening-hours/schedule';
import { searchBusinesses } from '../domain/search/search';
import { scheduleFor } from '../domain/catalog';
import { addDays, getZonedParts } from '../domain/time';
import { trustLabel } from '../domain/trust/trust';
import { buildPilotCatalog, resyncPilotCatalog } from './buildPilotCatalog';
import { CITY_CENTER } from './pilotPlaces';

const NOW = new Date('2026-10-14T10:00:00.000Z');

describe('Bologna pilot catalog', () => {
  it('supports the first milestone: search, status, provenance and a pending correction', async () => {
    const catalog = buildPilotCatalog(NOW);
    const found = searchBusinesses(catalog, { text: 'zanarini', now: NOW });
    assert.equal(found.total, 1);
    const cafe = found.items[0];
    assert.ok(cafe);
    assert.equal(cafe.open.status, 'open');
    assert.equal(cafe.trust, 'unverified');
    assert.equal(cafe.business.hoursSource, 'external_provider');
    assert.equal(
      currentOpeningHours(catalog, cafe.business.id).filter((row) => row.dayOfWeek === 3).length,
      2,
    );

    const proposal = submitContribution(
      catalog,
      {
        businessId: cafe.business.id,
        userId: 'user-luca',
        type: 'weekly_hours',
        payload: { intervals: [{ dayOfWeek: 3, opensAt: '10:00', closesAt: '18:00' }] },
      },
      { now: NOW, id: () => 'milestone-1' },
    );
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;
    assert.equal(proposal.contribution.status, 'pending');
    assert.equal(publishedHoursUnchanged(catalog, proposal.catalog, cafe.business.id), true);
    assert.equal(
      proposal.catalog.contributions.some((item) => item.id === proposal.contribution.id),
      true,
    );

    const books = searchBusinesses(catalog, { text: 'nanni', now: NOW }).items[0];
    assert.equal(books?.open.status, 'unknown');
    assert.equal(books?.statusLabel, 'Orari non disponibili');

    const forno = catalog.businesses.find((item) => item.name === 'Forno Brisa');
    assert.ok(forno);
    assert.equal(trustLabel(catalog, forno.id, NOW), 'owner_managed');
    assert.equal(currentOpeningHours(catalog, forno.id)[0]?.opensAt, '07:00');
    assert.equal(trustLabel(catalog, catalog.businesses.find((item) => item.name === 'Mercato delle Erbe')!.id, NOW), 'community_confirmed');
    assert.equal(trustLabel(catalog, catalog.businesses.find((item) => item.name === 'Bar del Pratello')!.id, NOW), 'needs_reconfirmation');

    const gelateria = catalog.businesses.find((item) => item.name === 'Gelateria Gianni');
    assert.ok(gelateria);
    const tomorrowKey = addDays(getZonedParts(NOW, 'Europe/Rome').dateKey, 1);
    const tomorrow = new Date(`${tomorrowKey}T10:00:00.000Z`);
    assert.equal(isOpenAt(scheduleFor(catalog, gelateria), tomorrow).status, 'closed');

    const near = searchBusinesses(catalog, {
      latitude: CITY_CENTER.latitude,
      longitude: CITY_CENTER.longitude,
      radiusMeters: 2000,
      now: NOW,
    });
    assert.equal(near.items.some((item) => item.business.name === 'Trattoria di San Luca'), false);
    assert.equal(near.items.some((item) => item.business.name === 'Caffè Zanarini'), true);

    const before = catalog.businesses.length;
    const resynced = await resyncPilotCatalog(catalog, new Date('2026-10-14T12:00:00.000Z'));
    assert.equal(resynced.catalog.businesses.length, before);
    assert.equal(resynced.report.created, 0);
    assert.equal(currentOpeningHours(resynced.catalog, forno.id)[0]?.opensAt, '07:00');
    assert.ok(resynced.report.skippedProtectedHours.includes(forno.id));
  });
});
