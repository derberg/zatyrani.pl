import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateAge, validateParticipant, calculatePaymentForParticipants, getCurrentFees } from '../api/shared/participant-validation.js';
import { EVENTS } from '../api/events/config.js';

const eventConfig = EVENTS['wilczypolmaraton-2026'];
const niebocrossConfig = EVENTS['niebocross-2026'];

describe('calculateAge', () => {
  it('should calculate age correctly for standard case', () => {
    // Event date: 2026-10-01, born 2000-01-01 → 26 years old
    const age = calculateAge('2000-01-01', '2026-10-01');
    expect(age).toBe(26);
  });

  it('should subtract one year when birthday falls after event date', () => {
    // Event date: 2026-10-01, born 2000-11-15 → birthday hasn't passed yet → 25
    const age = calculateAge('2000-11-15', '2026-10-01');
    expect(age).toBe(25);
  });

  it('should count exact birthday on event date as having reached that age', () => {
    // Born 2008-04-12, event 2026-04-12 → turns exactly 18 on event day → 18 (not 17)
    const age = calculateAge('2008-04-12', '2026-04-12');
    expect(age).toBe(18);
  });
});

describe('validateParticipant', () => {
  const validParticipant = {
    firstName: 'Jan',
    lastName: 'Kowalski',
    birthDate: '1990-05-01',
    city: 'Gliwice',
    nationality: 'PL',
    raceCategory: '21km',
    phoneNumber: '500600700',
    tshirtSize: 'M',
    gender: 'male'
  };

  it('should pass for a valid participant with wilczypolmaraton-2026 config', () => {
    const result = validateParticipant(validParticipant, eventConfig);
    expect(result).toEqual({ valid: true });
  });

  it('should reject participant with missing required field', () => {
    const participant = { ...validParticipant, firstName: '' };
    const result = validateParticipant(participant, eventConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Wszystkie wymagane pola muszą być wypełnione');
  });

  it('should reject participant with invalid phone number (not 9 digits)', () => {
    const participant = { ...validParticipant, phoneNumber: '12345' };
    const result = validateParticipant(participant, eventConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Numer telefonu musi składać się z 9 cyfr');
  });

  it('should reject participant with invalid race category', () => {
    const participant = { ...validParticipant, raceCategory: '5km' };
    const result = validateParticipant(participant, eventConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Nieprawidłowa kategoria biegu');
  });

  it('should reject participant under minAge for category', () => {
    // minAge is 18 for wilczypolmaraton; born 2010-01-01 → 16 at event date 2026-10-01
    const participant = { ...validParticipant, birthDate: '2010-01-01' };
    const result = validateParticipant(participant, eventConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Minimalny wiek dla tej kategorii to 18 lat');
  });

  it('should reject participant over maxAge for kids_run category with niebocross-2026 config', () => {
    // maxAge is 15 for kids_run; born 2008-08-01 → 17 at event date 2026-04-12
    const participant = {
      firstName: 'Anna',
      lastName: 'Nowak',
      birthDate: '2008-08-01',
      city: 'Gliwice',
      nationality: 'PL',
      raceCategory: 'kids_run',
      phoneNumber: '500600700',
      tshirtSize: 'S',
      gender: 'female'
    };
    const result = validateParticipant(participant, niebocrossConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Maksymalny wiek');
  });
});

describe('getCurrentFees', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return flat fees when no feeSchedule is defined', () => {
    const fees = getCurrentFees(eventConfig);
    expect(fees).toEqual({ default: 100 });
  });

  it('should return first matching schedule entry when date is before first deadline', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15'));

    const scheduledConfig = {
      ...eventConfig,
      feeSchedule: [
        { until: '2026-05-31', fees: { default: 100 } },
        { until: '2026-10-16', fees: { default: 130 } },
      ]
    };
    delete scheduledConfig.fees;
    const fees = getCurrentFees(scheduledConfig);
    expect(fees).toEqual({ default: 100 });
  });

  it('should return first entry when date is on the deadline day (end-of-day inclusive)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-31T14:00:00Z'));

    const scheduledConfig = {
      ...eventConfig,
      feeSchedule: [
        { until: '2026-05-31', fees: { default: 100 } },
        { until: '2026-10-16', fees: { default: 130 } },
      ]
    };
    delete scheduledConfig.fees;
    const fees = getCurrentFees(scheduledConfig);
    expect(fees).toEqual({ default: 100 });
  });

  it('should return second schedule entry when first deadline has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15'));

    const scheduledConfig = {
      ...eventConfig,
      feeSchedule: [
        { until: '2026-05-31', fees: { default: 100 } },
        { until: '2026-10-16', fees: { default: 130 } },
      ]
    };
    delete scheduledConfig.fees;
    const fees = getCurrentFees(scheduledConfig);
    expect(fees).toEqual({ default: 130 });
  });

  it('should return last schedule entry as fallback when all deadlines passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01'));

    const scheduledConfig = {
      ...eventConfig,
      feeSchedule: [
        { until: '2026-05-31', fees: { default: 100 } },
        { until: '2026-10-16', fees: { default: 130 } },
      ]
    };
    delete scheduledConfig.fees;
    const fees = getCurrentFees(scheduledConfig);
    expect(fees).toEqual({ default: 130 });
  });

  it('should fall back to eventConfig.fees when feeSchedule is not defined', () => {
    const fees = getCurrentFees(niebocrossConfig);
    expect(fees).toEqual({ kids_run: 20, default: 60 });
  });
});

