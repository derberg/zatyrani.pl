/**
 * Wilczy Półmaraton 2026 — one-time invite to past participants
 *
 * The email list (412 addresses) was exported from
 * iii-wilczy-polmaraton-emails-20260511-1453.xlsx and filtered to remove
 * anyone already registered for the 2026 edition. The list is inlined
 * below so this script has no extra dependencies.
 *
 * Promises a one-time send — do NOT use this campaign as a template for
 * follow-ups. If you want a second touch, build a new campaign explicitly.
 *
 * HOW TO USE:
 *   1. Set env vars: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
 *   2. Optionally set TEST_EMAIL below for a dry run
 *   3. Run: node scripts/send-wilczy-past-participants-invite.js
 *
 * State is saved in scripts/.campaign-state.json (gitignored).
 */

import sgMail from "@sendgrid/mail";
import { convert } from "html-to-text";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// ─── CAMPAIGN CONFIG — edit before each campaign ─────────────────────────────

const CAMPAIGN_ID = "wilczy-past-participants-invite-may-2026";

const DELAY_BETWEEN_EMAILS_MS = 1000;

// Set to an email address to do a test run: sends only to that address,
// does NOT update campaign state.
const TEST_EMAIL = null;

// ─── Recipients (412 emails, already filtered against 2026 registrations) ───

