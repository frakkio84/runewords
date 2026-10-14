import { emptyCatalog, type Catalog, type DomainDeps, type Profile } from './catalog';

export function testDeps(iso = '2026-10-14T09:00:00.000Z'): DomainDeps & { ids: () => string[] } {
  const issued: string[] = [];
  return {
    now: new Date(iso),
    id: () => {
      const value = `id-${issued.length + 1}`;
      issued.push(value);
      return value;
    },
    ids: () => issued,
  };
}

export function user(id: string, role: Profile['role'] = 'user', name = id): Profile {
  return {
    id,
    displayName: name,
    role,
    reputationScore: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

export function cafeCatalog(profiles: Profile[] = [user('ada'), user('mod', 'moderator', 'Mod')]): Catalog {
  const days = [1, 2, 3, 4, 5, 6, 7];
  return {
    ...emptyCatalog(),
    cities: [
      {
        id: 'bologna',
        name: 'Bologna',
        countryCode: 'IT',
        timezone: 'Europe/Rome',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    profiles,
    businesses: [
      {
        id: 'cafe',
        cityId: 'bologna',
        name: 'Caffè Zanarini',
        category: 'caffetteria',
        address: 'Piazza Galvani 1',
        latitude: 44.4933,
        longitude: 11.3434,
        status: 'active',
        scheduleKnown: true,
        hoursSource: 'external_provider',
        hoursVersion: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    openingHours: days.flatMap((dayOfWeek) => [
      {
        id: `open-${dayOfWeek}`,
        businessId: 'cafe',
        dayOfWeek,
        opensAt: '08:00',
        closesAt: '12:00',
        source: 'external_provider' as const,
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: `late-${dayOfWeek}`,
        businessId: 'cafe',
        dayOfWeek,
        opensAt: '15:00',
        closesAt: '19:00',
        source: 'external_provider' as const,
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]),
  };
}
