/**
 * Competition event configuration registry.
 * Add new events here — all generic API routes read from this config.
 *
 * Fee structure: use feeSchedule array for date-based pricing (new events),
 * or fees object for flat pricing (legacy). Use key 'default' as fallback.
 */

export const EVENTS = {
  // REFERENCE ONLY — niebocross continues to use its own routes (api/niebocross/) and tables (niebocross_*).
  // Do NOT use this config entry with generic API routes. It exists so email templates can share the
  // event name/location/URL strings if niebocross is ever migrated to the generic system.
  'niebocross-2026': {
    id: 'niebocross-2026',
    name: 'NieboCross 2026',
    date: '2026-04-12',
    location: 'Nieborowice',
    locationFull: '12 kwietnia 2026 w Nieborowicach',
    slug: 'niebocross',
    cookiePrefix: 'niebocross_2026',
    panelUrl: 'https://zatyrani.pl/niebocross/panel',
    paymentUrl: 'https://zatyrani.pl/niebocross/payment',
    distances: ['3km_run', '3km_nw', '9km_run', '9km_nw', 'kids_run'],
    ageRules: [
      { categories: ['3km_run', '3km_nw'], minAge: 16 },
      { categories: ['9km_run', '9km_nw'], minAge: 18 },
      { categories: ['kids_run'], maxAge: 15 }
    ],
    fees: {
      'kids_run': 20,
      default: 60
    },
    limits: [
      { group: 'kids', categories: ['kids_run'], limit: 30 },
      { group: 'adults_runners', categories: ['3km_run', '9km_run'], limit: 150 },
      { group: 'nw', categories: ['3km_nw', '9km_nw'], limit: 70 }
    ],
    tshirtEnabled: true,
    foodEnabled: true,
    tshirtSizes: ['116', '128', '134', '140', '146', '152', 'XS', 'S', 'M', 'L', 'XL', 'XXL']
  },
  'wilczypolmaraton-2026': {
    id: 'wilczypolmaraton-2026',
    name: 'Wilczy Półmaraton 2026',
    date: '2026-10-01', // TODO: update when confirmed
    location: 'TBD',
    locationFull: 'TBD',
    slug: 'wilczypolmaraton',
    cookiePrefix: 'wilczypolmaraton_2026',
    panelUrl: 'https://zatyrani.pl/wilczypolmaraton/panel',
    paymentUrl: 'https://zatyrani.pl/wilczypolmaraton/payment',
    distances: ['21km', '11km_nw', '21km_canicross'],
    ageRules: [
      { categories: ['21km', '11km_nw', '21km_canicross'], minAge: 18 }
    ],
    feeSchedule: [
      { until: '2026-08-31', fees: { default: 100 } },
      { until: '2026-10-16', fees: { default: 120 } },
    ],
    limits: [
      { group: 'runners', categories: ['21km', '11km_nw', '21km_canicross'], limit: 250 }
    ],
    tshirtEnabled: true,
    tshirtPrice: 70,
    tshirtImage: '/halfmarathon/tshirt.webp',
    tshirtSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  }
};

/**
 * Get event config by ID. Throws if event not found.
 * @param {string} eventId
 * @returns {Object} event config
 */
export function getEventConfig(eventId) {
  const config = EVENTS[eventId];
  if (!config) {
    throw new Error(`Unknown event: ${eventId}`);
  }
  return config;
}
