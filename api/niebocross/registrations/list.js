import { createClient } from "@supabase/supabase-js";
import { PARTICIPANT_LIMITS, getGroupForCategory } from "../utils/limits.js";
import { shouldFilterEmail } from "../utils/test-data-filter.js";


function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }

  return createClient(url, serviceKey);
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { raceCategory, paymentStatus } = req.query;
    const supabase = getSupabaseClient();

    // Build query with proper join through registrations
    let query = supabase
      .from("niebocross_participants")
      .select(`
        id,
        full_name,
        birth_date,
        city,
        nationality,
        club,
        race_category,
        hide_name_public,
        niebocross_registrations!inner(
          email,
          niebocross_payments(payment_status)
        )
      `);

    // Apply race category filter if specified
    if (raceCategory) {
      // Handle kids_run filter to match all kids categories (for backwards compatibility)
      if (raceCategory === 'kids_run') {
        query = query.in("race_category", ['kids_run', 'kids_100m', 'kids_300m', 'kids_500m']);
      } else {
        query = query.eq("race_category", raceCategory);
      }
    }

    const { data: participants, error } = await query.order("full_name", { ascending: true });

    if (error) {
      console.error("Error fetching participants:", error);
      return res.status(500).json({
        success: false,
        error: "Nie udało się pobrać listy uczestników"
      });
    }

    // Filter out test data in production
    const filteredParticipants = participants.filter(p => {
      const email = p.niebocross_registrations?.email;
      return !shouldFilterEmail(email);
    });

    // Calculate counts for paid participants per group
    const paidCounts = {};
    for (const group in PARTICIPANT_LIMITS) {
      paidCounts[group] = 0;
    }

    filteredParticipants.forEach(p => {
      const paymentStatus = p.niebocross_registrations?.niebocross_payments?.[0]?.payment_status || 'pending';
      if (paymentStatus === 'paid') {
        const group = getGroupForCategory(p.race_category);
        if (group && Object.hasOwn(paidCounts, group)) {
          paidCounts[group]++;
        }
      }
    });

    // Format results (respect hide_name_public)
    let results = filteredParticipants.map(p => ({
      fullName: p.hide_name_public ? "***" : p.full_name,
      city: p.city,
      club: p.club,
      raceCategory: p.race_category,
      paymentStatus: p.niebocross_registrations?.niebocross_payments?.[0]?.payment_status || 'pending'
    }));

    // Apply payment status filter
    if (paymentStatus) {
      results = results.filter(p => p.paymentStatus === paymentStatus);
    }

    // Prepare limits and counts response
    const limitsAndCounts = {};
    for (const [group, config] of Object.entries(PARTICIPANT_LIMITS)) {
      limitsAndCounts[group] = {
        count: paidCounts[group],
        limit: config.limit
      };
    }

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
