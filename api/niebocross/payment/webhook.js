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
    const { merchantTransactionId: paymentId, transactionId, status, notificationId } = webhookData;
    console.log('[Webhook] Parsed data:', JSON.stringify(webhookData, null, 2));

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

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from("niebocross_payments")
      .select(`
        *,
        niebocross_registrations!inner(email, contact_person)
      `)
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      console.error("Payment not found:", paymentError);
      // Still acknowledge to SIBS
      return res.status(200).json({
        statusCode: "200",
        statusMsg: "Success",
        notificationID: notificationId || "unknown"
      });
    }

    // Update payment status based on SIBS response
    // SIBS status codes: '000' = success, others = various failure states
    const updateData = {
      transaction_id: transactionId,
      payment_status: status === '000' ? 'paid' : 'failed'
    };

    if (status === '000') {
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
        if (status === '000') {
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
