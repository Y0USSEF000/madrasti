// Turns the raw OpenStreetMap export (seed-data/osm-raw.json) into seed-data/schools.json
// Each school is attached to the nearest city/town (max 15 km).
// Data © OpenStreetMap contributors (ODbL).
const fs = require('fs');
const path = require('path');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed-data', 'osm-raw.json'), 'utf8'));

const hasLatin = (s) => /[A-Za-z]/.test(s || '');
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const km = (a, b) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const places = [], schools = [];
for (const el of raw.elements) {
  const t = el.tags || {};
  const pos = el.lat !== undefined ? { lat: el.lat, lon: el.lon } : el.center;
  if (!pos) continue;
  if (t.place) {
    const name = clean(t['name:fr'] || (hasLatin(t.name) ? t.name : '') || t['name:en'] || t.name);
    if (name) places.push({ name, ar: clean(t['name:ar'] || (!hasLatin(t.name) ? t.name : '')), kind: t.place, pop: Number(t.population) || 0, ...pos });
  } else if (t.amenity === 'school') {
    const fr = clean(t['name:fr'] || (hasLatin(t.name) ? t.name : ''));
    const ar = clean(t['name:ar'] || (!hasLatin(t.name) ? t.name : ''));
    const name = fr && ar && fr !== ar ? `${fr} — ${ar}` : fr || ar;
    if (name && name.length >= 3 && name.length <= 120) schools.push({ name, ...pos });
  }
}

const byCity = new Map();
for (const s of schools) {
  let best = null, bestD = Infinity;
  for (const p of places) {
    const d = km(s, p) * (p.kind === 'city' ? 0.6 : 1); // big cities attract a wider area
    if (d < bestD) { bestD = d; best = p; }
  }
  if (!best || bestD > 15) continue;
  if (!byCity.has(best.name)) byCity.set(best.name, { city: best.name, ar: best.ar, schools: new Set() });
  byCity.get(best.name).schools.add(s.name);
}

const out = [...byCity.values()]
  .map((c) => ({ city: c.city, ar: c.ar, schools: [...c.schools].sort((a, b) => a.localeCompare(b, 'fr')) }))
  .sort((a, b) => a.city.localeCompare(b.city, 'fr'));
fs.writeFileSync(path.join(__dirname, '..', 'seed-data', 'schools.json'), JSON.stringify(out));
console.log(`places: ${places.length}, named schools: ${schools.length}, cities with schools: ${out.length}, schools kept: ${out.reduce((n, c) => n + c.schools.length, 0)}`);
console.log(out.sort((a, b) => b.schools.length - a.schools.length).slice(0, 15).map((c) => `${c.city} (${c.schools.length})`).join(', '));
