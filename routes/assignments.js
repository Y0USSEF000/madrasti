const router = require('express').Router();
const { Course, Assignment, Submission, Enrollment } = require('../models');
const { ah, auth, role, HttpError, ownCourse, canAccessCourse, upload, toFiles } = require('../middleware/auth');

router.use(auth);

async function loadAssignment(id) {
  const a = await Assignment.findById(id).catch(() => null);
  if (!a) throw new HttpError(404, 'Assignment not found');
  return a;
}

// List: teacher -> all assignments of own courses with counts; student -> enrolled courses with own submission
router.get('/', ah(async (req, res) => {
  if (req.user.role === 'teacher') {
    const courses = await Course.find({ teacher: req.user._id }).select('title color').lean();
    const list = await Assignment.find({ course: { $in: courses.map((c) => c._id) } }).sort({ dueDate: -1 }).lean();
    const [subs, enrolls] = await Promise.all([
      Submission.aggregate([{ $match: { assignment: { $in: list.map((a) => a._id) } } },
        { $group: { _id: '$assignment', n: { $sum: 1 }, graded: { $sum: { $cond: [{ $eq: ['$status', 'graded'] }, 1, 0] } } } }]),
      Enrollment.aggregate([{ $match: { course: { $in: courses.map((c) => c._id) } } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
    ]);
    const sm = Object.fromEntries(subs.map((s) => [String(s._id), s]));
    const em = Object.fromEntries(enrolls.map((e) => [String(e._id), e.n]));
    return res.json(list.map((a) => ({
      ...a, course: courses.find((c) => String(c._id) === String(a.course)),
      submitted: sm[String(a._id)]?.n || 0, graded: sm[String(a._id)]?.graded || 0, students: em[String(a.course)] || 0,
    })));
  }
  const enrolls = await Enrollment.find({ student: req.user._id }).populate('course', 'title color').lean();
  const courses = enrolls.map((e) => e.course).filter(Boolean);
  const list = await Assignment.find({ course: { $in: courses.map((c) => c._id) } }).sort({ dueDate: 1 }).lean();
  const subs = await Submission.find({ student: req.user._id, assignment: { $in: list.map((a) => a._id) } }).lean();
  res.json(list.map((a) => ({
    ...a, course: courses.find((c) => String(c._id) === String(a.course)),
    submission: subs.find((s) => String(s.assignment) === String(a._id)) || null,
  })));
}));

router.get('/:id', ah(async (req, res) => {
  const a = await loadAssignment(req.params.id);
  const course = await canAccessCourse(a.course, req.user);
  const out = { ...a.toObject(), course: { _id: course._id, title: course.title, color: course.color } };
  if (req.user.role === 'student') out.submission = await Submission.findOne({ assignment: a._id, student: req.user._id }).lean();
  res.json(out);
}));

router.put('/:id', role('teacher'), upload.array('files', 5), ah(async (req, res) => {
  const a = await loadAssignment(req.params.id);
  await ownCourse(a.course, req.user);
  for (const k of ['title', 'instructions']) if (req.body[k] !== undefined) a[k] = req.body[k];
  if (req.body.dueDate) a.dueDate = new Date(req.body.dueDate);
  if (req.body.maxPoints) a.maxPoints = Number(req.body.maxPoints) || 20;
  a.attachments.push(...toFiles(req.files));
  await a.save();
  res.json(a);
}));

router.delete('/:id', role('teacher'), ah(async (req, res) => {
  const a = await loadAssignment(req.params.id);
  await ownCourse(a.course, req.user);
  await Submission.deleteMany({ assignment: a._id });
  await a.deleteOne();
  res.json({ ok: true });
}));

// Teacher: all submissions + students who have not submitted
router.get('/:id/submissions', role('teacher'), ah(async (req, res) => {
  const a = await loadAssignment(req.params.id);
  const course = await ownCourse(a.course, req.user);
  const [subs, enrolls] = await Promise.all([
    Submission.find({ assignment: a._id }).populate('student', 'name email level').sort({ submittedAt: -1 }).lean(),
    Enrollment.find({ course: a.course }).populate('student', 'name email level').lean(),
  ]);
  const submittedIds = new Set(subs.map((s) => String(s.student?._id)));
  res.json({
    assignment: { ...a.toObject(), course: { _id: course._id, title: course.title } },
    submissions: subs.filter((s) => s.student),
    missing: enrolls.map((e) => e.student).filter((s) => s && !submittedIds.has(String(s._id))),
  });
}));

// Student submits (or re-submits before grading)
router.post('/:id/submit', role('student'), upload.array('files', 5), ah(async (req, res) => {
  const a = await loadAssignment(req.params.id);
  await canAccessCourse(a.course, req.user);
  const text = String(req.body.text || '').trim();
  const files = toFiles(req.files);
  let sub = await Submission.findOne({ assignment: a._id, student: req.user._id });
  if (sub && sub.status === 'graded') throw new HttpError(400, 'This work is already graded');
  if (!text && !files.length && !(sub && sub.files.length)) throw new HttpError(400, 'Write an answer or attach a file');
  const late = Date.now() > new Date(a.dueDate).getTime();
  if (sub) {
    sub.text = text;
    if (files.length) sub.files = files;
    sub.submittedAt = new Date();
    sub.late = late;
    await sub.save();
  } else {
    sub = await Submission.create({ assignment: a._id, student: req.user._id, text, files, late });
  }
  await Enrollment.updateOne({ student: req.user._id, course: a.course }, { lastActivity: new Date() });
  res.json(sub);
}));

// Teacher grades a submission
router.put('/submissions/:sid/grade', role('teacher'), ah(async (req, res) => {
  const sub = await Submission.findById(req.params.sid).catch(() => null);
  if (!sub) throw new HttpError(404, 'Submission not found');
  const a = await loadAssignment(sub.assignment);
  await ownCourse(a.course, req.user);
  const grade = Number(req.body.grade);
  if (req.body.grade === '' || req.body.grade === undefined || Number.isNaN(grade) || grade < 0 || grade > a.maxPoints) {
    throw new HttpError(400, `Grade must be between 0 and ${a.maxPoints}`);
  }
  sub.grade = grade;
  sub.feedback = req.body.feedback || '';
  sub.status = 'graded';
  sub.gradedAt = new Date();
  await sub.save();
  res.json(sub);
}));

module.exports = router;
