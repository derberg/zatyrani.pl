# SMS Gate — Design

**Date:** 2026-05-04
**Status:** Approved (pending user review of this spec)
**Owner:** Łukasz Górnicki

## 1. Problem & goals

Łukasz needs a self-service way to send SMS messages to members of the Zatyrani association directly from the website, gated to a small allowlist of trusted senders. The site already has Twilio integration and an SMS-based login system targeting the same `members` table — this feature reuses both.

**Goals**

- Provide a `/sms` page accessible only to logged-in members on a per-member allowlist.
- Compose a single SMS body and broadcast to selected members from the `members` table.
- Surface accurate cost in **Twilio segments** (not just messages) so a 1100-segment budget is honoured.
- Detect Polish-character (UCS-2) encoding, warn the user, and offer a one-click transliteration to GSM-7 with a clear "you'd save N segments" hint.
- Track every send (success or failure) in an audit table for budget reconciliation and forensics.

**Non-goals**

- No scheduled / future-dated sends.
- No per-recipient placeholders or templating (single body broadcast).
- No incoming SMS handling, no opt-out flow, no unsubscribe link.
- No multi-language UI — Polish only, like other admin pages.
- No migration framework — schema changes are run manually in Supabase SQL Editor.

## 2. User-visible behaviour

The page is at `/sms` and behaves as follows:

1. Unauthenticated visitor: redirected to `/` by `middleware.ts`.
2. Authenticated but not on allowlist (`members.can_send_sms = false`): the page-load `state` request returns 403; the page client-redirects to `/?access_denied=true` (matching the existing middleware redirect convention).
3. Authenticated + allowlisted: page renders.

### Layout (single column, mobile-friendly)

| Section | Content |
|---|---|
| **Budget header** (sticky top) | "Budżet: 234 / 1100 SMS — pozostało 866" |
| **Message textarea** + counter | Live counter under the textarea: "X znaków · Y segmentów · kodowanie GSM-7 / UCS-2" |
| **UCS-2 warning panel** (conditional) | Yellow box shown only when text contains characters outside GSM-7. Text: "Twoja wiadomość zawiera polskie znaki. Kosztuje **Y segmentów** zamiast **Y' bez polskich znaków** — zaoszczędziłbyś **Δ segmentów na odbiorcę** (= **Δ × N SMS** z budżetu)." Includes button **"Usuń polskie znaki"** that transliterates the textarea content in place. |
| **Recipients list** | Checkboxes, one row per deduplicated member: `name +48xxxxxxxxx`. Sticky toolbar above the list: "Zaznacz wszystkich / Odznacz wszystkich" + "Wybrano: K / N". Sorted alphabetically by name. |
| **Total panel** (sticky bottom) | "Wybrano K odbiorców · Y segmentów / SMS · razem **K × Y = T** SMS · po wysłaniu pozostanie **866 − T** z budżetu". Turns red when `T > remaining`. **Send** button disabled unless `K ≥ 1` and `body non-empty` and `T ≤ remaining`. |
| **Confirm modal** | "Wysłać do K osób, łącznie T SMS?" with Cancel / Confirm. |
| **Progress phase** (after Confirm) | UI inputs disabled. Recipient rows update live: pending → ✓ sent / ✗ failed. Counter "Wysłano K1, błędy K2, pozostało K3". |
| **Summary modal** (on completion) | Counts of sent/failed plus the list of failed recipients (name + phone) so they can be retried manually. |

### Send flow (client-driven loop)

```
for recipient in selected_recipients:
  POST /api/sms-gate/send  { recipientId, body }
  update recipient row in UI based on response
  if response 409 (budget_exceeded):
    abort loop; show modal "budżet wyczerpany, wysłano X z Y"
  sleep 200ms
```

Sequential, ~200 ms inter-request delay, total ~20 s for 100 recipients.

## 3. Data model

### 3.1 Schema deltas

These are run **once, by hand, in the Supabase SQL Editor** before deploying the feature:

