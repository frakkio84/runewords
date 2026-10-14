import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentOpeningHours, emptyCatalog } from '../catalog';
import { cafeCatalog, testDeps } from '../testing';
import { importPlaces, syncFromProvider } from './importPlaces';
import type { ImportedPlace, PlacesProvider } from './provider';

const city = {
  id: 'bologna',
  name: 'Bologna',
  countryCode: 'IT',
  timezone: 'Europe/Rome',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function place(overrides: Partial<ImportedPlace> = {}): ImportedPlace {
  return {
    externalId: 'cafe-1',
    name: 'Caffè Zanarini',
    category: 'cafe',
    latitude: 44.4933,
    longitude: 11.3434,
    address: 'Piazza Galvani 1',
    openingHours: { intervals: [{ dayOfWeek: 1, opensAt: '08:00', closesAt: '12:00' }] },
    attribution: 'Catalogo pilota',
    ...overrides,
  };
}

function run(places: ImportedPlace[], catalog = { ...emptyCatalog(), cities: [city] }, iso = '2026-10-14T09:00:00.000Z') {
  return importPlaces(catalog, places, { ...testDeps(iso), provider: 'pilot', cityId: 'bologna' });
}

describe('import', () => {
  it('does not create duplicates when repeated and keeps provenance', () => {
    const first = run([place(), place()]);
    assert.equal(first.report.created, 1);
    assert.equal(first.report.refreshed, 1);
    assert.equal(first.catalog.businesses.length, 1);
    assert.equal(first.catalog.sources.length, 1);
    assert.equal(first.catalog.businesses[0]?.hoursSource, 'external_provider');
    assert.equal(first.catalog.sources[0]?.attribution, 'Catalogo pilota');
    assert.equal(first.catalog.businesses[0]?.category, 'caffetteria');

    const second = run([place()], first.catalog, '2026-10-15T09:00:00.000Z');
    assert.equal(second.catalog.businesses.length, 1);
    assert.equal(second.catalog.sources.length, 1);
    assert.equal(second.report.created, 0);
    assert.equal(second.catalog.sources[0]?.lastSeenAt, '2026-10-15T09:00:00.000Z');
    assert.equal(currentOpeningHours(second.catalog, second.catalog.businesses[0].id).length, 1);
  });

  it('merges a nearby textual duplicate and records invalid rows', () => {
    const result = run([
      place(),
      place({
        externalId: 'cafe-typo',
        name: 'Caffe Zanarini',
        latitude: 44.49335,
        longitude: 11.34345,
      }),
      place({ externalId: 'bad', name: 'X', latitude: 120, longitude: 11 }),
      place({
        externalId: 'book',
        name: 'Libreria Nanni',
        category: 'bookstore',
        latitude: 44.5,
        longitude: 11.35,
        openingHours: { intervals: [{ dayOfWeek: 1, opensAt: '99:00', closesAt: '10:00' }] },
      }),
    ]);
    assert.equal(result.catalog.businesses.length, 2);
    assert.equal(result.report.merged, 1);
    assert.equal(result.report.errors.length, 1);
    assert.equal(result.report.warnings.length, 1);
    assert.equal(result.catalog.businesses.find((item) => item.name === 'Libreria Nanni')?.scheduleKnown, false);
    assert.ok(result.catalog.auditLog.some((entry) => entry.action === 'import_errors'));
  });

  it('does not overwrite protected local hours or a permanent closure', () => {
    const base = cafeCatalog();
    const protectedCatalog = {
      ...base,
      businesses: base.businesses.map((business) => ({
        ...business,
        hoursSource: 'verified_owner' as const,
        name: 'Forno Brisa',
      })),
      openingHours: base.openingHours.map((row) => ({ ...row, source: 'verified_owner' as const, opensAt: '07:00' })),
    };
    const linked = {
      ...protectedCatalog,
      sources: [
        {
          id: 'src-1',
          businessId: 'cafe',
          provider: 'pilot',
          externalId: 'cafe-1',
          lastSeenAt: '2026-10-01T00:00:00.000Z',
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    };
    const result = run(
      [
        place({
          name: 'Nome dal provider',
          address: 'Via sbagliata',
          openingHours: { intervals: [{ dayOfWeek: 1, opensAt: '11:00', closesAt: '12:00' }] },
        }),
      ],
      linked,
    );
    assert.equal(result.catalog.businesses.length, 1);
    assert.equal(result.catalog.businesses[0]?.name, 'Forno Brisa');
    assert.equal(result.catalog.businesses[0]?.hoursSource, 'verified_owner');
    assert.equal(currentOpeningHours(result.catalog, 'cafe')[0]?.opensAt, '07:00');
    assert.ok(result.report.skippedProtectedHours.includes('cafe'));

    const closed = {
      ...linked,
      businesses: linked.businesses.map((business) => ({ ...business, status: 'closed_permanently' as const })),
    };
    const reopened = run([place({ name: 'Di nuovo aperto' })], closed, '2026-10-16T09:00:00.000Z');
    assert.equal(reopened.catalog.businesses[0]?.status, 'closed_permanently');
    assert.equal(reopened.catalog.businesses.length, 1);
  });

  it('records a provider failure without creating businesses', async () => {
    const provider: PlacesProvider = {
      async searchPlaces() {
        throw new Error('timeout del provider');
      },
      async getPlace() {
        return null;
      },
    };
    const result = await syncFromProvider(
      { ...emptyCatalog(), cities: [city] },
      provider,
      { cityId: 'bologna' },
      { ...testDeps(), provider: 'pilot' },
    );
    assert.equal(result.catalog.businesses.length, 0);
    assert.equal(result.report.errors[0]?.message, 'timeout del provider');
    assert.ok(result.catalog.auditLog.some((entry) => entry.action === 'import_provider_failure'));
  });
});
