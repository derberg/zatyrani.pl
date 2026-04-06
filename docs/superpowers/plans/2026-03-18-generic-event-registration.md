# Generic Event Registration System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a competition-agnostic registration/payment/list system at `/api/events/[eventId]/` that powers Wilczy Półmaraton 2026 and all future Zatyrani events, without touching existing niebocross code.

**Architecture:** New generic Supabase tables (`registrations`, `participants`, `payments`, `auth_codes`, `clubs`) with an `event_id` column. A single set of Vercel dynamic-route API files under `api/events/[eventId]/` handles all events by reading an event config object. Niebocross routes and tables remain untouched.

**Tech Stack:** Vercel serverless functions (JS), Supabase (PostgreSQL), SendGrid, SIBS Gateway, Astro v4 (SSG), jsonwebtoken

---

## Important Context

### Existing code to reference (do NOT modify):
- `api/niebocross/utils/auth.js` — JWT verify pattern
- `api/niebocross/utils/sibs.js` — SIBS payment + webhook decrypt (fully generic, copy as-is)
- `api/niebocross/utils/email.js` — Email templates (event-specific strings to be parameterized)
- `api/niebocross/utils/participant-validation.js` — Validation logic (event-specific rules to be config-driven)
- `api/niebocross/utils/database-operations.js` — DB helpers (table names to be made generic)
- `api/niebocross/register.js` — Pattern for all protected mutation routes
- `api/niebocross/payment/webhook.js` — Webhook pattern

### Key differences for Wilczy Półmaraton vs NieboCross:
- No `kids_run` category, no food preference, no kids t-shirt sizes
- Two distances: `21km` and `10km` (run only, no Nordic walking)
- Minimum age 18 for both
- Different entry fees (TBD, placeholders in config)
- Different event name, date, location

### Cookie naming convention for generic auth:
Sanitize `eventId` by replacing `-` with `_`. Example: `niebocross-2026` → cookie `niebocross_2026_session` and `niebocross_2026_auth_status`.

---

## File Map

**New files to create:**

| File | Purpose |
|------|---------|
| `api/events/config.js` | Single source of truth: all event configs |
| `api/shared/auth.js` | Generic JWT verify (takes cookie prefix from event config) |
| `api/shared/email.js` | Generic email templates (takes event config for strings) |
| `api/shared/participant-validation.js` | Config-driven validation + fee calculation |
| `api/shared/database-operations.js` | Generic DB helpers using generic table names |
| `api/shared/supabase.js` | Shared Supabase client factory |
| `api/shared/limits.js` | Generic participant limits helpers (config-driven group/count logic) |
| `api/shared/test-data-filter.js` | Copy of niebocross test-data-filter (already fully generic) |
| `api/events/[eventId]/auth/start-registration.js` | POST: create registration + send code |
| `api/events/[eventId]/auth/verify-code.js` | POST: verify code + set JWT cookie |
| `api/events/[eventId]/auth/request-code.js` | POST: request new code (rate-limited) |
| `api/events/[eventId]/auth/logout.js` | POST: clear cookies |
| `api/events/[eventId]/register.js` | POST: add participants + create payment |
| `api/events/[eventId]/add-participants.js` | POST: add more participants to existing registration |
| `api/events/[eventId]/update-participant.js` | POST: update one participant |
| `api/events/[eventId]/delete-participant.js` | POST: delete one participant |
| `api/events/[eventId]/dashboard.js` | GET: full registration state for panel page |
| `api/events/[eventId]/registrations/list.js` | GET: public participant list |
| `api/events/[eventId]/payment/[id].js` | GET: get/create SIBS payment link |
| `api/events/[eventId]/payment/webhook.js` | POST: SIBS encrypted webhook handler |
| `api/events/[eventId]/clubs/search.js` | GET: club name autocomplete |
| `src/components/event/LoginContent.astro` | Generic login component (takes event config as prop) |
| `src/components/event/RegistrationContent.astro` | Generic registration form |
| `src/components/event/AddParticipantsContent.astro` | Generic add participants form |
| `src/components/event/ParticipantsListContent.astro` | Generic public list |
| `src/components/event/PanelContent.astro` | Generic dashboard panel |
| `src/components/event/ParticipantFieldset.astro` | Generic participant form fields |
| `src/components/event/RaceCategorySelector.astro` | Generic race category dropdown |
| `src/pages/wilczypolmaraton/rejestracja.astro` | WP registration page (PL) |
| `src/pages/wilczypolmaraton/zaloguj.astro` | WP login page (PL) |
| `src/pages/wilczypolmaraton/lista.astro` | WP public list page (PL) |
| `src/pages/wilczypolmaraton/panel.astro` | WP participant panel (PL) |
| `src/pages/wilczypolmaraton/dodaj-uczestnikow.astro` | WP add participants page (PL) |
| `src/pages/wilczypolmaraton/payment/index.astro` | WP payment page (PL) |
| `src/utils/wilczypolmaraton/constants.ts` | Frontend constants for WP |
| `public/locales/pl/wilczypolmaraton.json` | Polish translations for WP |
| `public/locales/en/wilczypolmaraton.json` | English translations for WP |

**Database changes (manual — user runs SQL in Supabase):** Create 5 new generic tables. Niebocross tables untouched.

---

## Task 1: Database Schema (Manual Step)

**Run the following SQL in Supabase SQL editor.** This creates all generic tables. The `event_id` column scopes records to a specific event.

- [ ] **Step 1: Run SQL in Supabase**

