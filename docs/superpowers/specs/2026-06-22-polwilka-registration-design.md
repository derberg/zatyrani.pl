# Pół Wilka 2026 — Registration Design

**Date:** 2026-06-22
**Event:** `polwilka-2026` (Pół Wilka), free night run, 7 Aug 2026, Rybnik Ochojec.

## Goal

Let people register for Pół Wilka 2026 with no payment, with a confirmation
email, and with minimal data entry for anyone who already registered for
Wilczy Półmaraton 2026 (`wilczypolmaraton-2026`). The wilczypolmaraton flow must
remain untouched — all changes are additive and guarded by config flags.

## Decisions (confirmed)

- **Open to everyone.** Newcomers fill the form from scratch; wilczypolmaraton
  participants get prefill on top.
- **Prefill requires proof of email ownership.** Logged-in wilczypolmaraton
  users are already verified; not-logged-in users verify a 6-digit code before
  any personal data is revealed. No instant-on-email prefill (PII protection).
- **Multi-person prefill.** A wilczypolmaraton registration can hold several
  people (a family); the registrant ticks who is coming and picks each one's
  Pół Wilka distance.
- **Distances:** `10km`, `10km_nw` (nordic walking — its own category),
  `10km_canicross`. All min age 18.
- **No payment at all.** No `event_payments` rows are ever created for polwilka.
- **Confirmation email always sent** on successful registration.

## Config changes — `api/events/config.js`

Update the `polwilka-2026` entry:

```js
'polwilka-2026': {
  id: 'polwilka-2026',
  name: 'Pół Wilka 2026',
  date: '2026-08-07',
  location: 'Rybnik Ochojec',
  locationFull: '7 sierpnia 2026 w Rybniku (Ochojec)',
  slug: 'polwilka',
  cookiePrefix: 'polwilka_2026',
  panelUrl: 'https://zatyrani.pl/wilczy-polmaraton/polwilka',
  paymentUrl: 'https://zatyrani.pl/wilczy-polmaraton/polwilka',
  distances: ['10km', '10km_nw', '10km_canicross'],
  ageRules: [
    { categories: ['10km', '10km_nw', '10km_canicross'], minAge: 18 }
  ],
  fees: { default: 0 },
  limits: [
    { group: 'all', categories: ['10km', '10km_nw', '10km_canicross'], limit: 50 }
  ],
  tshirtEnabled: false,
  paymentEnabled: false,
  registrationDeadline: '2026-08-05',
  prefillSourceEventId: 'wilczypolmaraton-2026'
}
```

New config fields and who reads them:

- **`paymentEnabled: false`** — `register.js` skips payment creation;
  `email.js` renders a free-event confirmation. Absent/true on other events =
  existing behavior.
- **`registrationDeadline: '2026-08-05'`** — enforced in `start-registration.js`,
  `register.js`, `from-source.js`, and the UI. Inclusive: registration allowed
  through end of 2026-08-05 (UTC end-of-day, matching the existing
  `feeSchedule.until` convention).
- **`prefillSourceEventId: 'wilczypolmaraton-2026'`** — enables the recognition
  endpoints. Absent on other events = no prefill.

`feeSchedule` is removed in favor of flat `fees: { default: 0 }`; the deadline
now lives in its own field rather than being implied by a price tier.

## Three registration entry states (UX)

A single registration page (`…/polwilka/rejestracja`) resolves who the user is:

- **State B — logged into wilczypolmaraton** (valid `wilczypolmaraton_2026_session`
  cookie): greeting "Cześć {imię}! Rozpoznaliśmy Cię z Wilczego Półmaratonu.",
  prefilled multi-person selector, **register with no code**.
- **State C — not logged in**: form collects name + email + RODO + terms → sends
  6-digit code → verify. If the email exists in wilczypolmaraton-2026 → prefilled
  selector; otherwise → blank form (newcomer). The code step is identical to
  today's registration, so no added friction.

The selector lists **all** the person's wilczypolmaraton participants (run, NW,
canicross). Each ticked person picks a Pół Wilka distance (10km / NW /
canicross). Prefilled fields (name, birth date, city, nationality, club, gender,
phone) are editable. `race_category` is never prefilled — it must be chosen
because the source distances differ.

After the deadline the page shows "Zapisy zamknięte" and the form is hidden.

## API — all additive

