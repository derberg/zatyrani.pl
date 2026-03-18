import { describe, it, expect } from 'vitest';
import { calculateAge, validateParticipant, calculatePaymentForParticipants } from '../api/shared/participant-validation.js';
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
    phoneNumber: '500600700'
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
      tshirtSize: 'S'
    };
    const result = validateParticipant(participant, niebocrossConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Maksymalny wiek');
  });
});

describe('calculatePaymentForParticipants', () => {
  it('should calculate correct fee for 21km category', () => {
    const participants = [{ race_category: '21km' }];
    const result = calculatePaymentForParticipants(participants, eventConfig);
    expect(result.raceFees).toBe(80);
    expect(result.totalAmount).toBe(80);
    expect(result.charityAmount).toBe(80);
  });

  it('should use default fee for unlisted category', () => {
    // 10km is not explicitly listed in fees, falls back to default: 60
    const participants = [{ race_category: '10km' }];
    const result = calculatePaymentForParticipants(participants, eventConfig);
    expect(result.raceFees).toBe(60);
    expect(result.totalAmount).toBe(60);
    expect(result.charityAmount).toBe(60);
  });
});