```sql
-- Generic registrations table (replaces niebocross_registrations)
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, email)
);

-- Generic auth codes table (replaces niebocross_auth_codes)
CREATE TABLE auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generic participants table (replaces niebocross_participants_v2)
-- No CHECK constraint on race_category — enforced by event config at API level
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  birth_date DATE NOT NULL,
  city VARCHAR(255) NOT NULL,
  nationality VARCHAR(100) NOT NULL,
  club VARCHAR(255),
  race_category VARCHAR(50) NOT NULL,
  food_preference VARCHAR(20),
  tshirt_size VARCHAR(10),
  hide_name_public BOOLEAN NOT NULL DEFAULT false,
  phone_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generic payments table (replaces niebocross_payments)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  race_fees DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tshirt_fees DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  charity_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled')),
  payment_link TEXT,
  transaction_id VARCHAR(255),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generic clubs table (shared across all events)
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS (consistent with existing niebocross tables)
ALTER TABLE registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE clubs DISABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Verify tables exist**

In Supabase Table Editor, confirm you can see: `registrations`, `auth_codes`, `participants`, `payments`, `clubs`.

- [x] **Step 3: Commit DB schema documentation**

Create `docs/GENERIC_DB_SCHEMA.md` documenting the new tables (copy the SQL above, add column descriptions matching the style of `DATABASE_SCHEMA.md`).

```bash
git add docs/GENERIC_DB_SCHEMA.md
git commit -m "docs: add generic competition database schema"
```

---

## Task 2: Event Config

**File:** `api/events/config.js`

This is the single source of truth for all event-specific settings. When adding a new event, only this file and frontend pages need to change.

- [x] **Step 1: Create `api/events/config.js`**

```javascript
/**
 * Competition event configuration registry.
 * Add new events here — all generic API routes read from this config.
 *
 * Fee structure: fees object maps race_category to PLN amount.
 * Use key 'default' as fallback for unlisted categories.
 */

export const EVENTS = {
  // REFERENCE ONLY — niebocross continues to use its own routes (api/niebocross/) and tables (niebocross_*).
  // Do NOT use this config entry with generic API routes. It exists so email templates can share the
  // event name/location/URL strings if niebocross is ever migrated to the generic system.
  'niebocross-2026': {
    id: 'niebocross-2026',
    name: 'NieboCross 2026',
    date: '2026-04-12',
    location: 'Nieborowice',
    locationFull: '12 kwietnia 2026 w Nieborowicach',
    slug: 'niebocross',
    cookiePrefix: 'niebocross_2026',
    panelUrl: 'https://zatyrani.pl/niebocross/panel',
    paymentUrl: 'https://zatyrani.pl/niebocross/payment',
    distances: ['3km_run', '3km_nw', '9km_run', '9km_nw', 'kids_run'],
    ageRules: [
      { categories: ['3km_run', '3km_nw'], minAge: 16 },
      { categories: ['9km_run', '9km_nw'], minAge: 18 },
      { categories: ['kids_run'], maxAge: 15 }
    ],
    fees: {
      'kids_run': 20,
      default: 60
    },
    // Limits per participant group — used by registrations/list.js to show capacity
    limits: [
      { group: 'kids', categories: ['kids_run'], limit: 30 },
      { group: 'adults_runners', categories: ['3km_run', '9km_run'], limit: 150 },
      { group: 'nw', categories: ['3km_nw', '9km_nw'], limit: 70 }
    ],
    tshirtEnabled: true,
    foodEnabled: true,
    tshirtSizes: ['116', '128', '134', '140', '146', '152', 'XS', 'S', 'M', 'L', 'XL', 'XXL']
  },
  'wilczypolmaraton-2026': {
    id: 'wilczypolmaraton-2026',
    name: 'Wilczy Półmaraton 2026',
    date: '2026-10-01', // TODO: update when confirmed
    location: 'TBD',    // TODO: update when confirmed
    locationFull: 'TBD',
    slug: 'wilczypolmaraton',
    cookiePrefix: 'wilczypolmaraton_2026',
    panelUrl: 'https://zatyrani.pl/wilczypolmaraton/panel',
    paymentUrl: 'https://zatyrani.pl/wilczypolmaraton/payment',
    distances: ['21km', '10km'],
    ageRules: [
      { categories: ['21km', '10km'], minAge: 18 }
    ],
    fees: {
      '21km': 80,
      default: 60
    },
    // Limits per participant group
    limits: [
      { group: 'runners', categories: ['21km', '10km'], limit: 500 } // TODO: confirm actual limit
    ],
    tshirtEnabled: false,
    foodEnabled: false,
    // tshirtSizes defined for future use — not displayed when tshirtEnabled is false
    tshirtSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  }
};

/**
 * Get event config by ID. Throws if event not found.
 * @param {string} eventId
 * @returns {Object} event config
 */
export function getEventConfig(eventId) {
  const config = EVENTS[eventId];
  if (!config) {
    throw new Error(`Unknown event: ${eventId}`);
  }
  return config;
}
```

- [x] **Step 2: Commit**

```bash
git add api/events/config.js
git commit -m "feat: add generic event config registry"
```

---

## Task 3: Shared Supabase Client

**File:** `api/shared/supabase.js`

- [x] **Step 1: Create `api/shared/supabase.js`**

```javascript
import { createClient } from "@supabase/supabase-js";

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }

  return createClient(url, serviceKey);
}
```

- [x] **Step 2: Commit**

```bash
git add api/shared/supabase.js
git commit -m "feat: add shared supabase client factory"
```

---

## Task 4: Shared Auth Utility

**File:** `api/shared/auth.js`

Unlike `api/niebocross/utils/auth.js` (hardcodes `niebocross_session` cookie), this reads the cookie name from the event config's `cookiePrefix`.

- [x] **Step 1: Create `api/shared/auth.js`**

```javascript
import jwt from "jsonwebtoken";

/**
 * Verify JWT token from request.
 * Reads cookie named `{eventConfig.cookiePrefix}_session`.
 *
 * @param {Object} req - HTTP request
 * @param {Object} eventConfig - Event config from api/events/config.js
 * @returns {{ registration_id, email } | { error, status }}
 */
export function verifyToken(req, eventConfig) {
  const cookieName = `${eventConfig.cookiePrefix}_session`;
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    token = cookies[cookieName];
  }

  if (!token) {
    return { error: "Brak tokenu autoryzacji", status: 401 };
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    return { error: "Konfiguracja serwera nieprawidłowa", status: 500 };
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    return { registration_id: decoded.registration_id, email: decoded.email };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { error: "Sesja wygasła. Zaloguj się ponownie.", status: 401 };
    }
    return { error: "Nieprawidłowy token", status: 401 };
  }
}
```

- [x] **Step 2: Commit**

```bash
git add api/shared/auth.js
git commit -m "feat: add shared generic JWT auth utility"
```

---

## Task 5: Shared Participant Validation

**File:** `api/shared/participant-validation.js`

The niebocross version hardcodes race categories and fees. This version reads them from event config.

- [x] **Step 1: Create `api/shared/participant-validation.js`**

```javascript
/**
 * Generic participant validation driven by event config.
 */

