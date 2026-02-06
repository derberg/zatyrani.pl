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
    amount, // in grosz (PLN * 100)
    description,
    email
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
      merchantTransactionId: paymentId,
      transactionDescription: description,
      shopURL: "https://zatyrani.pl/niebocross"
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
      paymentMethod: ["CARD", "BLIK", "PBLKV", "GOOGLEPAY"]
    },
    customer: {
      customerInfo: {
        customerEmail: email
      }
    }
  };

  try {
    console.log('Creating SIBS payment with data:', JSON.stringify(transactionData, null, 2));

    const response = await fetch(`${SIBS_API_URL}/api/v1/payments`, {
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

    // Extract transaction ID from response
    const transactionId = result.transactionID;

    if (!transactionId) {
      throw new Error('No transaction ID received from SIBS');
    }

    // Construct hosted checkout payment URL
    const paymentUrl = `https://pay.sibs.com/transaction/${transactionId}`;

    return {
      token: transactionId,
      paymentUrl: paymentUrl
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
  if (!SIBS_WEBHOOK_ID) {
    throw new Error('SIBS Webhook ID is not configured');
  }

  if (!receivedSignature) {
    return false;
  }

  // Decode the base64-encoded webhook ID to get the HMAC key
  const key = Buffer.from(SIBS_WEBHOOK_ID, 'base64');

  // Compute HMAC-SHA256 of the raw request body
  const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
  const expectedSignature = crypto
    .createHmac('sha256', key)
    .update(bodyStr)
    .digest('base64');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
  } catch {
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