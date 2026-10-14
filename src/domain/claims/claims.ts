import { appendAudit, currentOpeningHours, type Catalog, type DomainDeps, type VerificationMethod } from '../catalog';
import { validateWeeklyIntervals, type WeeklyInterval } from '../opening-hours/schedule';

export type Failure = { ok: false; message: string };
export type Result<T extends object = object> = ({ ok: true; catalog: Catalog } & T) | Failure;

function fail(message: string): Failure {
  return { ok: false, message };
}

export function canManageBusiness(catalog: Catalog, userId: string, businessId: string): boolean {
  return catalog.claims.some(
    (claim) =>
      claim.userId === userId && claim.businessId === businessId && claim.status === 'verified',
  );
}

export function submitClaim(
  catalog: Catalog,
  input: { businessId: string; userId: string; verificationMethod: VerificationMethod; note?: string },
  deps: DomainDeps,
): Result<{ claimId: string }> {
  const business = catalog.businesses.find((item) => item.id === input.businessId);
  if (!business) return fail('Attività non trovata.');
  const profile = catalog.profiles.find((item) => item.id === input.userId);
  if (!profile) return fail('Serve un profilo per rivendicare un’attività.');
  if (profile.role === 'moderator') return fail('Un moderatore non rivendica schede come titolare.');
  const existing = catalog.claims.find(
    (claim) =>
      claim.businessId === input.businessId &&
      claim.userId === input.userId &&
      (claim.status === 'pending' || claim.status === 'verified'),
  );
  if (existing) return fail('Hai già una richiesta aperta o verificata per questa attività.');
  const methods: VerificationMethod[] = ['document', 'business_contact', 'manual_review'];
  if (!methods.includes(input.verificationMethod)) return fail('Metodo di verifica non valido.');
  const createdAt = deps.now.toISOString();
  const claim = {
    id: deps.id(),
    businessId: input.businessId,
    userId: input.userId,
    verificationMethod: input.verificationMethod,
    note: input.note?.trim().slice(0, 500) || undefined,
    status: 'pending' as const,
    createdAt,
  };
  const next = appendAudit(
    { ...catalog, claims: [...catalog.claims, claim] },
    {
      id: deps.id(),
      actorId: input.userId,
      entityType: 'business_claim',
      entityId: claim.id,
      action: 'submit_claim',
      beforeSnapshot: null,
      afterSnapshot: { status: 'pending', businessId: input.businessId },
      createdAt,
    },
  );
  return { ok: true, catalog: next, claimId: claim.id };
}

export function reviewClaim(
  catalog: Catalog,
  input: {
    claimId: string;
    reviewerId: string;
    decision: 'verified' | 'rejected' | 'revoked';
    reason?: string;
  },
  deps: DomainDeps,
): Result<{ claimId: string }> {
  const reviewer = catalog.profiles.find((item) => item.id === input.reviewerId);
  if (!reviewer || reviewer.role !== 'moderator') return fail('Solo un moderatore può verificare le titolarità.');
  const claim = catalog.claims.find((item) => item.id === input.claimId);
  if (!claim) return fail('Richiesta non trovata.');
  if (input.decision === 'revoked' && claim.status !== 'verified') {
    return fail('Si può revocare solo una titolarità verificata.');
  }
  if (input.decision !== 'revoked' && claim.status !== 'pending') {
    return fail('La richiesta non è in attesa.');
  }
  if (claim.userId === input.reviewerId) return fail('Non puoi verificare una tua richiesta.');
  if (input.decision === 'verified') {
    const other = catalog.claims.find(
      (item) => item.businessId === claim.businessId && item.status === 'verified' && item.id !== claim.id,
    );
    if (other) return fail('Questa attività ha già un titolare verificato.');
  }
  const reviewedAt = deps.now.toISOString();
  const updated = {
    ...claim,
    status: input.decision,
    verifiedAt: input.decision === 'verified' ? reviewedAt : claim.verifiedAt,
    reviewedBy: input.reviewerId,
  };
  const next = appendAudit(
    { ...catalog, claims: catalog.claims.map((item) => (item.id === claim.id ? updated : item)) },
    {
      id: deps.id(),
      actorId: input.reviewerId,
      entityType: 'business_claim',
      entityId: claim.id,
      action: `claim_${input.decision}`,
      beforeSnapshot: { status: claim.status },
      afterSnapshot: { status: updated.status, reason: input.reason?.trim() || null },
      createdAt: reviewedAt,
    },
  );
  return { ok: true, catalog: next, claimId: claim.id };
}

export function publishOwnerHours(
  catalog: Catalog,
  input: { userId: string; businessId: string; intervals: WeeklyInterval[] },
  deps: DomainDeps,
): Result {
  if (!canManageBusiness(catalog, input.userId, input.businessId)) {
    return fail('La richiesta di titolarità non concede ancora permessi di gestione.');
  }
  const business = catalog.businesses.find((item) => item.id === input.businessId);
  if (!business) return fail('Attività non trovata.');
  if (input.intervals.length === 0) return fail('Indica almeno una fascia oraria.');
  const validation = validateWeeklyIntervals(input.intervals);
  if (validation) return fail(validation);
  const version = business.hoursVersion + 1;
  const createdAt = deps.now.toISOString();
  const before = currentOpeningHours(catalog, business.id);
  const rows = input.intervals.map((interval) => ({
    id: deps.id(),
    businessId: business.id,
    dayOfWeek: interval.dayOfWeek,
    opensAt: interval.opensAt,
    closesAt: interval.closesAt,
    source: 'verified_owner' as const,
    version,
    createdAt,
  }));
  const next = appendAudit(
    {
      ...catalog,
      businesses: catalog.businesses.map((item) =>
        item.id === business.id
          ? {
              ...item,
              scheduleKnown: true,
              hoursSource: 'verified_owner' as const,
              hoursVersion: version,
              updatedAt: createdAt,
            }
          : item,
      ),
      openingHours: [...catalog.openingHours, ...rows],
    },
    {
      id: deps.id(),
      actorId: input.userId,
      entityType: 'opening_hours',
      entityId: business.id,
      action: 'owner_publish_hours',
      beforeSnapshot: before,
      afterSnapshot: rows,
      createdAt,
    },
  );
  return { ok: true, catalog: next };
}
