import {
  appendAudit,
  currentOpeningHours,
  type Catalog,
  type Contribution,
  type DomainDeps,
  type Provenance,
} from '../catalog';
import {
  sameIntervals,
  validateWeeklyIntervals,
  type WeeklyInterval,
} from '../opening-hours/schedule';
import { PILOT_ABUSE_POLICY, PILOT_TRUST_POLICY, type AbusePolicy, type TrustPolicy } from '../policy';
import { addDays, isDateKey, parseClock, zonedLocalToUtc } from '../time';

export type Failure = { ok: false; message: string };
export type Success<T> = { ok: true } & T;
export type Result<T> = Success<T> | Failure;

type SubmitInput = {
  businessId: string;
  userId: string;
} & (
  | { type: 'status_confirmation'; payload: { observed: 'open' | 'closed'; observedAt?: string } }
  | { type: 'weekly_hours'; payload: { intervals: WeeklyInterval[] } }
  | { type: 'temporary_closure'; payload: { date: string; reason?: string } }
  | {
      type: 'extraordinary_opening';
      payload: { date: string; opensAt: string; closesAt: string; reason?: string };
    }
  | {
      type: 'report_incorrect';
      payload: {
        kind: 'closed_permanently' | 'wrong_details';
        note?: string;
        name?: string;
        category?: string;
        address?: string;
      };
    }
);

function fail(message: string): Failure {
  return { ok: false, message };
}

function requireBusiness(catalog: Catalog, businessId: string) {
  const business = catalog.businesses.find((item) => item.id === businessId);
  if (!business) return fail('Attività non trovata.');
  return business;
}

function requireProfile(catalog: Catalog, userId: string) {
  const profile = catalog.profiles.find((item) => item.id === userId);
  if (!profile) return fail('Serve un profilo per contribuire.');
  return profile;
}

function cleanText(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function validatePayload(input: SubmitInput): string | null {
  if (input.type === 'status_confirmation') {
    if (input.payload.observed !== 'open' && input.payload.observed !== 'closed') {
      return 'Indica se l’attività è aperta o chiusa.';
    }
    return null;
  }
  if (input.type === 'weekly_hours') {
    if (input.payload.intervals.length === 0) {
      return 'Aggiungi almeno una fascia, oppure segnala l’attività come cessata.';
    }
    return validateWeeklyIntervals(input.payload.intervals);
  }
  if (input.type === 'temporary_closure') {
    if (!isDateKey(input.payload.date)) return 'Data non valida.';
    return null;
  }
  if (input.type === 'extraordinary_opening') {
    if (!isDateKey(input.payload.date)) return 'Data non valida.';
    const error = validateWeeklyIntervals([
      { dayOfWeek: 1, opensAt: input.payload.opensAt, closesAt: input.payload.closesAt },
    ]);
    return error;
  }
  if (input.type === 'report_incorrect') {
    if (input.payload.kind !== 'closed_permanently' && input.payload.kind !== 'wrong_details') {
      return 'Tipo di segnalazione non valido.';
    }
    if (input.payload.kind === 'wrong_details') {
      const hasChange = Boolean(
        cleanText(input.payload.name, 120) ||
          cleanText(input.payload.category, 40) ||
          cleanText(input.payload.address, 180) ||
          cleanText(input.payload.note, 500),
      );
      if (!hasChange) return 'Descrivi cosa va corretto.';
    }
    return null;
  }
  return 'Tipo di contributo non supportato.';
}

function withinRateLimit(catalog: Catalog, userId: string, now: Date, policy: AbusePolicy): string | null {
  const stamps = catalog.contributions
    .filter((contribution) => contribution.userId === userId)
    .map((contribution) => Date.parse(contribution.createdAt));
  const hourAgo = now.getTime() - 60 * 60 * 1000;
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  if (stamps.filter((stamp) => stamp >= hourAgo).length >= policy.maxContributionsPerHour) {
    return 'Hai inviato troppi contributi nell’ultima ora. Riprova più tardi.';
  }
  if (stamps.filter((stamp) => stamp >= dayAgo).length >= policy.maxContributionsPerDay) {
    return 'Hai raggiunto il limite giornaliero di contributi.';
  }
  return null;
}

function publishHours(
  catalog: Catalog,
  businessId: string,
  intervals: WeeklyInterval[],
  source: Provenance,
  actorId: string,
  deps: DomainDeps,
  action: string,
): Catalog {
  const business = catalog.businesses.find((item) => item.id === businessId);
  if (!business) return catalog;
  const version = business.hoursVersion + 1;
  const createdAt = deps.now.toISOString();
  const rows = intervals.map((interval) => ({
    id: deps.id(),
    businessId,
    dayOfWeek: interval.dayOfWeek,
    opensAt: interval.opensAt,
    closesAt: interval.closesAt,
    source,
    version,
    createdAt,
  }));
  const before = currentOpeningHours(catalog, businessId);
  const next: Catalog = {
    ...catalog,
    businesses: catalog.businesses.map((item) =>
      item.id === businessId
        ? {
            ...item,
            scheduleKnown: true,
            hoursSource: source,
            hoursVersion: version,
            updatedAt: createdAt,
          }
        : item,
    ),
    openingHours: [...catalog.openingHours, ...rows],
  };
  return appendAudit(next, {
    id: deps.id(),
    actorId,
    entityType: 'opening_hours',
    entityId: businessId,
    action,
    beforeSnapshot: before.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      source: row.source,
      version: row.version,
    })),
    afterSnapshot: rows.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      source: row.source,
      version: row.version,
    })),
    createdAt,
  });
}

