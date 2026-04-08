import { getSupabaseClient } from "../../../shared/supabase.js";
import { getGroupForCategory, buildPaidCounts, buildLimitsAndCounts } from "../../../shared/limits.js";
import { shouldFilterEmail } from "../../../shared/test-data-filter.js";
import { getEventConfig } from "../../config.js";
import { setCorsHeaders } from "../../../shared/cors.js";

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get event config
    let eventConfig;
    try {
      eventConfig = getEventConfig(req.query.eventId);
    } catch {
      return res.status(404).json({ success: false, error: "Nieznane wydarzenie" });
    }

    const { raceCategory, paymentStatus } = req.query;
    const supabase = getSupabaseClient();

    // Build query with proper join through registrations
    let query = supabase
      .from("event_participants")
      .select(`
        first_name,
        last_name,
        city,
        club,
        race_category,
        gender,
        hide_name_public,
        created_at,
        event_registrations!inner(
          email,
          event_id,
          event_payments(payment_status, paid_at, updated_at, created_at)
        )
      `);

    // Filter by event_id
    query = query.eq("event_registrations.event_id", eventConfig.id);

    // Apply race category filter if specified
    if (raceCategory) {
      // Handle kids_run filter to match all kids categories (for backwards compatibility)
      if (raceCategory === 'kids_run') {
        query = query.in("race_category", ['kids_run', 'kids_100m', 'kids_300m', 'kids_500m']);
      } else {
        query = query.eq("race_category", raceCategory);
      }
    }

    const { data: participants, error } = await query
      .order("updated_at", { ascending: true });

    if (error) {
      console.error("Error fetching participants:", error);
      return res.status(500).json({
        success: false,
        error: "Nie udało się pobrać listy uczestników"
      });
    }

    // Filter out test data in production
    const filteredParticipants = participants.filter(p => {
      const email = p.event_registrations?.email;
      return !shouldFilterEmail(email);
    });

    // Calculate counts for paid participants per group
    const paidCounts = buildPaidCounts(eventConfig);

    filteredParticipants.forEach(p => {
      const payments = p.event_registrations?.event_payments || [];
      const hasPaidPayment = payments.some(pay => pay.payment_status === 'paid');
      if (hasPaidPayment) {
        const group = getGroupForCategory(p.race_category, eventConfig);
        if (group && Object.hasOwn(paidCounts, group)) {
          paidCounts[group]++;
        }
      }
    });

    // Format results (respect hide_name_public)
    let results = filteredParticipants.map(p => ({
      fullName: p.hide_name_public ? "***" : `${p.first_name} ${p.last_name}`.trim(),
      city: p.city,
      club: p.club,
      gender: p.gender,
      raceCategory: p.race_category,
      paymentStatus: (() => {
        const payments = p.event_registrations?.event_payments || [];
        const hasPaidPayment = payments.some(pay => pay.payment_status === 'paid');
        const hasPendingPayment = payments.some(pay => pay.payment_status === 'pending' || pay.payment_status === 'failed');
        // If there's a paid payment, mark as paid unless there's also a pending one (top-up for new participants)
        // In that case, check if participant was created before the paid payment
        if (hasPaidPayment && hasPendingPayment) {
          const paidPayment = payments.find(pay => pay.payment_status === 'paid');
          const paidAt = paidPayment.paid_at || paidPayment.updated_at || paidPayment.created_at;
          return new Date(p.created_at) <= new Date(paidAt) ? 'paid' : 'pending';
        }
        if (hasPaidPayment) return 'paid';
        return 'pending';
      })()
    }));

    // Apply payment status filter
    if (paymentStatus) {
      results = results.filter(p => p.paymentStatus === paymentStatus);
    }

    // Prepare limits and counts response
    const limitsAndCounts = buildLimitsAndCounts(paidCounts, eventConfig);

    return res.status(200).json({
      success: true,
      participants: results,
      total: results.length,
      limitsAndCounts
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."
    });
  }
}
