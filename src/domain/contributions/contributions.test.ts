import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentOpeningHours } from '../catalog';
import { PILOT_ABUSE_POLICY } from '../policy';
import { cafeCatalog, testDeps, user } from '../testing';
import { trustLabel } from '../trust/trust';
import { publishedHoursUnchanged, reviewContribution, submitContribution } from './contributions';

describe('contributions', () => {
  it('stores a valid proposal without changing published hours', () => {
    const before = cafeCatalog();
    const result = submitContribution(
      before,
      {
        businessId: 'cafe',
        userId: 'ada',
        type: 'weekly_hours',
        payload: { intervals: [{ dayOfWeek: 1, opensAt: '09:00', closesAt: '13:00' }] },
      },
      testDeps(),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.contribution.status, 'pending');
    assert.equal(publishedHoursUnchanged(before, result.catalog, 'cafe'), true);
    assert.equal(currentOpeningHours(result.catalog, 'cafe')[0]?.opensAt, '08:00');
    assert.equal(trustLabel(result.catalog, 'cafe', testDeps().now), 'needs_reconfirmation');
  });

  it('rejects an invalid proposal', () => {
    const result = submitContribution(
      cafeCatalog(),
      {
        businessId: 'cafe',
        userId: 'ada',
        type: 'weekly_hours',
        payload: { intervals: [{ dayOfWeek: 1, opensAt: '09:00', closesAt: '09:00' }] },
      },
      testDeps(),
    );
    assert.equal(result.ok, false);
  });

  it('records a status confirmation without rewriting the weekly schedule', () => {
    const before = cafeCatalog();
    const result = submitContribution(
      before,
      {
        businessId: 'cafe',
        userId: 'ada',
        type: 'status_confirmation',
        payload: { observed: 'open' },
      },
      testDeps(),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.contribution.type, 'status_confirmation');
    assert.equal(publishedHoursUnchanged(before, result.catalog, 'cafe'), true);
    assert.equal(result.catalog.openingHours.length, before.openingHours.length);
  });

  it('does not let repeated confirmations from one account inflate trust', () => {
    let catalog = cafeCatalog([user('ada'), user('leo'), user('mia')]);
    for (let index = 0; index < 5; index += 1) {
      const result = submitContribution(
        catalog,
        {
          businessId: 'cafe',
          userId: 'ada',
          type: 'status_confirmation',
          payload: { observed: 'open', observedAt: '2026-10-14T09:00:00.000Z' },
        },
        testDeps(`2026-10-14T09:0${index}:00.000Z`),
      );
      assert.equal(result.ok, true);
      if (result.ok) catalog = result.catalog;
    }
    assert.equal(trustLabel(catalog, 'cafe', new Date('2026-10-14T09:05:00.000Z')), 'unverified');

    for (const userId of ['leo', 'mia']) {
      const result = submitContribution(
        catalog,
        {
          businessId: 'cafe',
          userId,
          type: 'status_confirmation',
          payload: { observed: 'open', observedAt: '2026-10-14T09:00:00.000Z' },
        },
        testDeps(),
      );
      assert.equal(result.ok, true);
      if (result.ok) catalog = result.catalog;
    }
    assert.equal(trustLabel(catalog, 'cafe', new Date('2026-10-14T09:00:00.000Z')), 'community_confirmed');
  });

  it('flags independent disagreements as needing reconfirmation', () => {
    let catalog = cafeCatalog([user('ada'), user('leo')]);
    for (const userId of ['ada', 'leo']) {
      const result = submitContribution(
        catalog,
        {
          businessId: 'cafe',
          userId,
          type: 'status_confirmation',
          payload: { observed: 'closed', observedAt: '2026-10-14T09:00:00.000Z' },
        },
        testDeps(),
      );
      assert.equal(result.ok, true);
      if (result.ok) catalog = result.catalog;
    }
    assert.equal(trustLabel(catalog, 'cafe', new Date('2026-10-14T09:00:00.000Z')), 'needs_reconfirmation');
    assert.equal(currentOpeningHours(catalog, 'cafe')[0]?.opensAt, '08:00');
  });

  it('blocks self-approval and records a moderator decision', () => {
    const submitted = submitContribution(
      cafeCatalog([user('ada'), user('mod', 'moderator', 'Mod')]),
      {
        businessId: 'cafe',
        userId: 'ada',
        type: 'weekly_hours',
        payload: { intervals: [{ dayOfWeek: 3, opensAt: '10:00', closesAt: '18:00' }] },
      },
      testDeps(),
    );
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const selfReview = reviewContribution(
      {
        ...submitted.catalog,
        profiles: submitted.catalog.profiles.map((profile) =>
          profile.id === 'ada' ? { ...profile, role: 'moderator' as const } : profile,
        ),
      },
      { contributionId: submitted.contribution.id, reviewerId: 'ada', decision: 'approved' },
      testDeps('2026-10-14T10:00:00.000Z'),
    );
    assert.equal(selfReview.ok, false);

    const stranger = reviewContribution(
      submitted.catalog,
      { contributionId: submitted.contribution.id, reviewerId: 'ada', decision: 'approved' },
      testDeps('2026-10-14T10:00:00.000Z'),
    );
    assert.equal(stranger.ok, false);

    const reviewed = reviewContribution(
      submitted.catalog,
      {
        contributionId: submitted.contribution.id,
        reviewerId: 'mod',
        decision: 'approved',
        reason: 'Coerente con la vetrina',
      },
      testDeps('2026-10-14T10:00:00.000Z'),
    );
    assert.equal(reviewed.ok, true);
    if (!reviewed.ok) return;
    assert.equal(reviewed.contribution.status, 'approved');
    assert.equal(currentOpeningHours(reviewed.catalog, 'cafe').some((row) => row.opensAt === '10:00'), true);
    assert.equal(reviewed.catalog.businesses[0]?.hoursSource, 'community');
    const decision = reviewed.catalog.auditLog.find((entry) => entry.action === 'approve_contribution');
    assert.ok(decision);
    assert.equal(decision?.actorId, 'mod');
    assert.equal(decision?.entityId, submitted.contribution.id);
  });

  it('keeps published data intact when a proposal is rejected', () => {
    const submitted = submitContribution(
      cafeCatalog(),
      {
        businessId: 'cafe',
        userId: 'ada',
        type: 'temporary_closure',
        payload: { date: '2026-10-20', reason: 'Ferie' },
      },
      testDeps(),
    );
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const reviewed = reviewContribution(
      submitted.catalog,
      { contributionId: submitted.contribution.id, reviewerId: 'mod', decision: 'rejected', reason: 'Non verificata' },
      testDeps('2026-10-14T11:00:00.000Z'),
    );
    assert.equal(reviewed.ok, true);
    if (!reviewed.ok) return;
    assert.equal(reviewed.catalog.specialHours.length, 0);
    assert.ok(reviewed.catalog.auditLog.some((entry) => entry.action === 'reject_contribution'));
  });

  it('applies an approved exception and leaves a pending one unpublished', () => {
    const submitted = submitContribution(
      cafeCatalog(),
      {
        businessId: 'cafe',
        userId: 'ada',
        type: 'extraordinary_opening',
        payload: { date: '2026-10-18', opensAt: '10:00', closesAt: '12:00' },
      },
      testDeps(),
    );
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    assert.equal(submitted.catalog.specialHours.length, 0);
    const reviewed = reviewContribution(
      submitted.catalog,
      { contributionId: submitted.contribution.id, reviewerId: 'mod', decision: 'approved' },
      testDeps('2026-10-14T12:00:00.000Z'),
    );
    assert.equal(reviewed.ok, true);
    if (!reviewed.ok) return;
    assert.equal(reviewed.catalog.specialHours.length, 1);
    assert.equal(reviewed.catalog.specialHours[0]?.date, '2026-10-18');
  });

  it('rate limits repeated submissions', () => {
    let catalog = cafeCatalog();
    const policy = { ...PILOT_ABUSE_POLICY, maxContributionsPerHour: 2, maxContributionsPerDay: 10 };
    for (let index = 0; index < 2; index += 1) {
      const result = submitContribution(
        catalog,
        { businessId: 'cafe', userId: 'ada', type: 'status_confirmation', payload: { observed: 'open' } },
        testDeps(`2026-10-14T09:0${index}:00.000Z`),
        policy,
      );
      assert.equal(result.ok, true);
      if (result.ok) catalog = result.catalog;
    }
    const blocked = submitContribution(
      catalog,
      { businessId: 'cafe', userId: 'ada', type: 'status_confirmation', payload: { observed: 'closed' } },
      testDeps('2026-10-14T09:03:00.000Z'),
      policy,
    );
    assert.equal(blocked.ok, false);
  });

  it('does not auto-publish unless the tested policy flag is on', () => {
    const pending = submitContribution(
      cafeCatalog(),
      {
        businessId: 'cafe',
        userId: 'ada',
        type: 'weekly_hours',
        payload: { intervals: [{ dayOfWeek: 1, opensAt: '09:00', closesAt: '12:00' }] },
      },
      testDeps(),
    );
    assert.equal(pending.ok, true);
    if (!pending.ok) return;
    assert.equal(pending.contribution.status, 'pending');

    const published = submitContribution(
      cafeCatalog(),
      {
        businessId: 'cafe',
        userId: 'ada',
        type: 'weekly_hours',
        payload: { intervals: [{ dayOfWeek: 1, opensAt: '09:00', closesAt: '12:00' }] },
      },
      testDeps(),
      PILOT_ABUSE_POLICY,
      { independentConfirmationThreshold: 3, conflictThreshold: 2, confirmationWindowDays: 14, autoPublishCommunityEdits: true },
    );
    assert.equal(published.ok, true);
    if (!published.ok) return;
    assert.equal(published.contribution.status, 'approved');
    assert.equal(published.catalog.businesses[0]?.hoursSource, 'community');
    assert.ok(published.catalog.auditLog.some((entry) => entry.action === 'approve_weekly_hours'));
  });
});
