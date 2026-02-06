/**
 * SIBS Gateway payment gateway integration utilities
 */

import crypto from 'crypto';

// Ensure SIBS_API_URL has https:// protocol
const rawSibsUrl = process.env.SIBS_API_URL || 'https://api.sibsgateway.com';
const SIBS_API_URL = rawSibsUrl.startsWith('http') ? rawSibsUrl : `https://${rawSibsUrl}`;
const SIBS_CLIENT_ID = process.env.SIBS_CLIENT_ID;
const SIBS_TOKEN = process.env.SIBS_TOKEN;
const SIBS_WEBHOOK_ID = process.env.SIBS_WEBHOOK_ID;

/**
 * Generate payment link for SIBS Gateway
 */
export async function createPaymentLink(paymentData) {
  const {
    paymentId,
    amount, // in PLN (main currency unit, e.g. 140.00 for 140 PLN)
    description
  } = paymentData;

  // Validate environment variables
  const missingVars = [];
  if (!SIBS_TOKEN) missingVars.push('SIBS_TOKEN');
  if (!SIBS_CLIENT_ID) missingVars.push('SIBS_CLIENT_ID');
  if (!process.env.SIBS_TERMINAL) missingVars.push('SIBS_TERMINAL');

  if (missingVars.length > 0) {
    throw new Error(`Missing SIBS configuration: ${missingVars.join(', ')}`);
  }

  // Prepare transaction data for SIBS - matching Polish docs structure
  const transactionData = {
    merchant: {
      terminalId: parseInt(process.env.SIBS_TERMINAL) || 1,
      channel: "web",
      merchantTransactionId: paymentId
    },
    transaction: {
      transactionTimestamp: new Date().toISOString(),
      description: description,
      moto: false,
      paymentType: "PURS",
      amount: {
        value: amount,
        currency: "PLN"
      },
      paymentMethod: ["CARD", "BLIK", "PBLKV"]
    }
  };

  try {
    console.log('Creating SIBS payment with data:', JSON.stringify(transactionData, null, 2));

    const response = await fetch(`${SIBS_API_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SIBS_TOKEN}`,
        'x-ibm-client-id': SIBS_CLIENT_ID
      },
      body: JSON.stringify(transactionData)
    });

    const result = await response.json();

    console.log('SIBS API Response:', JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      result
    }, null, 2));

    if (!response.ok || result.returnStatus?.statusCode !== '000') {
      const errorMsg = result.returnStatus?.statusMsg || result.message || JSON.stringify(result);
      console.error('SIBS API error details:', {
        status: response.status,
        statusCode: result.returnStatus?.statusCode,
        statusMsg: result.returnStatus?.statusMsg,
        fullResponse: result
      });
      throw new Error(`SIBS API error (${response.status}): ${errorMsg}`);
    }

    // Extract transaction ID and formContext from response
    const transactionId = result.transactionID;
    const formContext = result.formContext;

    if (!transactionId) {
      throw new Error('No transaction ID received from SIBS');
    }

    if (!formContext) {
      throw new Error('No formContext received from SIBS');
    }

    // Construct hosted checkout payment URL with formContext
    // SIBS Gateway uses the formContext parameter for the hosted payment page
    const paymentUrl = `https://www.pay.sibs.com/form?formContext=${encodeURIComponent(formContext)}`;

    return {
      transactionID: transactionId,
      paymentUrl: paymentUrl,
      formContext: formContext
    };
  } catch (error) {
    console.error('Error creating SIBS payment:', error);
    // Re-throw with original message if available, otherwise use generic message
    if (error.message.includes('SIBS API error') || error.message.includes('SIBS configuration')) {
      throw error;
    }
    throw new Error(`Failed to create payment link: ${error.message}`);
  }
}

/**
 * Verify SIBS webhook signature
 * SIBS signs the raw request body using HMAC-SHA256 with the Webhook ID (base64-decoded) as key.
 * The resulting digest is base64-encoded and sent in the Authorization header.
 */
export function verifyWebhookSignature(rawBody, receivedSignature) {
  console.log('[verifyWebhookSignature] SIBS_WEBHOOK_ID configured:', !!SIBS_WEBHOOK_ID);
  console.log('[verifyWebhookSignature] SIBS_WEBHOOK_ID length:', SIBS_WEBHOOK_ID?.length);
  if (!SIBS_WEBHOOK_ID) {
    throw new Error('SIBS Webhook ID is not configured');
  }

  if (!receivedSignature) {
    console.log('[verifyWebhookSignature] No receivedSignature provided');
    return false;
  }

  // Strip common prefixes like "Bearer ", "Digest ", etc.
  const cleanSignature = receivedSignature.replace(/^(Bearer|Digest|Basic)\s+/i, '').trim();
  console.log('[verifyWebhookSignature] Received signature (raw):', receivedSignature);
  console.log('[verifyWebhookSignature] Received signature (cleaned):', cleanSignature);

  // Decode the base64-encoded webhook ID to get the HMAC key
  const key = Buffer.from(SIBS_WEBHOOK_ID, 'base64');

  // rawBody must be the exact string received from SIBS (not re-serialized)
  console.log('[verifyWebhookSignature] Body type:', typeof rawBody);
  console.log('[verifyWebhookSignature] Body string (first 200 chars):', rawBody.substring(0, 200));
  const expectedSignature = crypto
    .createHmac('sha256', key)
    .update(rawBody)
    .digest('base64');
  console.log('[verifyWebhookSignature] Expected signature:', expectedSignature);
  console.log('[verifyWebhookSignature] Signatures match (simple):', expectedSignature === cleanSignature);

  // Constant-time comparison to prevent timing attacks
  // Try both raw and cleaned signature
  try {
    const rawMatch = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
    if (rawMatch) {
      console.log('[verifyWebhookSignature] Raw signature matched');
      return true;
    }
  } catch (e) {
    console.log('[verifyWebhookSignature] Raw comparison failed (length mismatch):', e.message);
  }

  try {
    const cleanMatch = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(cleanSignature)
    );
    console.log('[verifyWebhookSignature] Clean signature matched:', cleanMatch);
    return cleanMatch;
  } catch (e) {
    console.log('[verifyWebhookSignature] Clean comparison failed (length mismatch):', e.message);
    return false;
  }
}

/**
 * Parse SIBS webhook data
 */
export function parseWebhookData(data) {
  return {
    merchantTransactionId: data.merchantTransactionId, // This is our paymentId
    transactionId: data.transactionId,
    amount: data.amount?.value,
    currency: data.amount?.currency,
    status: data.returnStatus?.statusCode,
    statusMessage: data.returnStatus?.statusMsg,
    paymentMethod: data.paymentMethod,
    signature: data.signature
  };
}