```sql
-- 1. Allowlist column on existing members table
ALTER TABLE members
  ADD COLUMN can_send_sms BOOLEAN NOT NULL DEFAULT false;

-- 2. Audit / usage table
CREATE TABLE sms_gate_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_member_id UUID NOT NULL REFERENCES members(id),
  recipient_member_id UUID REFERENCES members(id),    -- NULL allowed if member later deleted
  recipient_phone VARCHAR(20) NOT NULL,
  body TEXT NOT NULL,
  segments INTEGER NOT NULL,
  encoding VARCHAR(10) NOT NULL CHECK (encoding IN ('GSM-7', 'UCS-2')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed')),
  twilio_sid VARCHAR(64),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_sms_gate_usage_status ON sms_gate_usage(status);

-- 3. Lock the audit table down: RLS on, no policies
--    -> service_role bypasses RLS, anon role has no access.
ALTER TABLE sms_gate_usage ENABLE ROW LEVEL SECURITY;

-- 4. Grant access to the first sender (edit IDs as needed)
UPDATE members SET can_send_sms = true WHERE id = '8b209c30-06f2-4eed-927d-2915386ce88e';
```

The implementation plan must place these statements in their own first step with a hard "STOP — apply in Supabase before continuing" gate.

### 3.2 Budget computation

**Used budget** = `SELECT COALESCE(SUM(segments), 0) FROM sms_gate_usage WHERE status = 'sent'`.

Failed sends never count against the budget.

**Total budget** = `process.env.SMS_GATE_BUDGET` (string → integer; default `1100` if unset).

**Remaining** = `total − used`. Negative not possible because `/send` enforces `used + segments ≤ total` atomically.

## 4. API

Two new serverless functions under `api/sms-gate/`:

### 4.1 `GET /api/sms-gate/state`

**Auth**: `verifyUser(req)` → must succeed; then check `members.can_send_sms = true` for the resolved member. If either fails → `403 { error: "..." }`.

**Response 200**:
```json
{
  "budget": { "total": 1100, "used": 234, "remaining": 866 },
  "members": [
    { "id": "uuid", "name": "Arek", "phone": "+48123456789" }
  ]
}
```

- Members list = all rows in `members` with non-null, non-empty phone.
- Deduplicated by phone (keep first match in alphabetical-by-name order).
- Sorted alphabetically by `name`.

### 4.2 `POST /api/sms-gate/send`

**Auth**: same as above.

**Request body**:
```json
{ "recipientId": "uuid", "body": "tekst wiadomości" }
```

**Server-side processing**:

1. Re-resolve sender from session → `senderMemberId`. Re-check `can_send_sms`.
2. Look up recipient by `recipientId` → `recipientPhone`. If not found → `404 { error, recipientId }`.
3. Recompute `encoding` and `segments` from `body` using shared util (never trust client values).
4. In a single SELECT, compute `used`. If `used + segments > budget` → `409 { error: "budget_exceeded", remaining: budget - used, recipientId }`. Note: this is a small race window; we accept it because budget overshoot of one message is acceptable and a single sender is the realistic case.
5. Twilio `messages.create({ to, from, body })`.
6. On Twilio success → INSERT `sms_gate_usage` row with `status='sent'`, `twilio_sid`. Return `200 { ok: true, recipientId, twilio_sid, segments, used: used + segments }`.
7. On Twilio failure → INSERT row with `status='failed'`, `error_message`. Return `502 { ok: false, recipientId, error }`. **Failed rows do NOT consume budget** (they have `status='failed'`, the SUM filter excludes them).

**Supabase client**: must use `SUPABASE_SERVICE_ROLE_KEY` (no anon fallback — RLS blocks anon). If the env var is missing → `500 { error: "Konfiguracja serwera nieprawidłowa" }`.

## 5. Frontend

### 5.1 Files

- `src/pages/sms.astro` — page entry, wraps content in `Layout`. Polish-only, no `/en/sms`.
- `src/components/content/Sms.astro` — content + inline `<script>` (matches the `Zaloguj.astro` pattern: client-side fetches, no SSR, `define:vars` for any literals).
- `src/utils/sms-segments.js` — shared util, used by both the inline page script and the `/api/sms-gate/send` endpoint.

### 5.2 Middleware

`middleware.ts` `protectedPaths` and `matcher` get a new entry: `/sms`. The middleware checks the session cookie only — the page client-side then calls `/state` and handles allowlist enforcement (403 → redirect to `/`).

### 5.3 Segment / encoding util (`sms-segments.js`)

Three named exports:

```js
export function encoding(text)        // 'GSM-7' | 'UCS-2'
export function segments(text)        // integer
export function transliterate(text)   // text with Polish accents stripped
```