const EMAILS = ["93kamil@gmail.com","a.checinska@o2.pl","a.detz@wp.pl","a.szplit@wp.pl","a.wyszynski@poczta.fm","adam.galman@gmail.com","adam.matynka@gmail.com","adam.nowak@tab2.pl","adam@warzecha.katowice.pl","adamos7703@gmail.com","adamskorupa41@gmail.com","adamsosna1987@gmail.com","adamt2350@gmail.com","adrian.jagiela@wp.pl","ag.hetmanczyk@gmail.com","aga-przybyla@wp.pl","agata.lyzinska1995@gmail.com","agatawisniewskapl@wp.pl","agatkaandrzej@interia.pl","agnieszkasiuda@gmail.com","agusia771123@gmail.com","aguslawa2017@gmail.com","alekbiskup@gmail.com","aleksandra.bozek@poczta.onet.pl","aleksandra.grzybowsky@gmail.com","aleksandra.wilkosz@gmail.com","aleksandra1705b@gmail.com","aleksandrakancel@interia.pl","alicja_janicka85@o2.pl","alicjagrabarczyk515@gmail.com","alienum@interia.pl","alszymura@tlen.pl","ancymonwieczorek@o2.pl","andriyfanman@ukr.net","andrzejg77@gmail.com","andrzejmm03@gmail.com","anna.gruchala@yahoo.com","anna.medondzida@gmail.com","antoninaskowronska.ts@gmail.com","anucha81@interia.pl","apiechowiczkurowska@gmail.com","arek_sub@yahoo.co.uk","arekciesla@wp.pl","arltmarta@gmail.com","artem.lofickiy@gmail.com","artur.kupczak6@gmail.com","arturbujnowski@gmail.com","arturciechowski@interia.pl","arturhor@interia.pl","asi28@tlen.pl","asia_fojcik@wp.pl","asia9215@gmail.com","babczynskao@gmail.com","bakero9216@gmail.com","barsoom2022@gmail.com","bart992@interia.pl","bartek.dziubla@gmail.com","bartek@maximus.pl","bartosz.sliwka95@gmail.com","basiaastral01@gmail.com","basiuratomasz@gmail.com","bialek@op.pl","biuro.katowice@soft-pont.pl","bjaszczuk@o2.pl","bo.m@poczta.fm","bosii@interia.pl","breakingtherules44@gmail.com","buki91@o2.pl","bula2666@wp.pl","ciezak.kasia@gmail.com","ciuk@mac.com","criswallo66@gmail.com","czawaras@gmail.com","czerwa2@wp.pl","czos@autograf.pl","d.nakonieczny@gmail.com","d.wilczewski@poczta.fm","dabkowski92@gmail.com","dam.baranski@gmail.com","damian-kasperczyk@wp.pl","damian.d@op.pl","damian.marat2@gmail.com","damianklobuch@onet.pl","damianwojtyla@wp.pl","damiianmroz@o2.pl","damkle77@gmail.com","daniel.kuklewicz@gmail.com","danielbelica@gmail.com","danka.hdk@op.pl","dari3@wp.pl","dawid.matysik@onet.pl","dawidek57.dbu@gmail.com","dawidwilczek@op.pl","dawidwilczek97@gmail.com","deutoriam@gmail.com","diabdogs@gmail.com","dnakonieczny@proton.me","doda_bmw91@wp.pl","dominus7@wp.pl","dorabianiekluczypetrykowski@onet.pl","dorcia122@onet.pl","dorota2402@onet.eu","dr.emil.sulek@gmail.com","dudzinski.p@dom100.eu","echrobo@gmail.com","edytakurczok.ek@gmail.com","estewui@gmail.com","ewaewalska@wp.pl","ewazbien@interia.pl","ewelinamaj588@gmail.com","fajach1987@gmail.com","fcdarek@wp.pl","figo222@poczta.onet.pl","fisz92@gmail.com","furetti1@gmail.com","gaba2009@wp.pl","gaza37@vp.pl","gizelamajewska@onet.com.pl","goczalik@onet.pl","godmag@interia.pl","goreckiwoj@gmail.com","gptomaszek@gmail.com","gpysz@dgtrade.eu","grku@vp.pl","gryf1966@o2.pl","grzegorz.sztechmiler@gmail.com","grzegorzchetnicki@wp.pl","grzegorzchra@gmail.com","grzegorzwisla@gmail.com","gurinaroza@gmail.com","hanp1983@o2.pl","hetmanczyk.anna@gmail.com","holaola@o2.pl","i.kasper@vp.pl","iwona.czapczynska@gmail.com","iwona.kamczyk@op.pl","iwonaa.cwik@gmail.com","j.klosowska@icloud.com","jac.gramatyka@gmail.com","jac.iwanicki@gmail.com","jacek-nowakowski1@wp.pl","jacek.reclik@gmail.com","jacekdziekanowski@interia.eu","jacekrozek@gmail.com","jagoda1707@gmail.com","jakubiec.t@gmail.com","janusz@neologistics.eu","jaras8@gmail.com","jarek@gjz-bud.pl","jarek@miszczak.eu","jaroslaw.landek@gmail.com","jarugapaulina17@gmail.com","jficinski@gmail.com","jmaciejko1@yahoo.co.uk","jochen@poczta.fm","jolanta.cieszynska@gmail.com","jostaw1@tlen.pl","jtokarz83@interia.pl","juliaczosnyka1@gmail.com","just.sadowska@gmail.com","justyna-tyczynska@wp.pl","justynapis27@onet.pl","k.quba12@gmail.com","k.zawieja@o2.pl","kabatbk@gmail.com","kacper.bednarz97@gmail.com","kacperdorawa@icloud.com","kafcioll@poczta.fm","kaguz27@gmail.com","kamil.gron@interia.pl","kamil.losza@gmail.com","kamilapiniecka.p98@gmail.com","kanuselzbieta@gmail.com","karmark@wp.pl","karol.turlo@gmail.com","karszewczyk85@wp.pl","karter@hot.pl","kasiamaciek@gazeta.pl","kasiatekien@poczta.fm","kasiuxm@gmail.com","kaska193@onet.eu","kastoll@interia.pl","katarzyna_piatkowska@o2.pl","katarzyna.brzozowska10@gmail.com","katarzyna.kluczniok@wp.pl","katarzyna.koplin@gmail.com","kewinstajer@gmail.com","kinga.dansczyk@o2.pl","kirkolm@gmail.com","kkromka@interia.pl","kksiezyc@icloud.com","klaudiusz.piekielnik@gmail.com","kmikolajczyk1988@gmail.com","kmiszczuk.fizjo@gmail.com","knurowski.p@gmail.com","kociolksg@gazeta.pl","koczurj@gmail.com","kondzio1982@gmail.com","kopuwa@gmail.com","kosiar9700@o2.pl","kozielmaxk0777@gmail.com","krasos9@gmail.com","krisamba@wp.pl","krizz82@o2.pl","kropek50@interia.pl","krznow@adres.pl","krzysztof.glombik@o2.pl","krzysztof.keller99@onet.pl","krzysztof.scipien@gmail.com","krzysztof123ciszewski@gmail.com","krzysztofszymik@gmail.com","kuba.malisz@gmail.com","kubaseba1820@wp.pl","kwalasbytom@gmail.com","latrell@interia.pl","lek.vet.86@gmail.com","leszek.kudlinski@op.pl","lidocja@gmail.com","lincia62@wp.pl","lmatenczuk@gmail.com","ltoczydlowski@gmail.com","ludwigania@gmail.com","lukasz.brachmanski@gmail.com","lukasz.j.kasprzyk@gmail.com","lukasz.kaszuba@gmail.com","lukaszbogus@o2.pl","lukaszdziano@gmail.com","lukaszekkosala@interia.pl","lukon39@gmail.com","lukryb1983@wp.pl","lupiezowiec@op.pl","m.zawadzki@onet.pl","ma_dzia.wilim@wp.pl","maaarta85@tlen.pl","maciej.zuberek40@gmail.com","macionczykjulita@gmail.com","magdalenabiadacz0625@gmail.com","magjerra@gmail.com","majcher109@gmail.com","majerm@poczta.onet.pl","majki197431@gmail.com","major.meble@wp.pl","malek.marcin@outlook.com","malkinia@vp.pl","marcin.pawel.przygoda@gmail.com","marcingewerbe@gmail.com","marcintomaszek1@gmail.com","marek.baranek@onet.eu","marek.watola@gmail.com","marek411@onet.eu","marekcu@op.pl","marekpod1968@interia.pl","maricasklep@gmail.com","mariola.dylong@gmail.com","mariozab7@gmail.com","mariusz.mani@gmail.com","mariuszbochenski@o2.pl","martinbaron92@gmail.com","martinbednarek92@gmail.com","martintri@o2.pl","marzanna71@gmail.com","marzec.kasia@gmail.com","marzena.przybyla@onet.eu","marzena.szablowska@gmail.com","masarczyk.szymon@gmail.com","mateusz.data5@gmail.com","mateuszbulinski@gmail.com","mathy1987s@gmail.com","mati6095@gmail.com","matt.pierzyna@gmail.com","mbanaszczyk@o2.pl","mburli@op.pl","mez.rom@interia.pl","mflak9@gmail.com","mholeczek@gmail.com","michal.kandziora@wp.pl","michal.piszer@gmail.com","michalwidera@o2.pl","michalwrobbel@gmail.com","michutab94@gmail.com","mig.mikolaj@gmail.com","miroslaw.rajtar@gmail.com","mirpyt-86@wp.pl","miss_mg@op.pl","mocpatt@gmail.com","mocrom@o2.pl","mokryyy@gmail.com","monika.cywinska89@gmail.com","monika.gugala2@gmail.com","mpawleta@poczta.onet.pl","mrura@wp.pl","mtomaszewska151@gmail.com","natalia.kopitza@wp.pl","nikolanwitek@gmail.com","norbi1977@poczta.onet.pl","nowakowski98@gmail.com","ola.slominska@interia.pl","olekwalla4@gmail.com","oliwiarzytki@gmail.com","p.czapczynski@web.de","p.mazur100@gmail.com","p.popczyk15@gmail.com","palarz.mateusz@gmail.com","pander.izabela@gmail.com","pantus@op.pl","papieros1997@gmail.com","patrycjapozorska@autograf.pl","patryk8666@interia.pl","patula1988@gmail.com","pawel_gepfert@o2.pl","pawel_rother@o2.pl","pawel.kosiec@gmail.com","pawelprzeliorz@gmail.com","pawmar40@gmail.com","pawsa0@gmail.com","peplinskijakub@gmail.com","piatekjulia@o2.pl","piczu91@hotmail.com","pietyszukd@gmail.com","piotr.bik.poczta@gmail.com","piotr.magda@poczta.onet.pl","piotrekfortuna@gmail.com","piotrraczka@o2.pl","pkokot1703@gmail.com","przemekomyla@onet.pl","przemo.sa@gmail.com","przemyslaw.piatek86@gmail.com","przyludzki@wp.pl","psiwinski@gmail.com","r4q88pl@gmail.com","radoslaw.sobczak@onet.pl","radoslawsportman@gmail.com","rafal_tomczak@poczta.fm","rafal-nisar@t-online.de","rja.sikora@gmail.com","rlat987@gmail.com","robertgemulla1998@gmail.com","robertsto77@gmail.com","robsones@onet.eu","roch.czech@gmail.com","roksanaorzel@gmail.com","roman.odoszewski@gmail.com","roman12pl@onet.eu","roozii2119@gmail.com","ruslanek998@gmail.com","rutkowski.maciek@yahoo.pl","rybarzjanusz@wp.pl","s.ciasto85@gmail.com","s.gdowski@yahoo.com","safilo@tlen.pl","sajan_ussj@wp.pl","sandrapustelnik94@onet.pl","schabu77@wp.pl","sebastian.ziemkowski@o2.pl","sebastian123wilk@gmail.com","shazza1938@gmail.com","sit2@interia.pl","sjelulv33@gmail.com","skarpecia@poczta.onet.pl","sliwka73@tlen.pl","slominska.m83@gmail.com","smolinski-wojciech@o2.pl","sonia.rogoz@op.pl","sprzedaz-optima@o2.pl","stakaw264@gmail.com","stefan.wnorowski780@wp.pl","stg1mieszkanie@gmail.com","stno18@o2.pl","stodolakmaciek@gmail.com","sukces832@gmail.com","suszczykmonika@gmail.com","sylwesters1969@wp.pl","symelka@o2.pl","szpakup@gmail.com","szybkibyk@poczta.onet.pl","szymon.apacki@gmail.com","szymon.lewandowski@imir.bytom.pl","tadek.kozielski@interia.pl","tali93@o2.pl","teywor@gmail.com","tomasz.skulski@lila-logistik.com","tomasz.wisniewski.gm@gmail.com","tomaszgrabowski-86@o2.pl","tomaszprzybylski1980@poczta.fm","tomaszwajs87@gmail.com","tomekstobiecki@gmail.com","topsi@vp.pl","tprzezdzing@wp.pl","treskapiotr86@gmail.com","turczynowiczartur@gmail.com","ulappt@wp.pl","veno.marciniak@gmail.com","w.wojcierowska@gmail.com","walach@tlen.pl","waldekpietrzak83@gmail.com","wasky80@wp.pl","wesmac@wp.pl","wiktoriamachulak2@gmail.com","wjera@tlen.pl","wojciechszymura@onet.pl","wojtek444s@o2.pl","ximenek@gmail.com","zacharczuk@op.pl","zbigniewkrupa@wp.pl","zhangshuangbao249@gmail.com","zibi-1906@wp.pl","ziele1969@o2.pl","zimadots@gmail.com","zjun9488@gmail.com","zoeivohunter@gmail.com","zofia.esparza@gmail.com","zoficja@gmail.com"];