/**
 * Calculate age at event date.
 */
export function calculateAge(birthDate, eventDate) {
  const birth = new Date(birthDate);
  const event = new Date(eventDate);
  let age = event.getFullYear() - birth.getFullYear();
  const monthDiff = event.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && event.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Validate a single participant against event config rules.
 *
 * @param {Object} participant - camelCase participant data from request body
 * @param {Object} eventConfig - Event config from api/events/config.js
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateParticipant(participant, eventConfig) {
  const { firstName, lastName, birthDate, city, nationality, raceCategory, phoneNumber, tshirtSize } = participant;

  // Required fields (tshirtSize only required if tshirtEnabled)
  const requiredFields = { firstName, lastName, birthDate, city, nationality, raceCategory, phoneNumber };
  if (eventConfig.tshirtEnabled) {
    requiredFields.tshirtSize = tshirtSize;
  }

  if (Object.values(requiredFields).some(v => !v)) {
    return { valid: false, error: "Wszystkie wymagane pola muszą być wypełnione" };
  }

  // Phone number (Polish format: 9 digits)
  if (!/^\d{9}$/.test(phoneNumber)) {
    return { valid: false, error: "Numer telefonu musi składać się z 9 cyfr" };
  }

  // Race category must be in event's allowed distances
  if (!eventConfig.distances.includes(raceCategory)) {
    return { valid: false, error: "Nieprawidłowa kategoria biegu" };
  }

  // T-shirt size validation
  if (tshirtSize && !eventConfig.tshirtSizes.includes(tshirtSize)) {
    return { valid: false, error: "Nieprawidłowy rozmiar koszulki" };
  }

  // Age rules
  const age = calculateAge(birthDate, eventConfig.date);
  for (const rule of eventConfig.ageRules) {
    if (rule.categories.includes(raceCategory)) {
      if (rule.minAge !== undefined && age < rule.minAge) {
        return { valid: false, error: `Minimalny wiek dla tej kategorii to ${rule.minAge} lat` };
      }
      if (rule.maxAge !== undefined && age > rule.maxAge) {
        return { valid: false, error: `Maksymalny wiek dla tej kategorii to ${rule.maxAge} lat` };
      }
    }
  }

  return { valid: true };
}

/**
 * Calculate payment amounts based on participants and event fee config.
 *
 * @param {Array} participants - Array with race_category (snake_case, from DB)
 * @param {Object} eventConfig - Event config
 * @returns {{ raceFees, tshirtFees, totalAmount, charityAmount }}
 */
export function calculatePaymentForParticipants(participants, eventConfig) {
  let raceFees = 0;
  const tshirtFees = 0; // T-shirt fees disabled until confirmed

  participants.forEach(p => {
    const category = p.race_category || p.raceCategory;
    const fee = eventConfig.fees[category] ?? eventConfig.fees.default ?? 0;
    raceFees += fee;
  });

  const charityAmount = raceFees;

  return {
    raceFees,
    tshirtFees,
    totalAmount: raceFees + tshirtFees,
    charityAmount
  };
}
```

- [x] **Step 2: Commit**

```bash
git add api/shared/participant-validation.js
git commit -m "feat: add generic config-driven participant validation"
```

---

## Task 5b: Shared Utilities (limits + test-data-filter)

These two files are needed by `registrations/list.js` in Task 9.

### `api/shared/limits.js`

The niebocross `limits.js` hardcodes niebocross category groups. The generic version derives groups from `eventConfig.limits`.

- [x] **Step 1: Create `api/shared/limits.js`**

```javascript
/**
 * Generic participant limits helpers driven by event config.
 * Each event defines a `limits` array in its config:
 *   limits: [{ group: 'runners', categories: ['21km', '10km'], limit: 500 }]
 */

/**
 * Get the group name for a race category, using event config limits.
 * Returns null if category has no defined group.
 */
export function getGroupForCategory(raceCategory, eventConfig) {
  for (const limitConfig of (eventConfig.limits || [])) {
    if (limitConfig.categories.includes(raceCategory)) {
      return limitConfig.group;
    }
  }
  return null;
}

/**
 * Build initial paidCounts object with all groups set to 0.
 */
export function buildPaidCounts(eventConfig) {
  const counts = {};
  for (const limitConfig of (eventConfig.limits || [])) {
    counts[limitConfig.group] = 0;
  }
  return counts;
}

/**
 * Build limitsAndCounts response object for list API.
 */
export function buildLimitsAndCounts(paidCounts, eventConfig) {
  const result = {};
  for (const limitConfig of (eventConfig.limits || [])) {
    result[limitConfig.group] = {
      count: paidCounts[limitConfig.group] || 0,
      limit: limitConfig.limit
    };
  }
  return result;
}
```

### `api/shared/test-data-filter.js`

The niebocross version in `api/niebocross/utils/test-data-filter.js` is already fully generic (no niebocross-specific code). Copy it to `api/shared/`:

- [x] **Step 2: Create `api/shared/test-data-filter.js`**

Copy the contents of `api/niebocross/utils/test-data-filter.js` verbatim to `api/shared/test-data-filter.js`.

- [x] **Step 3: Commit**

```bash
git add api/shared/limits.js api/shared/test-data-filter.js
git commit -m "feat: add shared limits and test-data-filter utilities"
```

---

## Task 6: Shared Database Operations

**File:** `api/shared/database-operations.js`

Generic version of `api/niebocross/utils/database-operations.js` — uses generic table names (`registrations`, `participants`, `payments`, `clubs`) and takes `eventConfig` for fee calculation.

- [x] **Step 1: Create `api/shared/database-operations.js`**

```javascript
import { calculatePaymentForParticipants } from "./participant-validation.js";

/**
 * Convert participant objects from camelCase to database snake_case.
 */
export function createParticipantRecords(participants, registration_id) {
  return participants.map(p => ({
    registration_id,
    first_name: p.firstName,
    last_name: p.lastName,
    birth_date: p.birthDate,
    city: p.city,
    nationality: p.nationality,
    club: p.club || null,
    race_category: p.raceCategory,
    food_preference: p.foodPreference || null,
    hide_name_public: p.hideNamePublic || false,
    tshirt_size: p.tshirtSize || null,
    phone_number: p.phoneNumber
  }));
}

/**
 * Upsert clubs from participants list to shared clubs table.
 */
export async function upsertClubs(supabase, participants) {
  for (const participant of participants) {
    if (participant.club) {
      await supabase
        .from("event_clubs")
        .upsert(
          { name: participant.club },
          { onConflict: 'name', ignoreDuplicates: true }
        );
    }
  }
}

/**
 * Update existing pending payment or create new one.
 *
 * @param {Object} supabase
 * @param {string} registration_id
 * @param {Array} allParticipants - All participants for registration (snake_case from DB)
 * @param {Object|null} existingPendingPayment
 * @param {Object} eventConfig - Used for fee calculation
 * @param {number} extraDonation
 */
export async function updateOrCreatePayment(supabase, registration_id, allParticipants, existingPendingPayment, eventConfig, extraDonation = 0) {
  const payment = calculatePaymentForParticipants(allParticipants, eventConfig);

  // Preserve any existing extra donation on top of new calculation
  const existingTotalAmount = Number(existingPendingPayment?.total_amount || 0);
  const existingRaceFees = Number(existingPendingPayment?.race_fees || 0);
  const existingTshirtFees = Number(existingPendingPayment?.tshirt_fees || 0);
  const existingExtraDonation = Math.max(0, existingTotalAmount - existingRaceFees - existingTshirtFees);
  const newExtraDonation = Math.max(0, parseInt(extraDonation || '0'));
  const totalExtraDonation = existingExtraDonation + newExtraDonation;

  payment.totalAmount += totalExtraDonation;
  payment.charityAmount += totalExtraDonation;

  if (existingPendingPayment) {
    const { error } = await supabase
      .from("event_payments")
      .update({
        total_amount: payment.totalAmount,
        race_fees: payment.raceFees,
        tshirt_fees: payment.tshirtFees,
        charity_amount: payment.charityAmount,
        payment_link: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", existingPendingPayment.id);

    if (error) throw new Error("Failed to update payment");
    return { ...existingPendingPayment, ...payment };
  } else {
    const { data: newPayment, error } = await supabase
      .from("event_payments")
      .insert({
        registration_id,
        total_amount: payment.totalAmount,
        race_fees: payment.raceFees,
        tshirt_fees: payment.tshirtFees,
        charity_amount: payment.charityAmount,
        payment_status: 'pending'
      })
      .select()
      .single();

    if (error) throw new Error("Failed to create payment");
    return newPayment;
  }
}

/**
 * Get all registrations with pending payments for a given event.
 * Used for payment reminder emails.
 */
export async function getUnpaidRegistrations(supabase, eventId) {
  const { data, error } = await supabase
    .from('registrations')
    .select(`
      id,
      email,
      contact_person,
      event_payments!inner(id, total_amount, payment_status)
    `)
    .eq('event_id', eventId)
    .eq('payments.payment_status', 'pending');

  if (error) throw new Error(`Failed to fetch unpaid registrations: ${error.message}`);
  return data || [];
}
```

- [x] **Step 2: Commit**

```bash
git add api/shared/database-operations.js
git commit -m "feat: add generic database operations for event registration"
```

---

## Task 7: Shared Email Utility

**File:** `api/shared/email.js`

Generic version of `api/niebocross/utils/email.js`. All event-specific strings (name, location, date, URLs) come from `eventConfig`.

- [x] **Step 1: Create `api/shared/email.js`**

```javascript
import sgMail from "@sendgrid/mail";
import { convert } from 'html-to-text';

const htmlToTextOptions = {
  wordwrap: 80,
  selectors: [
    { selector: 'a', options: { ignoreHref: false } },
    { selector: 'img', format: 'skip' },
    { selector: 'hr', format: 'skip' }
  ]
};

function getSendgrid() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SendGrid API key not configured");
  sgMail.setApiKey(key);
  return sgMail;
}

const FROM = process.env.SENDGRID_FROM_EMAIL || "biuro@zatyrani.pl";

export async function sendVerificationCodeEmail(email, code, context = 'registration', eventConfig) {
  const sg = getSendgrid();
  const contextText = context === 'registration' ? 'zarejestrować' : 'zalogować';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Kod weryfikacyjny - ${eventConfig.name}</h2>
      <p>Twój kod weryfikacyjny:</p>
      <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
        ${code}
      </div>
      <p>Kod jest ważny przez 10 minut.</p>
      <p>Jeśli nie próbowałeś(łaś) się ${contextText} na ${eventConfig.name}, zignoruj tę wiadomość.</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl">www.zatyrani.pl</a>
      </p>
    </div>
  `;

  return sg.send({
    to: email,
    from: FROM,
    subject: `Kod weryfikacyjny - ${eventConfig.name}`,
    text: convert(html, htmlToTextOptions),
    html
  });
}

export async function sendRegistrationConfirmationEmail({ email, contactPerson, participants, payment, registrationId, eventConfig }) {
  const sg = getSendgrid();
  const paymentPageUrl = `${eventConfig.paymentUrl}?id=${registrationId}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Potwierdzenie rejestracji - ${eventConfig.name}</h2>
      <p>Witaj ${contactPerson},</p>
      <p>Dziękujemy za rejestrację na wydarzenie ${eventConfig.name}!</p>
      <h3>Zarejestrowani uczestnicy:</h3>
      <ul>
        ${participants.map(p => `<li>${p.firstName} ${p.lastName} - ${p.raceCategory.replace('_', ' ')}</li>`).join('')}
      </ul>
      <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
        <p style="margin: 0;"><strong>Do zapłaty: ${payment.totalAmount} zł</strong></p>
        <p style="margin: 5px 0 0 0; color: #666;">(w tym ${payment.charityAmount.toFixed ? payment.charityAmount.toFixed(2) : payment.charityAmount} zł na cel charytatywny)</p>
      </div>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${paymentPageUrl}" style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Opłać udział</a>
      </div>
      <p>Możesz też sprawdzić status płatności oraz zarejestrować dodatkowych uczestników pod adresem:<br>
      <a href="${eventConfig.panelUrl}">${eventConfig.panelUrl}</a></p>
      <p>Do zobaczenia ${eventConfig.locationFull}!</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl">www.zatyrani.pl</a>
      </p>
    </div>
  `;

  return sg.send({
    to: email,
    from: FROM,
    subject: `Potwierdzenie rejestracji - ${eventConfig.name}`,
    text: convert(html, htmlToTextOptions),
    html
  });
}

export async function sendPaymentReminderEmail({ email, contactPerson, totalAmount, registrationId, eventConfig }) {
  const sg = getSendgrid();
  const paymentPageUrl = `${eventConfig.paymentUrl}?id=${registrationId}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c7be5;">⏳ Hej ${contactPerson}, start coraz bliżej!</h2>
      <p>Zauważyliśmy, że Twój udział w <strong>${eventConfig.name}</strong> wciąż nie jest opłacony.</p>
      <p>Do startu ${eventConfig.locationFull} zostało już naprawdę niewiele czasu.</p>
      <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #2c7be5;">
        <p style="margin: 0;"><strong>Do zapłaty: ${totalAmount} zł</strong></p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${paymentPageUrl}" style="background-color: #2c7be5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Opłać udział teraz →</a>
      </div>
      <p style="color: #555;">Możesz też zalogować się do panelu uczestnika:<br>
      <a href="${eventConfig.panelUrl}">${eventConfig.panelUrl}</a></p>
      <p>Do zobaczenia na trasie! 💪</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl">www.zatyrani.pl</a>
      </p>
    </div>
  `;

  return sg.send({
    to: email,
    from: FROM,
    subject: `Hej ${contactPerson}, jeszcze nie opłaciłeś(aś) startu! ⏳ ${eventConfig.name}`,
    text: convert(html, htmlToTextOptions),
    html
  });
}

export async function sendPaymentFailedEmail({ email, contactPerson, totalAmount, registrationId, eventConfig }) {
  const sg = getSendgrid();
  const paymentPageUrl = `${eventConfig.paymentUrl}?id=${registrationId}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">⚠️ Płatność nie powiodła się - ${eventConfig.name}</h2>
      <p>Witaj ${contactPerson},</p>
      <p>Niestety Twoja płatność za udział w ${eventConfig.name} nie została zrealizowana.</p>
      <div style="background-color: #fef2f2; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626;">
        <p style="margin: 0;"><strong>Kwota do zapłaty: ${totalAmount} zł</strong></p>
      </div>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${paymentPageUrl}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Spróbuj zapłacić ponownie</a>
      </div>
      <p>Możesz też zalogować się do panelu uczestnika:<br>
      <a href="${eventConfig.panelUrl}">${eventConfig.panelUrl}</a></p>
      <div style="background-color: #f8fafc; padding: 15px; margin: 20px 0; border-left: 4px solid #94a3b8;">
        <p style="margin: 0 0 8px 0;"><strong>Masz pytania lub problemy z płatnością?</strong></p>
        <p style="margin: 0;">Napisz do nas: <a href="mailto:biuro@zatyrani.pl">biuro@zatyrani.pl</a></p>
      </div>
      <p>Do zobaczenia ${eventConfig.locationFull}!</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl">www.zatyrani.pl</a>
      </p>
    </div>
  `;

  return sg.send({
    to: email,
    from: FROM,
    subject: `Płatność nie powiodła się - ${eventConfig.name}`,
    text: convert(html, htmlToTextOptions),
    html
  });
}

export async function sendPaymentConfirmationEmail({ email, contactPerson, totalAmount, charityAmount, transactionId, eventConfig }) {
  const sg = getSendgrid();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4CAF50;">✓ Płatność potwierdzona!</h2>
      <p>Witaj ${contactPerson},</p>
      <p>Twoja płatność za ${eventConfig.name} została przyjęta!</p>
      <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
        <p style="margin: 0;"><strong>Kwota: ${totalAmount} zł</strong></p>
        <p style="margin: 5px 0 0 0; color: #666;">ID transakcji: ${transactionId}</p>
      </div>
      <p>Więcej informacji oraz możliwość zarejestrowania dodatkowych osób pod adresem:<br>
      <a href="${eventConfig.panelUrl}">${eventConfig.panelUrl}</a></p>
      <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0;">💚 Dziękujemy za wpłatę! <strong>${typeof charityAmount === 'number' ? charityAmount.toFixed(2) : charityAmount} zł</strong> zostanie przekazane na cel charytatywny.</p>
      </div>
      <p>Do zobaczenia ${eventConfig.locationFull}!</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl">www.zatyrani.pl</a>
      </p>
    </div>
  `;

  return sg.send({
    to: email,
    from: FROM,
    subject: `Potwierdzenie płatności - ${eventConfig.name}`,
    text: convert(html, htmlToTextOptions),
    html
  });
}
```

- [x] **Step 2: Commit**

```bash
git add api/shared/email.js
git commit -m "feat: add generic event email templates"
```

---

## Task 8: Auth API Routes

**Note:** These 4 files are the `[eventId]` dynamic versions of the niebocross auth routes. The `eventId` comes from `req.query.eventId` (Vercel dynamic route).

**Helper at top of each auth file:**
```javascript
import { getEventConfig } from '../../../events/config.js';  // adjust depth as needed

function getEvent(req, res) {
  try {
    return getEventConfig(req.query.eventId);
  } catch {
    res.status(404).json({ success: false, error: "Event not found" });
    return null;
  }
}
```

### `api/events/[eventId]/auth/start-registration.js`

- [x] **Step 1: Create file**

Copy `api/niebocross/auth/start-registration.js` as a starting template, then make these changes:
1. Add `getEvent()` helper at top
2. Replace all `niebocross_registrations` → `registrations`
3. Replace all `niebocross_auth_codes` → `auth_codes`
4. Add `.eq('event_id', eventConfig.id)` to the existing email check query
5. Add `event_id: eventConfig.id` to the `registrations` insert
6. Add `event_id: eventConfig.id` to the `auth_codes` insert
7. Pass `eventConfig` to `sendVerificationCodeEmail(email, code, 'registration', eventConfig)`
8. Import from `../../../../shared/` instead of `../utils/`

Full file:

```javascript
import crypto from "node:crypto";
import { getSupabaseClient } from '../../../../shared/supabase.js';
import { sendVerificationCodeEmail } from '../../../../shared/email.js';
import { getEventConfig } from '../../../config.js';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let eventConfig;
  try {
    eventConfig = getEventConfig(req.query.eventId);
  } catch {
    return res.status(404).json({ success: false, error: "Event not found" });
  }

  try {
    const { email, fullName, rodoAccepted, termsAccepted, website } = req.body;

    if (website) {
      return res.status(400).json({ success: false, error: "Invalid request" });
    }

    if (!email || !fullName) {
      return res.status(400).json({ success: false, error: "EMAIL_REQUIRED" });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: "EMAIL_INVALID" });
    }
    if (!rodoAccepted) {
      return res.status(400).json({ success: false, error: "RODO_REQUIRED" });
    }
    if (!termsAccepted) {
      return res.status(400).json({ success: false, error: "TERMS_REQUIRED" });
    }

    const supabase = getSupabaseClient();

    const { data: existingReg } = await supabase
      .from("event_registrations")
      .select("email")
      .eq("event_id", eventConfig.id)
      .eq("email", email.toLowerCase())
      .single();

    if (existingReg) {
      return res.status(400).json({ success: false, error: "EMAIL_EXISTS" });
    }

    const { error: regError } = await supabase
      .from("event_registrations")
      .insert({ event_id: eventConfig.id, email: email.toLowerCase(), contact_person: fullName })
      .select()
      .single();

    if (regError) {
      // Postgres unique violation (race condition: two simultaneous requests with same email)
      if (regError.code === '23505') {
        return res.status(400).json({ success: false, error: "EMAIL_EXISTS" });
      }
      console.error("Error creating registration:", regError);
      return res.status(500).json({ success: false, error: "DB_ERROR" });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: recentCodes } = await supabase
      .from("event_auth_codes")
      .select("id")
      .eq("event_id", eventConfig.id)
      .eq("email", email.toLowerCase())
      .gte("created_at", oneHourAgo.toISOString());

    if (recentCodes && recentCodes.length >= 3) {
      return res.status(429).json({ success: false, error: "RATE_LIMIT" });
    }

    const { error: codeError } = await supabase
      .from("event_auth_codes")
      .insert({ event_id: eventConfig.id, email: email.toLowerCase(), code, expires_at: expiresAt.toISOString(), used: false });

    if (codeError) {
      return res.status(500).json({ success: false, error: "CODE_STORE_ERROR" });
    }

    try {
      await sendVerificationCodeEmail(email, code, 'registration', eventConfig);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
    }

    return res.status(200).json({ success: true, message: "Kod weryfikacyjny został wysłany na email." });
  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ success: false, error: "UNEXPECTED_ERROR" });
  }
}
```

- [x] **Step 2: Create `api/events/[eventId]/auth/verify-code.js`**

Base on `api/niebocross/auth/verify-code.js`. Key differences:
- Query `auth_codes` (not `niebocross_auth_codes`) with `.eq('event_id', eventConfig.id)`
- Query `registrations` (not `niebocross_registrations`) **with `.eq('event_id', eventConfig.id)`** — this is critical: without the event_id filter, the same email registered for a different event would match and produce a JWT for the wrong registration
- Set cookie `${eventConfig.cookiePrefix}_session` (not `niebocross_session`)
- Set cookie `${eventConfig.cookiePrefix}_auth_status` (not `niebocross_auth_status`)

The registration fetch must look like:
```javascript
const { data: registration } = await supabase
  .from("event_registrations")
  .select("id, email")
  .eq("event_id", eventConfig.id)   // REQUIRED — scopes to this event
  .eq("email", email.toLowerCase())
  .single();
