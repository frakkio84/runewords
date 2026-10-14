import {
  scheduleFor,
  type Business,
  type Catalog,
  type Provenance,
} from '../catalog';
import { isOpenAt, sameIntervals } from '../opening-hours/schedule';
import { PILOT_TRUST_POLICY, type TrustPolicy } from '../policy';

export type TrustLabel =
  | 'unverified'
  | 'community_confirmed'
  | 'owner_managed'
  | 'needs_reconfirmation';

export const TRUST_LABELS: Record<TrustLabel, string> = {
  unverified: 'Da verificare',
  community_confirmed: 'Confermato dalla community',
  owner_managed: 'Gestito dal titolare',
  needs_reconfirmation: 'Da riconfermare',
};

export const PROVENANCE_LABELS: Record<Provenance, string> = {
  external_provider: 'Importato',
  community: 'Community',
  verified_owner: 'Titolare verificato',
  moderator: 'Moderatore',
};

function hasVerifiedOwner(catalog: Catalog, businessId: string): boolean {
  return catalog.claims.some(
    (claim) => claim.businessId === businessId && claim.status === 'verified',
  );
}

function recentConfirmations(catalog: Catalog, business: Business, now: Date, policy: TrustPolicy) {
  const windowStart = now.getTime() - policy.confirmationWindowDays * 24 * 60 * 60 * 1000;
  const latestByUser = new Map<string, { observed: 'open' | 'closed'; observedAt: string; createdAt: string }>();
  for (const contribution of catalog.contributions) {
    if (contribution.businessId !== business.id || contribution.type !== 'status_confirmation') continue;
    if (contribution.status === 'rejected' || contribution.status === 'withdrawn') continue;
    if (Date.parse(contribution.createdAt) < windowStart) continue;
    const current = latestByUser.get(contribution.userId);
    if (!current || contribution.createdAt > current.createdAt) {
      latestByUser.set(contribution.userId, {
        observed: contribution.payload.observed,
        observedAt: contribution.payload.observedAt,
        createdAt: contribution.createdAt,
      });
    }
  }
  return latestByUser;
}

function pendingScheduleDispute(catalog: Catalog, business: Business): boolean {
  const published = business.scheduleKnown
    ? catalog.openingHours
        .filter((row) => row.businessId === business.id && row.version === business.hoursVersion)
        .map((row) => ({ dayOfWeek: row.dayOfWeek, opensAt: row.opensAt, closesAt: row.closesAt }))
    : [];
  return catalog.contributions.some((contribution) => {
    if (contribution.businessId !== business.id || contribution.status !== 'pending') return false;
    if (contribution.type === 'temporary_closure' || contribution.type === 'extraordinary_opening') {
      return true;
    }
    if (contribution.type === 'report_incorrect') return true;
    if (contribution.type === 'weekly_hours') {
      return !business.scheduleKnown || !sameIntervals(contribution.payload.intervals, published);
    }
    return false;
  });
}

export function trustLabel(
  catalog: Catalog,
  businessId: string,
  now: Date,
  policy: TrustPolicy = PILOT_TRUST_POLICY,
): TrustLabel {
  const business = catalog.businesses.find((item) => item.id === businessId);
  if (!business) return 'unverified';
  const schedule = scheduleFor(catalog, business);
  const confirmations = recentConfirmations(catalog, business, now, policy);
  let agreements = 0;
  let disagreements = 0;
  for (const confirmation of confirmations.values()) {
    const status = isOpenAt(schedule, new Date(confirmation.observedAt));
    if (status.status === 'unknown') continue;
    const agrees =
      (confirmation.observed === 'open' && status.status === 'open') ||
      (confirmation.observed === 'closed' && status.status === 'closed');
    if (agrees) agreements += 1;
    else disagreements += 1;
  }
  if (pendingScheduleDispute(catalog, business) || disagreements >= policy.conflictThreshold) {
    return 'needs_reconfirmation';
  }
  if (business.hoursSource === 'verified_owner' && hasVerifiedOwner(catalog, business.id)) {
    return 'owner_managed';
  }
  if (agreements >= policy.independentConfirmationThreshold) return 'community_confirmed';
  return 'unverified';
}
