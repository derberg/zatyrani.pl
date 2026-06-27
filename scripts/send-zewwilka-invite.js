/**
 * Nocny Zew Wilka — invite to everyone registered for Wilczy Półmaraton 2026
 *
 * First-touch invite. Goes to ALL people registered for the IV Wilczy
 * Półmaraton (event_id "wilczypolmaraton-2026"), paid or not, regardless of
 * race category — they get first dibs on the 50 spots before the event opens
 * up wider.
 *
 * HOW TO USE:
 *   1. Env vars come from .env.local:
 *      SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
 *   2. TEST RUN (recommended first): send only to one address, no state change:
 *        TEST_EMAIL=lpgornicki@gmail.com node --env-file=.env.local scripts/send-zewwilka-invite.js
 *   3. REAL RUN — send to all registrants:
 *        node --env-file=.env.local scripts/send-zewwilka-invite.js
 *
 * State is saved in scripts/.campaign-state.json (gitignored).
 * Each run only sends to registrations that haven't received this campaign yet,
 * so it is safe to re-run (e.g. to pick up new registrations or retry failures).
 */

import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import { convert } from "html-to-text";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// ─── CAMPAIGN CONFIG — edit before each campaign ─────────────────────────────

const CAMPAIGN_ID = "zewwilka-invite-to-wilczy-registrants-2026";

const DELAY_BETWEEN_EMAILS_MS = 1000;

// Send only to this address (no state change). Set via env for a quick test:
//   TEST_EMAIL=lpgornicki@gmail.com node --env-file=.env.local scripts/send-zewwilka-invite.js
const TEST_EMAIL = process.env.TEST_EMAIL || null;

// ─── Email content ───────────────────────────────────────────────────────────

const EVENT_URL = "https://zatyrani.pl/wilczy-polmaraton/zewwilka/";

function buildSubject() {
  return "Nocny Zew Wilka — nocna rozgrzewka przed Wilczym półmaratonem, 7 sierpnia";
}

function buildHtml(firstName, gender) {
  const hello = firstName ? `Cześć ${firstName},` : "Cześć,";
  const registered =
    gender === "female" ? "Zarejestrowałaś się" : "Zarejestrowałeś się";
  const first = gender === "female" ? "pierwsza" : "pierwszy";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
      <h2 style="color: #1a5c2e;">${hello}</h2>

      <p style="font-size: 16px;">${registered} na IV Wilczy Półmaraton — dzięki temu jako ${first} dostajesz to zaproszenie.</p>

      <p style="font-size: 16px;">Zanim w październiku ruszymy na półmaraton, organizujemy <strong>Nocny Zew Wilka</strong> — darmowy bieg nocny ok. 10 km z pomiarem czasu. Miejsc jest tylko 50.</p>

      <div style="background-color: #f0fdf4; border-left: 4px solid #1a5c2e; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 6px 0; font-size: 16px;"><strong>Kiedy:</strong> 7 sierpnia 2026 (piątek), godz. 20:00</p>
        <p style="margin: 0 0 6px 0; font-size: 16px;"><strong>Gdzie:</strong> Azyl Zatyranych, Rybnik-Ochojec</p>
        <p style="margin: 0 0 6px 0; font-size: 16px;"><strong>Dystans:</strong> ok. 10 km, bieg nocny</p>
        <p style="margin: 0 0 6px 0; font-size: 16px;"><strong>Wstęp:</strong> bezpłatny, obowiązuje rejestracja</p>
        <p style="margin: 0; font-size: 16px;"><strong>Limit:</strong> 50 miejsc, zapisy do 5 sierpnia (lub do wyczerpania miejsc)</p>
      </div>

      <p style="font-size: 16px;">Kilka rzeczy, o których warto wiedzieć:</p>
      <ul style="font-size: 16px; padding-left: 20px; line-height: 1.8;">
        <li>Trasa nie będzie oznaczona — biegniemy według tracka GPS (plik GPX dostaniesz przed biegiem). Czołówka i naładowany zegarek/telefon z GPS obowiązkowe.</li>
        <li>Mierzymy czas, więc sprawdzisz formę przed październikiem.</li>
        <li>Po biegu zostajemy na ognisko i poczęstunek w Azylu Zatyranych.</li>
      </ul>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${EVENT_URL}" style="background-color: #1a5c2e; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Zapisz się na Nocny Zew Wilka</a>
      </div>

      <p style="font-size: 16px;">Miejsca rozejdą się szybko, więc nie zwlekaj z decyzją. Do zobaczenia w lesie.</p>

      <p style="font-size: 16px;">Ekipa Zatyranych</p>

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

async function fetchAllRegistrations() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set");

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("event_registrations")
    .select("id, email, contact_person, event_participants(gender)")
    .eq("event_id", "wilczypolmaraton-2026");

  if (error) throw new Error(`Supabase error: ${error.message}`);

  // De-duplicate by email — one person may have more than one registration,
  // but should only get one invite.
  const byEmail = new Map();
  for (const reg of data || []) {
    const email = (reg.email || "").trim().toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, reg);
  }
  return [...byEmail.values()];
}

async function sendEmail(reg) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SENDGRID_API_KEY not set");

  sgMail.setApiKey(key);

  const firstName = (reg.contact_person || "").trim().split(/\s+/)[0] || "";
  const gender = reg.event_participants?.[0]?.gender || "male";
  const html = buildHtml(firstName, gender);

  await sgMail.send({
    to: reg.email,
    from: process.env.SENDGRID_FROM_EMAIL || "biuro@zatyrani.pl",
    subject: buildSubject(),
    html,
    text: convert(html, htmlToTextOptions),
  });
}

async function run() {
  const registrations = await fetchAllRegistrations();

  if (TEST_EMAIL) {
    const real = registrations.find(
      (r) => (r.email || "").toLowerCase() === TEST_EMAIL.toLowerCase()
    );
    const reg = {
      id: real?.id ?? "00000000-0000-0000-0000-000000000000",
      email: TEST_EMAIL,
      contact_person: real?.contact_person ?? "Łukasz Górnicki",
      event_participants: real?.event_participants ?? [{ gender: "male" }],
    };
    console.log(
      `[campaign] TEST MODE — sending only to ${TEST_EMAIL} (${reg.contact_person}). State will not be updated.`
    );
    try {
      await sendEmail(reg);
      console.log(`  ✓ ${TEST_EMAIL}`);
    } catch (err) {
      console.error(`  ✗ ${TEST_EMAIL}: ${err.message}`);
    }
    return;
  }

  const state = loadState();
  const alreadySent = new Set(state.sent.map((s) => s.email));
  const pending = registrations.filter(
    (r) => !alreadySent.has((r.email || "").toLowerCase())
  );

  console.log(
    `[campaign] "${CAMPAIGN_ID}" — registrations: ${registrations.length}, already sent: ${alreadySent.size}, pending: ${pending.length}`
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
        email: (reg.email || "").toLowerCase(),
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
