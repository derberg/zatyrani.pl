/**
 * Shared validation and calculation utilities for NieboCross participants
 */

/**
 * Calculate age based on birth date and event date
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
 * Validate a single participant's data
 */
export function validateParticipant(participant) {
  const { fullName, birthDate, city, nationality, raceCategory } = participant;

  if (!fullName || !birthDate || !city || !nationality || !raceCategory) {
    return { valid: false, error: "Wszystkie wymagane pola muszą być wypełnione" };
  }

  // Validate race category
  const validCategories = ['3km_run', '3km_nw', '9km_run', '9km_nw', 'kids_100m', 'kids_300m'];
  if (!validCategories.includes(raceCategory)) {
    return { valid: false, error: "Nieprawidłowa kategoria biegu" };
  }

  // Validate age restrictions (event date: April 12, 2026)
  const eventDate = '2026-04-12';
  const age = calculateAge(birthDate, eventDate);

  const adultRaces = ['3km_run', '3km_nw', '9km_run', '9km_nw'];
  const kidsRaces = ['kids_100m', 'kids_300m'];

  if (adultRaces.includes(raceCategory) && age < 16) {
    return { valid: false, error: "Minimalny wiek dla tras 3km i 9km to 16 lat" };
  }

  if (kidsRaces.includes(raceCategory) && age > 14) {
    return { valid: false, error: "Biegi dzieci dla uczestników do 14 lat" };
  }

  return { valid: true };
}

/**
 * Calculate payment amounts based on participants
 * @param {Array} participants - Array of participant objects with race_category and tshirt_size
 * @returns {Object} Payment breakdown with raceFees, tshirtFees, totalAmount, charityAmount
 */
export function calculatePaymentForParticipants(participants) {
  let raceFees = 0;
  let tshirtFees = 0;

  participants.forEach(p => {
    // Race fees
    const category = p.race_category || p.raceCategory;
    if (category === 'kids_100m' || category === 'kids_300m') {
      raceFees += 20;
    } else {
      raceFees += 60;
    }

    // T-shirt fees
    const tshirt = p.tshirt_size || p.tshirtSize;
    if (tshirt) {
      tshirtFees += 80;
    }
  });

  // Charity amount: race_fees + (tshirt_fees * 10/80)
  const charityAmount = raceFees + (tshirtFees * 10 / 80);

  return {
    raceFees,
    tshirtFees,
    totalAmount: raceFees + tshirtFees,
    charityAmount
  };
}
