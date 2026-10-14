import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentOpeningHours } from '../catalog';
import { cafeCatalog, testDeps, user } from '../testing';
import { canManageBusiness, publishOwnerHours, reviewClaim, submitClaim } from './claims';

describe('business claims', () => {
  it('does not grant management until verification, and revocation removes it', () => {
    const pending = submitClaim(
      cafeCatalog(),
      { businessId: 'cafe', userId: 'ada', verificationMethod: 'document', note: 'Visura' },
      testDeps(),
    );
    assert.equal(pending.ok, true);
    if (!pending.ok) return;
    assert.equal(canManageBusiness(pending.catalog, 'ada', 'cafe'), false);
    const denied = publishOwnerHours(
      pending.catalog,
      { userId: 'ada', businessId: 'cafe', intervals: [{ dayOfWeek: 1, opensAt: '09:00', closesAt: '13:00' }] },
      testDeps(),
    );
    assert.equal(denied.ok, false);
    assert.equal(currentOpeningHours(pending.catalog, 'cafe')[0]?.source, 'external_provider');

    const verified = reviewClaim(
      pending.catalog,
      { claimId: pending.claimId, reviewerId: 'mod', decision: 'verified' },
      testDeps('2026-10-14T10:00:00.000Z'),
    );
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    const published = publishOwnerHours(
      verified.catalog,
      {
        userId: 'ada',
        businessId: 'cafe',
        intervals: [{ dayOfWeek: 1, opensAt: '07:30', closesAt: '14:00' }],
      },
      testDeps('2026-10-14T10:05:00.000Z'),
    );
    assert.equal(published.ok, true);
    if (!published.ok) return;
    assert.equal(published.catalog.businesses[0]?.hoursSource, 'verified_owner');
    assert.equal(currentOpeningHours(published.catalog, 'cafe')[0]?.opensAt, '07:30');
    assert.ok(published.catalog.auditLog.some((entry) => entry.action === 'owner_publish_hours'));

    const other = publishOwnerHours(
      published.catalog,
      { userId: 'mod', businessId: 'cafe', intervals: [{ dayOfWeek: 1, opensAt: '10:00', closesAt: '11:00' }] },
      testDeps(),
    );
    assert.equal(other.ok, false);

    const revoked = reviewClaim(
      published.catalog,
      { claimId: pending.claimId, reviewerId: 'mod', decision: 'revoked' },
      testDeps('2026-10-14T11:00:00.000Z'),
    );
    assert.equal(revoked.ok, true);
    if (!revoked.ok) return;
    assert.equal(canManageBusiness(revoked.catalog, 'ada', 'cafe'), false);
    const afterRevoke = publishOwnerHours(
      revoked.catalog,
      { userId: 'ada', businessId: 'cafe', intervals: [{ dayOfWeek: 1, opensAt: '11:00', closesAt: '12:00' }] },
      testDeps('2026-10-14T11:05:00.000Z'),
    );
    assert.equal(afterRevoke.ok, false);
  });

  it('stops a second verified owner and self-verification', () => {
    const first = submitClaim(
      cafeCatalog([user('ada'), user('leo'), user('mod', 'moderator')]),
      { businessId: 'cafe', userId: 'ada', verificationMethod: 'manual_review' },
      testDeps(),
    );
    const second = first.ok
      ? submitClaim(
          first.catalog,
          { businessId: 'cafe', userId: 'leo', verificationMethod: 'business_contact' },
          testDeps(),
        )
      : first;
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    const verified = reviewClaim(
      second.catalog,
      { claimId: first.claimId, reviewerId: 'mod', decision: 'verified' },
      testDeps(),
    );
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    const blocked = reviewClaim(
      verified.catalog,
      { claimId: second.claimId, reviewerId: 'mod', decision: 'verified' },
      testDeps(),
    );
    assert.equal(blocked.ok, false);
    const self = reviewClaim(
      verified.catalog,
      { claimId: second.claimId, reviewerId: 'leo', decision: 'verified' },
      testDeps(),
    );
    assert.equal(self.ok, false);
  });
});
