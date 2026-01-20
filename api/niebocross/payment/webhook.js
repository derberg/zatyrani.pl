import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";

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
    // TODO: Implement SIBS signature verification
    // const signature = req.headers['x-sibs-signature'];
    // if (!verifySignature(req.body, signature)) {
    //   return res.status(401).json({ error: "Invalid signature" });
    // }

    const { paymentId, transactionId, status } = req.body;

    if (!paymentId || !transactionId || !status) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
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

    // Update payment status
    const updateData = {
      transaction_id: transactionId,
      payment_status: status === 'success' ? 'paid' : 'failed'
    };

    if (status === 'success') {
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
    if (status === 'success') {
      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (sendgridKey && payment.niebocross_registrations) {
        sgMail.setApiKey(sendgridKey);

        const registration = payment.niebocross_registrations;

        const msg = {
          to: registration.email,
          from: process.env.SENDGRID_FROM_EMAIL || "zatyrani@zatyrani.pl",
          subject: "Potwierdzenie płatności - NieboCross 2026",
          text: `Witaj ${registration.contact_person},\n\nTwoja płatność została przyjęta!\n\nKwota: ${payment.total_amount} zł\nID transakcji: ${transactionId}\n\nMożesz pobrać potwierdzenie logując się na:\nhttps://zatyrani.pl/niebocross/panel\n\nDziękujemy za wpłatę! ${payment.charity_amount.toFixed(2)} zł zostanie przekazane na cel charytatywny.\n\nDo zobaczenia w Nieborowicach 12 kwietnia 2026!\n\n--\nStowarzyszenie ZATYRANI\nwww.zatyrani.pl`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4CAF50;">✓ Płatność potwierdzona!</h2>
              <p>Witaj ${registration.contact_person},</p>
              <p>Twoja płatność została przyjęta!</p>
              <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                <p style="margin: 0;"><strong>Kwota: ${payment.total_amount} zł</strong></p>
                <p style="margin: 5px 0 0 0; color: #666;">ID transakcji: ${transactionId}</p>
              </div>
              <p>Możesz pobrać potwierdzenie logując się na:<br>
              <a href="https://zatyrani.pl/niebocross/panel">https://zatyrani.pl/niebocross/panel</a></p>
              <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <p style="margin: 0;">💚 Dziękujemy za wpłatę! <strong>${payment.charity_amount.toFixed(2)} zł</strong> zostanie przekazane na cel charytatywny.</p>
              </div>
              <p>Do zobaczenia w Nieborowicach 12 kwietnia 2026!</p>
              <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
              <p style="color: #666; font-size: 14px;">
                Stowarzyszenie ZATYRANI<br>
                <a href="https://zatyrani.pl">www.zatyrani.pl</a>
              </p>
            </div>
          `,
        };

        try {
          await sgMail.send(msg);
        } catch (emailError) {
          console.error("Error sending email:", emailError);
          // Don't fail the webhook if email fails
        }
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
