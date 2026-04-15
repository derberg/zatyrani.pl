# NieboCross T-shirt Multi-item Multistep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-enable the NieboCross t-shirt ordering page and upgrade it to a 3-step wizard that lets one buyer order 1–10 t-shirts in a single SIBS transaction.

**Architecture:** Add `order_group_id` + `payment_link` columns to `niebocross_tshirt_payments`. Move the existing `purchase.js` into `purchase/index.js`, rewrite its `POST` handler to accept an `items[]` array and create N grouped rows + one SIBS payment. Add a new `GET /[id].js` endpoint that returns the cached SIBS session. Update the webhook to update/delete all rows in a group. Rewrite the Polish-only `/niebocross/koszulka` page as a 3-step wizard that mirrors the Wilczy Półmaraton flow.

**Tech Stack:** Astro v4 (SSG), Vercel serverless functions (JS), Supabase (PostgreSQL), SIBS Gateway.

**Spec:** [docs/superpowers/specs/2026-04-15-niebocross-tshirt-multistep-design.md](../specs/2026-04-15-niebocross-tshirt-multistep-design.md)

---

## Important Context

### Existing code to reference (read before implementing):

- [api/niebocross/tshirt/purchase.js](../../api/niebocross/tshirt/purchase.js) — current single-shirt POST handler. Will be moved to `purchase/index.js` and rewritten.
- [api/niebocross/payment/[id].js](../../api/niebocross/payment/[id].js) — the cache-and-return pattern for SIBS `formContext` + `transactionID`. New `tshirt/purchase/[id].js` mirrors it.
- [api/niebocross/payment/webhook.js](../../api/niebocross/payment/webhook.js) — SIBS encrypted webhook. `handleTshirtPaymentWebhook` lives here (~lines 39-73) and gets updated.
- [api/niebocross/utils/sibs.js](../../api/niebocross/utils/sibs.js) — `createPaymentLink({ paymentId, amount, description })` used as-is. `amount` is in major PLN units (60.00 for 60 PLN).
- [api/niebocross/utils/constants.js](../../api/niebocross/utils/constants.js) — `TSHIRT_SIZES` array.
- [src/pages/niebocross/koszulka.astro](../../src/pages/niebocross/koszulka.astro) — page to rewrite. Current widget config at lines 158-181 shows how to inject `paymentSPG` form.
- [src/components/wilczypolmaraton/RegistrationContent.astro](../../src/components/wilczypolmaraton/RegistrationContent.astro) — reference for multistep step show/hide + `define:vars` pattern.
- [src/components/niebocross/NieboCrossHeader.astro](../../src/components/niebocross/NieboCrossHeader.astro) — header wrapper used by the page. Do not modify.

### SIBS widget conventions:

- The widget loaded from `https://api.sibsgateway.com/assets/js/widget.js?id=${transactionID}`.
- The `spg-config` takes `amount: { value: <minor units>, currency: 'PLN' }` — that's PLN × 100.
- The `createPaymentLink` helper takes `amount` in **major units** (e.g. `60.00`). Don't multiply before passing to it.
- `paymentMethodList: ['CARD', 'BLIK']` — match the current page.

### DB constraints:

- `niebocross_tshirt_payments.tshirt_size` has a CHECK constraint — each row still stores exactly one valid size. Don't try to store comma-separated sizes.
- The table's primary key `id` (UUID) is used as SIBS `merchantTransactionId`.

### Vercel routing note:

Moving `purchase.js` to `purchase/index.js` keeps the external route `/api/niebocross/tshirt/purchase` unchanged for POST. The new `purchase/[id].js` handles GET for `/api/niebocross/tshirt/purchase/:id`. These are siblings inside a folder — matches the existing `payment/webhook.js` + `payment/[id].js` pattern.

### Follow project conventions:

- No automated tests for `api/niebocross/*` routes — manual verification only (matches project convention).
- No server-side rendering — the page stays fully static; all wizard logic is client-side JS inside `<script>`.

---

## File Map

**Create:**

| File | Purpose |
|------|---------|
| `api/niebocross/tshirt/purchase/index.js` | POST handler (moved from `purchase.js`, rewritten for `items[]`) |
| `api/niebocross/tshirt/purchase/[id].js` | GET handler — returns cached SIBS session for a primary row id |

**Modify:**

| File | Change |
|------|--------|
| `api/niebocross/payment/webhook.js` | Update `handleTshirtPaymentWebhook` to update/delete all rows in a group |
| `src/pages/niebocross/koszulka.astro` | Full page rewrite: 3-step wizard |
| `DATABASE_SCHEMA.md` | Document `order_group_id` + `payment_link` columns on `niebocross_tshirt_payments` |

**Delete:**

| File | Reason |
|------|--------|
| `api/niebocross/tshirt/purchase.js` | Moved to `purchase/index.js` |

**Database changes (manual — user runs SQL in Supabase):** Two columns + one index added to `niebocross_tshirt_payments`. Existing rows untouched.

---

## Task 1: Database Migration (Manual Step)

**Files:**
- User runs SQL manually in Supabase; no repo file changes in this task

