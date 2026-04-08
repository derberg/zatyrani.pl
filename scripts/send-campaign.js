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

const CAMPAIGN_ID = "final-info-april-10";

const SUBJECT = "NieboCross 2026 — ostatnie informacje przed niedzielą! 🏃";

const DAILY_LIMIT = null; // No limit - send to all paid participants
const DELAY_BETWEEN_EMAILS_MS = 1000; // 1 second delay between emails

// Set to an email address to do a test run: sends only to that recipient,
// does NOT update campaign state, and the email must exist in registrations.
const TEST_EMAIL = "lpgornicki@gmail.com";

/**
 * HTML body of the email.
 * Use ${name} to include the contact person's name.
 */
function buildHtml(name) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #065f46;">Cześć ${name}!</h2>
      <p>Już w niedzielę widzimy się w Nieborowicach! Poniżej najważniejsze informacje na ostatnią chwilę.</p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">⏰ Bądź na czas — odprawa zamykana punktualnie!</h3>
      <p style="color: #374151;">Biuro zawodów otwieramy o <strong>9:30</strong>. Odprawa zamykana jest punktualnie:</p>
      <ul style="color: #374151; margin-top: 8px;">
        <li><strong>11:00</strong> — zamknięcie odprawy na biegi dziecięce</li>
        <li><strong>11:20</strong> — start biegów dziecięcych</li>
        <li><strong>11:40</strong> — zamknięcie odprawy na bieg główny i Nordic Walking</li>
        <li><strong>12:00</strong> — start biegu głównego i NW</li>
      </ul>
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #7f1d1d;"><strong>⚠️ Ważne:</strong> Mamy bardzo dużo osób na liście rezerwowej. Jeśli nie odbierzesz pakietu przed zamknięciem odprawy, Twój pakiet zostanie sprzedany osobom chętnym na miejscu.</p>
      </div>
      <p style="color: #374151; margin-top: 12px;">💡 Możesz też umówić się na indywidualny odbiór pakietu <strong>w sobotę w Nieborowicach</strong> — zadzwoń: <a href="tel:+48784640977" style="color: #10b981; font-weight: bold;">784 640 977</a></p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">🔄 Nie możesz przyjść? Jutro ostatni dzień na rezygnację!</h3>
      <p style="color: #374151;">Jeśli wiesz, że nie dasz rady być w niedzielę — <strong>jutro (czwartek) to ostatni moment</strong>, żeby zadzwonić i zamienić się z kimś z listy rezerwowej. W ten sposób możesz odzyskać swoje pieniądze.</p>
      <p style="color: #374151; margin-top: 12px;">Nawet jeśli nie potrzebujesz zwrotu — daj nam znać! Dzięki temu już teraz możemy wpuścić kogoś z listy rezerwowej. Dla nas to mniej zamieszania w niedzielę, a więcej pieniędzy trafi na cel charytatywny.</p>
      <p style="color: #374151; margin-top: 16px;">📞 <strong>Zadzwoń:</strong> <a href="tel:+48784640977" style="color: #10b981; font-weight: bold; font-size: 18px;">784 640 977</a></p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">📱 SMS z kodem QR — w piątek wieczorem</h3>
      <p style="color: #374151;">W piątek wieczorem wyślemy Ci SMS-a z linkiem do wygenerowania <strong>kodu QR</strong>, który przyspieszy odprawę w biurze zawodów. SMS przyjdzie z platformy <strong>leszy.run</strong> — to nasz system pomiaru czasu, możesz mu zaufać.</p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">📋 Wszystkie szczegóły na stronie</h3>
      <p style="color: #374151;">Harmonogram, mapy tras, lokalizacja biura zawodów i parkingów — wszystko znajdziesz na:</p>
      <p style="color: #374151; margin-top: 12px;">👉 <a href="https://www.zatyrani.pl/niebocross" style="color: #10b981; font-weight: bold;">zatyrani.pl/niebocross</a></p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">🚗 Parking — jedź na Wierzbową 4!</h3>
      <p style="color: #374151;">Przygotowaliśmy wystarczająco dużo miejsc parkingowych blisko wydarzenia. <strong>Nie parkujcie byle gdzie i nie blokujcie prywatnych bram!</strong></p>
      <p style="color: #374151; margin-top: 12px;">Wpisz w nawigację: <strong>Wierzbowa 4 Nieborowice</strong> — nasi wolontariusze pokierują Cię na miejsce parkingowe.</p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">🐾 OTOZ Animals — adoptuj, nie kupuj!</h3>
      <p style="color: #374151;">Na wydarzeniu będą obecne inspektorki z <strong>OTOZ Animals Inspektorat Gliwice</strong> wraz z kilkoma swoimi podopiecznymi — psami, które szukają kochającego domu. Przyjdźcie się przywitać!</p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">🕯️ Pomnik pamięci pomordowanych</h3>
      <p style="color: #374151;">Na trasie biegu, w odległości 400m od startu, znajduje się <strong>„Pomnik pamięci pomordowanych w obozie przejściowym w Nieborowicach"</strong>. Zachęcamy do przyjścia ze zniczem i zapalenia go. My regularnie doglądamy tego miejsca, więc proszę się nie martwić — posprzątamy wypalone znicze. Biuro otwieramy o 9:30, a bieg główny startuje o 12:00, więc będzie sporo czasu, żeby tam podejść.</p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">🎒 Co zabrać ze sobą?</h3>
      <ul style="color: #374151;">
        <li>☕ <strong>Własny kubek</strong> — ograniczmy produkcję śmieci!</li>
        <li>💰 <strong>Trochę gotówki</strong> — na miejscu będzie można kupić ciasta, kiełbaski, kukurydzę, popcorn i watę cukrową. Będą też atrakcje dla dzieci — plecenie warkoczyków i malowanie twarzy. Cały dochód ze sprzedaży trafi bezpośrednio do OTOZ Animals Inspektorat Gliwice.</li>
      </ul>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">👶 Nieletni — oświadczenie obowiązkowe!</h3>
      <p style="color: #374151;">Wszyscy uczestnicy <strong>w wieku 16 lat i młodsi</strong> muszą mieć ze sobą <strong>wydrukowane i podpisane oświadczenie</strong> rodzica/opiekuna prawnego.</p>
      <p style="color: #374151; margin-top: 12px;">📄 <a href="https://www.zatyrani.pl/niebocross/o%C5%9Bwiadczenie_nieletnich.pdf" style="color: #10b981; font-weight: bold;">Pobierz oświadczenie</a></p>
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #7f1d1d; font-weight: bold;">⚠️ Bez oświadczenia nieletni nie będą mogli wziąć udziału!</p>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 40px 0;">

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">📊 Wyniki na żywo!</h3>
      <p style="color: #374151;">Wyniki będą dostępne na żywo w trakcie wydarzenia. Podziel się linkiem z rodziną i znajomymi, żeby mogli kibicować!</p>
      <p style="color: #374151; margin-top: 12px;">👉 <a href="https://www.leszy.run/events/niebocross-pamieci-marka-nowakowskiego/results/live" style="color: #10b981; font-weight: bold;">Wyniki na żywo — leszy.run</a></p>

      <h3 style="color: #065f46; margin-top: 30px; margin-bottom: 16px;">🐺 Wilczy Półmaraton — rejestracja otwarta!</h3>
      <p style="color: #374151;">Jeśli lubisz aktywne spędzanie czasu i nie chcesz kończyć na NieboCrossie — zapraszamy na nasz <strong>Wilczy Półmaraton 2026</strong>! Do wyboru 22km bieg, 22km canicross i 11km nordic walking. Właśnie otworzyliśmy zapisy:</p>
      <p style="color: #374151; margin-top: 12px;">👉 <a href="https://www.zatyrani.pl/wilczy-polmaraton" style="color: #10b981; font-weight: bold;">zatyrani.pl/wilczy-polmaraton</a></p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 40px 0;">

      <p style="color: #374151; font-size: 16px;">Teraz już tylko trzymajcie kciuki za słoneczną pogodę — bo o całą resztę zadbaliśmy! ☀️</p>
      <p style="font-size: 16px;">Do zobaczenia w niedzielę w Nieborowicach! 💚🏃‍♂️</p>

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
    const name = reg ? reg.contact_person : "Testowy Uczestnik";
    console.log(`[campaign] TEST MODE — sending only to ${TEST_EMAIL}${reg ? '' : ' (not in DB, using placeholder name)'}, state will not be updated.`);
    try {
      await sendEmail(TEST_EMAIL, name);
      console.log(`  ✓ ${TEST_EMAIL} (${name})`);
    } catch (err) {
      console.error(`  ✗ ${TEST_EMAIL}: ${err.message}`);
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
