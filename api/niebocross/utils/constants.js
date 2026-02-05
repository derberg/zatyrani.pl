/**
 * Niebocross Race Constants
 * Shared constants for API validation
 *
 * IMPORTANT: When updating TSHIRT_SIZES, remember to also update:
 * 1. src/utils/niebocross/constants.ts (frontend)
 * 2. The database CHECK constraint:
 *    ALTER TABLE niebocross_participants ADD CONSTRAINT niebocross_participants_tshirt_size_check
 *    CHECK (tshirt_size IN ('116', '128', '134', '140', '146', '152', 'XS', 'S', 'M', 'L', 'XL', 'XXL'));
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
];

export const VALID_RACE_CATEGORIES = ['3km_run', '3km_nw', '9km_run', '9km_nw', 'kids_run'];

export const EVENT_DATE = '2026-04-12';
