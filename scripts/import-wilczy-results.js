// Converts the BeepBeep "wszyscy" results export (markdown) into the JSON
// rendered by /wilczy-polmaraton/wyniki.
// Usage: node scripts/import-wilczy-results.js <path-to-wszyscy-*.md>
import fs from 'node:fs';
import path from 'node:path';

const STATUS = { 'ukończył': 'finished', 'na trasie': 'on_course', 'DNS': 'dns', 'DNF': 'dnf', 'DSQ': 'dsq' };
const RACE_IDS = { 'Półmaraton 21km': '21km', 'Canicross 21km': '21km_canicross', 'Nordic Walking 11km': '11km_nw' };
const RACE_ORDER = ['21km', '21km_canicross', '11km_nw'];

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/import-wilczy-results.js <wszyscy-*.md>');
  process.exit(1);
}

const lines = fs.readFileSync(input, 'utf8').split('\n');
const result = { updatedAt: null, races: [] };
let race = null;
let group = null;

for (const line of lines) {
  const stamp = line.match(/^Stan na (\S+ \S+)\./);
  if (stamp) result.updatedAt = stamp[1];

  const raceHeader = line.match(/^## (.+?) \(\d+\)$/);
  if (raceHeader) {
    const id = RACE_IDS[raceHeader[1]];
    if (!id) throw new Error(`Unknown race: ${raceHeader[1]}`);
    race = { id, name: raceHeader[1], groups: [] };
    result.races.push(race);
    continue;
  }

  const groupHeader = line.match(/^### (.+?) \(\d+\)$/);
  if (groupHeader) {
    group = { age: groupHeader[1], participants: [] };
    race.groups.push(group);
    continue;
  }

  if (!line.startsWith('|') || line.startsWith('|---') || line.startsWith('| Miejsce')) continue;
  const [place, bib, name, gender, birthYear, club, status, gross, net] = line.split('|').slice(1, -1).map((c) => c.trim());
  if (!STATUS[status]) throw new Error(`Unknown status "${status}" in: ${line}`);
  group.participants.push({
    place: place ? Number(place) : null,
    bib: Number(bib),
    name,
    gender,
    birthYear: Number(birthYear),
    club,
    status: STATUS[status],
    gross: gross || null,
    net: net || null,
  });
}

result.races.sort((a, b) => RACE_ORDER.indexOf(a.id) - RACE_ORDER.indexOf(b.id));

const out = path.resolve('src/data/wilczy-polmaraton-results-2026.json');
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
const count = result.races.reduce((n, r) => n + r.groups.reduce((m, g) => m + g.participants.length, 0), 0);
console.log(`Wrote ${count} participants (${result.updatedAt}) to ${out}`);