- [ ] **Step 1: Share the migration SQL with the user**

The user must run this in Supabase SQL editor before any other task deploys. Output this SQL verbatim:

```sql
ALTER TABLE niebocross_tshirt_payments
  ADD COLUMN order_group_id UUID,
  ADD COLUMN payment_link TEXT;

CREATE INDEX idx_tshirt_payments_order_group
  ON niebocross_tshirt_payments(order_group_id);
```

- [ ] **Step 2: Wait for user confirmation**

Ask the user: "Please run the SQL above in Supabase and confirm when done. I'll proceed with Task 2 once you confirm."

Do not proceed until the user explicitly confirms migration completed.

- [ ] **Step 3: Commit placeholder (no repo changes)**

Skip commit for this task — Task 6 will update `DATABASE_SCHEMA.md`.

---

## Task 2: Rewrite POST Handler — Move to `purchase/index.js`

**Files:**
- Create: `api/niebocross/tshirt/purchase/index.js`
- Delete: `api/niebocross/tshirt/purchase.js`

- [ ] **Step 1: Read the current `purchase.js`**

Read [api/niebocross/tshirt/purchase.js](../../api/niebocross/tshirt/purchase.js) in full to understand the original logic.

- [ ] **Step 2: Create `api/niebocross/tshirt/purchase/index.js` with the new multi-item handler**

Write this file exactly:

```javascript
import { createClient } from "@supabase/supabase-js";
import { createPaymentLink } from "../../utils/sibs.js";
import { TSHIRT_SIZES } from "../../utils/constants.js";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }
  return createClient(url, serviceKey);
}

const TSHIRT_PRICE = 60.0;
const MAX_ITEMS_PER_ORDER = 10;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return handleCreatePurchase(req, res);
}

async function handleCreatePurchase(req, res) {
  const supabase = getSupabaseClient();
  let insertedIds = [];

  try {
    const { firstName, lastName, email, phoneNumber, items } = req.body || {};

    if (!firstName || !lastName || !email || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "Wszystkie dane zamawiającego są wymagane (imię, nazwisko, email, telefon)",
      });
    }

    if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS_PER_ORDER) {
      return res.status(400).json({
        success: false,
        error: `Zamówienie musi zawierać od 1 do ${MAX_ITEMS_PER_ORDER} koszulek`,
      });
    }

    for (const item of items) {
      if (!item || !TSHIRT_SIZES.includes(item.tshirtSize)) {
        return res.status(400).json({
          success: false,
          error: "Nieprawidłowy rozmiar koszulki",
        });
      }
    }

    const totalAmount = items.length * TSHIRT_PRICE;

    // Insert N rows, each with one tshirt_size; buyer info duplicated
    const rowsToInsert = items.map((item) => ({
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      tshirt_size: item.tshirtSize,
      amount: TSHIRT_PRICE,
      payment_status: "pending",
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from("niebocross_tshirt_payments")
      .insert(rowsToInsert)
      .select("id");

    if (insertError || !insertedRows || insertedRows.length !== items.length) {
      console.error("Error creating tshirt payment rows:", insertError);
      return res.status(500).json({
        success: false,
        error: "Błąd podczas tworzenia zamówienia",
      });
    }

    insertedIds = insertedRows.map((r) => r.id);
    const primaryId = insertedIds[0];

    // Group all rows under the primary id (including the primary row itself)
    const { error: groupError } = await supabase
      .from("niebocross_tshirt_payments")
      .update({ order_group_id: primaryId })
      .in("id", insertedIds);

    if (groupError) {
      console.error("Error setting order_group_id:", groupError);
      await supabase.from("niebocross_tshirt_payments").delete().in("id", insertedIds);
      return res.status(500).json({
        success: false,
        error: "Błąd podczas tworzenia zamówienia",
      });
    }

    // Create SIBS payment for the total
    const description = `TSHIRT ${firstName} ${lastName} (${items.length}x)`;
    const paymentResult = await createPaymentLink({
      paymentId: primaryId,
      amount: totalAmount,
      description,
    });

    // Cache formContext + transactionID on the primary row
    const { error: cacheError } = await supabase
      .from("niebocross_tshirt_payments")
      .update({
        payment_link: paymentResult.formContext,
        transaction_id: paymentResult.transactionID,
      })
      .eq("id", primaryId);

    if (cacheError) {
      console.error("Error caching SIBS session:", cacheError);
      // Non-fatal: session still usable via formContext/transactionID returned below.
      // The /[id] endpoint can regenerate if cache is missing on next visit.
    }

    return res.status(200).json({
      success: true,
      payment: {
        id: primaryId,
        amount: totalAmount,
        formContext: paymentResult.formContext,
        transactionID: paymentResult.transactionID,
      },
    });
  } catch (error) {
    console.error("Tshirt purchase error:", error);
    // Clean up any rows we inserted before the failure
    if (insertedIds.length > 0) {
      const { error: cleanupErr } = await supabase
        .from("niebocross_tshirt_payments")
        .delete()
        .in("id", insertedIds);
      if (cleanupErr) {
        console.error("Cleanup failed:", cleanupErr);
      }
    }
    return res.status(500).json({
      success: false,
      error: "Wystąpił błąd podczas tworzenia płatności",
    });
  }
}
```

