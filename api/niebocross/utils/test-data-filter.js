/**
 * Utility functions for filtering test data in production
 */

// Test emails that should only be visible in development
const TEST_EMAILS = ['derberg@wp.pl'];

/**
 * Check if we're running in a production environment
 * @returns {boolean} True if in production, false otherwise
 */
export function isProduction() {
  // In Vercel, VERCEL_ENV is set to 'production', 'preview', or 'development'
  // When running locally with 'vercel dev', VERCEL_ENV is 'development'
  const vercelEnv = process.env.VERCEL_ENV;
  return vercelEnv === 'production';
}

/**
 * Check if an email should be filtered out (is test data and we're in production)
 * @param {string} email - Email address to check
 * @returns {boolean} True if the email should be filtered out
 */
export function shouldFilterEmail(email) {
  if (!email) return false;
  return isProduction() && TEST_EMAILS.includes(email.toLowerCase());
}

/**
 * Check if a registration should be visible based on environment
 * @param {Object} registration - Registration object with email property
 * @returns {boolean} True if the registration should be visible
 */
export function isRegistrationVisible(registration) {
  if (!registration?.email) return true;
  return !shouldFilterEmail(registration.email);
}
