import { describe, it, expect } from 'vitest';
import { getParticipantPaymentStatus } from '../api/shared/payment-status.js';

describe('getParticipantPaymentStatus', () => {
  it('is pending when the registration has no payments', () => {
    expect(getParticipantPaymentStatus({ created_at: '2026-05-01T10:00:00Z' }, [])).toBe('pending');
    expect(getParticipantPaymentStatus({ created_at: '2026-05-01T10:00:00Z' }, undefined)).toBe('pending');
  });

  it('is pending when the only payment is open', () => {
    const payments = [{ payment_status: 'pending', created_at: '2026-05-01T10:00:01Z' }];
    expect(getParticipantPaymentStatus({ created_at: '2026-05-01T10:00:00Z' }, payments)).toBe('pending');
  });

  it('is paid when the registration has a paid payment and nothing open', () => {
    const payments = [{ payment_status: 'paid', paid_at: '2026-05-01T10:05:00Z' }];
    expect(getParticipantPaymentStatus({ created_at: '2026-05-01T10:00:00Z' }, payments)).toBe('paid');
  });

  it('marks a participant added after payment as pending while the top-up is open', () => {
    // Paid entry in April (flipped by hand, no paid_at), second runner added in September with an unpaid top-up
    const payments = [
      { payment_status: 'paid', paid_at: null, updated_at: '2026-04-09T08:00:00Z', created_at: '2026-04-09T07:45:47Z' },
      { payment_status: 'pending', created_at: '2026-09-21T10:33:23Z' }
    ];
    expect(getParticipantPaymentStatus({ created_at: '2026-04-09T07:45:46Z' }, payments)).toBe('paid');
    expect(getParticipantPaymentStatus({ created_at: '2026-09-21T10:33:22Z' }, payments)).toBe('pending');
  });

  it('uses the latest paid payment when there are several', () => {
    const payments = [
      { payment_status: 'paid', paid_at: '2026-05-01T10:05:00Z' },
      { payment_status: 'paid', paid_at: '2026-07-01T10:05:00Z' },
      { payment_status: 'failed', created_at: '2026-09-01T10:00:01Z' }
    ];
    expect(getParticipantPaymentStatus({ created_at: '2026-07-01T10:00:00Z' }, payments)).toBe('paid');
    expect(getParticipantPaymentStatus({ created_at: '2026-09-01T10:00:00Z' }, payments)).toBe('pending');
  });

  it('counts a participant created exactly at paid_at as paid', () => {
    const payments = [
      { payment_status: 'paid', paid_at: '2026-05-01T10:05:00Z' },
      { payment_status: 'pending', created_at: '2026-06-01T10:00:00Z' }
    ];
    expect(getParticipantPaymentStatus({ created_at: '2026-05-01T10:05:00Z' }, payments)).toBe('paid');
  });

  it('falls back to created_at when the paid payment has no paid_at or updated_at', () => {
    const payments = [
      { payment_status: 'paid', created_at: '2026-05-01T10:00:01Z' },
      { payment_status: 'pending', created_at: '2026-06-01T10:00:01Z' }
    ];
    expect(getParticipantPaymentStatus({ created_at: '2026-05-01T10:00:00Z' }, payments)).toBe('paid');
    expect(getParticipantPaymentStatus({ created_at: '2026-06-01T10:00:00Z' }, payments)).toBe('pending');
  });
});