- [ ] **Step 3: Delete the old `purchase.js`**

Run:

```bash
git rm api/niebocross/tshirt/purchase.js
```

- [ ] **Step 4: Sanity-check the module resolves**

Run a quick syntax check:

```bash
node --check api/niebocross/tshirt/purchase/index.js
```

Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add api/niebocross/tshirt/purchase/index.js
git commit -m "feat(niebocross-tshirt): rewrite POST handler for multi-item orders

Moves purchase.js into purchase/index.js and accepts an items[] array,
creating N grouped rows in niebocross_tshirt_payments and a single SIBS
payment for the total. Sets order_group_id on all rows in the order and
caches the SIBS formContext + transactionID on the primary row."
```

---

## Task 3: Update Webhook for Order Groups

**Files:**
- Modify: `api/niebocross/payment/webhook.js` (function `handleTshirtPaymentWebhook`, lines ~39-73)

- [ ] **Step 1: Read the existing webhook**

Read [api/niebocross/payment/webhook.js](../../api/niebocross/payment/webhook.js) in full to understand the full flow.

- [ ] **Step 2: Replace `handleTshirtPaymentWebhook`**

In `api/niebocross/payment/webhook.js`, replace the existing `handleTshirtPaymentWebhook` function (lines 39-73 in the current file) with:

```javascript
/**
 * Handle webhook for tshirt payment (separate table).
 * On success: update all rows in the order group to paid.
 * On failure: delete all rows in the order group (no stale pending rows).
 * Legacy single-row records (order_group_id IS NULL) are handled via the OR clause.
 */
async function handleTshirtPaymentWebhook(supabase, paymentId, transactionId, isPaymentSuccess) {
  // Primary row lookup — the webhook's merchantTransactionId is the primary row's id
  const { data: primaryRow, error: lookupError } = await supabase
    .from("niebocross_tshirt_payments")
    .select("id")
    .eq("id", paymentId)
    .single();

  if (lookupError || !primaryRow) {
    return false;
  }

  console.log('[Webhook] Found tshirt payment primary:', paymentId);

  if (isPaymentSuccess) {
    const { error: updateError } = await supabase
      .from("niebocross_tshirt_payments")
      .update({
        payment_status: 'paid',
        transaction_id: transactionId,
        paid_at: new Date().toISOString(),
      })
      .or(`id.eq.${paymentId},order_group_id.eq.${paymentId}`);

    if (updateError) {
      console.error('[Webhook] Error marking tshirt group paid:', updateError);
    } else {
      console.log('[Webhook] Tshirt order group marked paid:', paymentId);
    }
  } else {
    const { error: deleteError } = await supabase
      .from("niebocross_tshirt_payments")
      .delete()
      .or(`id.eq.${paymentId},order_group_id.eq.${paymentId}`);

    if (deleteError) {
      console.error('[Webhook] Error deleting failed tshirt group:', deleteError);
    } else {
      console.log('[Webhook] Tshirt order group deleted (failed):', paymentId);
    }
  }

  return true;
}
```

- [ ] **Step 3: Sanity-check syntax**

```bash
node --check api/niebocross/payment/webhook.js
```

Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add api/niebocross/payment/webhook.js
git commit -m "feat(niebocross-tshirt): webhook updates all rows in order group

On payment success: update all rows where id = paymentId OR
order_group_id = paymentId. On failure: delete all matching rows.
The OR clause keeps legacy single-row records (with NULL
order_group_id) working as before — backward compatible."
```

---

## Task 4: New `GET /api/niebocross/tshirt/purchase/[id]` (Cache Retrieval)

**Files:**
- Create: `api/niebocross/tshirt/purchase/[id].js`

- [ ] **Step 1: Read the niebocross payment [id] handler for reference**

Read [api/niebocross/payment/[id].js](../../api/niebocross/payment/[id].js) in full.

- [ ] **Step 2: Create `api/niebocross/tshirt/purchase/[id].js`**

Write this file exactly:

