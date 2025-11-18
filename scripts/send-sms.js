import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config({ path: './.env.production' });

async function sendSms() {

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const smsToNumber = process.env.TEST_SMS_TO_NUMBER;
  const smsContent = process.env.TEST_SMS_CONTENT;

  if (!accountSid || !authToken || !twilioPhoneNumber) {
    console.error('Twilio environment variables are not set.');
    process.exit(1);
  }

  // const client = twilio(apiAccountSid, authToken, { accountSid: accountSid });
  
const client = twilio(accountSid, authToken);

  try {
    const message = await client.messages.create({
      body: smsContent,
      to: smsToNumber,
      from: twilioPhoneNumber,
    });

    console.log('SMS sent successfully:', message.sid);

  } catch (error) {
    console.error('Error sending SMS:', error);

  }
}

await sendSms();