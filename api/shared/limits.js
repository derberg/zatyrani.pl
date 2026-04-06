/**
 * Generic participant limits helpers driven by event config.
 * Each event defines a `limits` array in its config:
 *   limits: [{ group: 'runners', categories: ['21km', '10km'], limit: 500 }]
 */

/**
 * Get the group name for a race category, using event config limits.
 * Returns null if category has no defined group.
 */
export function getGroupForCategory(raceCategory, eventConfig) {
  for (const limitConfig of (eventConfig.limits || [])) {
    if (limitConfig.categories.includes(raceCategory)) {
      return limitConfig.group;
    }
  }
  return null;
}

/**
 * Build initial paidCounts object with all groups set to 0.
 */
export function buildPaidCounts(eventConfig) {
  const counts = {};
  for (const limitConfig of (eventConfig.limits || [])) {
    counts[limitConfig.group] = 0;
  }
  return counts;
}

/**
 * Build limitsAndCounts response object for list API.
 */
export function buildLimitsAndCounts(paidCounts, eventConfig) {
  const result = {};
  for (const limitConfig of (eventConfig.limits || [])) {
    result[limitConfig.group] = {
      count: paidCounts[limitConfig.group] || 0,
      limit: limitConfig.limit
    };
  }
  return result;
}