```javascript
import { createClient } from "@supabase/supabase-js";
import { createPaymentLink } from "../../utils/sibs.js";

const TSHIRT_PRICE = 60.0;

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }
  return createClient(url, serviceKey);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const primaryId = req.query.id;
    if (!primaryId) {
      return res.status(400).json({ success: false, error: "Missing id" });
    }

    const supabase = getSupabaseClient();

    // Fetch the primary row
    const { data: primary, error: primaryError } = await supabase
      .from("niebocross_tshirt_payments")
      .select("id, first_name, last_name, payment_status, payment_link, transaction_id")
      .eq("id", primaryId)
      .single();

    if (primaryError || !primary) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    if (primary.payment_status === "paid") {
      return res.status(200).json({ success: true, paid: true });
    }

    if (primary.payment_status === "failed") {
      return res.status(410).json({ success: false, error: "Payment failed or cancelled" });
    }

    // Count items in the group to compute amount
    const { count: itemCount, error: countError } = await supabase
      .from("niebocross_tshirt_payments")
      .select("id", { count: "exact", head: true })
      .or(`id.eq.${primaryId},order_group_id.eq.${primaryId}`);

    if (countError || !itemCount) {
      console.error("Error counting order group:", countError);
      return res.status(500).json({ success: false, error: "Błąd odczytu zamówienia" });
    }

    const amount = itemCount * TSHIRT_PRICE;

    // Cached session — return it directly
    if (primary.payment_link && primary.transaction_id) {
      return res.status(200).json({
        success: true,
        payment: {
          id: primary.id,
          amount,
          itemCount,
          formContext: primary.payment_link,
          transactionID: primary.transaction_id,
        },
      });
    }

    // Pending but cache missing — regenerate a SIBS session
    const description = `TSHIRT ${primary.first_name} ${primary.last_name} (${itemCount}x)`;
    const paymentResult = await createPaymentLink({
      paymentId: primary.id,
      amount,
      description,
    });

    await supabase
      .from("niebocross_tshirt_payments")
      .update({
        payment_link: paymentResult.formContext,
        transaction_id: paymentResult.transactionID,
      })
      .eq("id", primary.id);

    return res.status(200).json({
      success: true,
      payment: {
        id: primary.id,
        amount,
        itemCount,
        formContext: paymentResult.formContext,
        transactionID: paymentResult.transactionID,
      },
    });
  } catch (error) {
    console.error("Tshirt purchase GET error:", error);
    return res.status(500).json({ success: false, error: "Wystąpił błąd" });
  }
}
```

- [ ] **Step 3: Sanity-check syntax**

```bash
node --check api/niebocross/tshirt/purchase/[id].js
```

Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add api/niebocross/tshirt/purchase/[id].js
git commit -m "feat(niebocross-tshirt): add GET endpoint for cached SIBS session

Returns the cached formContext + transactionID for a primary row id so
returning visitors don't trigger a new SIBS API call. Falls back to
regenerating the session if cache is missing. Returns { paid: true }
if the order is already paid."
```

---

## Task 5: Rewrite the `/niebocross/koszulka` Page

**Files:**
- Modify (full rewrite): `src/pages/niebocross/koszulka.astro`

- [ ] **Step 1: Read the existing page**

Read [src/pages/niebocross/koszulka.astro](../../src/pages/niebocross/koszulka.astro) in full. Keep in mind:
- The `<Layout>`, `<NieboCrossHeader>`, top t-shirt image gallery, and contact footer must be preserved.
- The "Zamówienia zamknięte" notice, registration explanation, old hidden form, and old JS are all removed.

- [ ] **Step 2: Read the Wilczy multistep reference**

Read [src/components/wilczypolmaraton/RegistrationContent.astro](../../src/components/wilczypolmaraton/RegistrationContent.astro) to see the step show/hide pattern. You don't need to match it 1:1 — this page is simpler — but align on classes and aesthetic.

- [ ] **Step 3: Rewrite the page**

Replace the full contents of `src/pages/niebocross/koszulka.astro` with:

```astro
---
import Layout from "../../layouts/Layout.astro";
import NieboCrossHeader from "../../components/niebocross/NieboCrossHeader.astro";
import { t } from "../../utils/i18n";
---

<Layout
  title="Koszulka pamiątkowa - NieboCross 2026"
  description="Zamów pamiątkową koszulkę sportową z charytatywnego biegu NieboCross 2026"
  ogImage="/niebocross_og.jpg"
  t={t}
