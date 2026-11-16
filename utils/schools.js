// Loads the list of Moroccan schools (from OpenStreetMap) into MongoDB.
// Safe to run many times: it only reloads when the number of schools is not the expected one.
const path = require('path');
const { School } = require('../models');

async function ensureSchools() {
  const data = require(path.join(__dirname, '..', 'seed-data', 'schools.json'));
  const docs = data.flatMap((c) => c.schools.map((name) => ({ city: c.city, cityAr: c.ar, name })));
  const count = await School.countDocuments();
  if (count === docs.length) return;
  await School.deleteMany({});
  await School.insertMany(docs, { ordered: false });
  console.log(`[db] Loaded ${docs.length} schools in ${data.length} cities`);
}

module.exports = { ensureSchools };
