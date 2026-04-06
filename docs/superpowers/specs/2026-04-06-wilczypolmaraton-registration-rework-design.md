# Wilczy Polmaraton Registration Rework

## Overview

Rework the Wilczy Polmaraton 2026 registration flow on the `wilczyzapisy` branch to support updated race categories, optional t-shirt purchase, date-based fee scheduling, a multi-step per-participant wizard, and GDPR-hardened API endpoints.

## 1. Event Config Changes

**File:** `api/events/config.js`

Update the `wilczypolmaraton-2026` entry:

### Race Categories
- `21km` — Polmaraton (main run)
- `11km_nw` — Nordic Walking
- `21km_canicross` — Canicross

### Fee Schedule (replaces flat `fees` object)
New `feeSchedule` array, ordered by date. The API picks the first entry where `now <= until`:

```js
feeSchedule: [
  { until: '2026-08-31', fees: { default: 100 } },
  { until: '2026-10-16', fees: { default: 120 } },
],
```

Per-category fees are supported within any schedule entry (e.g., `{ '21km': 100, '11km_nw': 80 }`) but not needed for this event — flat `default` suffices.

### Age Rules
All categories: minAge 18.

### Participant Limits
Single shared pool: 250 total across all categories.

```js
limits: [
  { group: 'runners', categories: ['21km', '11km_nw', '21km_canicross'], limit: 250 }
]
```

### T-shirt Config
```js
tshirtEnabled: true,
tshirtPrice: 70,                          // PLN per t-shirt
tshirtImage: '/halfmarathon/tshirt.webp',  // image for purchase step
tshirtSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
```

T-shirt purchase is optional per participant. Empty `tshirtSize` means no purchase.

## 2. Multi-step Registration Flow

Steps 1 (email) and 2 (code verification) are unchanged.

Step 3 becomes a per-participant wizard with sub-steps. Step 4 is the final summary.

### Step 3a: Basic Info (one participant)
Fields: first name, last name, birth date, city, nationality, club, phone, race category (3 radio buttons), hide name on public list.

"Next" button validates all required fields client-side before advancing.

### Step 3b: T-shirt Purchase
- T-shirt image displayed (`/halfmarathon/tshirt.webp`)
- "I want to buy a t-shirt" checkbox (unchecked by default)
- If checked: size selector appears (XS–XXL)
- Price shown: 70 PLN
- "Next" button advances to summary

### Step 3c: Participant Summary
- Card showing this participant's basic info + t-shirt choice
- Two actions:
  - **"Add another runner"** — stores participant in JS array, loops back to step 3a with blank form
  - **"Finish and go to payment summary"** — advances to step 4

### Step 4: Final Summary
- All participants listed as summary cards
- Fee breakdown: race fees (per schedule) + t-shirt fees = total
- Info line showing current fee schedule (e.g., "After 31.08 registration costs 120 PLN")
- **"Submit and go to panel"** button — POSTs all participants to API, redirects to panel on success

### State Management
- Participants held in a JS array in memory (`participants[]`)
- Nothing hits the API until the final submit in step 4
- Users can navigate back through sub-steps and edit/remove participants before committing

## 3. API Changes

### Fee Calculation (`api/shared/participant-validation.js`)

**New function:** `getCurrentFees(eventConfig)` — reads `feeSchedule`, returns the active `fees` object based on current date. Falls back to the last entry if all `until` dates have passed.

**Updated:** `calculatePaymentForParticipants` — uses `getCurrentFees()` instead of `eventConfig.fees`. Calculates t-shirt fees as: count of participants with non-empty `tshirtSize` x `eventConfig.tshirtPrice`.

Returns `{ raceFees, tshirtFees, totalAmount, charityAmount }` (charityAmount = raceFees, does not include t-shirt fees).

### New Endpoint: `GET /api/events/[eventId]/fees`

Public endpoint (no auth required) returning current fee info for frontend display:

