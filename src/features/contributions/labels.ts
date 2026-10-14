import type { Contribution, ContributionStatus } from '../../domain/catalog';

export const CONTRIBUTION_TYPE_LABELS: Record<Contribution['type'], string> = {
  status_confirmation: 'Conferma stato',
  weekly_hours: 'Proposta orari',
  temporary_closure: 'Chiusura temporanea',
  extraordinary_opening: 'Apertura straordinaria',
  report_incorrect: 'Segnalazione dati',
};

export function contributionStatusLabel(contribution: Contribution): string {
  if (contribution.type === 'status_confirmation' && contribution.status === 'approved') return 'Registrata';
  const labels: Record<ContributionStatus, string> = {
    pending: 'In attesa',
    approved: 'Approvata',
    rejected: 'Rifiutata',
    withdrawn: 'Ritirata',
  };
  return labels[contribution.status];
}
