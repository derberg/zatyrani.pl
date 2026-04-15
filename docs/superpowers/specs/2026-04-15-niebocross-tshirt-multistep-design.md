# NieboCross T-shirt Ordering — Multi-item Multistep Flow

**Date:** 2026-04-15
**Status:** Design approved, pending implementation plan

## Goal

Re-enable t-shirt ordering at `/niebocross/koszulka` (currently showing a static "Zamówienia zamknięte" notice) and enhance the existing single-item flow to support ordering 1–10 t-shirts in one order, paid via a single SIBS transaction. Flow uses a 3-step wizard modelled after the Wilczy Półmaraton registration flow.

## Scope

**In scope:**
- DB migration: add `order_group_id` and `payment_link` columns to `niebocross_tshirt_payments`.
- Rewrite `POST /api/niebocross/tshirt/purchase` to accept an `items[]` array and create N grouped rows + one SIBS payment.
- New `GET /api/niebocross/tshirt/purchase/[id]` for cached session retrieval (mirrors existing registration payment pattern).
- Update webhook to apply success/failure to all rows in a group.
- Rewrite `/niebocross/koszulka` page as a 3-step wizard (Polish only — no English version exists for this page).
- Update `DATABASE_SCHEMA.md` to document the new columns.

**Out of scope:**
- SMS participant-link flow (`?id=` query param) — the prior campaign already ran; the new flow is general-public only. The `?id=` param is silently ignored.
- English translation of the page — no existing `/en/niebocross/koszulka.astro`, and not adding one.
- "Already ordered" participant check — not applicable without participant linkage.
- Shipping — explicitly not offered; acknowledgement copy clarifies pickup-only.
- Automated tests — none exist for `api/niebocross/*`; manual verification only, matching project convention.

## Database changes

Migration (user runs manually in Supabase):

```sql
ALTER TABLE niebocross_tshirt_payments
  ADD COLUMN order_group_id UUID,
  ADD COLUMN payment_link TEXT;

CREATE INDEX idx_tshirt_payments_order_group
  ON niebocross_tshirt_payments(order_group_id);
```

**Semantics:**
- `order_group_id`: groups the rows of a multi-item order. The first-inserted ("primary") row's `id` is used as the SIBS `merchantTransactionId`; all rows in the order share `order_group_id = primary.id` (including the primary row itself).
- `payment_link`: cached SIBS `formContext` token. Populated on the primary row only when the SIBS transaction is created. Matches the pattern in `niebocross_payments` / `event_payments`.
- Legacy single-row records from the SMS campaign have `order_group_id = NULL` and `payment_link = NULL`. Webhook handles them via a fallback `WHERE id = :x OR order_group_id = :x`, so they remain functional and no data migration is needed.

`DATABASE_SCHEMA.md` gets updated to document both columns plus the caching behavior.

## API changes

### `POST /api/niebocross/tshirt/purchase` (rewritten)

**Request:**
```json
{
  "firstName": "Jan",
  "lastName": "Kowalski",
  "email": "jan@example.com",
  "phoneNumber": "+48 600 000 000",
  "items": [{ "tshirtSize": "L" }, { "tshirtSize": "M" }]
}
```

**Validation:**
- Required buyer fields non-empty.
- `items` length between 1 and 10 inclusive.
- Every `items[i].tshirtSize` must be in `TSHIRT_SIZES` (from `api/niebocross/utils/constants.js`).

**Behavior:**
1. Compute `totalAmount = items.length * 60`.
2. Insert N rows with buyer info + individual `tshirt_size`, status `pending`. Record the first-inserted row as primary.
3. Update all N rows: `UPDATE ... SET order_group_id = :primaryId WHERE id IN (...)`.
4. Call `createPaymentLink({ paymentId: primary.id, amount: totalAmount, description: "TSHIRT <firstName> <lastName> (<N>x)" })`.
5. Update primary row: `SET transaction_id = :tx, payment_link = :formContext WHERE id = :primaryId`.
6. Return `{ success: true, payment: { id, amount, formContext, transactionID } }`.

**Failure handling:** If the SIBS call throws, delete the N inserted rows so no orphan pending records remain (improvement over the current single-row flow, which leaves orphans).

### `GET /api/niebocross/tshirt/purchase?participantId=...` (removed)

