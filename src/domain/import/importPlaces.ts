import {
  appendAudit,
  type Business,
  type Catalog,
  type DomainDeps,
} from '../catalog';
import { validateWeeklyIntervals } from '../opening-hours/schedule';
import { canonicalCategory, distanceMeters, normalizeName, tokenJaccard } from '../text';
import type { ImportedPlace, PlacesProvider } from './provider';

const DEDUPE_METERS = 80;

export type ImportIssue = { externalId?: string; message: string };

export type ImportReport = {
  created: number;
  refreshed: number;
  merged: number;
  skippedProtectedHours: string[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

function emptyReport(errors: ImportIssue[] = []): ImportReport {
  return {
    created: 0,
    refreshed: 0,
    merged: 0,
    skippedProtectedHours: [],
    errors,
    warnings: [],
  };
}

function hoursProtected(business: Business): boolean {
  return business.scheduleKnown && business.hoursSource !== null && business.hoursSource !== 'external_provider';
}

function placeError(place: ImportedPlace): string | null {
  if (!place.externalId?.trim()) return 'Identificativo esterno mancante.';
  if (!place.name?.trim() || place.name.trim().length < 2) return 'Nome mancante o troppo corto.';
  if (!Number.isFinite(place.latitude) || place.latitude < -90 || place.latitude > 90) {
    return 'Latitudine non valida.';
  }
  if (!Number.isFinite(place.longitude) || place.longitude < -180 || place.longitude > 180) {
    return 'Longitudine non valida.';
  }
  return null;
}

function findByExternal(catalog: Catalog, provider: string, externalId: string): Business | undefined {
  const source = catalog.sources.find(
    (item) => item.provider === provider && item.externalId === externalId,
  );
  if (!source) return undefined;
  return catalog.businesses.find((item) => item.id === source.businessId);
}

function findNearDuplicate(catalog: Catalog, cityId: string, place: ImportedPlace): Business | undefined {
  const normalized = normalizeName(place.name);
  let best: { business: Business; distance: number } | undefined;
  for (const business of catalog.businesses) {
    if (business.cityId !== cityId) continue;
    const distance = distanceMeters(business.latitude, business.longitude, place.latitude, place.longitude);
    if (distance > DEDUPE_METERS) continue;
    const sameName =
      normalizeName(business.name) === normalized || tokenJaccard(business.name, place.name) >= 0.75;
    if (!sameName) continue;
    if (!best || distance < best.distance) best = { business, distance };
  }
  return best?.business;
}

export function importPlaces(
  catalog: Catalog,
  places: ImportedPlace[],
  input: DomainDeps & { provider: string; cityId: string },
): { catalog: Catalog; report: ImportReport } {
  const city = catalog.cities.find((item) => item.id === input.cityId);
  if (!city) {
    return {
      catalog,
      report: emptyReport([{ message: 'Città pilota non configurata.' }]),
    };
  }
  let next = catalog;
  const report = emptyReport();
  const seenAt = input.now.toISOString();

  for (const place of places) {
    const error = placeError(place);
    if (error) {
      report.errors.push({ externalId: place.externalId, message: error });
      continue;
    }
    let hours = place.openingHours?.intervals;
    if (hours) {
      const validation = validateWeeklyIntervals(hours);
      if (validation) {
        report.warnings.push({ externalId: place.externalId, message: validation });
        hours = undefined;
      }
    }

    const externalMatch = findByExternal(next, input.provider, place.externalId);
    const nearMatch = externalMatch ? undefined : findNearDuplicate(next, input.cityId, place);
    const existing = externalMatch ?? nearMatch;
    if (!existing) {
      const businessId = input.id();
      const business: Business = {
        id: businessId,
        cityId: input.cityId,
        name: place.name.trim(),
        category: canonicalCategory(place.category),
        address: place.address?.trim() ?? '',
        latitude: place.latitude,
        longitude: place.longitude,
        status: 'active',
        scheduleKnown: Boolean(hours),
        hoursSource: hours ? 'external_provider' : null,
        hoursVersion: hours ? 1 : 0,
        createdAt: seenAt,
        updatedAt: seenAt,
      };
      const rows =
        hours?.map((interval) => ({
          id: input.id(),
          businessId,
          dayOfWeek: interval.dayOfWeek,
          opensAt: interval.opensAt,
          closesAt: interval.closesAt,
          source: 'external_provider' as const,
          version: 1,
          createdAt: seenAt,
        })) ?? [];
      next = {
        ...next,
        businesses: [...next.businesses, business],
        openingHours: [...next.openingHours, ...rows],
        sources: [
          ...next.sources,
          {
            id: input.id(),
            businessId,
            provider: input.provider,
            externalId: place.externalId,
            lastSeenAt: seenAt,
            attribution: place.attribution,
            createdAt: seenAt,
          },
        ],
      };
      report.created += 1;
      continue;
    }

    const protectedHours = hoursProtected(existing);
    const providerOwned = !protectedHours && existing.status !== 'closed_permanently';
    const updatedBusiness: Business = {
      ...existing,
      name: providerOwned ? place.name.trim() : existing.name,
      category: providerOwned ? canonicalCategory(place.category) : existing.category,
      address: providerOwned ? place.address?.trim() ?? existing.address : existing.address,
      latitude: providerOwned ? place.latitude : existing.latitude,
      longitude: providerOwned ? place.longitude : existing.longitude,
      updatedAt: seenAt,
    };

    let openingHours = next.openingHours;
    if (hours && protectedHours) {
      report.skippedProtectedHours.push(existing.id);
    } else if (hours && existing.status !== 'closed_permanently') {
      const current = next.openingHours.filter(
        (row) => row.businessId === existing.id && row.version === existing.hoursVersion,
      );
      const same =
        existing.scheduleKnown &&
        existing.hoursSource === 'external_provider' &&
        current.length === hours.length &&
        hours.every((interval) =>
          current.some(
            (row) =>
              row.dayOfWeek === interval.dayOfWeek &&
              row.opensAt === interval.opensAt &&
              row.closesAt === interval.closesAt,
          ),
        );
      if (!same) {
        const version = existing.hoursVersion + 1;
        updatedBusiness.scheduleKnown = true;
        updatedBusiness.hoursSource = 'external_provider';
        updatedBusiness.hoursVersion = version;
        openingHours = [
          ...openingHours,
          ...hours.map((interval) => ({
            id: input.id(),
            businessId: existing.id,
            dayOfWeek: interval.dayOfWeek,
            opensAt: interval.opensAt,
            closesAt: interval.closesAt,
            source: 'external_provider' as const,
            version,
            createdAt: seenAt,
          })),
        ];
      }
    }

    const hasSource = next.sources.some(
      (source) => source.provider === input.provider && source.externalId === place.externalId,
    );
    next = {
      ...next,
      businesses: next.businesses.map((item) => (item.id === existing.id ? updatedBusiness : item)),
      openingHours,
      sources: hasSource
        ? next.sources.map((source) =>
            source.provider === input.provider && source.externalId === place.externalId
              ? { ...source, lastSeenAt: seenAt, attribution: place.attribution ?? source.attribution }
              : source,
          )
        : [
            ...next.sources,
            {
              id: input.id(),
              businessId: existing.id,
              provider: input.provider,
              externalId: place.externalId,
              lastSeenAt: seenAt,
              attribution: place.attribution,
              createdAt: seenAt,
            },
          ],
    };
    if (externalMatch) report.refreshed += 1;
    else report.merged += 1;
  }

  if (report.errors.length > 0) {
    next = appendAudit(next, {
      id: input.id(),
      actorId: 'import',
      entityType: 'import',
      entityId: input.cityId,
      action: 'import_errors',
      beforeSnapshot: null,
      afterSnapshot: report.errors,
      createdAt: seenAt,
    });
  }
  return { catalog: next, report };
}

export async function syncFromProvider(
  catalog: Catalog,
  provider: PlacesProvider,
  params: { cityId: string; query?: string; latitude?: number; longitude?: number; radiusMeters?: number },
  deps: DomainDeps & { provider: string },
): Promise<{ catalog: Catalog; report: ImportReport }> {
  try {
    const places = await provider.searchPlaces(params);
    return importPlaces(catalog, places, { ...deps, cityId: params.cityId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore del provider.';
    const report = emptyReport([{ message }]);
    return {
      catalog: appendAudit(catalog, {
        id: deps.id(),
        actorId: 'import',
        entityType: 'import',
        entityId: params.cityId,
        action: 'import_provider_failure',
        beforeSnapshot: null,
        afterSnapshot: { message },
        createdAt: deps.now.toISOString(),
      }),
      report,
    };
  }
}