```

Read `api/niebocross/auth/verify-code.js` first to understand the full pattern, then implement the generic version following the exact same logic with the above changes.

- [x] **Step 3: Create `api/events/[eventId]/auth/request-code.js`**

Base on `api/niebocross/auth/request-code.js`. Same changes as above (table names, event_id filter, pass eventConfig to email function).

- [x] **Step 4: Create `api/events/[eventId]/auth/logout.js`**

Base on `api/niebocross/auth/logout.js`. Clear `${eventConfig.cookiePrefix}_session` and `${eventConfig.cookiePrefix}_auth_status` cookies.

- [x] **Step 5: Commit**

```bash
git add api/events/
git commit -m "feat: add generic event auth API routes"
```

---

## Task 9: Core Registration Routes

### `api/events/[eventId]/register.js`

- [x] **Step 1: Create file**

Base on `api/niebocross/register.js`. Changes:
- Import from `../../../shared/` and `../../config.js`
- Use `verifyToken(req, eventConfig)` from shared auth
- Use `registrations`, `participants`, `payments` table names
- Add `event_id` filter when fetching registration: `.eq('event_id', eventConfig.id)` (already implicit since JWT has registration_id)
- Pass `eventConfig` to `validateParticipant`, `updateOrCreatePayment`, `sendRegistrationConfirmationEmail`

- [x] **Step 2: Create `api/events/[eventId]/add-participants.js`**

Base on `api/niebocross/add-participants.js`. Same pattern as register.js — update table names, pass eventConfig through.

- [x] **Step 3: Create `api/events/[eventId]/update-participant.js`**

Base on `api/niebocross/update-participant.js`. Key changes:
- Add import: `import { updateOrCreatePayment } from "../../../shared/database-operations.js"` — the niebocross source does NOT have this import; add it alongside the existing imports
- Use `eventConfig.date` instead of hardcoded `EVENT_DATE` for the edit-deadline check
- Update table names: `participants`, `payments`, `clubs`
- Replace the inline payment recalculation logic (the niebocross source calls `calculatePaymentForParticipants` directly and then manually updates the payment table) with a single call to `updateOrCreatePayment(supabase, registration_id, allParticipants, existingPendingPayment, eventConfig)` — do NOT call `calculatePaymentForParticipants` separately; `updateOrCreatePayment` handles that internally

- [x] **Step 4: Create `api/events/[eventId]/delete-participant.js`**

Base on `api/niebocross/delete-participant.js`. Key changes:
- Add import: `import { updateOrCreatePayment } from "../../../shared/database-operations.js"` — the niebocross source does NOT have this import; add it
- Use `eventConfig.date` for edit-deadline check
- Update table names: `participants`, `payments`
- Replace inline payment recalculation logic with `updateOrCreatePayment(supabase, registration_id, remainingParticipants, existingPendingPayment, eventConfig)`

- [x] **Step 5: Create `api/events/[eventId]/dashboard.js`**

Base on `api/niebocross/dashboard.js`. Changes:
- Use `registrations`, `participants`, `payments` table names
- Use `eventConfig.date` for edit-deadline check
- Import from shared utils

- [x] **Step 6: Create `api/events/[eventId]/registrations/list.js`**

Base on `api/niebocross/registrations/list.js`. The niebocross version imports from two utilities that you must replace:

| Niebocross import | Replace with |
|-------------------|-------------|
| `import { PARTICIPANT_LIMITS, getGroupForCategory } from "../utils/limits.js"` | `import { getGroupForCategory, buildPaidCounts, buildLimitsAndCounts } from "../../../../shared/limits.js"` |
| `import { shouldFilterEmail } from "../utils/test-data-filter.js"` | `import { shouldFilterEmail } from "../../../../shared/test-data-filter.js"` |

Key query changes:
- Table: `participants` (not `niebocross_participants_v2`)
- Join: `event_registrations!inner(email, event_id, payments(payment_status, created_at))`
- Add filter: `.eq("registrations.event_id", eventConfig.id)` so each event's list is isolated
- Replace `p.niebocross_registrations?.niebocross_payments` → `p.registrations?.payments`
- Replace `p.niebocross_registrations?.email` → `p.registrations?.email`

Replace limits usage:
```javascript
// Instead of:
const paidCounts = {};
for (const group in PARTICIPANT_LIMITS) { paidCounts[group] = 0; }
// ...
const group = getGroupForCategory(p.race_category);
// ...
for (const [group, config] of Object.entries(PARTICIPANT_LIMITS)) {
  limitsAndCounts[group] = { count: paidCounts[group], limit: config.limit };
}