Handler `handleGetParticipant` is deleted. The `?id=` query param on the page is silently ignored.

### File restructure

To match the existing sibling-route pattern (see `api/niebocross/payment/webhook.js` + `api/niebocross/payment/[id].js` inside `payment/`), the t-shirt routes move into a folder:

- `api/niebocross/tshirt/purchase.js` → `api/niebocross/tshirt/purchase/index.js` (POST handler, rewritten per above)
- `api/niebocross/tshirt/purchase/[id].js` — new file for GET by id

This avoids the `purchase.js` file + `purchase/` directory coexistence question and matches project convention.

### `GET /api/niebocross/tshirt/purchase/[id]` (new)

New file: `api/niebocross/tshirt/purchase/[id].js`. Mirrors `api/niebocross/payment/[id].js`.

**Behavior:**
- Look up primary row by `id`.
- If `payment_status === 'pending'` and both `transaction_id` and `payment_link` populated → return `{ success: true, payment: { formContext: payment_link, transactionID: transaction_id, amount, itemCount } }` without calling SIBS.
- If `payment_status === 'paid'` → return `{ success: true, paid: true }`.
- If primary row not found → 404.
- If pending but cache is missing (edge case) → regenerate a SIBS session for `amount`, write `transaction_id` + `payment_link` to the primary row, return fresh values.

`amount` is computed as `count(rows in group) * 60`. `itemCount` returned for summary rendering if the frontend ever needs it.

### Webhook changes

File: `api/niebocross/payment/webhook.js`, function `handleTshirtPaymentWebhook`.

- Look up primary row by `merchantTransactionId` (same as today).
- On `isPaymentSuccess === true`:
  `UPDATE niebocross_tshirt_payments SET payment_status='paid', transaction_id=$tx, paid_at=NOW() WHERE id = :paymentId OR order_group_id = :paymentId`.
- On failure:
  `DELETE FROM niebocross_tshirt_payments WHERE id = :paymentId OR order_group_id = :paymentId`.
- The `OR` clause keeps legacy single-row records (with `order_group_id = NULL`) working as before.

## Page flow (`/niebocross/koszulka`)

Keep the `<Layout>` + `<NieboCrossHeader>` wrappers and the t-shirt image gallery. Remove the "Zamówienia zamknięte" notice, the `#registration-explanation` block, and the old hidden single-form markup + its JS. Render all three steps in the DOM and toggle visibility with the `hidden` class, matching the Wilczy pattern in `src/components/wilczypolmaraton/RegistrationContent.astro` and `AddParticipantsContent.astro`.

### Step 1 — Koszulki (items)

- Heading: "Wybierz koszulki".
- Dynamic list of item rows (min 1, max 10). Each row:
  - Label "Koszulka #{n}".
  - `<select>` for size, with `<optgroup>` for kids (116, 128, 134, 140, 146, 152) and adult (XS, S, M, L, XL, XXL). Reuse the structure already in the existing file.
  - "Usuń" button (hidden/disabled when only one row remains).
- "+ Dodaj kolejną koszulkę" button, disabled at 10 rows.
- Live total below the list: "Razem: {N × 60} zł ({N} szt.)".
- "Dalej →" button, disabled until every row has a size selected.

### Step 2 — Dane zamawiającego

- Heading: "Twoje dane".
- Fields, all required: Imię, Nazwisko, Email, Numer telefonu.
- RODO consent checkbox (required).
- "← Wstecz" button → step 1. "Dalej →" button:
  - Validates fields client-side.
  - Calls `POST /api/niebocross/tshirt/purchase` with buyer + items.
  - On success: stashes `{ id, formContext, transactionID, amount }` in JS state and advances to step 3.
  - On error: shows inline error, keeps user on step 2. API has already cleaned up any inserted rows.
  - Button disabled during the fetch to prevent double-submits.

### Step 3 — Podsumowanie + płatność

- Heading: "Podsumowanie i płatność".
- Summary card:
  - Buyer line: "Zamawiający: {firstName} {lastName} · {email} · {phoneNumber}".
  - Items list: "1× Koszulka L", "1× Koszulka M", etc. (aggregated per size).
  - Total: "Razem: {amount} zł".
