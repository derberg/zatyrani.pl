/**
 * Wilczy Półmaraton 2026 — FINAL price reminder email campaign
 *
 * Last call before the June 1st price increase. Sends to all
 * registered-but-unpaid participants. 21km/canicross goes from 100 zł to
 * 130 zł on June 1st.
 *
 * HOW TO USE:
 *   1. Set env vars: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
 *   2. Optionally set TEST_EMAIL below for a dry run (does not update state)
 *   3. Run: node scripts/send-wilczy-final-reminder.js
 *
 * State is saved in scripts/.campaign-state.json (gitignored).
 * Changing CAMPAIGN_ID resets state and starts a fresh campaign.
 * Each run only sends to registrations that haven't received this campaign yet.
 */

import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import { convert } from "html-to-text";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// ─── CAMPAIGN CONFIG — edit before each campaign ─────────────────────────────

const CAMPAIGN_ID = "wilczy-final-reminder-may-2026";

const DELAY_BETWEEN_EMAILS_MS = 1000;

// Set to an email address to do a test run: sends only to that address,
// does NOT update campaign state. If the email isn't found among unpaid
// registrations, a synthetic test registration is generated instead.
const TEST_EMAIL = null;
const TEST_INCLUDE_TSHIRT = true; // when true, synthetic test total = 100 + 80 = 180

// ─────────────────────────────────────────────────────────────────────────────

function buildSubject(firstName, gender) {
  const verb = gender === "female" ? "opłaciłaś" : "opłaciłeś";
  return `Wilczy Półmaraton: ${firstName}, za 10 dni cena rośnie do 130 zł — jeszcze nie ${verb} startu`;
}