describe('calculatePaymentForParticipants', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should calculate correct fee using feeSchedule for wilczypolmaraton', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15'));

    const participants = [{ race_category: '21km' }];
    const result = calculatePaymentForParticipants(participants, eventConfig);
    expect(result.raceFees).toBe(100);
    expect(result.totalAmount).toBe(100);
    expect(result.charityAmount).toBe(0); // wilczy is not a charity event
  });

  it('should calculate correct fee using legacy fees for niebocross', () => {
    const participants = [{ race_category: 'kids_run' }];
    const result = calculatePaymentForParticipants(participants, niebocrossConfig);
    expect(result.raceFees).toBe(20);
    expect(result.totalAmount).toBe(20);
    expect(result.charityAmount).toBe(20);
  });

  it('should use default fee for unlisted category with niebocross', () => {
    const participants = [{ race_category: '3km_run' }];
    const result = calculatePaymentForParticipants(participants, niebocrossConfig);
    expect(result.raceFees).toBe(60);
    expect(result.totalAmount).toBe(60);
    expect(result.charityAmount).toBe(60);
  });

  it('should include tshirt fees when participants have tshirt_size', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15'));

    const participants = [
      { race_category: '21km', tshirt_size: 'M' },
      { race_category: '21km', tshirt_size: 'L' }
    ];
    const result = calculatePaymentForParticipants(participants, eventConfig);
    expect(result.raceFees).toBe(200);
    expect(result.tshirtFees).toBe(160); // 2 × 80
    expect(result.totalAmount).toBe(360);
    expect(result.charityAmount).toBe(0); // wilczy is not a charity event
  });

  it('should not include tshirt fees for participants without tshirt_size', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15'));

    const participants = [
      { race_category: '21km', tshirt_size: 'M' },
      { race_category: '21km', tshirt_size: '' },
      { race_category: '21km' }
    ];
    const result = calculatePaymentForParticipants(participants, eventConfig);
    expect(result.raceFees).toBe(300);
    expect(result.tshirtFees).toBe(80); // only 1 with tshirt @ 80
    expect(result.totalAmount).toBe(380);
  });

  it('should handle tshirtSize (camelCase) property', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15'));

    const participants = [
      { raceCategory: '21km', tshirtSize: 'XL' }
    ];
    const result = calculatePaymentForParticipants(participants, eventConfig);
    expect(result.tshirtFees).toBe(80);
    expect(result.totalAmount).toBe(180);
  });
});