>
  <NieboCrossHeader t={t} />

  <section class="bg-gradient-to-b from-slate-50 to-white py-10 px-4">
    <div class="mx-auto max-w-3xl">

      <!-- Title -->
      <div class="text-center mb-8">
        <h2 class="text-3xl font-bold text-slate-900 sm:text-4xl">Koszulka pamiątkowa</h2>
        <p class="mt-2 text-lg text-slate-600">Sportowa koszulka z dedykowanym wzorem NieboCross 2026</p>
      </div>

      <!-- T-shirt images -->
      <div class="flex flex-wrap justify-center gap-4 mb-8">
        <img src="/niebocross/tshirt-front.png" alt="Koszulka NieboCross - przód" class="w-full max-w-xs rounded-2xl border border-slate-200 shadow-lg" />
        <img src="/niebocross/tshirt-back.png" alt="Koszulka NieboCross - tył" class="w-full max-w-xs rounded-2xl border border-slate-200 shadow-lg" />
      </div>

      <!-- Success state (shown when ?status=success) -->
      <div id="success-state" class="hidden rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-8 text-center text-emerald-800">
        <p class="text-xl font-bold mb-2">Dziękujemy za zamówienie!</p>
        <p>Płatność została przyjęta. Skontaktujemy się z Tobą w sprawie odbioru koszulki.</p>
      </div>

      <!-- Wizard container -->
      <div id="wizard" class="rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-6 sm:p-8">

        <!-- ========== STEP 1: Koszulki ========== -->
        <div id="step1" class="space-y-5">
          <h3 class="text-xl font-bold text-slate-900">Wybierz koszulki</h3>
          <p class="text-sm text-slate-600">Każda koszulka kosztuje 60 zł. Możesz zamówić do 10 sztuk.</p>

          <div id="items-list" class="space-y-3">
            <!-- Item rows injected here -->
          </div>

          <template id="item-row-template">
            <div class="item-row rounded-xl ring-1 ring-slate-200 p-4 space-y-2">
              <div class="flex items-center justify-between">
                <span class="item-label text-sm font-semibold text-slate-700">Koszulka #1</span>
                <button type="button" class="remove-item-btn hidden text-sm text-red-600 hover:underline">Usuń</button>
              </div>
              <select class="item-size block w-full rounded-lg border-2 border-emerald-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2">
                <option value="">— wybierz rozmiar —</option>
                <optgroup label="Dziecięce">
                  <option value="116">116</option>
                  <option value="128">128</option>
                  <option value="134">134</option>
                  <option value="140">140</option>
                  <option value="146">146</option>
                  <option value="152">152</option>
                </optgroup>
                <optgroup label="Dorosłe">
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                </optgroup>
              </select>
            </div>
          </template>

          <button type="button" id="add-item-btn"
            class="w-full rounded-lg border-2 border-dashed border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed">
            + Dodaj kolejną koszulkę
          </button>

          <div class="flex items-center justify-between border-t border-slate-200 pt-4">
            <span class="text-sm text-slate-600">Razem:</span>
            <span id="step1-total" class="text-lg font-bold text-slate-900">0 zł (0 szt.)</span>
          </div>

          <button type="button" id="step1-next-btn"
            class="w-full rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            disabled>
            Dalej →
          </button>
        </div>

        <!-- ========== STEP 2: Dane zamawiającego ========== -->
        <div id="step2" class="hidden space-y-5">
          <h3 class="text-xl font-bold text-slate-900">Twoje dane</h3>

          <div>
            <label for="firstName" class="block text-sm font-semibold text-slate-700 mb-1">Imię <span class="text-red-500">*</span></label>
            <input type="text" id="firstName" required
              class="block w-full rounded-lg border-2 border-emerald-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2" />
          </div>

          <div>
            <label for="lastName" class="block text-sm font-semibold text-slate-700 mb-1">Nazwisko <span class="text-red-500">*</span></label>
            <input type="text" id="lastName" required
              class="block w-full rounded-lg border-2 border-emerald-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2" />
          </div>

          <div>
            <label for="email" class="block text-sm font-semibold text-slate-700 mb-1">Email <span class="text-red-500">*</span></label>
            <input type="email" id="email" required
              class="block w-full rounded-lg border-2 border-emerald-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2" />
          </div>

          <div>
            <label for="phoneNumber" class="block text-sm font-semibold text-slate-700 mb-1">Numer telefonu <span class="text-red-500">*</span></label>
            <input type="tel" id="phoneNumber" required
              class="block w-full rounded-lg border-2 border-emerald-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2" />
          </div>

          <div>
            <label class="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" id="rodoAccepted" required
                class="mt-1 rounded border-emerald-300 border-2 text-emerald-600 focus:ring-emerald-500" />
              <span class="text-sm text-slate-700">Wyrażam zgodę na przetwarzanie moich danych osobowych w celu realizacji zamówienia koszulki. <span class="text-red-500">*</span></span>
            </label>
          </div>

          <div id="step2-error" class="hidden rounded-xl bg-red-50 ring-1 ring-red-200 p-3 text-sm text-red-700"></div>

          <div class="flex gap-3">
            <button type="button" id="step2-back-btn"
              class="flex-1 rounded-lg border-2 border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              ← Wstecz
            </button>
            <button type="button" id="step2-next-btn"
              class="flex-1 rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed">
              Dalej →
            </button>
          </div>
        </div>

        <!-- ========== STEP 3: Podsumowanie + płatność ========== -->
        <div id="step3" class="hidden space-y-5">
          <h3 class="text-xl font-bold text-slate-900">Podsumowanie i płatność</h3>

          <div class="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 space-y-3 text-sm">
            <div>
              <div class="font-semibold text-slate-700">Zamawiający:</div>
              <div id="summary-buyer" class="text-slate-600"></div>
            </div>
            <div>
              <div class="font-semibold text-slate-700">Koszulki:</div>
              <ul id="summary-items" class="list-disc list-inside text-slate-600"></ul>
            </div>
            <div class="flex justify-between border-t border-slate-200 pt-2">
              <span class="font-semibold text-slate-700">Razem:</span>
              <span id="summary-total" class="font-bold text-slate-900"></span>
            </div>
          </div>

          <div class="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-4">
            <label class="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" id="deliveryConsent" required
                class="mt-1 rounded border-amber-400 border-2 text-emerald-600 focus:ring-emerald-500" />
              <span class="text-sm text-slate-700 leading-relaxed">
                Przyjmuję do wiadomości, że koszulka nie jest wysyłana kurierem / pocztą i że cena nie zawiera kosztów wysyłki. Odbiór koszulki: osobiście po kontakcie z <a href="mailto:lukasz@zatyrani.pl" class="underline font-semibold">lukasz@zatyrani.pl</a>, lub podczas jednego z najbliższych biegów, w których uczestniczymy — <a href="https://dostartu.pl/permalink-v15465" target="_blank" rel="noopener" class="underline font-semibold">Bieg Lisa</a> oraz <a href="https://competitions.timekeeper.pl/15-bieg-im-ks-konstantego-damrota" target="_blank" rel="noopener" class="underline font-semibold">15. Bieg im. ks. Konstantego Damrota</a>. <span class="text-red-500">*</span>
              </span>
            </label>
          </div>

          <div id="payment-form-container" class="min-h-[400px]"></div>

          <div id="step3-error" class="hidden rounded-xl bg-red-50 ring-1 ring-red-200 p-3 text-sm text-red-700"></div>
        </div>
      </div>

      <!-- Contact info -->
      <div class="mt-6 text-center text-sm text-slate-500 leading-relaxed">
        <p>Pytania? Problemy z zamówieniem? Skontaktuj się z nami:</p>
        <p class="mt-1 font-semibold text-slate-700">
          <a href="tel:+48784640977" class="hover:text-emerald-600">784 640 977</a>
          &nbsp;·&nbsp;
          <a href="mailto:biuro@zatyrani.pl" class="hover:text-emerald-600">biuro@zatyrani.pl</a>
        </p>
      </div>
    </div>
  </section>
