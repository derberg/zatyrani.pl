/**
 * Payment status of a single participant, derived from their registration's payments.
 *
 * Payments belong to a registration, not to a participant. A participant counts as
 * paid when the registration has a paid payment, unless the registration also has an
 * open (pending/failed) top-up and the participant was added after the latest paid
 * payment — then the participant is covered by that unpaid top-up.
 *
 * The public list and its counters both use this, so they always agree. Recipient
 * lists for "paid participants only" messages should use it too.
 *
 * @param {{ created_at: string }} participant
 * @param {Array<{ payment_status: string, paid_at?: string, updated_at?: string, created_at?: string }>} payments
 * @returns {'paid' | 'pending'}
 */
export function getParticipantPaymentStatus(participant, payments) {
  const paidPayments = (payments || []).filter(pay => pay.payment_status === 'paid');
  if (paidPayments.length === 0) return 'pending';

  const hasOpenPayment = payments.some(pay => pay.payment_status === 'pending' || pay.payment_status === 'failed');
  if (!hasOpenPayment) return 'paid';

  const latestPaidAt = Math.max(
    ...paidPayments.map(pay => new Date(pay.paid_at || pay.updated_at || pay.created_at).getTime())
  );
  return new Date(participant.created_at).getTime() <= latestPaidAt ? 'paid' : 'pending';
}
