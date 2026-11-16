const router = require('express').Router();
const { Course, Lesson, Enrollment, Assignment, Quiz, Announcement, Submission, QuizAttempt, Question, Note } = require('../models');
const { ah, auth, role, HttpError, ownCourse, canAccessCourse, upload, toFiles } = require('../middleware/auth');
const { checkMessage } = require('../utils/moderation');

router.use(auth);

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Catalog: every course, searchable
router.get('/', ah(async (req, res) => {
  const { level, subject, q } = req.query;
  const filter = {};
  if (level) filter.level = level;
  if (subject) filter.subject = subject;
  if (q) filter.$or = [{ title: new RegExp(escRe(q), 'i') }, { description: new RegExp(escRe(q), 'i') }];
  const courses = await Course.find(filter).populate('teacher', 'name school').sort({ level: 1, title: 1 }).lean();
  const ids = courses.map((c) => c._id);
  const [lessonCounts, enrollCounts, mine] = await Promise.all([
    Lesson.aggregate([{ $match: { course: { $in: ids }, status: 'published' } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
    Enrollment.aggregate([{ $match: { course: { $in: ids } } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
    req.user.role === 'student' ? Enrollment.find({ student: req.user._id }).lean() : [],
  ]);
  const lc = Object.fromEntries(lessonCounts.map((x) => [String(x._id), x.n]));
  const ec = Object.fromEntries(enrollCounts.map((x) => [String(x._id), x.n]));
  const mineSet = new Set(mine.map((e) => String(e.course)));
  res.json(courses.map((c) => ({ ...c, lessonCount: lc[String(c._id)] || 0, studentCount: ec[String(c._id)] || 0, enrolled: mineSet.has(String(c._id)) })));
}));

// Teacher: own courses. Student: enrolled courses with progress
router.get('/mine', ah(async (req, res) => {
  if (req.user.role === 'teacher') {
    const courses = await Course.find({ teacher: req.user._id }).sort({ createdAt: -1 }).lean();
    const ids = courses.map((c) => c._id);
    const [lessons, enrolls] = await Promise.all([
      Lesson.aggregate([{ $match: { course: { $in: ids } } }, { $group: { _id: '$course', n: { $sum: 1 }, drafts: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } } } }]),
      Enrollment.aggregate([{ $match: { course: { $in: ids } } }, { $group: { _id: '$course', n: { $sum: 1 } } }]),
    ]);
    const lc = Object.fromEntries(lessons.map((x) => [String(x._id), x]));
    const ec = Object.fromEntries(enrolls.map((x) => [String(x._id), x.n]));
    return res.json(courses.map((c) => ({ ...c, lessonCount: lc[String(c._id)]?.n || 0, draftCount: lc[String(c._id)]?.drafts || 0, studentCount: ec[String(c._id)] || 0 })));
  }
  const enrolls = await Enrollment.find({ student: req.user._id }).populate({ path: 'course', populate: { path: 'teacher', select: 'name' } }).sort({ lastActivity: -1 }).lean();
  const valid = enrolls.filter((e) => e.course);
  const ids = valid.map((e) => e.course._id);
  const lessons = await Lesson.find({ course: { $in: ids }, status: 'published' }).select('_id course').lean();
  res.json(valid.map((e) => {
    const courseLessons = lessons.filter((l) => String(l.course) === String(e.course._id));
    const set = new Set(courseLessons.map((l) => String(l._id)));
    const done = e.completedLessons.filter((id) => set.has(String(id))).length;
    return { ...e.course, lessonCount: courseLessons.length, completed: done, progress: courseLessons.length ? Math.round((done / courseLessons.length) * 100) : 0, lastActivity: e.lastActivity };
  }));
}));

router.post('/', role('teacher'), ah(async (req, res) => {
  const { title, subject, level, description, color } = req.body;
  if (!title || !subject || !level) throw new HttpError(400, 'Title, subject and level are required');
  res.status(201).json(await Course.create({ title, subject, level, description, color, teacher: req.user._id }));
}));

// Course details: lessons + assignments + quizzes + announcements
router.get('/:id', ah(async (req, res) => {
  const course = await Course.findById(req.params.id).populate('teacher', 'name school email').lean().catch(() => null);
  if (!course) throw new HttpError(404, 'Course not found');
  const isOwner = req.user.role === 'teacher' && String(course.teacher._id) === String(req.user._id);
  const enrollment = req.user.role === 'student' ? await Enrollment.findOne({ student: req.user._id, course: course._id }).lean() : null;
  const lessonFilter = { course: course._id };
  if (!isOwner) lessonFilter.status = 'published';
  const lessons = await Lesson.find(lessonFilter).select(isOwner || enrollment ? '' : 'title order duration objectives status').sort({ order: 1, createdAt: 1 }).lean();
  const out = { ...course, isOwner, enrolled: !!enrollment, lessons, studentCount: await Enrollment.countDocuments({ course: course._id }) };
  if (isOwner || enrollment) {
    const [assignments, quizzes, announcements] = await Promise.all([
      Assignment.find({ course: course._id }).sort({ dueDate: 1 }).lean(),
      Quiz.find(isOwner ? { course: course._id } : { course: course._id, published: true }).select('-questions.correct').sort({ createdAt: -1 }).lean(),
      Announcement.find({ course: course._id }).populate('author', 'name').sort({ createdAt: -1 }).lean(),
    ]);
    out.assignments = assignments;
    out.quizzes = quizzes.map((q) => ({ ...q, questionCount: q.questions.length, questions: undefined }));
    out.announcements = announcements;
  }
  if (enrollment) {
    const done = new Set(enrollment.completedLessons.map(String));
    out.lessons = out.lessons.map((l) => ({ ...l, completed: done.has(String(l._id)) }));
    const [subs, attempts] = await Promise.all([
      Submission.find({ student: req.user._id, assignment: { $in: out.assignments.map((a) => a._id) } }).lean(),
      QuizAttempt.find({ student: req.user._id, quiz: { $in: out.quizzes.map((q) => q._id) } }).select('-answers').lean(),
    ]);
    out.assignments = out.assignments.map((a) => ({ ...a, submission: subs.find((s) => String(s.assignment) === String(a._id)) || null }));
    out.quizzes = out.quizzes.map((q) => ({ ...q, attempt: attempts.find((t) => String(t.quiz) === String(q._id)) || null }));
    out.progress = out.lessons.length ? Math.round((out.lessons.filter((l) => l.completed).length / out.lessons.length) * 100) : 0;
  }
  res.json(out);
}));

router.put('/:id', role('teacher'), ah(async (req, res) => {
  const course = await ownCourse(req.params.id, req.user);
  for (const k of ['title', 'subject', 'level', 'description', 'color']) if (req.body[k] !== undefined) course[k] = req.body[k];
  await course.save();
  res.json(course);
}));

router.delete('/:id', role('teacher'), ah(async (req, res) => {
  const course = await ownCourse(req.params.id, req.user);
  const [lessons, assignments, quizzes] = await Promise.all([
    Lesson.find({ course: course._id }).select('_id'), Assignment.find({ course: course._id }).select('_id'), Quiz.find({ course: course._id }).select('_id'),
  ]);
  await Promise.all([
    Note.deleteMany({ lesson: { $in: lessons.map((l) => l._id) } }),
    Submission.deleteMany({ assignment: { $in: assignments.map((a) => a._id) } }),
    QuizAttempt.deleteMany({ quiz: { $in: quizzes.map((q) => q._id) } }),
    Lesson.deleteMany({ course: course._id }), Assignment.deleteMany({ course: course._id }), Quiz.deleteMany({ course: course._id }),
    Enrollment.deleteMany({ course: course._id }), Announcement.deleteMany({ course: course._id }), Question.deleteMany({ course: course._id }),
  ]);
  await course.deleteOne();
  res.json({ ok: true });
}));

router.post('/:id/enroll', role('student'), ah(async (req, res) => {
  const course = await Course.findById(req.params.id).catch(() => null);
  if (!course) throw new HttpError(404, 'Course not found');
  await Enrollment.updateOne({ student: req.user._id, course: course._id }, { $setOnInsert: { completedLessons: [], lastActivity: new Date() } }, { upsert: true });
  res.json({ ok: true });
}));

router.delete('/:id/enroll', role('student'), ah(async (req, res) => {
  await Enrollment.deleteOne({ student: req.user._id, course: req.params.id });
  res.json({ ok: true });
}));

// ---- Course sub-resources (teacher creates) ----
router.post('/:id/lessons', role('teacher'), upload.array('files', 5), ah(async (req, res) => {
  const course = await ownCourse(req.params.id, req.user);
  const { title, content, videoUrl, duration, status } = req.body;
  if (!title) throw new HttpError(400, 'Lesson title is required');
  const last = await Lesson.findOne({ course: course._id }).sort({ order: -1 });
  const lesson = await Lesson.create({
    course: course._id, title, content, videoUrl,
    duration: Number(duration) || 45,
    order: req.body.order ? Number(req.body.order) : (last ? last.order + 1 : 1),
    status: status === 'draft' ? 'draft' : 'published',
    objectives: String(req.body.objectives || '').split('\n').map((s) => s.trim()).filter(Boolean),
    attachments: toFiles(req.files),
  });
  res.status(201).json(lesson);
}));

router.post('/:id/assignments', role('teacher'), upload.array('files', 5), ah(async (req, res) => {
  const course = await ownCourse(req.params.id, req.user);
  const { title, instructions, dueDate, maxPoints } = req.body;
  if (!title || !dueDate) throw new HttpError(400, 'Title and due date are required');
  res.status(201).json(await Assignment.create({ course: course._id, title, instructions, dueDate: new Date(dueDate), maxPoints: Number(maxPoints) || 20, attachments: toFiles(req.files) }));
}));

router.post('/:id/announcements', role('teacher'), ah(async (req, res) => {
  const course = await ownCourse(req.params.id, req.user);
  if (!req.body.title) throw new HttpError(400, 'Title is required');
  res.status(201).json(await Announcement.create({ course: course._id, author: req.user._id, title: req.body.title, body: req.body.body }));
}));

router.post('/:id/questions', role('student'), ah(async (req, res) => {
  const course = await canAccessCourse(req.params.id, req.user);
  const check = checkMessage(req.body.text);
  if (check.error) throw new HttpError(400, check.error);
  // Disrespectful words are always replaced with **** before the teacher sees the message
  const q = await Question.create({ course: course._id, student: req.user._id, text: check.text });
  res.status(201).json({ ...q.toObject(), censored: check.count });
}));

module.exports = router;