</Layout>

<script>
  const API_BASE = '/api/niebocross/tshirt/purchase';
  const MAX_ITEMS = 10;
  const PRICE_PER_ITEM = 60;

  // ─── State ────────────────────────────────────────────────
  const state = {
    items: [{ size: '' }],  // list of { size }
    buyer: null,            // { firstName, lastName, email, phoneNumber } after step 2
    payment: null,          // { id, amount, formContext, transactionID } after step 2 POST
  };

  // ─── Helpers ──────────────────────────────────────────────
  function show(stepId) {
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.add('hidden');
    document.getElementById(stepId).classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderItems() {
    const listEl = document.getElementById('items-list');
    const template = document.getElementById('item-row-template');
    listEl.innerHTML = '';

    state.items.forEach((item, i) => {
      const clone = template.content.firstElementChild.cloneNode(true);
      clone.querySelector('.item-label').textContent = `Koszulka #${i + 1}`;
      const select = clone.querySelector('.item-size');
      select.value = item.size || '';
      select.addEventListener('change', (e) => {
        state.items[i].size = e.target.value;
        updateStep1UI();
      });
      const removeBtn = clone.querySelector('.remove-item-btn');
      if (state.items.length > 1) {
        removeBtn.classList.remove('hidden');
        removeBtn.addEventListener('click', () => {
          state.items.splice(i, 1);
          renderItems();
          updateStep1UI();
        });
      }
      listEl.appendChild(clone);
    });
  }

  function updateStep1UI() {
    const count = state.items.length;
    const allPicked = state.items.every((it) => it.size);
    document.getElementById('step1-total').textContent = `${count * PRICE_PER_ITEM} zł (${count} szt.)`;
    document.getElementById('step1-next-btn').disabled = !allPicked || count < 1;
    document.getElementById('add-item-btn').disabled = count >= MAX_ITEMS;
  }

  function validateStep2() {
    const fn = document.getElementById('firstName').value.trim();
    const ln = document.getElementById('lastName').value.trim();
    const em = document.getElementById('email').value.trim();
    const ph = document.getElementById('phoneNumber').value.trim();
    const rodo = document.getElementById('rodoAccepted').checked;
    document.getElementById('step2-next-btn').disabled = !(fn && ln && em && ph && rodo);
  }

  function showStep2Error(msg) {
    const el = document.getElementById('step2-error');
    el.innerHTML = msg;
    el.classList.remove('hidden');
  }
  function hideStep2Error() {
    document.getElementById('step2-error').classList.add('hidden');
  }

  function renderSummary() {
    document.getElementById('summary-buyer').textContent =
      `${state.buyer.firstName} ${state.buyer.lastName} · ${state.buyer.email} · ${state.buyer.phoneNumber}`;

    // Aggregate by size
    const counts = {};
    state.items.forEach((it) => {
      counts[it.size] = (counts[it.size] || 0) + 1;
    });
    const ul = document.getElementById('summary-items');
    ul.innerHTML = '';
    Object.entries(counts).forEach(([size, n]) => {
      const li = document.createElement('li');
      li.textContent = `${n}× Koszulka ${size}`;
      ul.appendChild(li);
    });

    document.getElementById('summary-total').textContent = `${state.payment.amount} zł`;
  }

  function renderPaymentWidget() {
    const container = document.getElementById('payment-form-container');
    container.innerHTML = '';
    const script = document.createElement('script');
    script.src = `https://api.sibsgateway.com/assets/js/widget.js?id=${state.payment.transactionID}`;
    script.onload = function () {
      const form = document.createElement('form');
      form.className = 'paymentSPG';
      form.setAttribute('spg-context', state.payment.formContext);
      form.setAttribute('spg-config', JSON.stringify({
        paymentMethodList: ['CARD', 'BLIK'],
        amount: { value: state.payment.amount * 100, currency: 'PLN' },
        language: 'pl',
        redirectUrl: 'https://zatyrani.pl/niebocross/koszulka?status=success'
      }));
      container.appendChild(form);
    };
    script.onerror = function () {
      const el = document.getElementById('step3-error');
      el.innerHTML = 'Nie udało się załadować formularza płatności. Odśwież stronę lub napisz: <a href="mailto:biuro@zatyrani.pl" class="underline font-semibold">biuro@zatyrani.pl</a>';
      el.classList.remove('hidden');
    };
    document.head.appendChild(script);
  }

  // ─── Init ─────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  if (params.get('status') === 'success') {
    document.getElementById('wizard').classList.add('hidden');
    document.getElementById('success-state').classList.remove('hidden');
  } else {
    renderItems();
    updateStep1UI();
  }

  // ─── Step 1 handlers ──────────────────────────────────────
  document.getElementById('add-item-btn').addEventListener('click', () => {
    if (state.items.length >= MAX_ITEMS) return;
    state.items.push({ size: '' });
    renderItems();
    updateStep1UI();
  });

  document.getElementById('step1-next-btn').addEventListener('click', () => {
    show('step2');
    validateStep2();
  });

  // ─── Step 2 handlers ──────────────────────────────────────
  ['firstName', 'lastName', 'email', 'phoneNumber'].forEach((id) => {
    document.getElementById(id).addEventListener('input', validateStep2);
  });
  document.getElementById('rodoAccepted').addEventListener('change', validateStep2);

  document.getElementById('step2-back-btn').addEventListener('click', () => {
    hideStep2Error();
    show('step1');
  });

  document.getElementById('step2-next-btn').addEventListener('click', async () => {
    hideStep2Error();
    const btn = document.getElementById('step2-next-btn');
    btn.disabled = true;
    btn.textContent = 'Przetwarzanie...';

    state.buyer = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim(),
      phoneNumber: document.getElementById('phoneNumber').value.trim(),
    };

    const body = {
      ...state.buyer,
      items: state.items.map((it) => ({ tshirtSize: it.size })),
    };

    try {
      const resp = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Błąd podczas tworzenia zamówienia');
      }
      state.payment = data.payment;
      renderSummary();
      show('step3');
    } catch (err) {
      console.error('Purchase error:', err);
      showStep2Error(err.message || 'Wystąpił błąd. Spróbuj ponownie lub napisz: <a href="mailto:biuro@zatyrani.pl" class="underline font-semibold">biuro@zatyrani.pl</a>');
      btn.disabled = false;
      btn.textContent = 'Dalej →';
      validateStep2();
    }
  });

  // ─── Step 3 handler: consent gates widget injection ───────
  let widgetRendered = false;
  document.getElementById('deliveryConsent').addEventListener('change', (e) => {
    if (e.target.checked && !widgetRendered) {
      widgetRendered = true;
      renderPaymentWidget();
    }
  });
