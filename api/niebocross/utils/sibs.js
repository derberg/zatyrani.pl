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
 * Decrypt SIBS webhook notification.
 * 
 * SIBS encrypts webhook payloads using AES-256-GCM:
 * - Secret key: SIBS_WEBHOOK_ID (base64-encoded, from SIBS BackOffice)
 * - IV/Nonce: X-Initialization-Vector header (base64)
 * - Auth tag: X-Authentication-Tag header (base64)
 * - Body: base64-encoded ciphertext
 * 
 * Returns the decrypted JSON object.
 */
export function decryptWebhookNotification(base64Body, ivBase64, authTagBase64) {
  if (!SIBS_WEBHOOK_ID) {
    throw new Error('SIBS_WEBHOOK_ID is not configured');
  }

  console.log('[decryptWebhook] SIBS_WEBHOOK_ID configured: true, length:', SIBS_WEBHOOK_ID.length);
  console.log('[decryptWebhook] IV (base64):', ivBase64);
  console.log('[decryptWebhook] Auth tag (base64):', authTagBase64);
  console.log('[decryptWebhook] Body (first 100 chars):', base64Body.substring(0, 100));

  // Decode all base64 inputs
  const key = Buffer.from(SIBS_WEBHOOK_ID, 'base64');
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(base64Body, 'base64');

  console.log('[decryptWebhook] Key length:', key.length, 'bytes');
  console.log('[decryptWebhook] IV length:', iv.length, 'bytes');
  console.log('[decryptWebhook] Auth tag length:', authTag.length, 'bytes');
  console.log('[decryptWebhook] Ciphertext length:', ciphertext.length, 'bytes');

  // Decrypt using AES-GCM (no padding)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  const jsonString = decrypted.toString('utf8');
  console.log('[decryptWebhook] Decrypted payload:', jsonString);

  return JSON.parse(jsonString);
}

/**
 * Parse SIBS webhook data from the decrypted notification payload.
 */
export function parseWebhookData(data) {
  return {
    merchantTransactionId: data.merchant?.merchantTransactionId,
    transactionId: data.transactionID,
    notificationId: data.notificationID,
    amount: data.amount?.value,
    currency: data.amount?.currency,
    status: data.returnStatus?.statusCode,
    statusMessage: data.returnStatus?.statusMsg,
    paymentStatus: data.paymentStatus,
    paymentMethod: data.paymentMethod,
    paymentType: data.paymentType
  };
}