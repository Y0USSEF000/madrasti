const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { JWT_SECRET, UPLOAD_DIR } = require('../config');
const { User, Course, Enrollment } = require('../models');

// Wrap async route handlers so errors go to the error middleware
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const auth = ah(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please log in');
  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); } catch { throw new HttpError(401, 'Session expired, please log in again'); }
  const user = await User.findById(payload.id).select('-password');
  if (!user) throw new HttpError(401, 'Account not found');
  req.user = user;
  next();
});

const role = (r) => (req, res, next) => {
  if (req.user.role !== r) return next(new HttpError(403, `Only ${r}s can do this`));
  next();
};

// Load a course and check the current user owns it (teacher)
async function ownCourse(courseId, user) {
  const course = await Course.findById(courseId).catch(() => null);
  if (!course) throw new HttpError(404, 'Course not found');
  if (String(course.teacher) !== String(user._id)) throw new HttpError(403, 'This is not your course');
  return course;
}

// Teacher owns course, or student is enrolled
async function canAccessCourse(courseId, user) {
  const course = await Course.findById(courseId).catch(() => null);
  if (!course) throw new HttpError(404, 'Course not found');
  if (user.role === 'teacher') {
    if (String(course.teacher) !== String(user._id)) throw new HttpError(403, 'This is not your course');
  } else {
    const enr = await Enrollment.findOne({ student: user._id, course: course._id });
    if (!enr) throw new HttpError(403, 'Enroll in this course first');
  }
  return course;
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const safe = path.basename(file.originalname).replace(/[^\w.\-]+/g, '_').slice(-80);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
});

// multer keeps latin1 names; convert to utf8 so Arabic/French names display correctly
const toFiles = (files = []) => files.map((f) => ({
  name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
  path: '/uploads/' + f.filename,
  size: f.size,
}));

module.exports = { ah, auth, role, HttpError, ownCourse, canAccessCourse, upload, toFiles };