function buildHtml(firstName, gender, registrationId, totalAmount) {
  const paymentUrl = `https://zatyrani.pl/wilczy-polmaraton/payment?id=${registrationId}`;
  const registered =
    gender === "female" ? "Zarejestrowałaś się" : "Zarejestrowałeś się";

  const urgencyBlock = `
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #991b1b; font-size: 16px; font-weight: bold;">🚨 OSTATNIE 10 DNI — cena 100 zł!</p>
        <p style="margin: 8px 0 0 0; color: #7f1d1d; font-size: 15px;">Od <strong>1 czerwca</strong> wpisowe na bieg 21km i canicross wzrasta do <strong>130 zł</strong>. Opłać teraz i zaoszczędź 30 zł.</p>
      </div>`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a5c2e;">Hej ${firstName}!</h2>

      <p style="color: #374151; font-size: 16px;">${registered} na <strong>IV Wilczy Półmaraton</strong> (17 października 2026 w Wilczy), ale Twoja opłata startowa wciąż nie dotarła.</p>

      ${urgencyBlock}

      ${
        totalAmount
          ? `
      <div style="background-color: #f9fafb; padding: 16px 20px; margin: 20px 0; border-left: 4px solid #1a5c2e; border-radius: 4px;">
        <p style="margin: 0; color: #111827; font-size: 16px;"><strong>Do zapłaty: ${totalAmount} zł</strong></p>
      </div>
      `
          : ""
      }

      <div style="text-align: center; margin: 30px 0;">
        <a href="${paymentUrl}" style="background-color: #dc2626; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Opłać start teraz →</a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

      <h3 style="color: #1a5c2e;">Czeka na Ciebie kawałek prawdziwego lasu</h3>

      <p style="color: #374151; font-size: 16px;">Trasa wiedzie pięknymi leśnymi ścieżkami uroczyska <strong>„Głębokie Doły"</strong> — pamiątki po prastarej puszczy Nadleśnictwa Rybnik z niepowtarzalnym mikroklimatem i bogatą florą. Drugiego takiego półmaratonu na Śląsku nie znajdziesz.</p>

      <ul style="color: #374151; padding-left: 20px; font-size: 16px; line-height: 2;">
        <li>🏅 Pamiątkowy medal dla każdego uczestnika</li>
        <li>💪 Adrenalina i dziki kros przez leśne ścieżki</li>
        <li>😅 Klasyczne błoto w „magicznym miejscu" na trasie</li>
      </ul>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #9ca3af; font-size: 13px;">
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl" style="color: #1a5c2e;">www.zatyrani.pl</a>
      </p>
    </div>
  `;
}

// ─── Infrastructure ───────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, ".campaign-state.json");

const htmlToTextOptions = {
  wordwrap: 80,
  selectors: [
    { selector: "a", options: { ignoreHref: false } },
    { selector: "img", format: "skip" },
    { selector: "hr", format: "skip" },
  ],
};

function loadAllCampaigns() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function loadState() {
  const all = loadAllCampaigns();
  if (!all[CAMPAIGN_ID]) {
    console.log(`[campaign] New campaign "${CAMPAIGN_ID}", starting fresh.`);
  }
  return all[CAMPAIGN_ID] ?? { sent: [] };
}

function saveState(campaignState) {
  const all = loadAllCampaigns();
  all[CAMPAIGN_ID] = campaignState;
  writeFileSync(STATE_FILE, JSON.stringify(all, null, 2), "utf-8");
}

async function fetchUnpaidRegistrations() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set");

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("event_registrations")
    .select(
      `
      id,
      email,
      contact_person,
      event_payments(id, total_amount, payment_status),
      event_participants(gender, race_category)
    `
    )
    .eq("event_id", "wilczypolmaraton-2026");

  if (error) throw new Error(`Supabase error: ${error.message}`);

  return (data || []).filter((reg) => {
    const payments = reg.event_payments || [];
    const hasPaid = payments.some((p) => p.payment_status === "paid");
    const hasPending = payments.some((p) =>
      ["pending", "failed"].includes(p.payment_status)
    );
    if (hasPaid || !hasPending) return false;

    const participants = reg.event_participants || [];
    const isNwOnly = participants.length > 0 && participants.every(
      (p) => p.race_category === "11km_nw"
    );
    return !isNwOnly;
  });
}

async function sendEmail(reg) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SENDGRID_API_KEY not set");

  sgMail.setApiKey(key);

  const firstName = reg.contact_person.split(" ")[0];
  const gender = reg.event_participants?.[0]?.gender || "male";
  const pendingPayment = (reg.event_payments || []).find((p) =>
    ["pending", "failed"].includes(p.payment_status)
  );
  const totalAmount = pendingPayment?.total_amount ?? null;

  const subject = buildSubject(firstName, gender);
  const html = buildHtml(firstName, gender, reg.id, totalAmount);

  await sgMail.send({
    to: reg.email,
    from: process.env.SENDGRID_FROM_EMAIL || "biuro@zatyrani.pl",
    subject,
    html,
    text: convert(html, htmlToTextOptions),
  });
}

async function run() {
  const registrations = await fetchUnpaidRegistrations();

  if (TEST_EMAIL) {
    const real = registrations.find((r) => r.email === TEST_EMAIL);
    const syntheticTotal = TEST_INCLUDE_TSHIRT ? 180 : 100;
    const reg = {
      id: real?.id ?? "00000000-0000-0000-0000-000000000000",
      email: TEST_EMAIL,
      contact_person: real?.contact_person ?? "Lukasz Gornicki",
      event_payments: [
        { id: "test", total_amount: syntheticTotal, payment_status: "pending" },
      ],
      event_participants: real?.event_participants?.length
        ? real.event_participants
        : [{ gender: "male", race_category: "21km" }],
    };
    console.log(
      `[campaign] TEST MODE — sending to ${TEST_EMAIL} with overridden total ${syntheticTotal} zł${TEST_INCLUDE_TSHIRT ? " (incl. t-shirt)" : ""}. State will not be updated.`
    );
    try {
      await sendEmail(reg);
      console.log(`  ✓ ${TEST_EMAIL} (${reg.contact_person})`);
    } catch (err) {
      console.error(`  ✗ ${TEST_EMAIL}: ${err.message}`);
    }
    return;
  }

  const state = loadState();
  const alreadySent = new Set(state.sent.map((s) => s.email));
  const pending = registrations.filter((r) => !alreadySent.has(r.email));

  console.log(
    `[campaign] "${CAMPAIGN_ID}" — unpaid registrations: ${registrations.length}, already sent: ${alreadySent.size}, pending: ${pending.length}`
  );

  if (pending.length === 0) {
    console.log("[campaign] Everyone has received this campaign. Done.");
    return;
  }

  console.log(`[campaign] Sending to ${pending.length} recipient(s)...`);

  let sent = 0;
  let failed = 0;

  for (const reg of pending) {
    try {
      await sendEmail(reg);
      state.sent.push({
        email: reg.email,
        name: reg.contact_person,
        sent_at: new Date().toISOString(),
      });
      saveState(state);
      console.log(`  ✓ ${reg.email} (${reg.contact_person})`);
      sent++;

      if (DELAY_BETWEEN_EMAILS_MS && sent < pending.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_EMAILS_MS)
        );
      }
    } catch (err) {
      console.error(`  ✗ ${reg.email}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n[campaign] Done — sent: ${sent}, failed: ${failed}`);
}

await run();
