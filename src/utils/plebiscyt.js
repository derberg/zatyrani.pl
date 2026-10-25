// Plebiscyt configuration, shared by the /plebiscyt2026 page and /api/plebiscyt/*.
// To add a voting category, append it to `categories`; votes are stored per `key`.
export const PLEBISCYT = {
  edition: 2026,
  // Voting is open until the end of 14 November 2026, Polish time.
  closesAt: "2026-11-14T23:59:59+01:00",
  closesLabel: "14 listopada 2026",
  categories: [
    {
      key: "zatyrany_roku",
      label: "Wybierz Zatyranego Roku",
      hint: "Kto Twoim zdaniem najbardziej zasłużył na tytuł w 2026?",
    },
  ],
};

export const ACHIEVEMENT_MAX_LENGTH = 1000;

export function isPlebiscytClosed(now = new Date()) {
  return now.getTime() > new Date(PLEBISCYT.closesAt).getTime();
}
