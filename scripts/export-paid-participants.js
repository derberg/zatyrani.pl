import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Get all registrations with paid payments
const { data: payments, error: payErr } = await supabase
  .from("niebocross_payments")
  .select("registration_id")
  .eq("payment_status", "paid");

if (payErr) {
  console.error("Error fetching payments:", payErr.message);
  process.exit(1);
}

const paidRegIds = [...new Set(payments.map((p) => p.registration_id))];

if (paidRegIds.length === 0) {
  console.error("No paid registrations found");
  process.exit(0);
}

// Get participants for paid registrations
const { data: participants, error: partErr } = await supabase
  .from("niebocross_participants_v2")
  .select("first_name, last_name, birth_date, city, nationality, club, race_category, food_preference, tshirt_size, phone_number")
  .in("registration_id", paidRegIds);

if (partErr) {
  console.error("Error fetching participants:", partErr.message);
  process.exit(1);
}

// Output CSV
const headers = [
  "first_name",
  "last_name",
  "birth_date",
  "city",
  "nationality",
  "club",
  "race_category",
  "food_preference",
  "tshirt_size",
  "phone_number",
];

const escapeCSV = (val) => {
  if (val == null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

console.log(headers.join(","));
for (const p of participants) {
  console.log(headers.map((h) => escapeCSV(p[h])).join(","));
}