</script>
```

- [ ] **Step 4: Build to verify no syntax errors**

```bash
npm run build
```

Expected: build succeeds. Astro compiles the `.astro` file and emits static output.

- [ ] **Step 5: Commit**

```bash
git add src/pages/niebocross/koszulka.astro
git commit -m "feat(niebocross-tshirt): rewrite koszulka page as 3-step wizard

Replaces the 'Zamówienia zamknięte' notice with a 3-step multi-item
ordering flow (items → buyer details → summary + payment). Pre-generates
the SIBS session at step 2→3 transition so step 3 loads instantly. The
SIBS widget is injected only after the delivery acknowledgement is
ticked. The ?id= SMS-link param is silently ignored."
```

---

## Task 6: Update `DATABASE_SCHEMA.md`

**Files:**
- Modify: `DATABASE_SCHEMA.md`

- [ ] **Step 1: Read the existing schema doc**

Read [DATABASE_SCHEMA.md](../../DATABASE_SCHEMA.md) — the `niebocross_tshirt_payments` section is around lines 147-181.

- [ ] **Step 2: Update the CREATE TABLE block**

In `DATABASE_SCHEMA.md`, replace the CREATE TABLE block for `niebocross_tshirt_payments` (around lines 150-165 in the current file) with:

```sql
CREATE TABLE niebocross_tshirt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES niebocross_participants_v2(id) ON DELETE SET NULL,
  order_group_id UUID,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  tshirt_size VARCHAR(10) NOT NULL CHECK (tshirt_size IN ('116', '128', '134', '140', '146', '152', 'XS', 'S', 'M', 'L', 'XL', 'XXL')),
  amount DECIMAL(10, 2) NOT NULL DEFAULT 60.00,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  payment_link TEXT,
  transaction_id VARCHAR(255),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tshirt_payments_order_group
  ON niebocross_tshirt_payments(order_group_id);
