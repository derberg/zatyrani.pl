/**
 * Niebocross Race Constants (Frontend)
 *
 * ⚠️ IMPORTANT SYNC REQUIREMENTS:
 * Due to Vercel's architecture, these constants must be kept in sync with:
 * 1. api/niebocross/utils/constants.js (API layer - separate runtime)
 * 2. Database CHECK constraint (see below)
 *
 * When updating TSHIRT_SIZES or other constants, update ALL three places!
 *
 * Database constraint:
 * ALTER TABLE niebocross_participants ADD CONSTRAINT niebocross_participants_tshirt_size_check
 * CHECK (tshirt_size IN ('116', '128', '134', '140', '146', '152', 'XS', 'S', 'M', 'L', 'XL', 'XXL'));
 */

/**
 * Available t-shirt sizes for participants
 * Includes both child sizes (116-152) and adult sizes (XS-XXL)
 */
export const TSHIRT_SIZES = [
  '116',
  '128',
  '134',
  '140',
  '146',
  '152',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL'
] as const;

export type TshirtSize = typeof TSHIRT_SIZES[number];