// Use:
const paidCounts = buildPaidCounts(eventConfig);
// ...
const group = getGroupForCategory(p.race_category, eventConfig);
// ...
const limitsAndCounts = buildLimitsAndCounts(paidCounts, eventConfig);
```

- [x] **Step 7: Create `api/events/[eventId]/clubs/search.js`**

Base on `api/niebocross/clubs/search.js`. Query generic `clubs` table (clubs are shared across events — same table).

- [x] **Step 8: Commit**

```bash
git add api/events/
git commit -m "feat: add generic event registration and participant management routes"
```

---

## Task 10: Payment Routes

### `api/events/[eventId]/payment/[id].js`

- [x] **Step 1: Create file**

Base on `api/niebocross/payment/[id].js`. Changes:
- Use `payments` table (not `niebocross_payments`)
- Join with `registrations` table (not `niebocross_registrations`)
- SIBS `description` should include `eventConfig.name`
- Callback URL: `${eventConfig.panelUrl}?payment=success`

### `api/events/[eventId]/payment/webhook.js`

- [x] **Step 2: Create file**

Base on `api/niebocross/payment/webhook.js`. Changes:
- Use `payments` table with join to `registrations`
- To get `eventConfig` for email: join payments → registrations → get `event_id`, then call `getEventConfig(event_id)`
- Pass `eventConfig` to `sendPaymentConfirmationEmail` and `sendPaymentFailedEmail`
- `sibs.js` is fully generic — import directly from `api/niebocross/utils/sibs.js` (no need to copy)

Full key section of webhook handler (the rest is identical to niebocross):

```javascript
// Get payment with registration and event_id
const { data: payment, error: paymentError } = await supabase
  .from("event_payments")
  .select(`
    *,
    event_registrations!inner(email, contact_person, event_id)
  `)
  .eq("id", paymentId)
  .single();

