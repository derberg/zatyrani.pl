import sgMail from "@sendgrid/mail";

/**
 * Sends a verification code email to the user
 * @param {string} email - Recipient email address
 * @param {string} code - 6-digit verification code
 * @param {string} context - Context of the email: 'registration' or 'login'
 * @returns {Promise<void>}
 */
export async function sendVerificationCodeEmail(email, code, context = 'registration') {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (!sendgridKey) {
    throw new Error("SendGrid API key not configured");
  }

  sgMail.setApiKey(sendgridKey);

  const contextText = context === 'registration'
    ? 'zarejestrować'
    : 'zalogować';

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "biuro@zatyrani.pl",
    subject: "Kod weryfikacyjny - NieboCross",
    text: `Twój kod weryfikacyjny: ${code}\n\nKod jest ważny przez 10 minut.\n\nJeśli nie próbowałeś(łaś) się ${contextText}, zignoruj tę wiadomość.\n\n--\nStowarzyszenie ZATYRANI\nwww.zatyrani.pl`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Kod weryfikacyjny - NieboCross 2026</h2>
        <p>Twój kod weryfikacyjny:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${code}
        </div>
        <p>Kod jest ważny przez 10 minut.</p>
        <p>Jeśli nie próbowałeś(łaś) się ${contextText} na NieboCross, zignoruj tę wiadomość.</p>
        <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">
          Stowarzyszenie ZATYRANI<br>
          <a href="https://zatyrani.pl">www.zatyrani.pl</a>
        </p>
      </div>
    `,
  };

  return sgMail.send(msg);
}

/**
 * Sends a registration confirmation email with payment link
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email address
 * @param {string} params.contactPerson - Contact person name
 * @param {Array} params.participants - Array of participant objects with fullName and raceCategory
 * @param {Object} params.payment - Payment object with totalAmount and charityAmount
 * @param {string} params.registrationId - Registration ID for payment link
 * @returns {Promise<void>}
 */
export async function sendRegistrationConfirmationEmail({ email, contactPerson, participants, payment, registrationId }) {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (!sendgridKey) {
    throw new Error("SendGrid API key not configured");
  }

  sgMail.setApiKey(sendgridKey);

  const paymentPageUrl = `https://zatyrani.pl/niebocross/payment?id=${registrationId}`;
  const participantsList = participants.map(p =>
    `- ${p.fullName} - ${p.raceCategory.replace('_', ' ')}`
  ).join('\n');

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "biuro@zatyrani.pl",
    subject: "Potwierdzenie rejestracji - NieboCross 2026",
    text: `Witaj ${contactPerson},\n\nDziękujemy za rejestrację na wydarzenie NieboCross 2026!\n\nZarejestrowani uczestnicy:\n${participantsList}\n\nDo zapłaty: ${payment.totalAmount} zł\n(w tym ${payment.charityAmount.toFixed(2)} zł na cel charytatywny)\n\nAby dokończyć rejestrację, opłać udział klikając poniższy link:\n${paymentPageUrl}\n\nMożesz sprawdzić status płatności i pobrać potwierdzenie logując się na:\nhttps://zatyrani.pl/niebocross/panel\n\nDo zobaczenia w Nieborowicach 12 kwietnia 2026!\n\n--\nStowarzyszenie ZATYRANI\nwww.zatyrani.pl`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Potwierdzenie rejestracji - NieboCross 2026</h2>
        <p>Witaj ${contactPerson},</p>
        <p>Dziękujemy za rejestrację na wydarzenie NieboCross 2026!</p>
        <h3>Zarejestrowani uczestnicy:</h3>
        <ul>
          ${participants.map(p => `<li>${p.fullName} - ${p.raceCategory.replace('_', ' ')}</li>`).join('')}
        </ul>
        <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
          <p style="margin: 0;"><strong>Do zapłaty: ${payment.totalAmount} zł</strong></p>
          <p style="margin: 5px 0 0 0; color: #666;">(w tym ${payment.charityAmount.toFixed(2)} zł na cel charytatywny)</p>
        </div>
        <p>Aby dokończyć rejestrację, opłać udział klikając poniższy link:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${paymentPageUrl}" style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Opłać rejestrację</a>
        </p>
        <p style="color: #666; font-size: 14px;">Link jest ważny przez 48 godzin.</p>
        <p>Możesz sprawdzić status płatności i pobrać potwierdzenie logując się na:<br>
        <a href="https://zatyrani.pl/niebocross/panel">https://zatyrani.pl/niebocross/panel</a></p>
        <p>Do zobaczenia w Nieborowicach 12 kwietnia 2026!</p>
        <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">
          Stowarzyszenie ZATYRANI<br>
          <a href="https://zatyrani.pl">www.zatyrani.pl</a>
        </p>
      </div>
    `,
  };

  return sgMail.send(msg);
}

/**
 * Sends a payment confirmation email
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email address
 * @param {string} params.contactPerson - Contact person name
 * @param {number} params.totalAmount - Total payment amount
 * @param {number} params.charityAmount - Charity amount
 * @param {string} params.transactionId - Transaction ID
 * @returns {Promise<void>}
 */
export async function sendPaymentConfirmationEmail({ email, contactPerson, totalAmount, charityAmount, transactionId }) {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (!sendgridKey) {
    throw new Error("SendGrid API key not configured");
  }

  sgMail.setApiKey(sendgridKey);

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "zatyrani@zatyrani.pl",
    subject: "Potwierdzenie płatności - NieboCross 2026",
    text: `Witaj ${contactPerson},\n\nTwoja płatność została przyjęta!\n\nKwota: ${totalAmount} zł\nID transakcji: ${transactionId}\n\nMożesz pobrać potwierdzenie logując się na:\nhttps://zatyrani.pl/niebocross/panel\n\nDziękujemy za wpłatę! ${charityAmount.toFixed(2)} zł zostanie przekazane na cel charytatywny.\n\nDo zobaczenia w Nieborowicach 12 kwietnia 2026!\n\n--\nStowarzyszenie ZATYRANI\nwww.zatyrani.pl`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">✓ Płatność potwierdzona!</h2>
        <p>Witaj ${contactPerson},</p>
        <p>Twoja płatność została przyjęta!</p>
        <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
          <p style="margin: 0;"><strong>Kwota: ${totalAmount} zł</strong></p>
          <p style="margin: 5px 0 0 0; color: #666;">ID transakcji: ${transactionId}</p>
        </div>
        <p>Możesz pobrać potwierdzenie logując się na:<br>
        <a href="https://zatyrani.pl/niebocross/panel">https://zatyrani.pl/niebocross/panel</a></p>
        <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0;">💚 Dziękujemy za wpłatę! <strong>${charityAmount.toFixed(2)} zł</strong> zostanie przekazane na cel charytatywny.</p>
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

  return sgMail.send(msg);
}
