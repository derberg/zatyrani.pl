// NieboCross participant limits configuration
// Easy to edit limits for different participant categories

export const PARTICIPANT_LIMITS = {
  kids: {
    categories: ['kids_run'],
    limit: 30
  },
  adults_runners: {
    categories: ['3km_run', '9km_run'],
    limit: 150
  },
  nw: {
    categories: ['3km_nw', '9km_nw'],
    limit: 70
  }
};

// Helper function to get limit for a category
export function getLimitForCategory(raceCategory) {
  for (const [, config] of Object.entries(PARTICIPANT_LIMITS)) {
    if (config.categories.includes(raceCategory)) {
      return config.limit;
    }
  }
  return 0; // No limit if category not found
}

// Helper function to get group for a category
export function getGroupForCategory(raceCategory) {
  for (const [group, config] of Object.entries(PARTICIPANT_LIMITS)) {
    if (config.categories.includes(raceCategory)) {
      return group;
    }
  }
  return null;
}