// ...

// Get event config from registration's event_id
const eventConfig = getEventConfig(payment.registrations.event_id);
```

- [x] **Step 3: Commit**

```bash
git add api/events/
git commit -m "feat: add generic event payment routes"
```

---

## Task 11: Frontend — Wilczy Półmaraton Pages

The frontend follows the same pattern as niebocross pages. Create components under `src/components/event/` that are parameterized by event config, then create Wilczy Półmaraton pages that use them.

**Strategy:** Rather than creating fully generic components upfront (which risks over-engineering), copy the niebocross components to `src/components/wilczypolmaraton/` and adapt them. The main differences are:
- No kids race category
- No food preference field
- Different race category options in `RaceCategorySelector`
- API calls go to `/api/events/wilczypolmaraton-2026/` instead of `/api/niebocross/`
- Cookie prefix is `wilczypolmaraton_2026` instead of `niebocross`

- [x] **Step 1: Create `src/utils/wilczypolmaraton/constants.ts`**

```typescript
export const EVENT_ID = 'wilczypolmaraton-2026';
export const EVENT_NAME = 'Wilczy Półmaraton 2026';
export const EVENT_DATE = '2026-10-01'; // TODO: update when confirmed
export const COOKIE_PREFIX = 'wilczypolmaraton_2026';
export const API_BASE = `/api/events/${EVENT_ID}`;

