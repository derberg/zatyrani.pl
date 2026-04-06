import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

// Load .env.local
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
}

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

// Get registrations with emails
const { data: registrations, error: regErr } = await supabase
  .from("niebocross_registrations")
  .select("id, email")
  .in("id", paidRegIds);

if (regErr) {
  console.error("Error fetching registrations:", regErr.message);
  process.exit(1);
}

const emailByRegId = Object.fromEntries(registrations.map((r) => [r.id, r.email]));

// Get participants for paid registrations
const { data: participants, error: partErr } = await supabase
  .from("niebocross_participants_v2")
  .select("registration_id, first_name, last_name, birth_date, club, race_category, phone_number, tshirt_size")
  .in("registration_id", paidRegIds);

if (partErr) {
  console.error("Error fetching participants:", partErr.message);
  process.exit(1);
}

// Output CSV
const escapeCSV = (val) => {
  if (val == null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// --- Participants CSV ---
let participantsCsv = "first_name,last_name,email,gender,birth_date,club,category_id,phone,tshirt_size\n";
for (const p of participants) {
  const row = [
    p.first_name,
    p.last_name,
    emailByRegId[p.registration_id],
    "", // gender - not stored in DB
    p.birth_date,
    p.club,
    p.race_category,
    p.phone_number,
    p.tshirt_size,
  ];
  participantsCsv += row.map(escapeCSV).join(",") + "\n";
}
writeFileSync("participants.csv", participantsCsv);
console.log(`Written ${participants.length} participants to participants.csv`);

// --- Race Categories CSV ---
const categories = [
  { id: "3km_run", name: "Bieg 3 km", distance_meters: 3000 },
  { id: "3km_nw", name: "Nordic Walking 3 km", distance_meters: 3000 },
  { id: "9km_run", name: "Bieg 9 km", distance_meters: 9000 },
  { id: "9km_nw", name: "Nordic Walking 9 km", distance_meters: 9000 },
  { id: "kids_run", name: "Bieg dziecięcy", distance_meters: 0 },
];
let categoriesCsv = "id,name,distance_meters\n";
for (const c of categories) {
  categoriesCsv += `${c.id},${c.name},${c.distance_meters}\n`;
}
writeFileSync("race_categories.csv", categoriesCsv);
console.log(`Written ${categories.length} categories to race_categories.csv`);
