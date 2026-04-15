import { createClient } from "@supabase/supabase-js";
import { decryptWebhookNotification, parseWebhookData } from "../utils/sibs.js";
import { sendPaymentConfirmationEmail, sendPaymentFailedEmail } from "../utils/email.js";

// Disable Vercel's automatic body parsing so we get the raw base64 ciphertext
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Read the raw body from the request stream
 */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase URL or key is not configured.");
  }

  return createClient(url, serviceKey);
}

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

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Initialization-Vector, X-Authentication-Tag");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read raw body (base64-encoded AES-GCM ciphertext)
    const rawBody = await getRawBody(req);

    // Get AES-GCM decryption parameters from headers
    const iv = req.headers['x-initialization-vector'];
    const authTag = req.headers['x-authentication-tag'];

    console.log('[Webhook] Received notification');
    console.log('[Webhook] X-Initialization-Vector:', iv);
    console.log('[Webhook] X-Authentication-Tag:', authTag);
    console.log('[Webhook] Body length:', rawBody.length);

    if (!iv || !authTag) {
      console.error('[Webhook] Missing decryption headers - IV:', !!iv, 'AuthTag:', !!authTag);
      return res.status(400).json({ error: "Missing decryption headers" });
    }

    // Decrypt the notification payload
    const decryptedData = decryptWebhookNotification(rawBody.trim(), iv, authTag);

    // Parse webhook data
    const webhookData = parseWebhookData(decryptedData);
    const { merchantTransactionId: paymentId, transactionId, paymentStatus, notificationId } = webhookData;
    console.log('[Webhook] Parsed data:', JSON.stringify(webhookData, null, 2));

    // Determine if payment was actually successful
    // returnStatus.statusCode '000' only means the API call succeeded, NOT that the payment succeeded
    // paymentStatus contains the actual payment outcome: 'Success', 'Declined', 'Failed', etc.
    const isPaymentSuccess = paymentStatus === 'Success';

    if (!paymentId) {
      console.error('[Webhook] Missing merchantTransactionId in decrypted payload');
      // Still acknowledge to SIBS to prevent retries
      return res.status(200).json({
        statusCode: "200",
        statusMsg: "Success",
        notificationID: notificationId || "unknown"
      });
    }

    const supabase = getSupabaseClient();

    // Try main payments table first
    const { data: payment, error: paymentError } = await supabase
      .from("niebocross_payments")
      .select(`
        *,
        niebocross_registrations!inner(email, contact_person)
      `)
      .eq("id", paymentId)
      .single();

    // If not found in main table, check tshirt payments table
    if (paymentError || !payment) {
      const handled = await handleTshirtPaymentWebhook(supabase, paymentId, transactionId, isPaymentSuccess);
      if (!handled) {
        console.error("Payment not found in any table:", paymentId);
      }
      return res.status(200).json({
        statusCode: "200",
        statusMsg: "Success",
        notificationID: notificationId || "unknown"
      });
    }

    // Update payment status based on actual payment outcome
    const updateData = {
      transaction_id: transactionId,
      payment_status: isPaymentSuccess ? 'paid' : 'failed'
    };

    if (isPaymentSuccess) {
      updateData.paid_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("niebocross_payments")
      .update(updateData)
      .eq("id", paymentId);

    if (updateError) {
      console.error("Error updating payment:", updateError);
    }

    // Send email notification based on payment result
    if (payment.niebocross_registrations) {
      const registration = payment.niebocross_registrations;

      try {
        if (isPaymentSuccess) {
          await sendPaymentConfirmationEmail({
            email: registration.email,
            contactPerson: registration.contact_person,
            totalAmount: payment.total_amount,
            charityAmount: payment.charity_amount,
            transactionId
          });
        } else {
          await sendPaymentFailedEmail({
            email: registration.email,
            contactPerson: registration.contact_person,
            totalAmount: payment.total_amount,
            registrationId: payment.registration_id
          });
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Don't fail the webhook if email fails
      }
    }

    // SIBS requires this exact response format
    return res.status(200).json({
      statusCode: "200",
      statusMsg: "Success",
      notificationID: notificationId || decryptedData.notificationID || "unknown"
    });

  } catch (error) {
    console.error("Webhook error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
}
