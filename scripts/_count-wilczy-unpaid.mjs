import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data, error } = await supabase
  .from("event_registrations")
  .select(
    `id, email, contact_person,
     event_payments(payment_status, total_amount),
     event_participants(race_category)`
  )
  .eq("event_id", "wilczypolmaraton-2026");

if (error) {
  console.error("Supabase error:", error.message);
  process.exit(1);
}

const filtered = (data || []).filter((reg) => {
  const payments = reg.event_payments || [];
  const hasPaid = payments.some((p) => p.payment_status === "paid");
  const hasPending = payments.some((p) =>
    ["pending", "failed"].includes(p.payment_status)
  );
  if (hasPaid || !hasPending) return false;
  const participants = reg.event_participants || [];
  const isNwOnly =
    participants.length > 0 &&
    participants.every((p) => p.race_category === "11km_nw");
  return !isNwOnly;
});

console.log(`\nTotal registrations for wilczypolmaraton-2026: ${data.length}`);
console.log(`Eligible unpaid (21km/canicross, not paid, not NW-only): ${filtered.length}\n`);

const pad = (s, n) => String(s ?? "").padEnd(n);
console.log(pad("email", 38), pad("name", 28), pad("categories", 20), "due");
console.log("─".repeat(100));
for (const r of filtered) {
  const cats = (r.event_participants || []).map((p) => p.race_category).join(",");
  const pending = (r.event_payments || []).find((p) =>
    ["pending", "failed"].includes(p.payment_status)
  );
  console.log(
    pad(r.email, 38),
    pad(r.contact_person, 28),
    pad(cats, 20),
    pending?.total_amount ? `${pending.total_amount} zł` : "-"
  );
}
