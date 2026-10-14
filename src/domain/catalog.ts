import type { SpecialInterval, WeeklyInterval } from './opening-hours/schedule';

export type Provenance = 'external_provider' | 'community' | 'verified_owner' | 'moderator';

export type BusinessStatus = 'active' | 'closed_permanently' | 'under_review';

export type City = {
  id: string;
  name: string;
  countryCode: string;
  timezone: string;
  createdAt: string;
};

export type Business = {
  id: string;
  cityId: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  status: BusinessStatus;
  /** False when no weekly schedule has been published. Unknown is not closed. */
  scheduleKnown: boolean;
  hoursSource: Provenance | null;
  /** Published version. Older rows are history and are not current. */
  hoursVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type BusinessSource = {
  id: string;
  businessId: string;
  provider: string;
  externalId: string;
  lastSeenAt: string;
  attribution?: string;
  createdAt: string;
};

export type OpeningHoursInterval = WeeklyInterval & {
  id: string;
  businessId: string;
  source: Provenance;
  version: number;
  createdAt: string;
};

export type SpecialHours = {
  id: string;
  businessId: string;
  date: string;
  isClosed: boolean;
  opensAt?: string;
  closesAt?: string;
  reason?: string;
  validFrom?: string;
  validUntil?: string;
  createdBy?: string;
  source: Provenance;
  createdAt: string;
};

export type ContributionStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

type ContributionBase = {
  id: string;
  businessId: string;
  userId: string;
  status: ContributionStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  decisionReason?: string;
};

export type Contribution =
  | (ContributionBase & {
      type: 'status_confirmation';
      payload: { observed: 'open' | 'closed'; observedAt: string };
    })
  | (ContributionBase & {
      type: 'weekly_hours';
      payload: { intervals: WeeklyInterval[] };
    })
  | (ContributionBase & {
      type: 'temporary_closure';
      payload: { date: string; reason?: string };
    })
  | (ContributionBase & {
      type: 'extraordinary_opening';
      payload: { date: string; opensAt: string; closesAt: string; reason?: string };
    })
  | (ContributionBase & {
      type: 'report_incorrect';
      payload: {
        kind: 'closed_permanently' | 'wrong_details';
        note?: string;
        name?: string;
        category?: string;
        address?: string;
      };
    });

export type ContributionType = Contribution['type'];

export type ClaimStatus = 'pending' | 'verified' | 'rejected' | 'revoked';

export type VerificationMethod = 'document' | 'business_contact' | 'manual_review';

export type BusinessClaim = {
  id: string;
  businessId: string;
  userId: string;
  verificationMethod: VerificationMethod;
  note?: string;
  status: ClaimStatus;
  verifiedAt?: string;
  reviewedBy?: string;
  createdAt: string;
};

export type ProfileRole = 'user' | 'moderator';

export type Profile = {
  id: string;
  displayName: string;
  role: ProfileRole;
  reputationScore: number;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  createdAt: string;
};

export type Catalog = {
  cities: City[];
  businesses: Business[];
  sources: BusinessSource[];
  openingHours: OpeningHoursInterval[];
  specialHours: SpecialHours[];
  contributions: Contribution[];
  claims: BusinessClaim[];
  profiles: Profile[];
  auditLog: AuditEntry[];
};

export type DomainDeps = {
  now: Date;
  id: () => string;
};

export function emptyCatalog(): Catalog {
  return {
    cities: [],
    businesses: [],
    sources: [],
    openingHours: [],
    specialHours: [],
    contributions: [],
    claims: [],
    profiles: [],
    auditLog: [],
  };
}

export function cityOf(catalog: Catalog, cityId: string): City | undefined {
  return catalog.cities.find((city) => city.id === cityId);
}

export function currentOpeningHours(catalog: Catalog, businessId: string): OpeningHoursInterval[] {
  const business = catalog.businesses.find((item) => item.id === businessId);
  if (!business || !business.scheduleKnown) return [];
  return catalog.openingHours.filter(
    (row) => row.businessId === businessId && row.version === business.hoursVersion,
  );
}

export function effectiveSpecials(catalog: Catalog, businessId: string): SpecialInterval[] {
  const rows = catalog.specialHours.filter((row) => row.businessId === businessId);
  const latestByDate = new Map<string, string>();
  for (const row of rows) {
    const current = latestByDate.get(row.date);
    if (!current || row.createdAt > current) latestByDate.set(row.date, row.createdAt);
  }
  return rows
    .filter((row) => row.createdAt === latestByDate.get(row.date))
    .map((row) => ({
      date: row.date,
      isClosed: row.isClosed,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
    }));
}

export function scheduleFor(catalog: Catalog, business: Business) {
  const city = cityOf(catalog, business.cityId);
  return {
    weekly: business.scheduleKnown
      ? currentOpeningHours(catalog, business.id).map((row) => ({
          dayOfWeek: row.dayOfWeek,
          opensAt: row.opensAt,
          closesAt: row.closesAt,
        }))
      : null,
    specials: effectiveSpecials(catalog, business.id),
    timeZone: city?.timezone ?? 'Europe/Rome',
  };
}

export function appendAudit(catalog: Catalog, entry: AuditEntry): Catalog {
  return { ...catalog, auditLog: [...catalog.auditLog, entry] };
}

export function upsertProfile(catalog: Catalog, profile: Profile): Catalog {
  const exists = catalog.profiles.some((item) => item.id === profile.id);
  return {
    ...catalog,
    profiles: exists
      ? catalog.profiles.map((item) => (item.id === profile.id ? profile : item))
      : [...catalog.profiles, profile],
  };
}
