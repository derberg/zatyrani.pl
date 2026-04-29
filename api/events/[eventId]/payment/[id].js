import { getSupabaseClient } from "../../../shared/supabase.js";
import { verifyToken } from "../../../shared/auth.js";
import { createPaymentLink } from "../../../niebocross/utils/sibs.js";
import { repricePendingPayment } from "../../../shared/database-operations.js";
import { getEventConfig } from "../../config.js";
import { setCorsHeaders } from "../../../shared/cors.js";

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let eventConfig;
  try {
    eventConfig = getEventConfig(req.query.eventId);
  } catch {
    return res.status(404).json({ error: "Event not found" });
  }

  const authResult = verifyToken(req, eventConfig);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  try {
    const registrationId = req.query.id;

    if (!registrationId) {
      return res.status(400).json({
        success: false,
        error: "Registration ID is required"
      });
    }

    const supabase = getSupabaseClient();

    // Reprice against current fee schedule before creating SIBS link. Ensures users
    // who registered before a price bump pay the new (correct) amount. When prices
    // have advanced, the helper clears payment_link so the block below creates a
    // fresh SIBS session for the updated amount.
    await repricePendingPayment(supabase, registrationId, eventConfig);

    // Get the latest pending or failed payment (both are actionable — user can pay)
    const { data: payment, error: paymentError } = await supabase
      .from("event_payments")
      .select(`
        id,
        total_amount,
        payment_status,
        payment_link,
        transaction_id,
        event_registrations!inner(email, contact_person, event_id)
      `)
      .eq("registration_id", registrationId)
      .in("payment_status", ["pending", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (paymentError || !payment) {
      return res.status(200).json({
        success: true,
        has_pending_payment: false,
        message: "Brak nieopłaconych płatności"
      });
    }

    const registration = payment.event_registrations;

    // Verify this payment belongs to the requested event
    if (registration.event_id !== eventConfig.id) {
      return res.status(403).json({
        success: false,
        error: "Brak dostępu"
      });
    }

    // Reuse cached SIBS session if it's less than 15 minutes old.
    // Older sessions go stale (card declines don't trigger webhooks, so status stays
    // "pending" with a dead formContext). After 15 min we create a fresh one.
    const SESSION_MAX_AGE_MS = 15 * 60 * 1000;
    if (payment.transaction_id && payment.payment_link) {
      const age = Date.now() - new Date(payment.updated_at || payment.created_at).getTime();
      if (age < SESSION_MAX_AGE_MS) {
        return res.status(200).json({
          success: true,
          has_pending_payment: true,
          payment: {
            id: payment.id,
            total_amount: payment.total_amount,
            payment_status: payment.payment_status,
            contact_person: registration.contact_person,
            formContext: payment.payment_link,
            transactionID: payment.transaction_id
          }
        });
      }
    }

    // Create new SIBS payment link
    const webhookUrl = `https://zatyrani.pl/api/events/${eventConfig.id}/payment/webhook`;

    const paymentResult = await createPaymentLink({
      paymentId: payment.id,
      amount: payment.total_amount, // SIBS expects amount in PLN (main currency unit)
      description: `${eventConfig.name} - ${registration.contact_person}`,
      email: registration.email,
      customerName: registration.contact_person,
      urlReturn: `${eventConfig.panelUrl}?payment=success`,
      urlStatus: webhookUrl
    });

    // Save formContext and transactionID to database (updated_at used for session TTL)
    await supabase
      .from("event_payments")
      .update({
        payment_link: paymentResult.formContext,
        transaction_id: paymentResult.transactionID,
        updated_at: new Date().toISOString()
      })
      .eq("id", payment.id);

    return res.status(200).json({
      success: true,
      has_pending_payment: true,
      payment: {
        id: payment.id,
        total_amount: payment.total_amount,
        payment_status: payment.payment_status,
        contact_person: registration.contact_person,
        formContext: paymentResult.formContext,
        transactionID: paymentResult.transactionID
      }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      error: "Wystąpił nieoczekiwany błąd podczas tworzenia płatności"
    });
  }
}
