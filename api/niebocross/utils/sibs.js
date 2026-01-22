/**
 * SIBS Gateway payment gateway integration utilities
 */

import crypto from 'crypto';

const SIBS_API_URL = process.env.SIBS_API_URL || 'https://api.sibsgateway.com';
const SIBS_CLIENT_ID = process.env.SIBS_CLIENT_ID;
const SIBS_CLIENT_SECRET = process.env.SIBS_CLIENT_SECRET;

/**
 * Get OAuth2 access token from SIBS
 */
async function getAccessToken() {
  if (!SIBS_CLIENT_ID || !SIBS_CLIENT_SECRET) {
    throw new Error('SIBS credentials are not configured');
  }

  const auth = Buffer.from(`${SIBS_CLIENT_ID}:${SIBS_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await fetch(`${SIBS_API_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'payment'
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(`SIBS OAuth error: ${data.error_description || data.error || 'Unknown error'}`);
    }

    return data.access_token;
  } catch (error) {
    console.error('Error getting SIBS access token:', error);
    throw new Error('Failed to authenticate with SIBS');
  }
}

/**
 * Generate payment link for SIBS Gateway
 */
export async function createPaymentLink(paymentData) {
  const {
    paymentId,
    amount, // in cents (EUR * 100)
    description,
    email,
    urlReturn,
    urlStatus
  } = paymentData;

  const accessToken = await getAccessToken();

  // Prepare transaction data for SIBS
  const transactionData = {
    merchant: {
      terminalId: 1, // Default terminal
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
        currency: "EUR"
      },
      paymentMethod: ["CARD"],
      paymentReference: {
        type: "REFERENCE",
        reference: paymentId
      }
    },
    customer: {
      customerInfo: {
        email: email
      }
    },
    urls: {
      success: urlReturn,
      cancel: urlReturn,
      failure: urlReturn,
      notification: urlStatus
    }
  };

  try {
    const response = await fetch(`${SIBS_API_URL}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(transactionData)
    });

    const result = await response.json();

    if (!response.ok || result.returnStatus?.statusCode !== '000') {
      throw new Error(`SIBS API error: ${result.returnStatus?.statusMsg || 'Unknown error'}`);
    }

    // Extract payment URL from transaction response
    const paymentUrl = result.transactionResponse?.paymentMethodResponse?.redirectUrl;

    if (!paymentUrl) {
      throw new Error('No payment URL received from SIBS');
    }

    return {
      token: result.transactionResponse?.transactionId,
      paymentUrl: paymentUrl
    };
  } catch (error) {
    console.error('Error creating SIBS payment:', error);
    throw new Error('Failed to create payment link');
  }
}

/**
 * Verify SIBS webhook signature
 */
export function verifyWebhookSignature(data, receivedSign) {
  // SIBS typically uses HMAC-SHA256 for webhook signatures
  // This is a placeholder - actual implementation depends on SIBS documentation
  if (!SIBS_CLIENT_SECRET) {
    throw new Error('SIBS client secret is not configured');
  }

  // Create signature from webhook data
  const sortedKeys = Object.keys(data).sort();
  const signString = sortedKeys
    .filter(key => key !== 'signature')
    .map(key => `${key}=${JSON.stringify(data[key])}`)
    .join('&');

  const expectedSign = crypto
    .createHmac('sha256', SIBS_CLIENT_SECRET)
    .update(signString)
    .digest('hex');

  return expectedSign === receivedSign;
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