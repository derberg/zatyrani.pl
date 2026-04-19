/**
 * Universal SIBS webhook — single endpoint for all payment tables.
 *
 * SIBS BackOffice allows only one webhook URL per Merchant, so this handler
 * tries every payment table until it finds a match:
 *   1. event_payments         (Wilczy Półmaraton, future events)
 *   2. niebocross_payments    (NieboCross registrations)
 *   3. niebocross_tshirt_payments (NieboCross t-shirt orders)
 */

import { getSupabaseClient } from "../shared/supabase.js";
import { decryptWebhookNotification, parseWebhookData } from "../niebocross/utils/sibs.js";
import { setCorsHeaders } from "../shared/cors.js";
import { getEventConfig } from "../events/config.js";

// Lazy-load email helpers so a missing env var doesn't blow up the other path
async function loadNiebocrossEmail() {
  return import("../niebocross/utils/email.js");
}
async function loadSharedEmail() {
  return import("../shared/email.js");
}

export const config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── Table handlers ──────────────────────────────────────────────────────────

async function handleEventPayment(supabase, paymentId, transactionId, isPaymentSuccess) {
  const { data: payment, error } = await supabase
    .from("event_payments")
    .select("*, event_registrations!inner(email, contact_person, event_id)")
    .eq("id", paymentId)
    .single();

  if (error || !payment) return false;
  console.log('[Webhook] Matched event_payments:', paymentId);

  const updateData = {
    transaction_id: transactionId,
    payment_status: isPaymentSuccess ? 'paid' : 'failed',
  };
  if (isPaymentSuccess) updateData.paid_at = new Date().toISOString();

  await supabase.from("event_payments").update(updateData).eq("id", paymentId);

  // Send email
  try {
    const reg = payment.event_registrations;
    const eventConfig = getEventConfig(reg.event_id);
    const { sendPaymentConfirmationEmail, sendPaymentFailedEmail } = await loadSharedEmail();

    if (isPaymentSuccess) {
      await sendPaymentConfirmationEmail({
        email: reg.email, contactPerson: reg.contact_person,
        totalAmount: payment.total_amount, charityAmount: payment.charity_amount,
        transactionId, eventConfig,
      });
    } else {
      await sendPaymentFailedEmail({
        email: reg.email, contactPerson: reg.contact_person,
        totalAmount: payment.total_amount, registrationId: payment.registration_id,
        eventConfig,
      });
    }
  } catch (e) { console.error('[Webhook] Email error (event):', e.message); }

  return true;
}

async function handleNiebocrossPayment(supabase, paymentId, transactionId, isPaymentSuccess) {
  const { data: payment, error } = await supabase
    .from("niebocross_payments")
    .select("*, niebocross_registrations!inner(email, contact_person)")
    .eq("id", paymentId)
    .single();

  if (error || !payment) return false;
  console.log('[Webhook] Matched niebocross_payments:', paymentId);

  const updateData = {
    transaction_id: transactionId,
    payment_status: isPaymentSuccess ? 'paid' : 'failed',
  };
  if (isPaymentSuccess) updateData.paid_at = new Date().toISOString();

  await supabase.from("niebocross_payments").update(updateData).eq("id", paymentId);

  // Send email
  try {
    const reg = payment.niebocross_registrations;
    const { sendPaymentConfirmationEmail, sendPaymentFailedEmail } = await loadNiebocrossEmail();

    if (isPaymentSuccess) {
      await sendPaymentConfirmationEmail({
        email: reg.email, contactPerson: reg.contact_person,
        totalAmount: payment.total_amount, charityAmount: payment.charity_amount,
        transactionId,
      });
    } else {
      await sendPaymentFailedEmail({
        email: reg.email, contactPerson: reg.contact_person,
        totalAmount: payment.total_amount, registrationId: payment.registration_id,
      });
    }
  } catch (e) { console.error('[Webhook] Email error (niebocross):', e.message); }

  return true;
}

async function handleTshirtPayment(supabase, paymentId, transactionId, isPaymentSuccess) {
  const { data: row, error } = await supabase
    .from("niebocross_tshirt_payments")
    .select("id")
    .eq("id", paymentId)
    .single();

  if (error || !row) return false;
  console.log('[Webhook] Matched niebocross_tshirt_payments:', paymentId);

  if (isPaymentSuccess) {
    await supabase.from("niebocross_tshirt_payments")
      .update({ payment_status: 'paid', transaction_id: transactionId, paid_at: new Date().toISOString() })
      .or(`id.eq.${paymentId},order_group_id.eq.${paymentId}`);
  } else {
    await supabase.from("niebocross_tshirt_payments")
      .delete()
      .or(`id.eq.${paymentId},order_group_id.eq.${paymentId}`);
  }

  return true;
}

// ── Main handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCorsHeaders(res);
  res.setHeader("Access-Control-Allow-Headers",
    res.getHeader("Access-Control-Allow-Headers") + ", X-Initialization-Vector, X-Authentication-Tag");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const rawBody = await getRawBody(req);
    const iv = req.headers['x-initialization-vector'];
    const authTag = req.headers['x-authentication-tag'];

    console.log('[Webhook] Received notification');
    if (!iv || !authTag) {
      console.error('[Webhook] Missing decryption headers');
      return res.status(400).json({ error: "Missing decryption headers" });
    }

    const decryptedData = decryptWebhookNotification(rawBody.trim(), iv, authTag);
    const webhookData = parseWebhookData(decryptedData);
    const { merchantTransactionId: paymentId, transactionId, paymentStatus, notificationId } = webhookData;
    console.log('[Webhook] Parsed:', JSON.stringify(webhookData, null, 2));

    const isPaymentSuccess = paymentStatus === 'Success';
    const ack = { statusCode: "200", statusMsg: "Success", notificationID: notificationId || "unknown" };

    if (!paymentId) {
      console.error('[Webhook] Missing merchantTransactionId');
      return res.status(200).json(ack);
    }

    const supabase = getSupabaseClient();

    // Try each table in order until one matches
    const handled =
      await handleEventPayment(supabase, paymentId, transactionId, isPaymentSuccess) ||
      await handleNiebocrossPayment(supabase, paymentId, transactionId, isPaymentSuccess) ||
      await handleTshirtPayment(supabase, paymentId, transactionId, isPaymentSuccess);

    if (!handled) {
      console.error('[Webhook] Payment not found in any table:', paymentId);
    }

    return res.status(200).json(ack);
  } catch (error) {
    console.error("Webhook error:", error.message, error.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}
