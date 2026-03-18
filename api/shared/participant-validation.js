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
  const { firstName, lastName, birthDate, city, nationality, raceCategory, phoneNumber, tshirtSize } = participant;

  // Required fields (tshirtSize only required if tshirtEnabled)
  const requiredFields = { firstName, lastName, birthDate, city, nationality, raceCategory, phoneNumber };
  if (eventConfig.tshirtEnabled) {
    requiredFields.tshirtSize = tshirtSize;
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
 * Calculate payment amounts based on participants and event fee config.
 *
 * @param {Array} participants - Array with race_category (snake_case, from DB)
 * @param {Object} eventConfig - Event config
 * @returns {{ raceFees, tshirtFees, totalAmount, charityAmount }}
 */
export function calculatePaymentForParticipants(participants, eventConfig) {
  let raceFees = 0;
  const tshirtFees = 0; // T-shirt fees disabled until confirmed

  participants.forEach(p => {
    const category = p.race_category || p.raceCategory;
    const fee = eventConfig.fees[category] ?? eventConfig.fees.default ?? 0;
    raceFees += fee;
  });

  const charityAmount = raceFees;

  return {
    raceFees,
    tshirtFees,
    totalAmount: raceFees + tshirtFees,
    charityAmount
  };
}
