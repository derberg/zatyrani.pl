const OWNER = "derberg";
const REPO = "zatyrani.pl";

export async function readGithubFile(octokit, path) {
  const { data: file } = await octokit.repos.getContent({
    owner: OWNER,
    repo: REPO,
    path,
  });

  const decoded = Buffer.from(file.content ?? "", "base64").toString();
  return decoded ? JSON.parse(decoded) : [];
}

export async function updateGithubFile(octokit, { path, content, message }) {
  return octokit.createOrUpdateTextFile({
    owner: OWNER,
    repo: REPO,
    path,
    message,
    content: JSON.stringify(content, null, 2),
  });
}

export async function readExistingData(octokit, trainings = false) {
  const path = trainings ? "src/data/trainings.json" : "src/data/events.json";
  return readGithubFile(octokit, path);
}

export async function updateFile(octokit, message, content, trainings = false) {
  const path = trainings ? "src/data/trainings.json" : "src/data/events.json";
  return updateGithubFile(octokit, { path, content, message });
}

// Backwards-compatible aliases used in existing tests
export async function readExistingEventsData(octokit) {
  return readExistingData(octokit, false);
}

export async function updateEventsFile(octokit, message, content) {
  return updateFile(octokit, message, content, false);
}

export function formatDate(dateString) {
  const date = new Date(dateString);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export function formatDateDisplay(dateString) {
  const [day, month, year] = dateString.split("/").map(Number);
  const dateObj = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateObj);
}

export function formatDateTimeDisplay(dateTimeString) {
  const [datePart, timePart] = dateTimeString.split(" ");
  const [day, month, year] = datePart.split("/").map(Number);
  const [hours, minutes] = timePart.split(":");

  const dateObj = new Date(year, month - 1, day, hours, minutes);
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
}

export function formatDateForInput(dateString) {
  if (!dateString) return "";
  const [day, month, year] = dateString.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function formatDateTimeForInput(dateTimeString) {
  if (!dateTimeString) return "";
  const [datePart, timePart] = dateTimeString.split(" ");
  const [day, month, year] = datePart.split("/");
  const [hours, minutes] = timePart.split(":");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

export function formatDateTime(dateTimeString) {
  const d = new Date(dateTimeString);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const mins = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

export function generateTrainingUID(type, datetime, location, distance, pace) {
  let day;
  let month;
  let year;
  let hours;
  let mins;

  if (datetime.includes("/")) {
    const [datePart, timePart] = datetime.split(" ");
    [day, month, year] = datePart.split("/");
    [hours, mins] = timePart.split(":");
  } else {
    const d = new Date(datetime);
    day = String(d.getUTCDate());
    month = String(d.getUTCMonth() + 1);
    year = d.getUTCFullYear();
    hours = String(d.getUTCHours());
    mins = String(d.getUTCMinutes());
  }

  const polishMap = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ż: "z",
    ź: "z",
    Ą: "a",
    Ć: "c",
    Ę: "e",
    Ł: "l",
    Ń: "n",
    Ó: "o",
    Ś: "s",
    Ż: "z",
    Ź: "z",
  };

  const normalize = (value) =>
    value
      .toString()
      .replace(/[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ]/g, (match) => polishMap[match])
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return [
    normalize(type),
    day,
    month,
    year,
    hours,
    mins,
    normalize(location),
    distance,
    pace,
  ].join("-");
}

export function generateUID(title, date) {
  const polishMap = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ż: "z",
    ź: "z",
    Ą: "a",
    Ć: "c",
    Ę: "e",
    Ł: "l",
    Ń: "n",
    Ó: "o",
    Ś: "s",
    Ż: "z",
    Ź: "z",
  };

  const slug = title
    .slice(0, 40)
    .replace(/[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ]/g, (match) => polishMap[match])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug}-${formatDate(date).replace(/\//g, "-")}`;
}

export function deleteByUid(items, uid) {
  const updated = items.filter((item) => item.uid !== uid);
  return updated.length === items.length ? null : updated;
}

export function updateByUid(items, uid, newData) {
  const index = items.findIndex((item) => item.uid === uid);
  if (index === -1) return null;

  return [
    ...items.slice(0, index),
    { ...items[index], ...newData },
    ...items.slice(index + 1),
  ];
}

export function normalizeEventData(body) {
  const { name, date, website, registration, description, location } = body;

  return {
    date: formatDate(date),
    title: name,
    mainLink: website,
    registrationLink: registration,
    description,
    image: "",
    location,
    uid: generateUID(name, date),
  };
}