function dayBounds(dateKey: string, timeZone: string, opensAt?: string, closesAt?: string) {
  const start = zonedLocalToUtc(dateKey, 0, timeZone);
  let endKey = addDays(dateKey, 1);
  let endMinutes = 0;
  if (opensAt && closesAt) {
    const opens = parseClock(opensAt);
    const closes = parseClock(closesAt);
    const overnight =
      opens !== null && closes !== null && closes < opens && !(opens === 0 && closes === 0);
    if (overnight) endMinutes = closes;
  }
  const end = zonedLocalToUtc(endKey, endMinutes, timeZone);
  return {
    validFrom: start?.toISOString(),
    validUntil: end?.toISOString(),
  };
}

function applyApproval(
  catalog: Catalog,
  contribution: Contribution,
  actorId: string,
  deps: DomainDeps,
): Catalog {
  const business = catalog.businesses.find((item) => item.id === contribution.businessId);
  if (!business) return catalog;
  const timeZone = catalog.cities.find((city) => city.id === business.cityId)?.timezone ?? 'Europe/Rome';
  if (contribution.type === 'weekly_hours') {
    return publishHours(
      catalog,
      business.id,
      contribution.payload.intervals,
      'community',
      actorId,
      deps,
      'approve_weekly_hours',
    );
  }
  if (contribution.type === 'temporary_closure' || contribution.type === 'extraordinary_opening') {
    const date = contribution.payload.date;
    const opensAt = contribution.type === 'extraordinary_opening' ? contribution.payload.opensAt : undefined;
    const closesAt = contribution.type === 'extraordinary_opening' ? contribution.payload.closesAt : undefined;
    const bounds = dayBounds(date, timeZone, opensAt, closesAt);
    const createdAt = deps.now.toISOString();
    const row = {
      id: deps.id(),
      businessId: business.id,
      date,
      isClosed: contribution.type === 'temporary_closure',
      opensAt,
      closesAt,
      reason: contribution.payload.reason,
      validFrom: bounds.validFrom,
      validUntil: bounds.validUntil,
      createdBy: contribution.userId,
      source: 'community' as const,
      createdAt,
    };
    return appendAudit(
      { ...catalog, specialHours: [...catalog.specialHours, row] },
      {
        id: deps.id(),
        actorId,
        entityType: 'special_hours',
        entityId: row.id,
        action: contribution.type === 'temporary_closure' ? 'approve_closure' : 'approve_opening',
        beforeSnapshot: null,
        afterSnapshot: row,
        createdAt,
      },
    );
  }
  if (contribution.type === 'report_incorrect' && contribution.payload.kind === 'closed_permanently') {
    const createdAt = deps.now.toISOString();
    const updated = { ...business, status: 'closed_permanently' as const, updatedAt: createdAt };
    return appendAudit(
      {
        ...catalog,
        businesses: catalog.businesses.map((item) => (item.id === business.id ? updated : item)),
      },
      {
        id: deps.id(),
        actorId,
        entityType: 'business',
        entityId: business.id,
        action: 'mark_closed_permanently',
        beforeSnapshot: { status: business.status },
        afterSnapshot: { status: updated.status },
        createdAt,
      },
    );
  }
  if (contribution.type === 'report_incorrect') {
    const createdAt = deps.now.toISOString();
    const updated = {
      ...business,
      name: cleanText(contribution.payload.name, 120) ?? business.name,
      category: cleanText(contribution.payload.category, 40) ?? business.category,
      address: cleanText(contribution.payload.address, 180) ?? business.address,
      updatedAt: createdAt,
    };
    return appendAudit(
      {
        ...catalog,
        businesses: catalog.businesses.map((item) => (item.id === business.id ? updated : item)),
      },
      {
        id: deps.id(),
        actorId,
        entityType: 'business',
        entityId: business.id,
        action: 'apply_detail_correction',
        beforeSnapshot: { name: business.name, category: business.category, address: business.address },
        afterSnapshot: { name: updated.name, category: updated.category, address: updated.address },
        createdAt,
      },
    );
  }
  return catalog;
}

