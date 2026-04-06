export const EVENT_ID = 'wilczypolmaraton-2026';
export const EVENT_NAME = 'Wilczy Półmaraton 2026';
export const EVENT_DATE = '2026-10-01'; // TODO: update when confirmed
export const COOKIE_PREFIX = 'wilczypolmaraton_2026';
export const API_BASE = `/api/events/${EVENT_ID}`;

export const RACE_CATEGORIES = ['21km', '11km_nw', '21km_canicross'] as const;
export type RaceCategory = typeof RACE_CATEGORIES[number];

export const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type TshirtSize = typeof TSHIRT_SIZES[number];
