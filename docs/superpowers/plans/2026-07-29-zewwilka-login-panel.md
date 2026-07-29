# Zew Wilka Login Flow + View-Only Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registered zewwilka users who re-enter their email get a login code instead of the "Ten e-mail jest już zapisany" dead end, and land in a new view-only panel at `/wilczy-polmaraton/zewwilka/panel` showing their participants.

**Architecture:** Frontend-only (approach A from the spec at `docs/superpowers/specs/2026-07-29-zewwilka-login-panel-design.md`). All API endpoints (`auth/request-code`, `auth/verify-code`, `auth/logout`, `dashboard`, `prefill`) already exist under `/api/events/zewwilka-2026/` and are NOT modified. Two frontend pieces: a new self-contained panel component + page, and flow changes in the existing registration component.

**Tech Stack:** Astro static pages with vanilla-JS inline `<script>` tags, Tailwind CSS (emerald palette), Vercel serverless API (untouched).

## Global Constraints

- **Do not touch anything under `api/`** — zero backend changes.
- **Do not touch any file under `src/components/wilczypolmaraton/` or any wilczy page** except none — only zewwilka files listed in tasks.
- All new UI copy is **Polish, hardcoded** (no i18n) — this is the established zewwilka convention (see `src/components/zewwilka/ZewWilkaRegistrationContent.astro`).
- Panel URL is exactly `/wilczy-polmaraton/zewwilka/panel`.
- API base is exactly `/api/events/zewwilka-2026`.
- Registration deadline string is `2026-08-05` (must match `registrationDeadline` in `api/events/config.js`).
- **Testing note:** this repo's vitest suite (`npm test`) covers API helpers only; there is no harness for Astro inline scripts, so these tasks are verified with `npm test` (existing suite stays green), `npx eslint .`, `npm run build`, and a manual checklist in Task 3. Do not invent a jsdom harness.

---

### Task 1: Panel page (`/wilczy-polmaraton/zewwilka/panel`)

**Files:**
- Create: `src/components/zewwilka/ZewWilkaPanelContent.astro`
- Create: `src/pages/wilczy-polmaraton/zewwilka/panel.astro`

**Interfaces:**
- Consumes: `GET /api/events/zewwilka-2026/dashboard` (returns `{success, registration: {id, email, fullName, createdAt}, participants: [{firstName, lastName, city, club, raceCategory, hideNamePublic, ...}], payment: null, ...}`; 401/403 when no session), `POST .../auth/request-code` (`{email}` → 200 always for unknown emails, 429 `{error: "RATE_LIMIT"}`), `POST .../auth/verify-code` (`{email, code}` → sets `zewwilka_2026_session` cookie; 400 `{error: "INVALID_CODE"}`), `POST .../auth/logout` (clears cookies).
- Produces: the page `/wilczy-polmaraton/zewwilka/panel` that Task 2 redirects to. Nothing else depends on this component's internals.

- [ ] **Step 1: Create the panel component**

Write `src/components/zewwilka/ZewWilkaPanelContent.astro` with exactly this content:

```astro
---
// Nocny Zew Wilka 2026 — view-only panel. Shows the participants registered
// under the logged-in email. Has its own email+code login so it still works
// between the registration deadline (5 Aug) and the event (7 Aug), when the
// registration page only shows "Zapisy zamknięte".
const registrationDeadline = "2026-08-05";
---

<div
  class="mx-auto max-w-3xl px-6 py-12"
  data-api-base="/api/events/zewwilka-2026"
  data-deadline={registrationDeadline}
>
  <!-- Loading -->
  <div id="loading" class="py-16 text-center text-slate-600">Ładowanie…</div>

  <!-- Login, step 1: email -->
  <div id="loginEmail" class="hidden space-y-6">
    <div class="text-center">
      <h2 class="text-3xl font-bold text-slate-900">Twoje zgłoszenie</h2>
      <p class="mt-2 text-slate-600">Podaj e-mail użyty przy zapisie, a wyślemy Ci kod logowania.</p>
    </div>
    <div class="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <form id="loginEmailForm" class="space-y-4">
        <div>
          <label for="loginEmailInput" class="block text-sm font-semibold text-slate-700">E-mail <span class="text-red-600">*</span></label>
          <input type="email" id="loginEmailInput" required placeholder="twoj@email.pl"
            class="mt-1 block w-full rounded-lg border-emerald-300 border-2 px-3 py-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500" />
        </div>
        <div id="loginEmailError" class="hidden rounded-lg bg-red-50 p-3 text-sm text-red-700"></div>
        <button type="submit"
          class="w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700">
          Wyślij kod
        </button>
        <p class="text-center text-sm text-slate-600">
          Nie masz jeszcze zgłoszenia?
          <a href="/wilczy-polmaraton/zewwilka/rejestracja" class="font-semibold text-emerald-600 hover:underline">Zapisz się</a>
        </p>
      </form>
    </div>
  </div>

  <!-- Login, step 2: code -->
  <div id="loginCode" class="hidden space-y-6">
    <div class="text-center">
      <h2 class="text-3xl font-bold text-slate-900">Wpisz kod</h2>
      <p class="mt-2 text-slate-600">Wysłaliśmy 6-cyfrowy kod na Twój e-mail.</p>
    </div>
    <div class="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <form id="loginCodeForm" class="space-y-4">
        <input type="text" id="loginCodeInput" required maxlength="6" pattern="[0-9]{6}" placeholder="000000"
          class="block w-full rounded-lg border-2 border-emerald-300 px-3 py-2 text-center text-2xl font-bold tracking-widest shadow-sm focus:border-emerald-500 focus:ring-emerald-500" />
        <div class="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">Sprawdź folder spam, jeśli wiadomość nie dotarła.</div>
        <div id="loginCodeError" class="hidden rounded-lg bg-red-50 p-3 text-sm text-red-700"></div>
        <button type="submit" id="loginCodeSubmitBtn" disabled
          class="w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          Zweryfikuj
        </button>
        <button type="button" id="loginBackBtn"
          class="w-full rounded-lg border-2 border-emerald-300 bg-white px-6 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">← Zmień e-mail</button>
      </form>
    </div>
  </div>

  <!-- Panel -->
  <div id="panel" class="hidden space-y-6">
    <div class="text-center">
      <h2 id="panelGreeting" class="text-3xl font-bold text-slate-900">Twoje zgłoszenie</h2>
      <p class="mt-2 text-slate-600">Nocny Zew Wilka — 7 sierpnia 2026 o 20:00, Azyl Zatyranych (Rybnik-Ochojec).</p>
      <p class="mt-1 text-sm font-semibold text-emerald-700">Udział jest bezpłatny.</p>
    </div>
    <div id="panelParticipants" class="space-y-4"></div>
    <div class="flex flex-col items-center gap-2 pt-4">
      <a href="/wilczy-polmaraton/zewwilka/lista" class="font-semibold text-emerald-700 hover:underline">Zobacz listę zapisanych →</a>
      <a href="/wilczy-polmaraton/zewwilka" class="text-sm text-emerald-600 hover:underline">← Wróć do strony wydarzenia</a>
      <button type="button" id="logoutBtn" class="mt-4 text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline">Wyloguj się</button>
    </div>
  </div>

  <!-- Logged in, but no participants yet -->
  <div id="empty" class="hidden py-16 text-center">
    <h2 class="text-2xl font-bold text-slate-900">Nie masz jeszcze zapisanych uczestników</h2>
    <p id="emptyOpen" class="mt-2 hidden text-slate-600">Dokończ zapisy, aby pojawić się na liście startowej.</p>
    <p id="emptyClosed" class="mt-2 hidden text-slate-600">Zapisy na Nocny Zew Wilka zostały zakończone 5 sierpnia 2026.</p>
    <a id="emptyRegisterBtn" href="/wilczy-polmaraton/zewwilka/rejestracja"
      class="mt-6 hidden inline-block rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700">Dokończ zapisy</a>
    <div class="mt-6 flex flex-col items-center gap-2">
      <a href="/wilczy-polmaraton/zewwilka" class="text-sm text-emerald-600 hover:underline">← Wróć do strony wydarzenia</a>
      <button type="button" id="emptyLogoutBtn" class="text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline">Wyloguj się</button>
    </div>
  </div>
</div>

<script>
  const root = document.querySelector("[data-api-base]");
  const API_BASE = root.getAttribute("data-api-base");
  const DEADLINE = root.getAttribute("data-deadline");

  const CATEGORY_LABELS = {
    "10km": "Bieg 10 km",
    "10km_nw": "Nordic Walking 10 km",
    "10km_canicross": "Canicross 10 km",
  };

  const sections = {
    loading: document.getElementById("loading"),
    loginEmail: document.getElementById("loginEmail"),
    loginCode: document.getElementById("loginCode"),
    panel: document.getElementById("panel"),
    empty: document.getElementById("empty"),
  };

  function show(name) {
    Object.values(sections).forEach((s) => s.classList.add("hidden"));
    sections[name].classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function isClosed() {
    const end = new Date(DEADLINE);
    end.setHours(23, 59, 59, 999);
    return new Date() > end;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  let currentEmail = "";

  // ─── Panel rendering ─────────────────────────────────────────────────
  function participantCard(p) {
    const details = [p.city, p.club].filter(Boolean).map(esc).join(" · ");
    return `
    <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold text-slate-900">${esc(p.firstName)} ${esc(p.lastName)}</h3>
          ${details ? `<p class="mt-1 text-sm text-slate-600">${details}</p>` : ""}
        </div>
        <span class="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">${esc(CATEGORY_LABELS[p.raceCategory] || p.raceCategory)}</span>
      </div>
      ${p.hideNamePublic ? `<p class="mt-3 text-xs text-slate-500">Nazwisko ukryte na publicznej liście uczestników</p>` : ""}
    </div>`;
  }

  function renderPanel(data) {
    const name = (data.registration?.fullName || "").split(" ")[0];
    document.getElementById("panelGreeting").textContent = name ? `Cześć ${name}!` : "Twoje zgłoszenie";
    document.getElementById("panelParticipants").innerHTML = data.participants.map(participantCard).join("");
    show("panel");
  }

  function renderEmpty() {
    const closed = isClosed();
    document.getElementById("emptyOpen").classList.toggle("hidden", closed);
    document.getElementById("emptyClosed").classList.toggle("hidden", !closed);
    document.getElementById("emptyRegisterBtn").classList.toggle("hidden", closed);
    show("empty");
  }

  async function fetchDashboard() {
    try {
      const res = await fetch(`${API_BASE}/dashboard`, { credentials: "same-origin" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data : null;
    } catch {
      return null;
    }
  }

  async function init() {
    const dash = await fetchDashboard();
    if (!dash) { show("loginEmail"); return; }
    if (dash.participants && dash.participants.length > 0) renderPanel(dash);
    else renderEmpty();
  }

  // ─── Login ───────────────────────────────────────────────────────────
  const loginEmailForm = document.getElementById("loginEmailForm");
  const loginEmailInput = document.getElementById("loginEmailInput");
  const loginEmailError = document.getElementById("loginEmailError");

  loginEmailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginEmailError.classList.add("hidden");
    currentEmail = loginEmailInput.value.trim();
    try {
      const res = await fetch(`${API_BASE}/auth/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        loginEmailError.textContent = data.error === "RATE_LIMIT"
          ? "Zbyt wiele prób. Spróbuj ponownie za godzinę."
          : "Wystąpił błąd. Spróbuj ponownie.";
        loginEmailError.classList.remove("hidden");
        return;
      }
      show("loginCode");
    } catch {
      loginEmailError.textContent = "Błąd połączenia. Spróbuj ponownie.";
      loginEmailError.classList.remove("hidden");
    }
  });

  const loginCodeForm = document.getElementById("loginCodeForm");
  const loginCodeInput = document.getElementById("loginCodeInput");
  const loginCodeSubmitBtn = document.getElementById("loginCodeSubmitBtn");
  const loginCodeError = document.getElementById("loginCodeError");

  loginCodeInput.addEventListener("input", () => {
    loginCodeSubmitBtn.disabled = !/^\d{6}$/.test(loginCodeInput.value.trim());
  });
  document.getElementById("loginBackBtn").addEventListener("click", () => show("loginEmail"));

  loginCodeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginCodeError.classList.add("hidden");
    try {
      const res = await fetch(`${API_BASE}/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: currentEmail, code: loginCodeInput.value.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        loginCodeError.textContent = data.error === "INVALID_CODE" ? "Nieprawidłowy lub nieaktualny kod." : "Wystąpił błąd. Spróbuj ponownie.";
        loginCodeError.classList.remove("hidden");
        return;
      }
      show("loading");
      init();
    } catch {
      loginCodeError.textContent = "Błąd połączenia. Spróbuj ponownie.";
      loginCodeError.classList.remove("hidden");
    }
  });

  // ─── Logout ──────────────────────────────────────────────────────────
  async function logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "same-origin" });
    } catch { /* clearing cookies is best-effort; redirect regardless */ }
    window.location.href = "/wilczy-polmaraton/zewwilka";
  }
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("emptyLogoutBtn").addEventListener("click", logout);

  init();
</script>
```

- [ ] **Step 2: Create the page wrapper**

Write `src/pages/wilczy-polmaraton/zewwilka/panel.astro` with exactly this content (mirrors `lista.astro`):

```astro
---
import Layout from "../../../layouts/Layout.astro";
import WilczyPolmaratonHeader from "../../../components/wilczypolmaraton/WilczyPolmaratonHeader.astro";
import ZewWilkaPanelContent from "../../../components/zewwilka/ZewWilkaPanelContent.astro";
import { t } from "../../../utils/i18n";
---

<Layout
  title="Nocny Zew Wilka - Twoje zgłoszenie"
  description="Panel uczestnika Nocnego Zewu Wilka — darmowy bieg nocny, 7 sierpnia 2026, Rybnik-Ochojec."
  ogImage="/zewwilka_og.jpg"
  t={t}
>
  <WilczyPolmaratonHeader t={t} backHref="/wilczy-polmaraton/zewwilka" backLabel="Wróć do wydarzenia" />
  <ZewWilkaPanelContent />
</Layout>
```

- [ ] **Step 3: Verify — lint, tests, build**

Run: `npx eslint . && npm test && npm run build`
Expected: eslint clean, all existing vitest tests PASS, astro build succeeds and the build output lists the `/wilczy-polmaraton/zewwilka/panel` route.

- [ ] **Step 4: Commit**

```bash
git add src/components/zewwilka/ZewWilkaPanelContent.astro src/pages/wilczy-polmaraton/zewwilka/panel.astro
git commit -m "feat(zewwilka): add view-only participant panel with inline login"
```

---

### Task 2: Registration page — login fallback, panel redirects, success link

**Files:**
- Modify: `src/components/zewwilka/ZewWilkaRegistrationContent.astro`

**Interfaces:**
- Consumes: the panel page `/wilczy-polmaraton/zewwilka/panel` from Task 1; existing endpoints `GET /dashboard`, `POST /auth/request-code` (both under `/api/events/zewwilka-2026`).
- Produces: nothing new for other tasks.

All edits below are in `src/components/zewwilka/ZewWilkaRegistrationContent.astro`. Line numbers refer to the file as of commit `035fcf9`; match on content, not line numbers.

- [ ] **Step 1: Add the login-notice banner to the code step (HTML)**

In the `<!-- State C, step 2: code -->` section, directly after the line
`<form id="codeForm" class="space-y-4">`, insert:

```html
        <div id="codeLoginNotice" class="hidden rounded-lg bg-blue-50 p-3 text-sm text-blue-700">Ten adres jest już zapisany — wysłaliśmy kod, aby zobaczyć swoje zgłoszenie.</div>
```

- [ ] **Step 2: Add the panel link to the success screen (HTML)**

In the `<!-- Success -->` section, directly after the line
`<div class="mt-6 flex flex-col items-center gap-2">`, insert (as the first link, above the lista link):

```html
        <a href="/wilczy-polmaraton/zewwilka/panel" class="font-semibold text-emerald-700 hover:underline">Zobacz swoje zgłoszenie →</a>
```

- [ ] **Step 3: Add PANEL_URL constant and fetchDashboard helper (script)**

In the `<script>` block, directly after the line
`const MIN_AGE = parseInt(root.getAttribute("data-min-age"), 10);`, insert:

```js
  const PANEL_URL = "/wilczy-polmaraton/zewwilka/panel";

  // Returns dashboard data when a valid zewwilka session exists, else null.
  async function fetchDashboard() {
    try {
      const res = await fetch(`${API_BASE}/dashboard`, { credentials: "same-origin" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data : null;
    } catch {
      return null;
    }
  }
```

- [ ] **Step 4: EMAIL_EXISTS → send a login code instead of erroring (script)**

In the `emailForm` submit handler, two changes.

First, at the top of the handler, right after `emailError.classList.add("hidden");`, insert:

```js
    document.getElementById("codeLoginNotice").classList.add("hidden");
```

Second, inside the `if (!res.ok) {` block, replace:

```js
        emailError.textContent =
          data.error === "EMAIL_EXISTS" ? "Ten e-mail jest już zapisany na Nocny Zew Wilka."
          : data.error === "REGISTRATION_CLOSED" ? "Zapisy zostały zamknięte."
```

with:

```js
        if (data.error === "EMAIL_EXISTS") {
          // Already registered — switch to login: send a code and reuse the code step.
          const rc = await fetch(`${API_BASE}/auth/request-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: currentEmail }),
          });
          if (rc.ok) {
            document.getElementById("codeLoginNotice").classList.remove("hidden");
            show("codeStep");
          } else {
            const rcData = await rc.json().catch(() => ({}));
            emailError.textContent = rcData.error === "RATE_LIMIT"
              ? "Zbyt wiele prób. Spróbuj ponownie za godzinę."
              : "Wystąpił błąd. Spróbuj ponownie.";
            emailError.classList.remove("hidden");
          }
          return;
        }
        emailError.textContent =
          data.error === "REGISTRATION_CLOSED" ? "Zapisy zostały zamknięte."