// ─── Email content ────────────────────────────────────────────────────────────

function buildSubject() {
  return "Wilczy Półmaraton wraca! Tylko 10 dni na wpisowe 100 zł";
}

function buildHtml() {
  const eventUrl = "https://zatyrani.pl/wilczy-polmaraton/";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a5c2e;">Hej!</h2>

      <p style="color: #374151; font-size: 16px;">Dostajesz tę wiadomość, bo brałaś/eś udział w którejś z poprzednich edycji <strong>Wilczego Półmaratonu</strong>. Pomyśleliśmy, że może masz ochotę wpaść do nas znowu.</p>

      <p style="color: #374151; font-size: 16px;"><strong>17 października 2026</strong> w Wilczy ruszamy z <strong>IV edycją</strong> — i mamy do Ciebie jedną prośbę: nie zwlekaj z decyzją.</p>

      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #991b1b; font-size: 16px; font-weight: bold;">⏰ Tylko 10 dni — wpisowe 100 zł</p>
        <p style="margin: 8px 0 0 0; color: #7f1d1d; font-size: 15px;">Od <strong>1 czerwca</strong> wpisowe na bieg 21km i canicross wzrasta do <strong>130 zł</strong>. NW pozostaje 100 zł.</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${eventUrl}" style="background-color: #1a5c2e; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Zapisz się na IV Wilczy Półmaraton →</a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

      <h3 style="color: #1a5c2e;">Czeka na Ciebie to, za co pokochałaś/eś Wilczy Półmaraton</h3>

      <p style="color: #374151; font-size: 16px;">Trasa wiedzie pięknymi leśnymi ścieżkami uroczyska <strong>„Głębokie Doły"</strong> — pamiątki po prastarej puszczy Nadleśnictwa Rybnik z niepowtarzalnym mikroklimatem i bogatą florą. Drugiego takiego półmaratonu na Śląsku nie znajdziesz.</p>

      <ul style="color: #374151; padding-left: 20px; font-size: 16px; line-height: 2;">
        <li>🌲 Kawałek prawdziwego lasu, prastara puszcza Nadleśnictwa Rybnik</li>
        <li>💪 Adrenalina i dziki kros przez leśne ścieżki</li>
        <li>😅 Klasyczne błoto w „magicznym miejscu" na trasie</li>
        <li>🏅 Pamiątkowy medal dla każdego uczestnika</li>
        <li>👕 Możliwość zakupu pamiątkowej koszulki</li>
      </ul>

      <div style="background-color: #f0fdf4; border-left: 4px solid #1a5c2e; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #14532d; font-size: 16px; font-weight: bold;">⚡ Nowość — dla Was się rozwijamy!</p>
        <p style="margin: 8px 0 0 0; color: #166534; font-size: 15px;">W tym roku po raz pierwszy na trasie zlokalizowana będzie <strong>lotna premia</strong> — dodatkowa walka, dodatkowe emocje.</p>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

      <p style="color: #6b7280; font-size: 14px; font-style: italic;">To jest jednorazowe zaproszenie — nie będziemy do Ciebie więcej pisać w tej sprawie. Jeśli nie wracasz, nie ma sprawy. Jeśli wracasz — do zobaczenia w lesie!</p>

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

async function sendEmail(email) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SENDGRID_API_KEY not set");

  sgMail.setApiKey(key);

  const html = buildHtml();
  await sgMail.send({
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "biuro@zatyrani.pl",
    subject: buildSubject(),
    html,
    text: convert(html, htmlToTextOptions),
  });
}

