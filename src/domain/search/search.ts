import { scheduleFor, type Business, type Catalog } from '../catalog';
import { describeStatus, isOpenAt, type OpenStatus } from '../opening-hours/schedule';
import { getZonedParts } from '../time';
import { distanceMeters, normalizeName } from '../text';
import { trustLabel, type TrustLabel } from '../trust/trust';

export type SearchQuery = {
  text?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  openNow?: boolean;
  now: Date;
  limit?: number;
  offset?: number;
};

export type SearchHit = {
  business: Business;
  distanceMeters: number | null;
  open: OpenStatus;
  statusLabel: string;
  trust: TrustLabel;
};

export function searchBusinesses(catalog: Catalog, query: SearchQuery): { items: SearchHit[]; total: number } {
  const text = query.text ? normalizeName(query.text) : '';
  const located =
    query.latitude !== undefined &&
    query.longitude !== undefined &&
    Number.isFinite(query.latitude) &&
    Number.isFinite(query.longitude);
  const hits: SearchHit[] = [];
  for (const business of catalog.businesses) {
    if (business.status === 'closed_permanently') continue;
    if (query.category && business.category !== query.category) continue;
    if (text && !normalizeName(business.name).includes(text) && !normalizeName(business.category).includes(text)) {
      continue;
    }
    const distance = located
      ? distanceMeters(query.latitude as number, query.longitude as number, business.latitude, business.longitude)
      : null;
    if (located && query.radiusMeters !== undefined && distance !== null && distance > query.radiusMeters) {
      continue;
    }
    const schedule = scheduleFor(catalog, business);
    const open = isOpenAt(schedule, query.now);
    if (query.openNow && open.status !== 'open') continue;
    const todayKey = getZonedParts(query.now, schedule.timeZone).dateKey;
    hits.push({
      business,
      distanceMeters: distance,
      open,
      statusLabel:
        business.status === 'under_review'
          ? `In revisione · ${describeStatus(open, todayKey)}`
          : describeStatus(open, todayKey),
      trust: trustLabel(catalog, business.id, query.now),
    });
  }
  hits.sort((a, b) => {
    if (a.distanceMeters !== null && b.distanceMeters !== null && a.distanceMeters !== b.distanceMeters) {
      return a.distanceMeters - b.distanceMeters;
    }
    return a.business.name.localeCompare(b.business.name, 'it');
  });
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 20;
  return { items: hits.slice(offset, offset + limit), total: hits.length };
}
