import sgMail from "@sendgrid/mail";
import { convert } from 'html-to-text';

/**
 * Common options for HTML to text conversion
 */
const htmlToTextOptions = {
  wordwrap: 80,
  selectors: [
    { selector: 'a', options: { ignoreHref: false } },
    { selector: 'img', format: 'skip' },
    { selector: 'hr', format: 'skip' }
  ]
};

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

  // Only maintain HTML - text is auto-generated
  const html = `
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
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl">www.zatyrani.pl</a>
      </p>
    </div>
  `;

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "biuro@zatyrani.pl",
    subject: "Kod weryfikacyjny - NieboCross",
    text: convert(html, htmlToTextOptions), // Auto-generated from HTML
    html,
  };

  return sgMail.send(msg);
}

/**
 * Sends a registration confirmation email with payment link
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email address
 * @param {string} params.contactPerson - Contact person name
 * @param {Array} params.participants - Array of participant objects with firstName, lastName and raceCategory
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

  // Only maintain HTML - text is auto-generated
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Potwierdzenie rejestracji - NieboCross 2026</h2>
      <p>Witaj ${contactPerson},</p>
      <p>Dziękujemy za rejestrację na wydarzenie NieboCross 2026!</p>
      <h3>Zarejestrowani uczestnicy:</h3>
      <ul>
        ${participants.map(p => `<li>${p.firstName} ${p.lastName} - ${p.raceCategory.replace('_', ' ')}</li>`).join('')}
      </ul>
      <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
        <p style="margin: 0;"><strong>Do zapłaty: ${payment.totalAmount} zł</strong></p>
        <p style="margin: 5px 0 0 0; color: #666;">(w tym ${payment.charityAmount.toFixed(2)} zł na cel charytatywny)</p>
      </div>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${paymentPageUrl}" style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Opłać udział</a>
      </div>
      <p>Możesz też sprawdzić status płatności oraz zarejestrować dodatkowych uczestników pod adresem:<br>
      <a href="https://zatyrani.pl/niebocross/panel">https://zatyrani.pl/niebocross/panel</a></p>
      <p>Do zobaczenia w Nieborowicach 12 kwietnia 2026!</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl">www.zatyrani.pl</a>
      </p>
    </div>
  `;

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "biuro@zatyrani.pl",
    subject: "Potwierdzenie rejestracji - NieboCross 2026",
    text: convert(html, htmlToTextOptions), // Auto-generated from HTML
    html,
  };

  return sgMail.send(msg);
}

/**
 * Sends a weekly payment reminder email to registrations with pending payments
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email address
 * @param {string} params.contactPerson - Contact person name
 * @param {number} params.totalAmount - Total amount due
 * @param {string} params.registrationId - Registration ID used to build payment link
 * @returns {Promise<void>}
 */
export async function sendPaymentReminderEmail({ email, contactPerson, totalAmount, registrationId }) {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (!sendgridKey) {
    throw new Error("SendGrid API key not configured");
  }

  sgMail.setApiKey(sendgridKey);

  const paymentPageUrl = `https://zatyrani.pl/niebocross/payment?id=${registrationId}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c7be5;">⏳ Hej ${contactPerson}, zostało tylko 7 dni na dokończenie zapisu!</h2>
      <p>Zauważyliśmy, że Twój udział w <strong>NieboCross 2026</strong> wciąż nie jest opłacony.</p>
      <div style="background-color: #fff7ed; padding: 16px 20px; margin: 20px 0; border-left: 4px solid #f97316; border-radius: 4px;">
        <p style="margin: 0 0 8px 0;"><strong>🗓️ Masz tydzień na dokończenie zapisu</strong> — ale może być krócej.</p>
        <p style="margin: 0;">Ponad <strong>170 osób już opłaciło</strong> swój start. Gdy limity miejsc się wyczerpią, zapisy zamkniemy niezależnie od terminu. Sama rejestracja bez wpłaty nie gwarantuje miejsca na liście startowej.</p>
      </div>
      <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #2c7be5;">
        <p style="margin: 0;"><strong>Do zapłaty: ${totalAmount} zł</strong></p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${paymentPageUrl}" style="background-color: #2c7be5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Opłać udział teraz →</a>
      </div>
      <p style="color: #555;">Możesz też zalogować się do panelu uczestnika i opłacić stamtąd:<br>
      <a href="https://zatyrani.pl/niebocross/panel">https://zatyrani.pl/niebocross/panel</a></p>
      <p>Do zobaczenia na trasie! 💪</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl">www.zatyrani.pl</a>
      </p>
    </div>
  `;

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "biuro@zatyrani.pl",
    subject: `Hej ${contactPerson}, zostało 7 dni na dokończenie zapisu — ponad 170 osób już opłaciło start! ⏳`,
    text: convert(html, htmlToTextOptions),
    html,
  };

  return sgMail.send(msg);
}