```

(The rest of the ternary chain — `EVENT_FULL`, `EMAIL_INVALID`, fallback — stays unchanged.)

- [ ] **Step 5: After verify-code, route to panel when participants exist (script)**

In the `codeForm` submit handler, directly after the closing `}` of the
`if (!res.ok) { ... return; }` block and before the comment
`// Verified — fetch prefill (recognised wilczypolmaraton participants) if any.`, insert:

```js
      // Logged in — an existing signup goes to the panel instead of the form.
      const dash = await fetchDashboard();
      if (dash && dash.participants.length > 0) {
        window.location.href = PANEL_URL;
        return;
      }
```

- [ ] **Step 6: Rework init() — own session first, then closed, then from-source (script)**

Replace the entire `init()` function (from `async function init() {` through its closing `}`) with:

```js
  async function init() {
    // Already logged in to zewwilka? A completed signup goes straight to the
    // panel — also prevents registering the same people twice.
    const dash = await fetchDashboard();
    if (dash && dash.participants.length > 0) {
      window.location.href = PANEL_URL;
      return;
    }

    if (isClosed()) { show("closed"); return; }

    if (dash) {
      // Session but no participants yet (abandoned flow) — resume at the form.
      let prefill = { participants: [], recognized: false };
      try {
        const pf = await fetch(`${API_BASE}/prefill`, { credentials: "same-origin" });
        if (pf.ok) prefill = await pf.json();
      } catch { /* prefill is best-effort */ }
      const intro = prefill.recognized
        ? "Rozpoznaliśmy Cię z Wilczego Półmaratonu — sprawdź dane i wybierz dystans. Odznacz osoby, które nie biorą udziału."
        : "Uzupełnij dane uczestnika i wybierz dystans.";
      renderParticipants(prefill.participants, intro);
      return;
    }

    // State B: already logged into the source event?
    try {
      const res = await fetch(`${API_BASE}/auth/from-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      if (res.ok) {
        const data = await res.json();
        // from-source minted a zewwilka session; an existing signup goes to the panel.
        const dash2 = await fetchDashboard();
        if (dash2 && dash2.participants.length > 0) {
          window.location.href = PANEL_URL;
          return;
        }
        const name = (data.contactPerson || "").split(" ")[0];
        renderParticipants(
          data.participants,
          `Cześć${name ? " " + name : ""}! Rozpoznaliśmy Cię z Wilczego Półmaratonu — sprawdź dane i wybierz dystans. Odznacz osoby, które nie biorą udziału.`
        );
        return;
      }
    } catch { /* fall through to email step */ }

    // State C: not logged in.
    show("emailStep");
    validateEmailForm();
  }