export function submitContribution(
  catalog: Catalog,
  input: SubmitInput,
  deps: DomainDeps,
  abuse: AbusePolicy = PILOT_ABUSE_POLICY,
  trust: TrustPolicy = PILOT_TRUST_POLICY,
): Result<{ catalog: Catalog; contribution: Contribution }> {
  const business = requireBusiness(catalog, input.businessId);
  if ('ok' in business) return business;
  const profile = requireProfile(catalog, input.userId);
  if ('ok' in profile) return profile;
  const validation = validatePayload(input);
  if (validation) return fail(validation);
  const limited = withinRateLimit(catalog, input.userId, deps.now, abuse);
  if (limited) return fail(limited);

  const createdAt = deps.now.toISOString();
  let contribution: Contribution;
  if (input.type === 'status_confirmation') {
    contribution = {
      id: deps.id(),
      businessId: input.businessId,
      userId: input.userId,
      type: 'status_confirmation',
      payload: {
        observed: input.payload.observed,
        observedAt: input.payload.observedAt ?? createdAt,
      },
      status: 'approved',
      createdAt,
      reviewedAt: createdAt,
      decisionReason: 'Evidenza sullo stato corrente. Il calendario settimanale non cambia.',
    };
  } else if (input.type === 'weekly_hours') {
    contribution = {
      id: deps.id(),
      businessId: input.businessId,
      userId: input.userId,
      type: 'weekly_hours',
      payload: { intervals: input.payload.intervals.map((interval) => ({ ...interval })) },
      status: 'pending',
      createdAt,
    };
  } else if (input.type === 'temporary_closure') {
    contribution = {
      id: deps.id(),
      businessId: input.businessId,
      userId: input.userId,
      type: 'temporary_closure',
      payload: { date: input.payload.date, reason: cleanText(input.payload.reason, 180) },
      status: 'pending',
      createdAt,
    };
  } else if (input.type === 'extraordinary_opening') {
    contribution = {
      id: deps.id(),
      businessId: input.businessId,
      userId: input.userId,
      type: 'extraordinary_opening',
      payload: {
        date: input.payload.date,
        opensAt: input.payload.opensAt,
        closesAt: input.payload.closesAt,
        reason: cleanText(input.payload.reason, 180),
      },
      status: 'pending',
      createdAt,
    };
  } else {
    contribution = {
      id: deps.id(),
      businessId: input.businessId,
      userId: input.userId,
      type: 'report_incorrect',
      payload: {
        kind: input.payload.kind,
        note: cleanText(input.payload.note, 500),
        name: cleanText(input.payload.name, 120),
        category: cleanText(input.payload.category, 40),
        address: cleanText(input.payload.address, 180),
      },
      status: 'pending',
      createdAt,
    };
  }

  let next = appendAudit(
    { ...catalog, contributions: [...catalog.contributions, contribution] },
    {
      id: deps.id(),
      actorId: input.userId,
      entityType: 'contribution',
      entityId: contribution.id,
      action: 'submit_contribution',
      beforeSnapshot: null,
      afterSnapshot: { type: contribution.type, status: contribution.status },
      createdAt,
    },
  );

  if (
    contribution.type === 'weekly_hours' &&
    trust.autoPublishCommunityEdits &&
    contribution.status === 'pending'
  ) {
    const approved: Contribution = {
      ...contribution,
      status: 'approved',
      reviewedAt: createdAt,
      reviewedBy: input.userId,
      decisionReason: 'Pubblicazione automatica abilitata dalla policy di test.',
    };
    next = {
      ...next,
      contributions: next.contributions.map((item) => (item.id === approved.id ? approved : item)),
    };
    next = applyApproval(next, approved, input.userId, deps);
    return { ok: true, catalog: next, contribution: approved };
  }

  return { ok: true, catalog: next, contribution };
}

