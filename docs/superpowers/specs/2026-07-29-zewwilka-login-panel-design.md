# Zew Wilka: login flow + view-only panel

**Date:** 2026-07-29
**Status:** Approved

## Problem

Registering at `/wilczy-polmaraton/zewwilka/rejestracja` with an email that already
has a `zewwilka-2026` registration dead-ends with "Ten e-mail jest już zapisany na
Nocny Zew Wilka." There is no way for a registered person to see their signup:
zewwilka has no panel, the free-event confirmation email deliberately omits a panel
link, and `event_registrations` rows are created before participants exist (both by
`start-registration` and by `from-source`, which fires on mere page load for people
logged into the Wilczy Półmaraton panel), so a registration can exist with zero
participants and its owner cannot resume.

## Solution overview

Frontend-only (approach A — zero API changes). Three pieces:

1. **Registration page**: an already-registered email triggers a login code
   (existing `auth/request-code` endpoint) instead of an error; after verification
   the user lands either in the panel (has participants) or on the participants
   step (empty registration — resume signup).
2. **New view-only panel** at `/wilczy-polmaraton/zewwilka/panel` with its own
   inline email+code login for direct visits without a session.
3. **Success screen** links to the panel.

All endpoints used (`auth/request-code`, `auth/verify-code`, `auth/logout`,
`dashboard`, `prefill`, `clubs/search`, `register`) already exist under
`/api/events/zewwilka-2026/`. Wilczy Półmaraton files are not touched; cookies are
namespaced per event (`zewwilka_2026_*` vs `wilczypolmaraton_2026_*`).
`dashboard` is safe for free events: `repricePendingPayment` returns early when no
payment rows exist, so the panel receives `payment: null`.

## 1. Registration page changes

File: `src/components/zewwilka/ZewWilkaRegistrationContent.astro`

### init() — new resolution order

1. **Own session first**: `GET {API_BASE}/dashboard` with `credentials:
   "same-origin"`. On 200:
   - `participants.length > 0` → `window.location.href =
     "/wilczy-polmaraton/zewwilka/panel"` (prevents double-registering the same
     people).
   - `participants.length === 0` → fetch `/prefill` (best-effort) and show the
     participants step, prefilled if recognised.
2. **Closed check** (existing): past deadline → "Zapisy zamknięte" screen.
   Run after the session check so a session holder with participants still reaches
   the panel redirect; a session holder with an empty registration past the
   deadline sees the closed screen (registration is closed — nothing to resume).
   Note: `register.js` enforces the deadline server-side regardless.
3. **from-source** (existing): recognised wilczy user. After a 200, call
   `GET /dashboard` (the from-source response set the session cookie):
   - target registration has participants → redirect to panel;
   - empty → participants step prefilled from the from-source response
     (existing behaviour).
4. **Email step** (existing fallback).

### EMAIL_EXISTS path

In the `start-registration` error handling: when `data.error === "EMAIL_EXISTS"`,
do not show an error. Instead `POST {API_BASE}/auth/request-code` with the same
email, then show the existing code step with an info banner (blue, like the spam
note): "Ten adres jest już zapisany — wysłaliśmy kod, aby zobaczyć swoje
zgłoszenie." Handle `429 RATE_LIMIT` from request-code by showing an error on the
email step ("Zbyt wiele prób. Spróbuj ponownie za godzinę.").

`request-code` always returns 200 even for unknown emails (anti-enumeration);
irrelevant here because EMAIL_EXISTS proves the registration exists.

### After verify-code

Replace the current unconditional prefill+participants-step logic with:
`GET /dashboard` →
- `participants.length > 0` → redirect to panel;
- otherwise → existing `/prefill` + participants step flow.

### Success screen

Add a link above the existing lista link: `Zobacz swoje zgłoszenie →` pointing to
`/wilczy-polmaraton/zewwilka/panel`.

## 2. Panel page

New files:
- `src/pages/wilczy-polmaraton/zewwilka/panel.astro` — thin wrapper, same
  structure as `lista.astro` (Layout + WilczyPolmaratonHeader with back link to
  `/wilczy-polmaraton/zewwilka` + content component).
- `src/components/zewwilka/ZewWilkaPanelContent.astro` — self-contained,
  Polish-only, same conventions as the other zewwilka components (hardcoded
  strings, `data-api-base` attribute, vanilla JS in a `<script>` tag, emerald
  Tailwind styling).

### States

- **loading** — "Ładowanie…".
- **login** — shown when `GET /dashboard` returns 401/403. Minimal inline login:
  email input → `POST /auth/request-code` → 6-digit code input → `POST
  /auth/verify-code` → re-fetch dashboard. Mirrors the code-step UX of the
  registration page (spam-folder note, back-to-email button, rate-limit error
  handling). Works after the registration deadline — this is the only login path
  between the deadline (Aug 5) and the event (Aug 7).
- **panel** — shown on dashboard 200 with participants:
  - greeting: "Cześć {first word of registration.fullName}!";
  - event info: "7 sierpnia 2026 o 20:00 w Azylu Zatyranych (Rybnik-Ochojec)"
    and a "Udział jest bezpłatny" note;
  - participant cards: full name, distance label (Bieg 10 km / Nordic Walking
    10 km / Canicross 10 km), city, club (if any), and a small "ukryty na liście
    publicznej" badge when `hideNamePublic`;
  - links: "Lista zapisanych" → `/wilczy-polmaraton/zewwilka/lista`, "Strona
    wydarzenia" → `/wilczy-polmaraton/zewwilka`;
  - logout button → `POST /auth/logout` then redirect to
    `/wilczy-polmaraton/zewwilka`.
- **empty** — dashboard 200 with zero participants: "Nie masz jeszcze zapisanych
  uczestników." plus a button to `/wilczy-polmaraton/zewwilka/rejestracja`
  (before the deadline) or the info that registration has closed (after it —
  same date logic as the registration page, deadline passed via a data
  attribute).

View-only: no edit, add, or delete actions.

## 3. Out of scope

- Any change under `api/` (all endpoints reused as-is).
- Any change to Wilczy Półmaraton pages/components or shared emails.
- i18n (zewwilka is Polish-only by existing convention).
- Panel edit/add/delete capabilities.
- Cleanup of existing participant-less registrations in the DB.

## Error handling

- All fetches wrapped in try/catch with the existing "Błąd połączenia. Spróbuj
  ponownie." pattern.
- Dashboard 401 on the registration page init is the normal "not logged in"
  signal — fall through silently (same as from-source failures today).
- verify-code `INVALID_CODE` → existing message.
- request-code 429 → rate-limit message (both on registration page and panel).

## Testing

- Extend `test/zewwilka-registration.test.js` (mock-based) to cover:
  EMAIL_EXISTS → request-code fallback; post-verify dashboard branching
  (participants → panel redirect, empty → participants step).
- New `test/zewwilka-panel.test.js` if the harness pattern fits; otherwise cover
  panel branching in the existing test file.
- Manual: `vercel dev` — register fresh, revisit page (expect panel redirect),
  login with registered email from clean browser, empty-registration resume,
  logout.
