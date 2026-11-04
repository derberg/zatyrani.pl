// Plebiscyt configuration, shared by the /plebiscyt page and /api/plebiscyt/*.
// To add a voting category, append it to `categories`; votes are stored per `key`.
const GALA_WHEN = "21 listopada 2026 o 18:00";

export const PLEBISCYT = {
  edition: 2026,
  // Voting is open until the end of 14 November 2026, Polish time.
  closesAt: "2026-11-14T23:59:59+01:00",
  closesLabel: "14 listopada 2026",
  // Stored in `votes` instead of a member id when someone does not want to vote in a category.
  abstain: {
    key: "abstain",
    label: "Wstrzymuję się od głosu",
  },
  categories: [
    {
      key: "serce_druzyny",
      label: "Serce Drużyny",
      hint: "Osoba, która najbardziej motywuje innych, organizuje wspólne wyjazdy i wspiera na trasie.",
    },
    {
      key: "zatyrany_roku",
      label: "Zatyrany Roku",
      hint: "Osoba, która wyróżniła się nie tylko wynikami sportowymi, ale też poświęciła się dla rozwoju grupy w 2026 roku.",
    },
  ],
  // Required question at the end of the form. `people` is how many seats the answer takes.
  gala: {
    label: "Czy będziesz na Gali Zatyranych?",
    when: GALA_WHEN,
    hint: `Gala odbędzie się ${GALA_WHEN}.`,
    options: [
      { key: "no", label: "Nie będę", people: 0 },
      { key: "alone", label: "Będę sam/sama", people: 1 },
      { key: "plus_one", label: "Będę z osobą towarzyszącą", people: 2 },
    ],
  },
};

export const ACHIEVEMENT_MAX_LENGTH = 1000;

export function isPlebiscytClosed(now = new Date()) {
  return now.getTime() > new Date(PLEBISCYT.closesAt).getTime();
}
