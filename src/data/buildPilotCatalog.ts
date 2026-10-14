import { submitClaim, publishOwnerHours, reviewClaim } from '../domain/claims/claims';
import { emptyCatalog, type Catalog, type Profile } from '../domain/catalog';
import { reviewContribution, submitContribution } from '../domain/contributions/contributions';
import { importPlaces, syncFromProvider, type ImportReport } from '../domain/import/importPlaces';
import { FixturePlacesProvider } from '../services/api/fixtureProvider';
import { addDays, getZonedParts, weekdayFromDateKey, zonedLocalToUtc } from '../domain/time';
import { PILOT_CITY_ID, PILOT_PLACES, PILOT_PROVIDER } from './pilotPlaces';

const CITY_CREATED_AT = '2026-01-01T00:00:00.000Z';

function profile(id: string, displayName: string, role: Profile['role'] = 'user'): Profile {
  return { id, displayName, role, reputationScore: 0, createdAt: CITY_CREATED_AT };
}

function must<T extends { ok: boolean; message?: string }>(
  result: T,
  label: string,
): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`${label}: ${result.message ?? label}`);
  return result as Extract<T, { ok: true }>;
}

function businessId(catalog: Catalog, externalId: string): string {
  const source = catalog.sources.find((item) => item.externalId === externalId);
  if (!source) throw new Error(`Attività importata mancante: ${externalId}`);
  return source.businessId;
}

function recentLocalInstant(now: Date, acceptsWeekday: (weekday: number) => boolean, minutes: number): string {
  const today = getZonedParts(now, 'Europe/Rome').dateKey;
  for (let delta = 0; delta < 8; delta += 1) {
    const dateKey = addDays(today, -delta);
    if (!acceptsWeekday(weekdayFromDateKey(dateKey))) continue;
    const instant = zonedLocalToUtc(dateKey, minutes, 'Europe/Rome');
    if (!instant || instant.getTime() > now.getTime()) continue;
    return instant.toISOString();
  }
  throw new Error('Nessun orario locale recente trovato.');
}

export async function resyncPilotCatalog(
  catalog: Catalog,
  now = new Date(),
): Promise<{ catalog: Catalog; report: ImportReport }> {
  let sequence = 0;
  return syncFromProvider(catalog, new FixturePlacesProvider(), { cityId: PILOT_CITY_ID }, {
    now,
    id: () => `resync-${now.getTime()}-${sequence++}`,
    provider: PILOT_PROVIDER,
  });
}

export function buildPilotCatalog(now = new Date()): Catalog {
  let sequence = 0;
  const id = () => `pilot-${sequence++}`;
  const deps = { now, id };
  let catalog: Catalog = {
    ...emptyCatalog(),
    cities: [
      {
        id: PILOT_CITY_ID,
        name: 'Bologna',
        countryCode: 'IT',
        timezone: 'Europe/Rome',
        createdAt: CITY_CREATED_AT,
      },
    ],
    profiles: [
      profile('owner-brisa', 'Giulia Brisa'),
      profile('user-marta', 'Marta'),
      profile('user-luca', 'Luca'),
      profile('user-anna', 'Anna'),
      profile('user-paolo', 'Paolo'),
      profile('user-sara', 'Sara'),
      profile('mod-pilot', 'Moderazione pilota', 'moderator'),
    ],
  };

  catalog = importPlaces(catalog, PILOT_PLACES, { ...deps, provider: PILOT_PROVIDER, cityId: PILOT_CITY_ID }).catalog;

  const fornoId = businessId(catalog, 'forno-brisa');
  const claim = must(
    submitClaim(
      catalog,
      { businessId: fornoId, userId: 'owner-brisa', verificationMethod: 'document', note: 'Visura camerale' },
      deps,
    ),
    'rivendicazione',
  );
  catalog = must(
    reviewClaim(claim.catalog, { claimId: claim.claimId, reviewerId: 'mod-pilot', decision: 'verified' }, deps),
    'verifica titolare',
  ).catalog;
  catalog = must(
    publishOwnerHours(
      catalog,
      {
        userId: 'owner-brisa',
        businessId: fornoId,
        intervals: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          dayOfWeek,
          opensAt: '07:00',
          closesAt: '14:30',
        })),
      },
      deps,
    ),
    'orari titolare',
  ).catalog;

  const tomorrow = addDays(getZonedParts(now, 'Europe/Rome').dateKey, 1);
  const closure = must(
    submitContribution(
      catalog,
      {
        businessId: businessId(catalog, 'gelateria-gianni'),
        userId: 'user-marta',
        type: 'temporary_closure',
        payload: { date: tomorrow, reason: 'Festa di quartiere' },
      },
      deps,
    ),
    'chiusura gelateria',
  );
  catalog = must(
    reviewContribution(
      closure.catalog,
      { contributionId: closure.contribution.id, reviewerId: 'mod-pilot', decision: 'approved' },
      deps,
    ),
    'approvazione chiusura',
  ).catalog;

  const marketOpenAt = recentLocalInstant(now, (weekday) => weekday !== 7, 10 * 60);
  for (const userId of ['user-marta', 'user-luca', 'user-anna']) {
    catalog = must(
      submitContribution(
        catalog,
        {
          businessId: businessId(catalog, 'mercato-erbe'),
          userId,
          type: 'status_confirmation',
          payload: { observed: 'open', observedAt: marketOpenAt },
        },
        deps,
      ),
      'conferma mercato',
    ).catalog;
  }

  const barOpenAt = recentLocalInstant(now, () => true, 12 * 60);
  for (const userId of ['user-paolo', 'user-sara']) {
    catalog = must(
      submitContribution(
        catalog,
        {
          businessId: businessId(catalog, 'bar-pratello'),
          userId,
          type: 'status_confirmation',
          payload: { observed: 'closed', observedAt: barOpenAt },
        },
        deps,
      ),
      'conflitto bar',
    ).catalog;
  }

  return catalog;
}
