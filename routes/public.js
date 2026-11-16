// Routes that do not need a login: cities and schools for the sign-up form
const router = require('express').Router();
const { School } = require('../models');
const { ah } = require('../middleware/auth');

let citiesCache = null;

router.get('/cities', ah(async (req, res) => {
  if (!citiesCache) {
    const rows = await School.aggregate([{ $group: { _id: '$city', ar: { $first: '$cityAr' }, schools: { $sum: 1 } } }]);
    citiesCache = rows.map((r) => ({ name: r._id, ar: r.ar || '', schools: r.schools })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  res.json(citiesCache);
}));

router.get('/schools', ah(async (req, res) => {
  const city = String(req.query.city || '');
  if (!city) return res.json([]);
  const rows = await School.find({ city }).select('name -_id').lean();
  res.json(rows.map((r) => r.name).sort((a, b) => a.localeCompare(b, 'fr')));
}));

module.exports = router;