```

- [ ] **Step 3: Update the column list**

Replace the `**Columns:**` list under the `niebocross_tshirt_payments` section with:

```markdown
**Columns:**
- `id` - Unique identifier for the tshirt payment (also used as SIBS merchantTransactionId for the primary row of an order)
- `participant_id` - Optional foreign key to niebocross_participants_v2 (NULL for non-participant purchases; legacy SMS-campaign rows may use this)
- `order_group_id` - Groups multiple rows belonging to a single multi-item order. The primary row's `id` is the group id; all rows in the group (including the primary) share `order_group_id = primary.id`. Legacy single-row records have `order_group_id = NULL` and are handled in the webhook via an `id OR order_group_id` match.
- `first_name` - Buyer's first name
- `last_name` - Buyer's last name
- `email` - Buyer's email
- `phone_number` - Buyer's phone number
- `tshirt_size` - Selected t-shirt size (one size per row)
- `amount` - Per-row payment amount (60.00 PLN); total for an order = `count(rows in group) * 60`
- `payment_status` - Status: `pending`, `paid`, `failed`
- `payment_link` - Cached SIBS `formContext` token, populated on the primary row when the SIBS session is created. Returning visitors hit `/api/niebocross/tshirt/purchase/[id]` which reuses this cached value, skipping a new SIBS API call
- `transaction_id` - SIBS transaction ID (stored on the primary row when the SIBS session is created; webhook stamps it on all rows on success)
- `paid_at` - Payment completion timestamp
- `created_at` - Record creation timestamp
- `updated_at` - Last update timestamp
```

- [ ] **Step 4: Update the `Relationships` section**

If the existing relationship line for `niebocross_tshirt_payments` needs it, keep it as-is. No new foreign key constraints are added (`order_group_id` references another row in the same table but is not a hard FK — keep it as a plain UUID).

- [ ] **Step 5: Commit**

```bash
git add DATABASE_SCHEMA.md
git commit -m "docs: document order_group_id and payment_link on tshirt payments

Adds documentation for the two new columns on niebocross_tshirt_payments
that support multi-item t-shirt orders with a single SIBS transaction
and cached SIBS session retrieval."
```

---

## Task 7: Manual Verification

**Files:**
- None (manual testing)

- [ ] **Step 1: Local build + smoke**

```bash
npm run build
```

Expected: build succeeds, `dist/niebocross/koszulka/index.html` generated.

- [ ] **Step 2: Run dev server**

```bash
npm run dev
```

Navigate to `http://localhost:4321/niebocross/koszulka`. Verify:
- Page renders header, image gallery, step 1 visible, step 2 and step 3 hidden.
- Step 1: "Dalej" disabled until a size is picked. Live total updates to "60 zł (1 szt.)".
- Click "+ Dodaj kolejną koszulkę" → second row appears. Pick different sizes → total updates to "120 zł (2 szt.)". "Usuń" visible on both rows.
- Add 10 items → "+ Dodaj" becomes disabled.
- Remove items back to 1 → "Usuń" button hides on the remaining row.

- [ ] **Step 3: Verify step 2 → step 3 transition hits the API**

With the dev server running, fill buyer fields + check RODO, click "Dalej". In the Network tab you should see a `POST /api/niebocross/tshirt/purchase` with an `items` array. On success, you advance to step 3; summary shows buyer line, aggregated items, total.

- [ ] **Step 4: DB row verification (requires Supabase access)**

In Supabase:

```sql
SELECT id, order_group_id, tshirt_size, payment_status, payment_link, transaction_id
FROM niebocross_tshirt_payments
ORDER BY created_at DESC
LIMIT 20;
```

Verify the most recent N rows (for a 3-item order) share the same `order_group_id` equal to the first row's `id`, all are `pending`, and the primary row has `payment_link` and `transaction_id` set.

- [ ] **Step 5: Consent-gated widget**

On step 3, the payment widget area is empty until the delivery acknowledgement is ticked. Tick it → SIBS widget loads in the container.

- [ ] **Step 6: Complete a real SIBS sandbox payment**

Complete a payment in the SIBS widget (use sandbox card if available). On redirect back, URL should have `?status=success` and the page shows the success card.

Then re-run the SQL from Step 4 — the rows in that order should all be `paid` with `paid_at` populated.

- [ ] **Step 7: Failed payment path**

Attempt a payment that the SIBS sandbox will decline. Webhook should fire `Failed` status, which deletes all rows in the group.

Verify in SQL — the rows for that primary id are gone.

- [ ] **Step 8: Legacy record regression test**

Pick one pre-existing SMS-campaign row (where `order_group_id IS NULL`) and verify that a manually-sent SIBS webhook (or an in-flight session if any) still updates that row alone. You can check the webhook code path compiles and handles `id.eq.X OR order_group_id.eq.X` cleanly against a NULL `order_group_id`.

If no live pre-existing session is available to test end-to-end, at minimum confirm the SQL syntax works:

```sql
SELECT id FROM niebocross_tshirt_payments
WHERE id = '<some-legacy-id>' OR order_group_id = '<some-legacy-id>';
```

- [ ] **Step 9: SMS link compatibility**

Visit `http://localhost:4321/niebocross/koszulka?id=some-participant-id`. Verify the wizard loads at step 1 normally — the `?id=` is ignored.

- [ ] **Step 10: Final commit**

No code changes in this task unless you found a regression to fix. Otherwise skip the commit.

---

## Done

After Task 7 passes end-to-end on the deployed branch, the feature is ready. The user can announce it on the NieboCross channel.