- Delivery acknowledgement (required checkbox):
  > "Przyjmuję do wiadomości, że koszulka nie jest wysyłana kurierem / pocztą i że cena nie zawiera kosztów wysyłki. Odbiór koszulki: osobiście po kontakcie z lukasz@zatyrani.pl, lub podczas jednego z najbliższych biegów, w których uczestniczymy — [Bieg Lisa](https://dostartu.pl/permalink-v15465) oraz [15. Bieg im. ks. Konstantego Damrota](https://competitions.timekeeper.pl/15-bieg-im-ks-konstantego-damrota)."
- Payment widget container: hidden until the acknowledgement is ticked. On check, inject the SIBS `paymentSPG` form using the cached `formContext` + `transactionID` (same DOM mechanism as the existing page at `koszulka.astro:158-181`), `amount = cached total * 100` in minor units, `redirectUrl = 'https://zatyrani.pl/niebocross/koszulka?status=success'`, `paymentMethodList: ['CARD', 'BLIK']`.
- No "back" button on step 3. Editing the cart means refreshing the page (aborted SIBS sessions expire on their own).

### Success state

When the page loads with `?status=success` (SIBS post-payment redirect), bypass the wizard and show a standalone success card:

> "Dziękujemy za zamówienie! Płatność została przyjęta. Skontaktujemy się z Tobą w sprawie odbioru koszulki."

### Contact footer

Keep the existing "Pytania? Problemy…" block with phone and email — unchanged.

## Edge cases

| Case | Behavior |
|---|---|
| User reloads step 3 (loses JS state) | Page restarts at step 1. Pending rows + SIBS session are abandoned; SIBS lets them expire. |
| SIBS API call fails at step 2→3 | Delete the N inserted rows, show inline error on step 2, user retries. |
| User closes browser mid-widget | Pending rows stay `pending` until SIBS webhook fires `Failed` (which deletes them). Matches current behavior. |
| User clicks "+ dodaj kolejną" past 10 | Button disabled at 10. |
| User tries to remove the only item | "Usuń" hidden/disabled when only one row remains. |
| Double-click "Dalej" on step 2 | Button disabled during fetch, re-enabled on error. |
| Legacy single-row records (SMS campaign) | Webhook's `WHERE id = :x OR order_group_id = :x` handles both cases — backward-compatible. |
| `?status=success` redirect but payment actually failed | SIBS webhook drives the true DB status. Page shows success optimistically; the DB reflects reality when the webhook fires. Matches current behavior. |
| Old SMS link (`?id=...`) clicked after relaunch | `?id=` is silently ignored; wizard loads at step 1 normally. |

## Code cleanup

Remove from `src/pages/niebocross/koszulka.astro`:
- "Zamówienia zamknięte" notice block (lines 36–43)
- `#registration-explanation` block (lines 31–33)
- Old hidden single-form card (lines 45–129)
- Old `init()` JS with participant-ID lookup (lines 183–248)
- Old single-item submit handler (lines 250–287)

Remove from the old `api/niebocross/tshirt/purchase.js` (as it's moved to `purchase/index.js`):
- `handleGetParticipant` (lines 43–89 of the current file) — not carried over
- Single-size POST body handling — replaced with `items[]` logic
- The old file is deleted; the rewritten POST handler lives at `purchase/index.js`

Keep unchanged:
- `api/niebocross/utils/sibs.js`, `api/niebocross/utils/constants.js` (reuse `TSHIRT_SIZES`, `createPaymentLink`)
- Webhook decryption and SIBS integration plumbing
- `scripts/send-tshirt-campaign.js` (not touched)

## Manual verification plan

1. Order 1 t-shirt → pay → verify single row marked `paid`, `order_group_id = id`.
2. Order 3 t-shirts → pay → verify all 3 rows marked `paid`, share same `order_group_id`.
3. Order 2 t-shirts → simulate SIBS failure mid-transaction → verify rows deleted when webhook fires `Failed`.
4. Hit the page with an old `?id=...` SMS link → verify wizard loads normally, param ignored.
5. Hit `?status=success` → verify success card shows.
6. Reload step 3 → verify page restarts at step 1 (expected abandoned-session behavior).

## Open dependencies / manual steps

- **User runs the SQL migration** in Supabase before code deploy. Implementation plan gates the frontend/backend rollout on this.
