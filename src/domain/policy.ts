/**
 * Pilot defaults. These thresholds are a starting point to validate with real
 * users, not a claim that the numbers are already correct.
 */
export type TrustPolicy = {
  independentConfirmationThreshold: number;
  conflictThreshold: number;
  confirmationWindowDays: number;
  /** Community edits stay pending unless this is explicitly enabled and tested. */
  autoPublishCommunityEdits: boolean;
};

export type AbusePolicy = {
  maxContributionsPerHour: number;
  maxContributionsPerDay: number;
  allowSelfApproval: boolean;
};

export const PILOT_TRUST_POLICY: TrustPolicy = {
  independentConfirmationThreshold: 3,
  conflictThreshold: 2,
  confirmationWindowDays: 14,
  autoPublishCommunityEdits: false,
};

export const PILOT_ABUSE_POLICY: AbusePolicy = {
  maxContributionsPerHour: 5,
  maxContributionsPerDay: 20,
  allowSelfApproval: false,
};