export function reviewContribution(
  catalog: Catalog,
  input: {
    contributionId: string;
    reviewerId: string;
    decision: 'approved' | 'rejected' | 'needs_info';
    reason?: string;
  },
  deps: DomainDeps,
  abuse: AbusePolicy = PILOT_ABUSE_POLICY,
): Result<{ catalog: Catalog; contribution: Contribution }> {
  const reviewer = requireProfile(catalog, input.reviewerId);
  if ('ok' in reviewer) return reviewer;
  if (reviewer.role !== 'moderator') return fail('Solo un moderatore può rivedere i contributi.');
  const current = catalog.contributions.find((item) => item.id === input.contributionId);
  if (!current) return fail('Contributo non trovato.');
  if (current.status !== 'pending') return fail('Questo contributo non è più in attesa.');
  if (current.type === 'status_confirmation') {
    return fail('Le conferme di stato non modificano gli orari e non richiedono approvazione.');
  }
  if (!abuse.allowSelfApproval && current.userId === input.reviewerId) {
    return fail('Non puoi approvare o rifiutare un tuo contributo.');
  }
  const reviewedAt = deps.now.toISOString();
  const reason = cleanText(input.reason, 500);
  if (input.decision === 'needs_info') {
    const contribution: Contribution = { ...current, decisionReason: reason ?? 'Servono più informazioni.' };
    const next = appendAudit(
      {
        ...catalog,
        contributions: catalog.contributions.map((item) => (item.id === contribution.id ? contribution : item)),
      },
      {
        id: deps.id(),
        actorId: input.reviewerId,
        entityType: 'contribution',
        entityId: contribution.id,
        action: 'request_contribution_info',
        beforeSnapshot: { status: current.status, decisionReason: current.decisionReason ?? null },
        afterSnapshot: { status: contribution.status, decisionReason: contribution.decisionReason },
        createdAt: reviewedAt,
      },
    );
    return { ok: true, catalog: next, contribution };
  }
  const contribution: Contribution = {
    ...current,
    status: input.decision,
    reviewedAt,
    reviewedBy: input.reviewerId,
    decisionReason: reason,
  };
  let next: Catalog = {
    ...catalog,
    contributions: catalog.contributions.map((item) => (item.id === contribution.id ? contribution : item)),
    profiles:
      input.decision === 'approved'
        ? catalog.profiles.map((profile) =>
            profile.id === contribution.userId
              ? { ...profile, reputationScore: profile.reputationScore + 1 }
              : profile,
          )
        : catalog.profiles,
  };
  if (input.decision === 'approved') next = applyApproval(next, contribution, input.reviewerId, deps);
  next = appendAudit(next, {
    id: deps.id(),
    actorId: input.reviewerId,
    entityType: 'contribution',
    entityId: contribution.id,
    action: input.decision === 'approved' ? 'approve_contribution' : 'reject_contribution',
    beforeSnapshot: { status: 'pending' },
    afterSnapshot: { status: contribution.status, reason: reason ?? null },
    createdAt: reviewedAt,
  });
  return { ok: true, catalog: next, contribution };
}

export function withdrawContribution(
  catalog: Catalog,
  input: { contributionId: string; userId: string },
  deps: DomainDeps,
): Result<{ catalog: Catalog; contribution: Contribution }> {
  const current = catalog.contributions.find((item) => item.id === input.contributionId);
  if (!current) return fail('Contributo non trovato.');
  if (current.userId !== input.userId) return fail('Puoi ritirare solo i tuoi contributi.');
  if (current.status !== 'pending') return fail('Si può ritirare solo un contributo in attesa.');
  const contribution: Contribution = {
    ...current,
    status: 'withdrawn',
    reviewedAt: deps.now.toISOString(),
  };
  const next = appendAudit(
    {
      ...catalog,
      contributions: catalog.contributions.map((item) => (item.id === contribution.id ? contribution : item)),
    },
    {
      id: deps.id(),
      actorId: input.userId,
      entityType: 'contribution',
      entityId: contribution.id,
      action: 'withdraw_contribution',
      beforeSnapshot: { status: 'pending' },
      afterSnapshot: { status: 'withdrawn' },
      createdAt: deps.now.toISOString(),
    },
  );
  return { ok: true, catalog: next, contribution };
}

export function publishedHoursUnchanged(before: Catalog, after: Catalog, businessId: string): boolean {
  const left = currentOpeningHours(before, businessId);
  const right = currentOpeningHours(after, businessId);
  return sameIntervals(left, right) && before.businesses.find((item) => item.id === businessId)?.hoursVersion ===
    after.businesses.find((item) => item.id === businessId)?.hoursVersion;
}
