const router = require('express').Router();
const crypto = require('crypto');
const dns = require('dns').promises;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { User } = require('../models');
const { ah, auth, HttpError } = require('../middleware/auth');
const { sendVerificationEmail, mailConfigured } = require('../utils/mailer');

const CODE_MINUTES = 15;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;

const sign = (u) => jwt.sign({ id: u._id, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role, level: u.level, subject: u.subject, school: u.school, city: u.city });
const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');
const cleanEmail = (e) => String(e || '').toLowerCase().trim();

// Common typing mistakes in email domains
const TYPOS = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.fr': 'gmail.com', 'gnail.com': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com' };

// Checks the email looks right and that its domain can really receive emails
async function checkEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) || email.length > 120) throw new HttpError(400, 'This email address is not valid');
  const domain = email.split('@')[1];
  if (TYPOS[domain]) throw new HttpError(400, `Did you mean ${email.split('@')[0]}@${TYPOS[domain]}? Check your email address.`);
  try {
    const mx = await Promise.race([dns.resolveMx(domain), new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), 3000))]);
    if (!mx || !mx.length) throw Object.assign(new Error('no mx'), { code: 'ENODATA' });
  } catch (e) {
    // Only refuse when the domain clearly does not exist; if we are offline, let it pass
    if (e.code === 'ENOTFOUND' || e.code === 'ENODATA') throw new HttpError(400, `The domain "${domain}" cannot receive emails. Check your email address.`);
  }
}

// Creates a new 6-digit code, saves its hash and emails it
async function issueCode(user) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  user.verifyCodeHash = hashCode(code);
  user.verifyExpires = new Date(Date.now() + CODE_MINUTES * 60000);
  user.verifyAttempts = 0;
  user.verifySentAt = new Date();
  await user.save();
  let sent = false;
  try { sent = (await sendVerificationEmail(user.email, user.name, code)).sent; }
  catch (e) {
    console.error('[mail] Could not send email:', e.message);
    throw new HttpError(502, 'We could not send the email. Check the Gmail settings in .env and try again.');
  }
  const out = { needsVerification: true, email: user.email, emailSent: sent, resendIn: RESEND_SECONDS };
  // Test mode only (no Gmail configured): show the code so the site can still be tried
  if (!mailConfigured) out.devCode = code;
  return out;
}

router.post('/register', ah(async (req, res) => {
  const { name, password, role, level, subject, school, city } = req.body;
  const email = cleanEmail(req.body.email);
  if (!name || !String(name).trim() || !email || !password) throw new HttpError(400, 'Name, email and password are required');
  if (!['teacher', 'student'].includes(role)) throw new HttpError(400, 'Choose teacher or student');
  if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  let user = await User.findOne({ email });
  if (user && user.verified) throw new HttpError(409, 'This email is already registered. Please log in.');
  await checkEmail(email);
  if (user && user.verifySentAt && Date.now() - user.verifySentAt.getTime() < RESEND_SECONDS * 1000) {
    throw new HttpError(429, 'A code was just sent to this email. Wait one minute and try again.');
  }
  // A not-yet-verified account with this email is simply replaced
  if (!user) user = new User({ email });
  Object.assign(user, {
    name: String(name).trim(), role, school, city, verified: false,
    level: role === 'student' ? level : undefined,
    subject: role === 'teacher' ? subject : undefined,
    password: await bcrypt.hash(String(password), 10),
  });
  res.status(201).json(await issueCode(user));
}));

router.post('/verify', ah(async (req, res) => {
  const user = await User.findOne({ email: cleanEmail(req.body.email) });
  const code = String(req.body.code || '').replace(/\D/g, '');
  if (!user) throw new HttpError(404, 'Account not found. Create your account again.');
  if (user.verified) return res.json({ token: sign(user), user: pub(user) });
  if (!user.verifyCodeHash || !user.verifyExpires || user.verifyExpires < new Date()) throw new HttpError(400, 'This code has expired. Ask for a new code.');
  if (user.verifyAttempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong tries. Ask for a new code.');
  if (code.length !== 6 || hashCode(code) !== user.verifyCodeHash) {
    user.verifyAttempts += 1;
    await user.save();
    const left = MAX_ATTEMPTS - user.verifyAttempts;
    throw new HttpError(400, left > 0 ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Ask for a new code.');
  }
  user.verified = true;
  user.verifyCodeHash = undefined;
  user.verifyExpires = undefined;
  user.verifyAttempts = 0;
  await user.save();
  res.json({ token: sign(user), user: pub(user) });
}));

router.post('/resend', ah(async (req, res) => {
  const user = await User.findOne({ email: cleanEmail(req.body.email) });
  if (!user) throw new HttpError(404, 'Account not found. Create your account again.');
  if (user.verified) throw new HttpError(400, 'This email is already confirmed. You can log in.');
  const wait = user.verifySentAt ? RESEND_SECONDS - Math.floor((Date.now() - user.verifySentAt.getTime()) / 1000) : 0;
  if (wait > 0) throw new HttpError(429, `Please wait ${wait} seconds before asking for a new code.`);
  res.json(await issueCode(user));
}));

router.post('/login', ah(async (req, res) => {
  const { password } = req.body;
  const user = await User.findOne({ email: cleanEmail(req.body.email) });
  if (!user || !(await bcrypt.compare(String(password || ''), user.password))) throw new HttpError(401, 'Wrong email or password');
  if (!user.verified) {
    // Right password but email not confirmed yet: send a code (if none was sent in the last minute)
    const recent = user.verifySentAt && Date.now() - user.verifySentAt.getTime() < RESEND_SECONDS * 1000;
    const info = recent ? { needsVerification: true, email: user.email, emailSent: mailConfigured, resendIn: RESEND_SECONDS - Math.floor((Date.now() - user.verifySentAt.getTime()) / 1000) } : await issueCode(user);
    return res.status(403).json({ error: 'Confirm your email first. We sent you a code.', ...info });
  }
  res.json({ token: sign(user), user: pub(user) });
}));

router.get('/me', auth, (req, res) => res.json(pub(req.user)));

router.put('/me', auth, ah(async (req, res) => {
  const { name, level, subject, school, city, password } = req.body;
  const u = await User.findById(req.user._id);
  if (name) u.name = name;
  if (u.role === 'student' && level) u.level = level;
  if (u.role === 'teacher' && subject !== undefined) u.subject = subject;
  if (school !== undefined) u.school = school;
  if (city !== undefined) u.city = city;
  if (password) {
    if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    u.password = await bcrypt.hash(String(password), 10);
  }
  await u.save();
  res.json(pub(u));
}));

module.exports = router;
