/**
 * Shared database operations for NieboCross participant management
 */

import { calculatePaymentForParticipants } from "./participant-validation.js";

/**
 * Convert participant objects from camelCase to database snake_case format
 * @param {Array} participants - Array of participant objects with camelCase properties
 * @param {string} registration_id - Registration UUID
 * @returns {Array} Array of participant records ready for database insertion
 */
export function createParticipantRecords(participants, registration_id) {
  return participants.map(p => ({
    registration_id: registration_id,
    full_name: p.fullName,
    birth_date: p.birthDate,
    city: p.city,
    nationality: p.nationality,
    club: p.club || null,
    race_category: p.raceCategory,
    hide_name_public: p.hideNamePublic || false,
    tshirt_size: p.tshirtSize || null
  }));
}

/**
 * Add clubs from participants to the database (upsert to avoid duplicates)
 * @param {Object} supabase - Supabase client instance
 * @param {Array} participants - Array of participant objects
 */
export async function upsertClubs(supabase, participants) {
  for (const participant of participants) {
    if (participant.club) {
      await supabase
        .from("niebocross_clubs")
        .upsert(
          { name: participant.club },
          { onConflict: 'name', ignoreDuplicates: true }
        );
    }
  }
}

/**
 * Update existing payment or create new one based on all participants
 * @param {Object} supabase - Supabase client instance
 * @param {string} registration_id - Registration UUID
 * @param {Array} allParticipants - All participants for this registration (from DB, snake_case)
 * @param {Object|null} existingPayment - Existing payment record or null
 * @returns {Object} Updated or created payment record
 */
export async function updateOrCreatePayment(supabase, registration_id, allParticipants, existingPayment) {
  // Calculate payment based on all participants
  const payment = calculatePaymentForParticipants(allParticipants);

  if (existingPayment) {
    // Update existing payment
    const { error: updateError } = await supabase
      .from("niebocross_payments")
      .update({
        total_amount: payment.totalAmount,
        race_fees: payment.raceFees,
        tshirt_fees: payment.tshirtFees,
        charity_amount: payment.charityAmount,
        updated_at: new Date().toISOString()
      })
      .eq("registration_id", registration_id);

    if (updateError) {
      throw new Error("Failed to update payment");
    }

    return { ...existingPayment, ...payment };
  } else {
    // Create new payment record
    const paymentLink = `https://zatyrani.pl/niebocross/payment/${registration_id}`;

    const { data: newPayment, error: createError } = await supabase
      .from("niebocross_payments")
      .insert({
        registration_id: registration_id,
        total_amount: payment.totalAmount,
        race_fees: payment.raceFees,
        tshirt_fees: payment.tshirtFees,
        charity_amount: payment.charityAmount,
        payment_status: 'pending',
        payment_link: paymentLink
      })
      .select()
      .single();

    if (createError) {
      throw new Error("Failed to create payment");
    }

    return newPayment;
  }
}