Generic routes live under `api/events/[eventId]/`. New and changed:

### New: `auth/from-source.js` (POST) — state B
1. Read `prefillSourceEventId` from polwilka config; 404 if absent.
2. Verify the **source event** session cookie (`{sourceConfig.cookiePrefix}_session`)
   using `verifyToken(req, sourceConfig)`. 401 if missing/invalid.
3. Reject if past `registrationDeadline`; reject if event at `limit`.
4. Load the source registration + participants for that `registration_id`.
5. Upsert a polwilka `event_registrations` row for `{ email, contact_person }`
   (idempotent on `(event_id, email)`).
6. Mint a polwilka JWT, set `polwilka_2026_session` + `polwilka_2026_auth_status`
   cookies (same shape as `verify-code.js`).
7. Return `{ recognized: true, contactPerson, email, participants: [...] }`
   mapped to polwilka-relevant fields (no tshirt/food; `raceCategory` omitted).

### New: `prefill.js` (GET, polwilka-JWT-gated) — state C after verify
1. `verifyToken(req, eventConfig)` for polwilka. 401 if invalid.
2. If `prefillSourceEventId` set, look up the source-event participants by the
   **verified** email (join `event_participants` → `event_registrations` where
   `event_id = prefillSourceEventId` and `email = <verified email>`).
3. Return the mapped participants (or empty list if the email is unknown in the
   source event — newcomer). PII only ever reaches the JWT-verified owner.

### Changed: `auth/start-registration.js` — state C
- Add: reject if past `registrationDeadline` (error `REGISTRATION_CLOSED`).
- Add: reject if event already at `limit` (error `EVENT_FULL`).
- Otherwise unchanged (creates registration, sends code).

### Changed: `register.js`
- If `eventConfig.paymentEnabled === false`: skip `updateOrCreatePayment`
  entirely; do not query/create `event_payments`.
- Enforce `registrationDeadline` and `limit` (count existing polwilka
  participants + incoming ≤ limit) before insert.
- Always send the confirmation email (free-event branch when payment disabled).

### Changed: `shared/email.js`
- `sendRegistrationConfirmationEmail`: when `eventConfig.paymentEnabled === false`,
  render "Udział bezpłatny", omit amounts and the payment link, list participants
  + distances.

### Limit enforcement helper
`limits` is currently defined but enforced nowhere. Add a shared helper
(`shared/database-operations.js` or `participant-validation.js`) that counts
current `event_participants` for the event and compares against the summed
`limit`. Used by `start-registration.js`, `register.js`, and `from-source.js`.
Scope: enforce the **total** cap (single `group: 'all'`) for polwilka; per-group
enforcement for other events is out of scope here.

## Data model

- polwilka gets its own `event_registrations` + `event_participants` rows
  (`event_id = 'polwilka-2026'`).
- **No `event_payments` rows, ever.**
- Recognition/prefill is a read-only lookup of wilczypolmaraton data by verified
  email — never a shared or linked record.

## Front-end

- **Restructure:** move `src/pages/wilczy-polmaraton/polwilka.astro` →
  `polwilka/index.astro` (landing); add `polwilka/rejestracja.astro`.
- **New component** `PolWilkaRegistrationContent.astro` — implements states B/C,
  the multi-person selector, deadline gating. Styling reused from
  `wilczypolmaraton/RegistrationContent.astro`.
- **Landing** gets a "Zapisz się" CTA and a deadline notice; shows "Zapisy
  zamknięte" after 2026-08-05.
- **Panel promo:** add an info card to `wilczypolmaraton/PanelContent.astro` —
  short Pół Wilka blurb + "Zapisz się" linking to the registration page (state B
  prefills instantly for the logged-in user).

## Out of scope

- No polwilka panel / dashboard / participant-list / payment pages.
- No English (`/en`) mirror for the polwilka pages.
- No per-group limit enforcement for other events.

## Risks / notes

- `validateParticipant` already gates tshirt/food on config flags and validates
  `race_category` against `distances` and age against `ageRules` — reused as-is
  for polwilka (tshirt/food off).
- The shared generic endpoints are live for wilczypolmaraton; every change is
  behind a config flag (`paymentEnabled`, `prefillSourceEventId`,
  `registrationDeadline`) so wilczypolmaraton behavior is unchanged. This must be
  verified during implementation.
