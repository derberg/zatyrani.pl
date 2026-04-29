import { calculatePaymentForParticipants } from "./participant-validation.js";

/**
 * Convert participant objects from camelCase to database snake_case.
 * @param {Array} participants - camelCase participant objects from request body
 * @param {string} registration_id - Registration UUID
 * @returns {Array} snake_case records ready for DB insertion
 */
export function createParticipantRecords(participants, registration_id) {
  return participants.map(p => ({
    registration_id,
    first_name: p.firstName,
    last_name: p.lastName,
    birth_date: p.birthDate,
    city: p.city,
    nationality: p.nationality,
    club: p.club || null,
    race_category: p.raceCategory,
    food_preference: p.foodPreference || null,
    hide_name_public: p.hideNamePublic || false,
    tshirt_size: p.tshirtSize || null,
    phone_number: p.phoneNumber,
    gender: p.gender || null
  }));
}

/**
 * Upsert clubs from participants list to shared clubs table.
 * @param {Object} supabase
 * @param {Array} participants - camelCase participant objects
 */
export async function upsertClubs(supabase, participants) {
  for (const participant of participants) {
    if (participant.club) {
      await supabase
        .from("event_clubs")
        .upsert(
          { name: participant.club },
          { onConflict: 'name', ignoreDuplicates: true }
        );
    }
  }
}

/**
 * Update existing pending payment or create a new one.
 * Preserves any extra donation amount on top of recalculated fees.
 *
 * @param {Object} supabase
 * @param {string} registration_id
 * @param {Array} allParticipants - All participants for registration (snake_case from DB)
 * @param {Object|null} existingPendingPayment - Existing pending payment or null
 * @param {Object} eventConfig - Used for fee calculation
 * @param {number} extraDonation - Optional extra donation (default 0)
 * @returns {Object} Updated or created payment record
 */
export async function updateOrCreatePayment(supabase, registration_id, allParticipants, existingPendingPayment, eventConfig, extraDonation = 0) {
  const payment = calculatePaymentForParticipants(allParticipants, eventConfig);

  // Preserve any existing extra donation and add new extra donation
  const existingTotalAmount = Number(existingPendingPayment?.total_amount || 0);
  const existingRaceFees = Number(existingPendingPayment?.race_fees || 0);
  const existingTshirtFees = Number(existingPendingPayment?.tshirt_fees || 0);
  const existingExtraDonation = Math.max(0, existingTotalAmount - existingRaceFees - existingTshirtFees);
  const newExtraDonation = Math.max(0, parseInt(extraDonation || '0'));
  const totalExtraDonation = existingExtraDonation + newExtraDonation;

  payment.totalAmount += totalExtraDonation;
  payment.charityAmount += totalExtraDonation;

  if (existingPendingPayment) {
    // Update existing payment; clear payment_link so new SIBS link is generated on demand
    const { error } = await supabase
      .from("event_payments")
      .update({
        total_amount: payment.totalAmount,
        race_fees: payment.raceFees,
        tshirt_fees: payment.tshirtFees,
        charity_amount: payment.charityAmount,
        payment_link: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", existingPendingPayment.id);

    if (error) throw new Error("Failed to update payment");
    return { ...existingPendingPayment, ...payment };
  } else {
    const { data: newPayment, error } = await supabase
      .from("event_payments")
      .insert({
        registration_id,
        total_amount: payment.totalAmount,
        race_fees: payment.raceFees,
        tshirt_fees: payment.tshirtFees,
        charity_amount: payment.charityAmount,
        payment_status: 'pending'
      })
      .select()
      .single();

    if (error) throw new Error("Failed to create payment");
    return newPayment;
  }
}

/**
 * Reprice a pending payment using the current fee schedule.
 * Preserves any extra donation (amount beyond race_fees + tshirt_fees).
 * Only updates the DB when race + tshirt fees went UP (prices increase over time).
 *
 * Call before reading payment totals in panel/payment endpoints so users always
 * see the correct amount when pricing tiers have advanced since registration.
 *
 * @param {Object} supabase
 * @param {string} registrationId
 * @param {Object} eventConfig
 * @returns {Promise<{ payment: Object|null, previousTotal: number|null, previousRaceFees: number|null, priceIncreased: boolean }>}
 */
export async function repricePendingPayment(supabase, registrationId, eventConfig) {
  const { data: allPayments } = await supabase
    .from("event_payments")
    .select("*")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false });

  const pendingPayment = allPayments?.find(p => p.payment_status === 'pending' || p.payment_status === 'failed');
  const paidPayment = allPayments?.find(p => p.payment_status === 'paid');

  if (!pendingPayment) {
    return { payment: null, previousTotal: null, previousRaceFees: null, priceIncreased: false };
  }

  const { data: allParticipants } = await supabase
    .from("event_participants")
    .select("*")
    .eq("registration_id", registrationId);

  if (!allParticipants || allParticipants.length === 0) {
    return { payment: pendingPayment, previousTotal: null, previousRaceFees: null, priceIncreased: false };
  }

  // When a prior payment has been paid, the pending one is a top-up that covers only
  // participants added after paid_at. Matches delete-participant.js:155-160.
  const participantsForRepricing = paidPayment
    ? allParticipants.filter(p => {
        const paidAt = paidPayment.paid_at || paidPayment.updated_at || paidPayment.created_at;
        return new Date(p.created_at) > new Date(paidAt);
      })
    : allParticipants;

  if (participantsForRepricing.length === 0) {
    return { payment: pendingPayment, previousTotal: null, previousRaceFees: null, priceIncreased: false };
  }

  const freshFees = calculatePaymentForParticipants(participantsForRepricing, eventConfig);

  const storedTotal = Number(pendingPayment.total_amount || 0);
  const storedRace = Number(pendingPayment.race_fees || 0);
  const storedTshirt = Number(pendingPayment.tshirt_fees || 0);
  const extraDonation = Math.max(0, storedTotal - storedRace - storedTshirt);

  const newTotal = freshFees.totalAmount + extraDonation;
  const newCharity = freshFees.charityAmount + extraDonation;

  const priceIncreased = newTotal > storedTotal;

  if (!priceIncreased) {
    return { payment: pendingPayment, previousTotal: null, previousRaceFees: null, priceIncreased: false };
  }

  const { data: updated, error } = await supabase
    .from("event_payments")
    .update({
      total_amount: newTotal,
      race_fees: freshFees.raceFees,
      tshirt_fees: freshFees.tshirtFees,
      charity_amount: newCharity,
      payment_link: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", pendingPayment.id)
    .select()
    .single();

  if (error) {
    console.error("Failed to reprice pending payment:", error);
    return { payment: pendingPayment, previousTotal: null, previousRaceFees: null, priceIncreased: false };
  }

  return {
    payment: updated,
    previousTotal: storedTotal,
    previousRaceFees: storedRace,
    priceIncreased: true
  };
}

/**
 * Get all registrations with pending payments for a given event.
 * Used for payment reminder emails.
 * @param {Object} supabase
 * @param {string} eventId
 * @returns {Promise<Array>}
 */
export async function getUnpaidRegistrations(supabase, eventId) {
  const { data, error } = await supabase
    .from('registrations')
    .select(`
      id,
      email,
      contact_person,
      event_payments!inner(id, total_amount, payment_status)
    `)
    .eq('event_id', eventId)
    .eq('payments.payment_status', 'pending');

  if (error) throw new Error(`Failed to fetch unpaid registrations: ${error.message}`);
  return data || [];
}
