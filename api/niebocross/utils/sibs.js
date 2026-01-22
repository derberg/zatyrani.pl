/**
 * SIBS Gateway payment gateway integration utilities
 */

import crypto from 'crypto';

// Ensure SIBS_API_URL has https:// protocol
const rawSibsUrl = process.env.SIBS_API_URL || 'https://api.sibsgateway.com';
const SIBS_API_URL = rawSibsUrl.startsWith('http') ? rawSibsUrl : `https://${rawSibsUrl}`;
const SIBS_CLIENT_ID = process.env.SIBS_CLIENT_ID;
const SIBS_BEARER_TOKEN = process.env.SIBS_BEARER_TOKEN;

/**
 * Generate payment link for SIBS Gateway
 */
export async function createPaymentLink(paymentData) {
  const {
    paymentId,
    amount, // in grosz (PLN * 100)
    description,
    email,
    urlReturn,
    urlStatus
  } = paymentData;

  if (!SIBS_BEARER_TOKEN) {
    throw new Error('SIBS Bearer token is not configured');
  }

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
        currency: "PLN"
      },
      paymentMethod: ["CARD", "BLIK", "PBLKV", "GOOGLEPAY"],
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
        'Authorization': `Bearer ${SIBS_BEARER_TOKEN}`,
        'x-ibm-client-id': SIBS_CLIENT_ID
      },
      body: JSON.stringify(transactionData)
    });

    const result = await response.json();

    if (!response.ok || result.returnStatus?.statusCode !== '000') {
      throw new Error(`SIBS API error: ${result.returnStatus?.statusMsg || 'Unknown error'}`);
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
    throw new Error('Failed to create payment link');
  }
}

/**
 * Verify SIBS webhook signature
 */
export function verifyWebhookSignature(data, receivedSign) {
  // SIBS typically uses HMAC-SHA256 for webhook signatures
  // Using bearer token as the signing key (needs verification with SIBS docs)
  if (!SIBS_BEARER_TOKEN) {
    throw new Error('SIBS Bearer token is not configured');
  }

  // Create signature from webhook data
  const sortedKeys = Object.keys(data).sort();
  const signString = sortedKeys
    .filter(key => key !== 'signature')
    .map(key => `${key}=${JSON.stringify(data[key])}`)
    .join('&');

  const expectedSign = crypto
    .createHmac('sha256', SIBS_BEARER_TOKEN)
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