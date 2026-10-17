// Converts the BeepBeep age-group export (CSV from age-groups.sh --gender) into
// the JSON rendered by /wilczy-polmaraton/wyniki. Only the main run is published.
// The top 3 per gender form the Open podium and are left out of the age groups,
// whose places are then recounted.
// Usage: node scripts/import-wilczy-results.js <age-groups.csv>
import fs from 'node:fs';
import path from 'node:path';

const RACE = 'Półmaraton 21km';
const STATUS = { finished: 'finished', started: 'on_course', dns: 'dns', dnf: 'dnf', dsq: 'dsq' };
const AGE_ORDER = ['18-29', '30-39', '40-49', '50-59', '60-69', '70+'];
const GENDER_ORDER = ['K', 'M'];

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/import-wilczy-results.js <age-groups.csv>');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const groups = new Map();
for (const r of parseCsv(fs.readFileSync(input, 'utf8'))) {
  if (r.dystans !== RACE) continue;
  const [age, gender] = r.grupa.split(' ');
  if (!AGE_ORDER.includes(age) || !GENDER_ORDER.includes(gender)) {
    throw new Error(`Unexpected group "${r.grupa}" for bib ${r.nr}; export with --gender`);
  }
  if (!STATUS[r.status]) throw new Error(`Unknown status "${r.status}" for bib ${r.nr}`);
  const key = `${gender} ${age}`;
  if (!groups.has(key)) groups.set(key, { gender, age, participants: [] });
  groups.get(key).participants.push({
    place: r.miejsce ? Number(r.miejsce) : null,
    bib: Number(r.nr),
    name: r.zawodnik,
    birthYear: Number(r.rocznik),
    club: r.klub,
    status: STATUS[r.status],
    gross: r.brutto || null,
    net: r.netto || null,
  });
}

const finishTime = (p) => (p.status === 'finished' ? p.gross || p.net : null);
const byTime = (a, b) => finishTime(a).localeCompare(finishTime(b));

// Equal times share a place, like rank() in the export.
function assignPlaces(participants) {
  const finishers = participants.filter(finishTime).sort(byTime);
  finishers.forEach((p, i) => {
    p.place = i > 0 && finishTime(p) === finishTime(finishers[i - 1]) ? finishers[i - 1].place : i + 1;
  });
  const rest = participants.filter((p) => !finishTime(p)).map((p) => ({ ...p, place: null }));
  return [...finishers, ...rest];
}

const sorted = [];
for (const gender of GENDER_ORDER) {
  const ageGroups = [...groups.values()]
    .filter((g) => g.gender === gender)
    .sort((a, b) => AGE_ORDER.indexOf(a.age) - AGE_ORDER.indexOf(b.age));
  const open = assignPlaces(ageGroups.flatMap((g) => g.participants)).filter((p) => p.place !== null && p.place <= 3);
  const openBibs = new Set(open.map((p) => p.bib));
  if (open.length) sorted.push({ gender, age: 'Open', participants: open });
  for (const g of ageGroups) {
    const participants = assignPlaces(g.participants.filter((p) => !openBibs.has(p.bib)).map((p) => ({ ...p })));
    if (participants.length) sorted.push({ ...g, participants });
  }
}

const exportedAt = fs.statSync(input).mtime.toLocaleString('sv-SE', { timeZone: 'Europe/Warsaw' }).slice(0, 16);
const result = { updatedAt: exportedAt, race: RACE, groups: sorted };

const out = path.resolve('src/data/wilczy-polmaraton-results-2026.json');
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
const count = sorted.reduce((n, g) => n + g.participants.length, 0);
console.log(`Wrote ${count} participants in ${sorted.length} groups (${exportedAt}) to ${out}`);