async function run() {
  const emails = [...new Set(EMAILS.map((e) => e.trim().toLowerCase()))];
  console.log(`[campaign] ${emails.length} recipient(s) inlined.`);

  if (TEST_EMAIL) {
    console.log(
      `[campaign] TEST MODE — sending only to ${TEST_EMAIL}. State will not be updated.`
    );
    try {
      await sendEmail(TEST_EMAIL);
      console.log(`  ✓ ${TEST_EMAIL}`);
    } catch (err) {
      console.error(`  ✗ ${TEST_EMAIL}: ${err.message}`);
    }
    return;
  }

  const state = loadState();
  const alreadySent = new Set(state.sent.map((s) => s.email));
  const pending = emails.filter((e) => !alreadySent.has(e));

  console.log(
    `[campaign] "${CAMPAIGN_ID}" — total: ${emails.length}, already sent: ${alreadySent.size}, pending: ${pending.length}`
  );

  if (pending.length === 0) {
    console.log("[campaign] Everyone has received this campaign. Done.");
    return;
  }

  console.log(`[campaign] Sending to ${pending.length} recipient(s)...`);

  let sent = 0;
  let failed = 0;

  for (const email of pending) {
    try {
      await sendEmail(email);
      state.sent.push({
        email,
        sent_at: new Date().toISOString(),
      });
      saveState(state);
      console.log(`  ✓ ${email}`);
      sent++;

      if (DELAY_BETWEEN_EMAILS_MS && sent < pending.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_EMAILS_MS)
        );
      }
    } catch (err) {
      console.error(`  ✗ ${email}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n[campaign] Done — sent: ${sent}, failed: ${failed}`);
}

await run();