```

Also update the file's top frontmatter comment (the `// Resolves one of two entry states on load:` block) to mention the new panel routing, e.g.:

```js
// Resolves entry state on load:
//   A) own zewwilka session with participants -> redirected to the panel
//   B) logged into wilczypolmaraton           -> recognised, prefilled, no code
//   C) not logged in                          -> email + code, then prefilled (if known) or blank
//      (already-registered emails get a login code and land in the panel)
```

- [ ] **Step 7: Verify — lint, tests, build**

Run: `npx eslint . && npm test && npm run build`
Expected: eslint clean, all existing vitest tests PASS, astro build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/zewwilka/ZewWilkaRegistrationContent.astro
git commit -m "feat(zewwilka): login code for registered emails + panel routing on registration page"
```

---

### Task 3: End-to-end verification (manual, via vercel dev)

**Files:**
- None created or modified. This task validates Tasks 1–2 against the real API.

**Interfaces:**
- Consumes: everything from Tasks 1 and 2.
- Produces: a written pass/fail report per checklist item.

- [ ] **Step 1: Start the dev server**

Run: `vercel dev` (or `npm run dev:vercel`) from the repo root. The API routes under `/api/events/...` only work under vercel dev, not plain `astro dev`.

- [ ] **Step 2: Walk the checklist**

In a browser against the local server (use a test email like `derberg@wp.pl` — it's in `TEST_EMAILS` so it won't pollute the production list; locally `VERCEL_ENV` is `development` so it stays visible):

1. `/wilczy-polmaraton/zewwilka/panel` with no session → inline login appears; enter a registered email → code arrives → verify → participants shown, greeting uses first name, distance labels correct.
2. Panel → "Wyloguj się" → redirected to event page; revisiting panel shows login again.
3. `/wilczy-polmaraton/zewwilka/rejestracja` with no session, enter an **already registered** email → no error; code step appears with the blue "Ten adres jest już zapisany…" banner → verify → redirected to panel (registration has participants).
4. Registration page while holding a session with participants → immediate redirect to panel (no form flash beyond loading).
5. Empty-registration case: create a fresh registration (new email), abandon at the participants step, revisit registration page after verifying → participants step shown (resume works); panel for that session shows the "Nie masz jeszcze zapisanych uczestników" state with the "Dokończ zapisy" button.
6. Fresh full registration (new email) → success screen shows "Zobacz swoje zgłoszenie →" linking to the panel, which opens without re-login.
7. Wilczy Półmaraton regression: `/wilczy-polmaraton/rejestracja`, `/wilczy-polmaraton/zaloguj`, `/wilczy-polmaraton/panel` all behave as before (login, dashboard, participant list render).

- [ ] **Step 3: Report results**

Report each checklist item as pass/fail with notes. Any failure loops back to the owning task.
