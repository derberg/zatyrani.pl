/**
 * NieboCross custom email campaign script
 *
 * HOW TO USE:
 *   1. Ask agent to update CAMPAIGN_ID, SUBJECT, DAILY_LIMIT and HTML_MESSAGE below
 *   2. Run: node scripts/send-campaign.js
 *
 * State is saved in scripts/.campaign-state.json (gitignored).
 * Changing CAMPAIGN_ID resets the state and starts a fresh campaign.
 * Each run sends to registrations that haven't received this campaign yet.
 */

import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import { convert } from "html-to-text";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// ─── CAMPAIGN CONFIG — edit before each campaign ─────────────────────────────

const CAMPAIGN_ID = "info-about-trainings";

const SUBJECT = "Zapraszamy na oficjalne treningi NieboCross z ekspertką z Kliniki Nieborowice 🏃";

const DAILY_LIMIT = 70;

// Set to an email address to do a test run: sends only to that recipient,
// does NOT update campaign state, and the email must exist in registrations.
const TEST_EMAIL = null;

/**
 * HTML body of the email.
 * Use ${name} to include the contact person's name.
 */
function buildHtml(name) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #065f46;">Cześć ${name}!</h2>
      <p>Mamy dla Ciebie świetną wiadomość — już w <strong>najbliższy czwartek (12 marca o 19:00)</strong> startujemy z oficjalnymi treningami rekonesansowymi NieboCross 2026!</p>
      <p>To idealna okazja, żeby poznać trasę jeszcze przed startem — niezależnie od tego, czy biegniesz, czy idziesz z kijkami.</p>

      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-weight: bold; color: #065f46;">Rozgrzewka z ekspertką z Kliniki Nieborowice</p>
        <p style="margin: 0; color: #374151;">Na każdym treningu rozgrzewkę poprowadzi trenerka przygotowania motorycznego i GPS <strong>kobiecej reprezentacji Polski w piłce nożnej</strong>. Profesjonalne przygotowanie fizyczne dostosowane do każdego uczestnika.</p>
      </div>

      <h3 style="color: #065f46; margin-bottom: 8px;">Terminy treningów:</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #f0fdf4;">
          <td style="padding: 12px 16px; font-weight: bold; font-size: 18px; color: #111827;">12 marca</td>
          <td style="padding: 12px 16px; color: #6b7280;">czwartek · 19:00</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; font-weight: bold; font-size: 18px; color: #111827;">19 marca</td>
          <td style="padding: 12px 16px; color: #6b7280;">czwartek · 19:00</td>
        </tr>
        <tr style="background-color: #f0fdf4;">
          <td style="padding: 12px 16px; font-weight: bold; font-size: 18px; color: #111827;">26 marca</td>
          <td style="padding: 12px 16px; color: #6b7280;">czwartek · 19:00</td>
        </tr>
      </table>
      <p style="color: #374151;">📍 <a href="https://maps.app.goo.gl/1hiWUekjpgK7GpAN8" style="color: #10b981; font-weight: bold;">Nieborowice – Wierzbowa 4</a> (kliknij, żeby otworzyć w Mapach Google)</p>

      <p style="color: #374151;">Poprowadzimy zarówno trasę <strong>3+ km</strong>, jak i <strong>9+ km</strong> — każdy znajdzie coś dla siebie, niezależnie od poziomu zaawansowania.</p>

      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; color: #92400e;">📌 <strong>Zapisz sobie te terminy!</strong> Nie będziemy wysyłać cotygodniowych przypomnień, żeby nie zaśmiecać skrzynki — to jedyna wiadomość o treningach.</p>
        <p style="margin: 0; color: #92400e;">Ewentualne dodatkowe, spontaniczne treningi pojawią się na <a href="https://www.zatyrani.pl/" style="color: #b45309; font-weight: bold;">zatyrani.pl</a> oraz na <a href="https://www.facebook.com/events/1586078795903551" style="color: #b45309; font-weight: bold;">wydarzeniu na Facebooku</a>.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.zatyrani.pl/niebocross#treningi-rekonesansowe"
           style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
          Więcej szczegółów →
        </a>
      </div>

      <p style="color: #374151;">Masz pytania? Zadzwoń: <a href="tel:+48784640977" style="color: #10b981; font-weight: bold;">784 640 977</a></p>
      <p>Do zobaczenia na trasie! 💚</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl">www.zatyrani.pl</a>
      </p>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────

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

async function fetchAllRegistrations() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set");

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("niebocross_registrations")
    .select("email, contact_person");

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data || [];
}

async function sendEmail(email, name) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SENDGRID_API_KEY not set");

  sgMail.setApiKey(key);

  const html = buildHtml(name);
  await sgMail.send({
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "biuro@zatyrani.pl",
    subject: SUBJECT,
    html,
    text: convert(html, htmlToTextOptions),
  });
}

async function run() {
  const registrations = await fetchAllRegistrations();

  if (TEST_EMAIL) {
    const reg = registrations.find((r) => r.email === TEST_EMAIL);
    if (!reg) {
      console.error(`[campaign] TEST_EMAIL "${TEST_EMAIL}" not found in registrations.`);
      process.exit(1);
    }
    console.log(`[campaign] TEST MODE — sending only to ${TEST_EMAIL}, state will not be updated.`);
    try {
      await sendEmail(reg.email, reg.contact_person);
      console.log(`  ✓ ${reg.email} (${reg.contact_person})`);
    } catch (err) {
      console.error(`  ✗ ${reg.email}: ${err.message}`);
    }
    return;
  }

  const state = loadState();
  const alreadySent = new Set(state.sent.map((s) => s.email));
  const pending = registrations.filter((r) => !alreadySent.has(r.email));

  console.log(
    `[campaign] "${CAMPAIGN_ID}" — total registrations: ${registrations.length}, already sent: ${alreadySent.size}, pending: ${pending.length}`
  );

  if (pending.length === 0) {
    console.log("[campaign] Everyone has received this campaign. Done.");
    return;
  }

  const batch = pending.slice(0, DAILY_LIMIT);
  console.log(`[campaign] Sending to ${batch.length} recipient(s) (limit: ${DAILY_LIMIT})...`);

  let sent = 0;
  let failed = 0;

  for (const reg of batch) {
    try {
      await sendEmail(reg.email, reg.contact_person);
      state.sent.push({ email: reg.email, name: reg.contact_person, sent_at: new Date().toISOString() });
      saveState(state);
      console.log(`  ✓ ${reg.email} (${reg.contact_person})`);
      sent++;
    } catch (err) {
      console.error(`  ✗ ${reg.email}: ${err.message}`);
      failed++;
    }
  }

  const remaining = pending.length - batch.length;
  console.log(`\n[campaign] Done — sent: ${sent}, failed: ${failed}, still pending: ${remaining}`);
  if (remaining > 0) {
    console.log(`[campaign] Run again tomorrow to send to the remaining ${remaining} recipient(s).`);
  }
}

await run();
