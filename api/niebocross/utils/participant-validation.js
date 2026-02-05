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
  const { fullName, birthDate, city, nationality, raceCategory, phoneNumber, tshirtSize } = participant;

  if (!fullName || !birthDate || !city || !nationality || !raceCategory || !phoneNumber || !tshirtSize) {
    return { valid: false, error: "Wszystkie wymagane pola muszą być wypełnione" };
  }

  // Validate phone number (Polish format: 9 digits)
  if (!/^\d{9}$/.test(phoneNumber)) {
    return { valid: false, error: "Numer telefonu musi składać się z 9 cyfr" };
  }

  // Validate race category
  const validCategories = ['3km_run', '3km_nw', '9km_run', '9km_nw', 'kids_run'];
  if (!validCategories.includes(raceCategory)) {
    return { valid: false, error: "Nieprawidłowa kategoria biegu" };
  }

  // Validate t-shirt size
  const validTshirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  if (!validTshirtSizes.includes(tshirtSize)) {
    return { valid: false, error: "Nieprawidłowy rozmiar koszulki" };
  }

  // Validate age restrictions (event date: April 12, 2026)
  const eventDate = '2026-04-12';
  const age = calculateAge(birthDate, eventDate);

  const adultRaces = ['3km_run', '3km_nw', '9km_run', '9km_nw'];
  const kidsRaces = ['kids_run'];

  if (adultRaces.includes(raceCategory) && age < 18) {
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
  const tshirtFees = 0; // T-shirt fees temporarily disabled until partnership confirmed

  participants.forEach(p => {
    // Race fees
    const category = p.race_category || p.raceCategory;
    if (category === 'kids_run') {
      raceFees += 20;
    } else {
      raceFees += 60;
    }

    // T-shirt fees calculation disabled until partnership confirmed
    // const tshirt = p.tshirt_size || p.tshirtSize;
    // if (tshirt) {
    //   tshirtFees += 80;
    // }
  });

  // Charity amount: race_fees only (t-shirt fees disabled)
  const charityAmount = raceFees;

  return {
    raceFees,
    tshirtFees,
    totalAmount: raceFees + tshirtFees,
    charityAmount
  };
}
