import { describe, it, expect } from 'vitest';
import { isRegistrationOpen, getTotalLimit } from '../api/shared/participant-validation.js';
import { getEventCapacity, countEventParticipants } from '../api/shared/database-operations.js';
import { EVENTS } from '../api/events/config.js';

const zewwilka = EVENTS['zewwilka-2026'];
const wilczy = EVENTS['wilczypolmaraton-2026'];

describe('isRegistrationOpen', () => {
  it('is open before the deadline', () => {
    expect(isRegistrationOpen(zewwilka, new Date('2026-08-01T10:00:00Z'))).toBe(true);
  });

  it('is open through the end of the deadline day (inclusive)', () => {
    expect(isRegistrationOpen(zewwilka, new Date('2026-08-05T23:59:00Z'))).toBe(true);
  });

  it('is closed the day after the deadline', () => {
    expect(isRegistrationOpen(zewwilka, new Date('2026-08-06T00:00:00Z'))).toBe(false);
  });

  it('treats events without a deadline as always open', () => {
    expect(isRegistrationOpen(wilczy, new Date('2030-01-01T00:00:00Z'))).toBe(true);
  });
});

describe('getTotalLimit', () => {
  it('sums limit groups (zewwilka = 50)', () => {
    expect(getTotalLimit(zewwilka)).toBe(50);
  });

  it('sums multiple groups (wilczypolmaraton = 220+30+30)', () => {
    expect(getTotalLimit(wilczy)).toBe(280);
  });

  it('returns null when no limits configured', () => {
    expect(getTotalLimit({ id: 'x' })).toBeNull();
  });
});

describe('getEventCapacity', () => {
  function mockSupabase(count) {
    return {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ count, error: null })
        })
      })
    };
  }

  it('reports used/available against the limit', async () => {
    const cap = await getEventCapacity(mockSupabase(12), zewwilka);
    expect(cap).toEqual({ limit: 50, used: 12, available: 38 });
  });

  it('clamps available at 0 when over capacity', async () => {
    const cap = await getEventCapacity(mockSupabase(55), zewwilka);
    expect(cap.available).toBe(0);
  });

  it('returns Infinity available for unlimited events', async () => {
    const cap = await getEventCapacity(mockSupabase(0), { id: 'x' });
    expect(cap).toEqual({ limit: null, used: 0, available: Infinity });
  });
});

describe('countEventParticipants', () => {
  it('returns the joined count', async () => {
    const supabase = {
      from: (table) => {
        expect(table).toBe('event_participants');
        return {
          select: (sel, opts) => {
            expect(opts).toEqual({ count: 'exact', head: true });
            return { eq: () => Promise.resolve({ count: 7, error: null }) };
          }
        };
      }
    };
    expect(await countEventParticipants(supabase, 'zewwilka-2026')).toBe(7);
  });

  it('throws on db error', async () => {
    const supabase = {
      from: () => ({ select: () => ({ eq: () => Promise.resolve({ count: null, error: { message: 'boom' } }) }) })
    };
    await expect(countEventParticipants(supabase, 'zewwilka-2026')).rejects.toThrow('boom');
  });
});
