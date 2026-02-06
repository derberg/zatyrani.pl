import { createClient } from "@supabase/supabase-js";
import { verifyWebhookSignature, parseWebhookData } from "../utils/sibs.js";
import { sendPaymentConfirmationEmail } from "../utils/email.js";

// Disable Vercel's automatic body parsing so we get the raw body string
// This is critical for HMAC signature verification - JSON.stringify(parsedObj)
// won't reproduce the exact bytes SIBS signed
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
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read raw body as string (body parser is disabled)
    const rawBody = await getRawBody(req);
    console.log('[Webhook] Raw body (first 300 chars):', rawBody.substring(0, 300));

    // Verify SIBS webhook signature from Authorization header
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    console.log('[Webhook] Authorization header:', authHeader);
    const isValidSignature = verifyWebhookSignature(rawBody, authHeader);
    console.log('[Webhook] Signature valid:', isValidSignature);
    if (!isValidSignature) {
      console.log('[Webhook] Returning 401 - invalid signature');
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Parse the raw body JSON manually (since body parser is disabled)
    const body = JSON.parse(rawBody);

    // Parse webhook data
    const webhookData = parseWebhookData(body);
    const { merchantTransactionId: paymentId, transactionId, status } = webhookData;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: "Missing payment ID"
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
      return res.status(404).json({
        success: false,
        error: "Payment not found"
      });
    }

    // Update payment status based on SIBS response
    // SIBS status codes: '000' = success, others = various failure states
    const updateData = {
      transaction_id: transactionId || body.transactionId,
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
      return res.status(500).json({
        success: false,
        error: "Failed to update payment"
      });
    }

    // Send confirmation email on success
    if (status === '000' && payment.niebocross_registrations) {
      const registration = payment.niebocross_registrations;

      try {
        await sendPaymentConfirmationEmail({
          email: registration.email,
          contactPerson: registration.contact_person,
          totalAmount: payment.total_amount,
          charityAmount: payment.charity_amount,
          transactionId
        });
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Don't fail the webhook if email fails
      }
    }

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully"
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
}