**Encoding detection**: text is GSM-7 iff every character is in the GSM 03.38 base set or its single-shift extension table (`{}`, `[]`, `~`, `\`, `|`, `^`, `€`). Otherwise UCS-2.

**Segment counting**:
- GSM-7 single segment: ≤ 160 chars (extension chars count as 2 each toward the 160 limit).
- GSM-7 multipart: 153 chars per segment (UDH overhead).
- UCS-2 single segment: ≤ 70 code units.
- UCS-2 multipart: 67 code units per segment.

**Transliteration map** (uppercase + lowercase): `ą↔a, ć↔c, ę↔e, ł↔l, ń↔n, ó↔o, ś↔s, ź↔z, ż↔z`.

The util is pure JS (no Node-only APIs) so it can be imported both into the inline browser script and into the API function.

### 5.4 Logout integration

The existing logout button on other pages keeps working. The `/sms` page should include a small "Wyloguj" link in the header so a sender can step out without going via another admin page.

## 6. Environment variables

| Var | Where | Purpose |
|---|---|---|
| `SMS_GATE_BUDGET` | Vercel + `.env.local` | Integer total segment budget. Defaults to `1100` if unset. |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` | Required for SMS-gate endpoints (RLS on `sms_gate_usage`). |
| `TWILIO_ACCOUNT_SID` | already set | Twilio. |
| `TWILIO_AUTH_TOKEN` | already set | Twilio. |
| `TWILIO_PHONE_NUMBER` | already set | Twilio sender. |

## 7. Threat model & security

**Sensitivity**: `sms_gate_usage` rows contain SMS bodies (potentially private), recipient phone numbers, and member identifiers. `members.can_send_sms` is an authorisation flag.

**Defences**:

- **Authentication** — every API endpoint runs `verifyUser(req)`, which requires a valid `zatyrani_session` cookie matching a non-expired row in `sessions`.
- **Authorisation** — every API endpoint additionally checks `members.can_send_sms = true` for the session's member. Disabling a sender is a single SQL update.
- **Rate of abuse** — even an authorised sender is bounded by `SMS_GATE_BUDGET`. Lifetime cap, manually reset.
- **Server-only secrets** — Supabase service-role key and Twilio credentials are only referenced in API functions; they never reach the browser bundle (verified in code review during design).
- **Defence in depth** — `sms_gate_usage` has RLS enabled with no policies. Even if the anon key leaks, it cannot read or write this table.
- **No client-trusted segment math** — the API recomputes `encoding` and `segments` from `body` server-side. The client's number is purely cosmetic.

**Known limitations / future work**:

- The existing `members` table still has RLS disabled (consistent with the rest of the project). Phone numbers there are theoretically reachable by anyone holding the anon key. Out of scope for this spec; a project-wide RLS pass is the proper fix.
- Single-sender race: if two allowlisted members send simultaneously near the budget cap, one or both may overshoot by a few segments. Acceptable for the realistic single-admin use case.

## 8. Testing notes (manual)

These are the paths the implementer must exercise before merging:

- **Auth gate** — log out, hit `/sms` → redirected to `/`.
- **Allowlist gate** — log in as a member with `can_send_sms = false`, hit `/sms` → `state` returns 403, page redirects.
- **Allowlist pass** — flip `can_send_sms = true`, page renders with members list and budget.
- **Encoding detection** — type "Czesc" → GSM-7, no warning. Type "Cześć" → UCS-2 warning appears with savings hint.
- **Transliteration** — click "Usuń polskie znaki" → textarea text becomes "Czesc", encoding flips to GSM-7, warning disappears.
- **Segment math** — body of 71 Polish chars to 1 recipient debits 2 segments. Body of "Cześć" (5 chars, UCS-2) debits 1 segment.
- **Phone dedupe** — temporarily set two members to share a phone; recipients list shows one entry.
- **Budget cap** — set `used = budget - 1` (insert a fake `status='sent'` row), try to send a 2-segment message → `409 budget_exceeded`, no Twilio call.
- **Failure handling** — point Twilio at a guaranteed-failing number for one row; row records `status='failed'`, budget unchanged, UI shows ✗, loop continues.
- **Progress UI** — sending to 5+ recipients shows live ticking pending → ✓.
- **Summary** — after a mixed batch, summary modal lists the failed recipients with their phone numbers.

## 9. Open questions

None. Ready for implementation plan.
