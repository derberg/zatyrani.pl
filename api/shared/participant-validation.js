/**
 * Generic participant validation driven by event config.
 */

/**
 * Calculate age at event date.
 */
export function calculateAge(birthDate, eventDate) {
  const birth = new Date(birthDate);
  const event = new Date(eventDate);
  let age = event.getFullYear() - birth.getFullYear();
  const monthDiff = event.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && event.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Validate a single participant against event config rules.
 *
 * @param {Object} participant - camelCase participant data from request body
 * @param {Object} eventConfig - Event config from api/events/config.js
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateParticipant(participant, eventConfig) {
  const { firstName, lastName, birthDate, city, nationality, raceCategory, phoneNumber, tshirtSize, gender } = participant;

  // Required fields (tshirtSize is always optional — empty means no purchase)
  const requiredFields = { firstName, lastName, birthDate, city, nationality, raceCategory, phoneNumber, gender };

  // Gender validation
  if (gender && !['male', 'female'].includes(gender)) {
    return { valid: false, error: "Nieprawidłowa płeć" };
  }

  if (Object.values(requiredFields).some(v => !v)) {
    return { valid: false, error: "Wszystkie wymagane pola muszą być wypełnione" };
  }

  // Phone number (Polish format: 9 digits)
  if (!/^\d{9}$/.test(phoneNumber)) {
    return { valid: false, error: "Numer telefonu musi składać się z 9 cyfr" };
  }

  // Race category must be in event's allowed distances
  if (!eventConfig.distances.includes(raceCategory)) {
    return { valid: false, error: "Nieprawidłowa kategoria biegu" };
  }

  // T-shirt size validation
  if (tshirtSize && !eventConfig.tshirtSizes.includes(tshirtSize)) {
    return { valid: false, error: "Nieprawidłowy rozmiar koszulki" };
  }

  // Age rules
  const age = calculateAge(birthDate, eventConfig.date);
  for (const rule of eventConfig.ageRules) {
    if (rule.categories.includes(raceCategory)) {
      if (rule.minAge !== undefined && age < rule.minAge) {
        return { valid: false, error: `Minimalny wiek dla tej kategorii to ${rule.minAge} lat` };
      }
      if (rule.maxAge !== undefined && age > rule.maxAge) {
        return { valid: false, error: `Maksymalny wiek dla tej kategorii to ${rule.maxAge} lat` };
      }
    }
  }

  return { valid: true };
}

/**
 * Get current fees from event config, supporting both feeSchedule (date-based)
 * and legacy fees object.
 *
 * @param {Object} eventConfig - Event config from api/events/config.js
 * @returns {Object} fees object mapping category to PLN amount
 */
export function getCurrentFees(eventConfig) {
  if (!eventConfig.feeSchedule) {
    return eventConfig.fees;
  }

  const now = new Date();
  for (const entry of eventConfig.feeSchedule) {
    const untilEnd = new Date(entry.until);
    untilEnd.setUTCHours(23, 59, 59, 999);
    if (now <= untilEnd) {
      return entry.fees;
    }
  }

  // All dates passed — return last entry as fallback
  return eventConfig.feeSchedule[eventConfig.feeSchedule.length - 1].fees;
}

/**
 * Calculate payment amounts based on participants and event fee config.
 *
 * @param {Array} participants - Array with race_category (snake_case, from DB)
 * @param {Object} eventConfig - Event config
 * @returns {{ raceFees, tshirtFees, totalAmount, charityAmount }}
 */
export function calculatePaymentForParticipants(participants, eventConfig) {
  const fees = getCurrentFees(eventConfig);
  let raceFees = 0;

  participants.forEach(p => {
    const category = p.race_category || p.raceCategory;
    const fee = fees[category] ?? fees.default ?? 0;
    raceFees += fee;
  });

  const tshirtPrice = eventConfig.tshirtPrice || 0;
  const tshirtCount = participants.filter(p => {
    const size = p.tshirt_size || p.tshirtSize;
    return size && size !== '';
  }).length;
  const tshirtFees = tshirtCount * tshirtPrice;

  const charityAmount = raceFees;

  return {
    raceFees,
    tshirtFees,
    totalAmount: raceFees + tshirtFees,
    charityAmount
  };
}
