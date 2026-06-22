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
    charityEvent: true,
    tshirtEnabled: true,
    foodEnabled: true,
    tshirtSizes: ['116', '128', '134', '140', '146', '152', 'XS', 'S', 'M', 'L', 'XL', 'XXL']
  },
  'wilczypolmaraton-2026': {
    id: 'wilczypolmaraton-2026',
    name: 'Wilczy Polmaraton 2026',
    date: '2026-10-17',
    location: 'Wilcza',
    locationFull: '17 października 2026 w Wilczy',
    slug: 'wilczypolmaraton',
    cookiePrefix: 'wilczypolmaraton_2026',
    panelUrl: 'https://zatyrani.pl/wilczy-polmaraton/panel',
    paymentUrl: 'https://zatyrani.pl/wilczy-polmaraton/payment',
    distances: ['21km', '11km_nw', '21km_canicross'],
    ageRules: [
      { categories: ['21km', '11km_nw', '21km_canicross'], minAge: 18 }
    ],
    feeSchedule: [
      { until: '2026-05-31', fees: { default: 100 } },
      { until: '2026-10-17', fees: { '11km_nw': 100, default: 130 } }
    ],
    limits: [
      { group: 'run', categories: ['21km'], limit: 220 },
      { group: 'canicross', categories: ['21km_canicross'], limit: 30 },
      { group: 'nw', categories: ['11km_nw'], limit: 30 }
    ],
    tshirtEnabled: true,
    tshirtPrice: 80,
    tshirtImage: '/halfmarathon/2026/koszulka.jpeg',
    tshirtSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  },
  // Free night run. No payment is ever created (paymentEnabled: false). People who
  // registered for wilczypolmaraton-2026 are recognised and their data is prefilled
  // (prefillSourceEventId). Registration closes at end of registrationDeadline.
  'polwilka-2026': {
    id: 'polwilka-2026',
    name: 'Nocny Zew Wilka 2026',
    date: '2026-08-07',
    location: 'Azyl Zatyranych, Rybnik-Ochojec',
    locationFull: '7 sierpnia 2026 o 20:00 w Azylu Zatyranych (Rybnik-Ochojec)',
    slug: 'zewwilka',
    panelUrl: 'https://zatyrani.pl/wilczy-polmaraton/zewwilka',
    paymentUrl: 'https://zatyrani.pl/wilczy-polmaraton/zewwilka',
    cookiePrefix: 'polwilka_2026',
    distances: ['10km', '10km_nw', '10km_canicross'],
    ageRules: [
      { categories: ['10km', '10km_nw', '10km_canicross'], minAge: 18 }
    ],
    fees: { default: 0 },
    limits: [
      { group: 'all', categories: ['10km', '10km_nw', '10km_canicross'], limit: 50 }
    ],
    tshirtEnabled: false,
    paymentEnabled: false,
    registrationDeadline: '2026-08-05',
    prefillSourceEventId: 'wilczypolmaraton-2026',
    // Enforce a single total cap (sum of `limits`). Opt-in: other events (e.g.
    // wilczypolmaraton, whose `limits` are per-group) are left unenforced as before.
    enforceTotalLimit: true
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
