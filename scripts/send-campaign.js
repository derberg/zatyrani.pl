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

const CAMPAIGN_ID = "organizational-info-march-29";

const SUBJECT = "NieboCross 2026 — ważne informacje organizacyjne 📋";

const DAILY_LIMIT = null; // No limit - send to all paid participants
const DELAY_BETWEEN_EMAILS_MS = 1000; // 1 second delay between emails

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
      <p>NieboCross zbliża się wielkimi krokami! 🏃‍♀️ Mamy dla Ciebie kilka <strong>ważnych informacji organizacyjnych</strong>, które ułatwią Ci przygotowania i udział w wydarzeniu.</p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">👕 Zamówienie koszulki — ostatni dzwonek!</h3>
      <p style="color: #374151;"><strong>Do końca wtorku (31 marca)</strong> możesz jeszcze zamówić koszulkę pamiątkową za pomocą linku w SMS-ie sprzed kilku dni od <strong>LeszyRun</strong>.</p>
      <p style="color: #374151; margin-top: 12px;">Nie możesz znaleźć SMS-a? Zamów manualnie: <a href="https://www.zatyrani.pl/niebocross/koszulka" style="color: #10b981; font-weight: bold;">zatyrani.pl/niebocross/koszulka</a></p>
      <p style="color: #374151; margin-top: 16px;">💳 <strong>Ważne:</strong> Dostawca płatności (PayU) czasami potrzebuje więcej czasu na załadowanie formularza — prosimy o cierpliwość. Po podaniu kodu BLIK pamiętaj o potwierdzeniu płatności w aplikacji banku!</p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">📱 SMS-y z leszy.run — możesz im zaufać!</h3>
      <p style="color: #374151;">Pomiar czasu obsługuje system <strong>leszy.run</strong>.</p>
      <p style="color: #374151; margin-top: 12px;"><strong>2 dni przed wydarzeniem</strong> (10 kwietnia) otrzymasz od tego nadawcy SMS-a z linkiem do wygenerowania <strong>kodu QR</strong>. Będzie on niezbędny do identyfikacji w biurze zawodów.</p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">👶 Uczestnicy nieletni — obowiązkowe oświadczenie</h3>
      <p style="color: #374151;">Jeśli w Twojej grupie są osoby <strong>poniżej 18. roku życia</strong>, <strong>obowiązkowo</strong> musisz mieć ze sobą <strong>wypełnione oświadczenie rodzica/opiekuna prawnego</strong>.</p>
      <p style="color: #374151; margin-top: 12px;">
        📄 <a href="https://drive.google.com/file/d/1hcW-umCJ_AIe9n8KfFRAxOYzI2WQFYDp/view?usp=sharing" style="color: #10b981; font-weight: bold;">Pobierz wzór oświadczenia</a>
      </p>
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #7f1d1d; font-weight: bold;">⚠️ Bez oświadczenia nieletni nie będą mogli wziąć udziału w biegu!</p>
      </div>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">🗺️ Trasy są już dostępne!</h3>
      <p style="color: #374151;">Możesz już zapoznać się z przebiegiem tras 3+ km i 9+ km, a także pobrać pliki GPX:</p>
      <p style="color: #374151; margin-top: 12px;">
        👉 <a href="https://www.zatyrani.pl/niebocross#mapy-tras" style="color: #10b981; font-weight: bold;">Zobacz mapy tras i pobierz GPX</a>
      </p>
      <p style="color: #374151; margin-top: 16px;"><strong>Biuro zawodów</strong> będzie czynne w miejscu startu/mety <strong>od godziny 10:00</strong> (12 kwietnia).</p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">🧒 Bieg dla dzieci — nie czekaj do ostatniej chwili!</h3>
      <p style="color: #374151;"><strong>Bieg dla dzieci</strong> (poniżej 16 lat) startuje o <strong>11:30</strong>.</p>
      <p style="color: #374151; margin-top: 12px;">⏰ <strong>Nie zostawiajcie rejestracji w biurze zawodów na ostatnią chwilę!</strong> Przyjdźcie wcześniej, żeby wszystko załatwić na spokojnie.</p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">🏃 Trening we wtorek — metoda Galloway</h3>
      <p style="color: #374151;">Ostatni trening przed startem odbędzie się <strong>we wtorek, 31 marca o 19:00</strong>.</p>
      <p style="color: #374151; margin-top: 12px;">Tym razem przetestujemy <strong>metodę Galloway</strong> — idealną technikę dla tych, którzy dopiero zaczynają przygodę z bieganiem lub chcą przebiec dłuższy dystans bez dużego zmęczenia. To połączenie biegania i chodzenia w przemyślanych interwałach.</p>
      <p style="color: #374151; margin-top: 12px;">📍 <a href="https://maps.app.goo.gl/1hiWUekjpgK7GpAN8" style="color: #10b981; font-weight: bold;">Nieborowice – Wierzbowa 4</a></p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">🔄 Lista rezerwowa — pomóż innym!</h3>
      <p style="color: #374151;">Jeśli z jakichś przyczyn (choroba, kontuzja, inne nieprzewidziane okoliczności) <strong>nie będziesz mógł/mogła wziąć udziału</strong>, koniecznie daj nam znać jak najszybciej!</p>
      <p style="color: #374151; margin-top: 12px;">Prowadzimy <strong>listę rezerwową</strong> — skontaktujemy Cię z osobą, która przejmie Twój pakiet startowy.</p>
      <p style="color: #374151; margin-top: 16px;">📞 <strong>Kontakt w sprawie rezygnacji:</strong> <a href="tel:+48784640977" style="color: #10b981; font-weight: bold; font-size: 18px;">784 640 977</a></p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 40px 0;">

      <p style="color: #374151; font-size: 16px;">Masz pytania? Zadzwoń: <a href="tel:+48784640977" style="color: #10b981; font-weight: bold;">784 640 977</a></p>
      <p style="font-size: 16px;">Do zobaczenia 12 kwietnia w Nieborowicach! 💚🏃‍♂️</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl" style="color: #10b981;">www.zatyrani.pl</a>
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
  
  // Fetch only registrations with paid status
  const { data, error } = await supabase
    .from("niebocross_registrations")
    .select(`
      email,
      contact_person,
      niebocross_payments!inner(
        payment_status
      )
    `)
    .eq('niebocross_payments.payment_status', 'paid');

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

  const batch = DAILY_LIMIT ? pending.slice(0, DAILY_LIMIT) : pending;
  console.log(`[campaign] Sending to ${batch.length} recipient(s)${DAILY_LIMIT ? ` (limit: ${DAILY_LIMIT})` : ' (no limit)'}...`);

  let sent = 0;
  let failed = 0;

  for (const reg of batch) {
    try {
      await sendEmail(reg.email, reg.contact_person);
      state.sent.push({ email: reg.email, name: reg.contact_person, sent_at: new Date().toISOString() });
      saveState(state);
      console.log(`  ✓ ${reg.email} (${reg.contact_person})`);
      sent++;
      
      // Add delay between emails to avoid rate limiting
      if (DELAY_BETWEEN_EMAILS_MS && sent < batch.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS_MS));
      }
    } catch (err) {
      console.error(`  ✗ ${reg.email}: ${err.message}`);
      failed++;
    }
  }

  const remaining = DAILY_LIMIT ? (pending.length - batch.length) : 0;
  console.log(`\n[campaign] Done — sent: ${sent}, failed: ${failed}${remaining > 0 ? `, still pending: ${remaining}` : ''}`);
  if (remaining > 0) {
    console.log(`[campaign] Run again tomorrow to send to the remaining ${remaining} recipient(s).`);
  }
  console.log(`[campaign] Total paid registrations processed: ${registrations.length}`);
}

await run();