/**
 * Sends a payment failed notification email with retry link and contact details
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email address
 * @param {string} params.contactPerson - Contact person name
 * @param {number} params.totalAmount - Total amount due
 * @param {string} params.registrationId - Registration ID used to build payment link
 * @returns {Promise<void>}
 */
export async function sendPaymentFailedEmail({ email, contactPerson, totalAmount, registrationId }) {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (!sendgridKey) {
    throw new Error("SendGrid API key not configured");
  }

  sgMail.setApiKey(sendgridKey);

  const paymentPageUrl = `https://zatyrani.pl/niebocross/payment?id=${registrationId}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">⚠️ Płatność nie powiodła się - NieboCross 2026</h2>
      <p>Witaj ${contactPerson},</p>
      <p>Niestety Twoja płatność za udział w NieboCross 2026 nie została zrealizowana. Jesteśmy tego świadomi i chcemy pomóc Ci dokończyć rejestrację.</p>
      <div style="background-color: #fef2f2; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626;">
        <p style="margin: 0;"><strong>Kwota do zapłaty: ${totalAmount} zł</strong></p>
      </div>
      <p>Kliknij poniższy przycisk, aby spróbować ponownie:</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${paymentPageUrl}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Spróbuj zapłacić ponownie</a>
      </div>
      <p>Możesz też zalogować się do panelu uczestnika:<br>
      <a href="https://zatyrani.pl/niebocross/panel">https://zatyrani.pl/niebocross/panel</a></p>
      <div style="background-color: #f8fafc; padding: 15px; margin: 20px 0; border-left: 4px solid #94a3b8;">
        <p style="margin: 0 0 8px 0;"><strong>Masz pytania lub problemy z płatnością?</strong></p>
        <p style="margin: 0;">Napisz do nas: <a href="mailto:biuro@zatyrani.pl">biuro@zatyrani.pl</a><br>
        Zadzwoń: <a href="tel:784640977">784 640 977</a></p>
      </div>
      <p>Do zobaczenia w Nieborowicach 12 kwietnia 2026!</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Stowarzyszenie Zatyrani Gratisownia.pl<br>
        <a href="https://zatyrani.pl">www.zatyrani.pl</a>
      </p>
    </div>
  `;

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "biuro@zatyrani.pl",
    subject: "Płatność nie powiodła się - NieboCross 2026",
    text: convert(html, htmlToTextOptions),
    html,
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

  // Only maintain HTML - text is auto-generated
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">✓ Płatność potwierdzona!</h2>
        <p>Witaj ${contactPerson},</p>
        <p>Twoja płatność została przyjęta!</p>
        <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
          <p style="margin: 0;"><strong>Kwota: ${totalAmount} zł</strong></p>
          <p style="margin: 5px 0 0 0; color: #666;">ID transakcji: ${transactionId}</p>
        </div>
        <p>Więcej informacji oraz możliwość zarejestrowania dodatkowych osób pod adresem:<br>
        <a href="https://zatyrani.pl/niebocross/panel">https://zatyrani.pl/niebocross/panel</a></p>
        <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0;">💚 Dziękujemy za wpłatę! <strong>${charityAmount.toFixed(2)} zł</strong> zostanie przekazane na cel charytatywny.</p>
        </div>
        <p>Do zobaczenia w Nieborowicach 12 kwietnia 2026!</p>
        <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">
          Stowarzyszenie Zatyrani Gratisownia.pl<br>
          <a href="https://zatyrani.pl">www.zatyrani.pl</a>
        </p>
      </div>
  `;

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "zatyrani@zatyrani.pl",
    subject: "Potwierdzenie płatności - NieboCross 2026",
    text: convert(html, htmlToTextOptions), // Auto-generated from HTML
    html,
  };

  return sgMail.send(msg);
}
