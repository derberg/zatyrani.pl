/**
 * SIBS Payments Report
 *
 * Shows paid amounts per event and lets you look up any payment by its ID
 * (the ID is what SIBS receives as merchantTransactionId).
 *
 * HOW TO USE:
 *   Summary of all events:
 *     node --env-file=.env.local scripts/payments-report.js
 *
 *   Filter to one event:
 *     node --env-file=.env.local scripts/payments-report.js --event niebocross-2026
 *     node --env-file=.env.local scripts/payments-report.js --event wilczypolmaraton-2026
 *
 *   Look up a specific payment ID:
 *     node --env-file=.env.local scripts/payments-report.js --id <uuid>
 */

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set");
  return createClient(url, key);
}

function fmt(amount) {
  return `${Number(amount).toFixed(2)} zł`;
}

function fmtDate(ts) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
}

// ── NieboCross (legacy table) ─────────────────────────────────────────────────

async function fetchNiebocross(supabase, paymentId) {
  let query = supabase
    .from("niebocross_payments")
    .select(`
      id,
      total_amount,
      charity_amount,
      payment_status,
      transaction_id,
      paid_at,
      created_at,
      niebocross_registrations!inner(email, contact_person)
    `)
    .order("created_at", { ascending: false });

  if (paymentId) query = query.eq("id", paymentId);

  const { data, error } = await query;
  if (error) throw new Error(`niebocross_payments: ${error.message}`);
  return (data || []).map(p => ({
    event: "niebocross-2026",
    id: p.id,
    email: p.niebocross_registrations?.email ?? "-",
    contact: p.niebocross_registrations?.contact_person ?? "-",
    status: p.payment_status,
    total: p.total_amount,
    charity: p.charity_amount,
    transaction_id: p.transaction_id ?? "-",
    paid_at: p.paid_at,
    created_at: p.created_at,
  }));
}

// ── Generic events table ──────────────────────────────────────────────────────

async function fetchGeneric(supabase, eventId, paymentId) {
  let query = supabase
    .from("payments")
    .select(`
      id,
      total_amount,
      charity_amount,
      payment_status,
      transaction_id,
      paid_at,
      created_at,
      registrations!inner(email, contact_person, event_id)
    `)
    .order("created_at", { ascending: false });

  if (eventId) query = query.eq("registrations.event_id", eventId);
  if (paymentId) query = query.eq("id", paymentId);

  const { data, error } = await query;
  if (error) throw new Error(`payments: ${error.message}`);
  return (data || []).map(p => ({
    event: p.registrations?.event_id ?? "unknown",
    id: p.id,
    email: p.registrations?.email ?? "-",
    contact: p.registrations?.contact_person ?? "-",
    status: p.payment_status,
    total: p.total_amount,
    charity: p.charity_amount,
    transaction_id: p.transaction_id ?? "-",
    paid_at: p.paid_at,
    created_at: p.created_at,
  }));
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function printEventSummary(eventId, payments) {
  const paid = payments.filter(p => p.status === "paid");
  const pending = payments.filter(p => p.status === "pending");
  const failed = payments.filter(p => p.status === "failed" || p.status === "cancelled");

  const totalPaid = paid.reduce((s, p) => s + Number(p.total), 0);
  const totalCharity = paid.reduce((s, p) => s + Number(p.charity), 0);

  console.log(`\n${"═".repeat(70)}`);
  console.log(`  EVENT: ${eventId}`);
  console.log(`${"═".repeat(70)}`);
  console.log(`  Paid:    ${paid.length} payments   →  ${fmt(totalPaid)}  (charity: ${fmt(totalCharity)})`);
  console.log(`  Pending: ${pending.length} payments`);
  console.log(`  Failed:  ${failed.length} payments`);

  if (paid.length > 0) {
    console.log(`\n  ── Paid transactions ──`);
    console.log(`  ${"ID".padEnd(36)}  ${"Amount".padStart(10)}  ${"Paid at".padEnd(20)}  Contact`);
    console.log(`  ${"─".repeat(36)}  ${"─".repeat(10)}  ${"─".repeat(20)}  ${"─".repeat(20)}`);
    for (const p of paid) {
      console.log(`  ${p.id}  ${fmt(p.total).padStart(10)}  ${fmtDate(p.paid_at).padEnd(20)}  ${p.contact} <${p.email}>`);
    }
  }
}

function printSinglePayment(payment) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Payment lookup`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  ID (merchantTransactionId):  ${payment.id}`);
  console.log(`  Event:                       ${payment.event}`);
  console.log(`  Status:                      ${payment.status}`);
  console.log(`  Amount:                      ${fmt(payment.total)}`);
  console.log(`  Charity:                     ${fmt(payment.charity)}`);
  console.log(`  SIBS transaction_id:         ${payment.transaction_id}`);
  console.log(`  Paid at:                     ${fmtDate(payment.paid_at)}`);
  console.log(`  Created at:                  ${fmtDate(payment.created_at)}`);
  console.log(`  Contact:                     ${payment.contact}`);
  console.log(`  Email:                       ${payment.email}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const eventArg = args[args.indexOf("--event") + 1] ?? null;
const idArg = args[args.indexOf("--id") + 1] ?? null;

const supabase = getSupabase();

if (idArg) {
  // Look up a specific payment ID across both tables
  const [niebocross, generic] = await Promise.all([
    fetchNiebocross(supabase, idArg).catch(() => []),
    fetchGeneric(supabase, null, idArg).catch(() => []),
  ]);
  const all = [...niebocross, ...generic];
  if (all.length === 0) {
    console.log(`\n  No payment found with ID: ${idArg}`);
  } else {
    printSinglePayment(all[0]);
  }
} else {
  // Summary report
  const fetchNiebo = eventArg && eventArg !== "niebocross-2026"
    ? Promise.resolve([])
    : fetchNiebocross(supabase, null);

  const fetchGen = eventArg && eventArg === "niebocross-2026"
    ? Promise.resolve([])
    : fetchGeneric(supabase, eventArg, null);

  const [niebocross, generic] = await Promise.all([fetchNiebo, fetchGen]);

  // Group generic by event_id
  const byEvent = {};
  for (const p of generic) {
    (byEvent[p.event] ??= []).push(p);
  }

  if (!eventArg || eventArg === "niebocross-2026") {
    printEventSummary("niebocross-2026", niebocross);
  }
  for (const [eid, payments] of Object.entries(byEvent)) {
    printEventSummary(eid, payments);
  }

  console.log(`\n`);
}