export const RACE_CATEGORIES = ['21km', '10km'] as const;
export type RaceCategory = typeof RACE_CATEGORIES[number];

export const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
```

- [x] **Step 2: Create pages**

Create the following 6 pages under `src/pages/wilczypolmaraton/` by copying the corresponding niebocross page and updating:
- Import path: use `wilczypolmaraton` components
- Page title and meta description
- API paths: change to use `API_BASE` from constants

Pages to create:
- `rejestracja.astro` (based on `src/pages/niebocross/rejestracja.astro`)
- `zaloguj.astro` (based on `src/pages/niebocross/zaloguj.astro`)
- `lista.astro` (based on `src/pages/niebocross/lista.astro`)
- `panel.astro` (based on `src/pages/niebocross/panel.astro`)
- `dodaj-uczestnikow.astro` (based on `src/pages/niebocross/dodaj-uczestnikow.astro`)
- `payment/index.astro` (based on `src/pages/niebocross/payment/index.astro`)

- [x] **Step 3: Create components**

Create `src/components/wilczypolmaraton/` directory. Copy components from `src/components/niebocross/` and adapt:

Components to create (copy + adapt):
- `LoginContent.astro` — Update API endpoint, cookie prefix
- `RegistrationContent.astro` — Update API endpoint, remove food preference field
- `AddParticipantsContent.astro` — Update API endpoint
- `ParticipantsListContent.astro` — Update API endpoint
- `PanelContent.astro` — Update API endpoint, cookie name
- `ParticipantFieldset.astro` — Remove food preference field, update race categories
- `RaceCategorySelector.astro` — Only `21km` and `10km` options (no kids, no NW)
- `TshirtSizeSelector.astro` — Adult sizes only (`XS` through `XXL`), or omit if not needed

Do NOT need (truly reusable — no niebocross-specific references):
- `BirthDateSelector.astro` — Can reuse niebocross version directly
- `RegistrationSummary.astro` — Can reuse niebocross version directly

Must copy and adapt (contains hardcoded niebocross API URL):
- `ClubAutocomplete.astro` — Copy from niebocross. The URL is inside a plain `<script>` tag (not frontmatter), so TypeScript imports are not available in that scope. Use a hardcoded string: replace `/api/niebocross/clubs/search` with `/api/events/wilczypolmaraton-2026/clubs/search` directly on line 53.

- [x] **Step 4: Commit**

```bash
git add src/components/wilczypolmaraton/ src/pages/wilczypolmaraton/ src/utils/wilczypolmaraton/
git commit -m "feat: add Wilczy Półmaraton frontend pages and components"
```

---

## Task 12: Translations

Follow `I18N_GUIDE.md` patterns. The simplest approach is event-specific translation files.

- [x] **Step 1: Review I18N_GUIDE.md**

Read `I18N_GUIDE.md` to understand the i18n pattern used in this project before adding translations.

- [x] **Step 2: Add Polish translations**

Create or update `public/locales/pl/translation.json` to add `wilczypolmaraton` namespace keys, or add a dedicated `public/locales/pl/wilczypolmaraton.json`.

Key strings needed:
- Page titles, meta descriptions
- Form field labels (race category names: "Półmaraton 21km", "Bieg 10km")
- Error messages
- Navigation labels

- [x] **Step 3: Add English translations**

Mirror in `public/locales/en/`.

- [x] **Step 4: Create English frontend pages (optional — do later)**

If English pages are needed, create `src/pages/en/wilczypolmaraton/` following the same pattern as `src/pages/en/niebocross/`.

- [x] **Step 5: Commit**

```bash
git add public/locales/
git commit -m "feat: add Wilczy Półmaraton translations"
```

---

## Task 13: Verification

Before considering the backend complete, do a manual end-to-end test:

- [x] **Step 1: Test registration flow**

```
POST /api/events/wilczypolmaraton-2026/auth/start-registration
Body: { "email": "test@example.com", "fullName": "Test User", "rodoAccepted": true, "termsAccepted": true }
Expected: 200 { success: true }
```

Check Supabase `registrations` table — row should have `event_id = 'wilczypolmaraton-2026'`.

- [x] **Step 2: Test code verification**

Use code from `auth_codes` table (or from email):
```
POST /api/events/wilczypolmaraton-2026/auth/verify-code
Body: { "email": "test@example.com", "code": "XXXXXX" }
Expected: 200 + Set-Cookie: wilczypolmaraton_2026_session=...
```

- [x] **Step 3: Test participant registration**

```
POST /api/events/wilczypolmaraton-2026/register
Headers: Cookie: wilczypolmaraton_2026_session=<token>
Body: { "event_participants": [{ "firstName": "Jan", "lastName": "Kowalski", "birthDate": "1990-01-01", "city": "Warszawa", "nationality": "PL", "raceCategory": "21km", "phoneNumber": "123456789", "tshirtSize": "M" }] }
Expected: 200 { success: true }
```

Check `participants` and `payments` tables in Supabase.

- [x] **Step 4: Test invalid event ID returns 404**

```
POST /api/events/nonexistent-event/auth/start-registration
Expected: 404 { error: "Event not found" }
```

- [x] **Step 5: Confirm niebocross still works**

Test that `POST /api/niebocross/auth/start-registration` still works correctly — niebocross routes are untouched.

- [x] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete generic event registration system for Wilczy Półmaraton"
```

---

## Scope Notes

**Out of scope for this plan:**
- Migrating existing niebocross data to new tables — niebocross runs on its own tables indefinitely
- Payment reminder cron job for Wilczy Półmaraton — add `api/events/[eventId]/reminders/send-payment-reminder.js` following the same pattern as `api/niebocross/reminders/send-payment-reminder.js` when needed
- English language pages for Wilczy Półmaraton — add `src/pages/en/wilczypolmaraton/` later
- Admin dashboard — out of scope

**Adding a future 3rd event:**
1. Add entry to `api/events/config.js`
2. Create frontend pages + components under `src/pages/{slug}/` and `src/components/{slug}/`
3. Add translations
4. Zero backend changes needed