```json
{
  "fees": { "default": 100 },
  "tshirtPrice": 70,
  "feeSchedule": [
    { "until": "2026-08-31", "fees": { "default": 100 } },
    { "until": "2026-10-16", "fees": { "default": 120 } }
  ]
}
```

No personal data exposed. Used by the frontend to show accurate prices (since the site is statically built, prices that change by date cannot be baked in at build time).

### GDPR Hardening

**Public list (`registrations/list.js`):**
- Tighten `.select()` to only fetch columns needed for the response: `first_name`, `last_name`, `city`, `club`, `race_category`, `hide_name_public`, plus `email` and `event_id` from the join (needed for filtering, never returned)
- Remove `birth_date` and `nationality` from the query entirely
- Response fields: first name, last name (or `***` if hidden), city, club, race category, payment status
- No email, phone, birth date, or nationality ever returned

**All API endpoints:**
- Restrict CORS `Access-Control-Allow-Origin` from `*` to `https://zatyrani.pl`

**Dashboard (`dashboard.js`):**
- Already JWT-protected, returns only the authenticated user's own data — no changes needed beyond CORS

**Mutation endpoints (register, add-participants, update-participant, delete-participant):**
- Already JWT-protected — no changes needed beyond CORS

## 4. Frontend Component Changes

### `ParticipantFieldset.astro`
- Remove t-shirt size selector (moves to step 3b)
- Update race category radio buttons: 3 options (`21km`, `11km_nw`, `21km_canicross`) with Polish labels from translation keys

### `RegistrationContent.astro` (major rework)
- Replace step 3 with sub-steps 3a/3b/3c/4
- JS state machine manages current sub-step + `participants[]` array
- Fetch current fees from `/api/events/[eventId]/fees` on entering step 3a
- Step 4 calculates total from fetched fees and displays breakdown
- Final submit POSTs all participants at once

### `TshirtSizeSelector.astro`
- No structural changes, reused in step 3b

### `constants.ts`
- Update `RACE_CATEGORIES` to `['21km', '11km_nw', '21km_canicross']`

### Translation Keys (Polish)
New keys needed:
- Step titles for t-shirt step and final summary step
- T-shirt purchase prompt, price display
- Category labels: "Polmaraton 21km", "Nordic Walking 11km", "Canicross 21km"
- "Add another runner" button
- "Finish and go to payment summary" button
- Per-participant summary card labels
- Fee schedule info line

Remove/update keys referencing old 2-category setup (`10km`).

## 5. Database

No schema changes required. The existing `event_participants` table already has:
- `race_category VARCHAR(50)` — validated at API level against config, no DB constraint
- `tshirt_size VARCHAR(10)` — nullable, empty means no purchase

The `event_payments` table already has `tshirt_fees DECIMAL(10,2)` column.

## 6. Files Changed

| File | Change |
|------|--------|
| `api/events/config.js` | Update wilczypolmaraton-2026 config (categories, feeSchedule, tshirt, limits) |
| `api/shared/participant-validation.js` | Add `getCurrentFees()`, update fee calculation for t-shirts and schedule |
| `api/events/[eventId]/fees.js` | New endpoint — public current fees |
| `api/events/[eventId]/registrations/list.js` | Tighten SELECT, restrict CORS |
| `api/events/[eventId]/dashboard.js` | Restrict CORS |
| `api/events/[eventId]/auth/*.js` | Restrict CORS |
| `api/events/[eventId]/register.js` | Restrict CORS |
| `api/events/[eventId]/add-participants.js` | Restrict CORS |
| `api/events/[eventId]/update-participant.js` | Restrict CORS |
| `api/events/[eventId]/delete-participant.js` | Restrict CORS |
| `api/events/[eventId]/payment/*.js` | Restrict CORS |
| `src/components/wilczypolmaraton/RegistrationContent.astro` | Major rework — multi-step wizard |
| `src/components/wilczypolmaraton/ParticipantFieldset.astro` | Remove tshirt, update categories to 3 |
| `src/utils/wilczypolmaraton/constants.ts` | Update RACE_CATEGORIES |
| `public/locales/pl/translation.json` | New/updated translation keys |
