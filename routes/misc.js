// Dashboard, progress tracking, announcements and Q&A
const router = require('express').Router();
const { User, Course, Lesson, Enrollment, Assignment, Submission, Quiz, QuizAttempt, Announcement, Question, Note } = require('../models');
const { ah, auth, role, HttpError, ownCourse } = require('../middleware/auth');
const { checkMessage } = require('../utils/moderation');

router.use(auth);

const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
const on20 = (v, max) => (max ? (v / max) * 20 : 0);

// Build a progress row for each student of one course
async function courseProgress(course, studentIds) {
  const [lessons, assignments, quizzes, enrolls] = await Promise.all([
    Lesson.find({ course: course._id, status: 'published' }).select('_id').lean(),
    Assignment.find({ course: course._id }).select('_id maxPoints dueDate').lean(),
    Quiz.find({ course: course._id, published: true }).select('_id').lean(),
    Enrollment.find({ course: course._id, ...(studentIds ? { student: { $in: studentIds } } : {}) }).populate('student', 'name email level city').lean(),
  ]);
  const ids = enrolls.map((e) => e.student?._id).filter(Boolean);
  const [subs, attempts] = await Promise.all([
    Submission.find({ assignment: { $in: assignments.map((a) => a._id) }, student: { $in: ids } }).lean(),
    QuizAttempt.find({ quiz: { $in: quizzes.map((q) => q._id) }, student: { $in: ids } }).select('-answers').lean(),
  ]);
  const lessonSet = new Set(lessons.map((l) => String(l._id)));
  const maxOf = Object.fromEntries(assignments.map((a) => [String(a._id), a.maxPoints]));
  const dueAssignments = assignments.filter((a) => new Date(a.dueDate) < new Date()).length;
  return enrolls.filter((e) => e.student).map((e) => {
    const sid = String(e.student._id);
    const mySubs = subs.filter((s) => String(s.student) === sid);
    const graded = mySubs.filter((s) => s.status === 'graded');
    const myAttempts = attempts.filter((a) => String(a.student) === sid);
    const done = e.completedLessons.filter((l) => lessonSet.has(String(l))).length;
    const assignAvg = avg(graded.map((s) => on20(s.grade, maxOf[String(s.assignment)])));
    const quizAvg = avg(myAttempts.map((a) => on20(a.score, a.total)));
    const all = [...graded.map((s) => on20(s.grade, maxOf[String(s.assignment)])), ...myAttempts.map((a) => on20(a.score, a.total))];
    const overall = avg(all);
    const progress = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
    const daysInactive = Math.floor((Date.now() - new Date(e.lastActivity).getTime()) / 86400000);
    let status = 'good';
    if ((overall !== null && overall < 10) || (dueAssignments && mySubs.length < dueAssignments / 2) || daysInactive > 14) status = 'risk';
    else if ((overall !== null && overall < 12) || progress < 30) status = 'watch';
    return {
      student: e.student, lessonsDone: done, lessonsTotal: lessons.length, progress,
      submitted: mySubs.length, assignmentsTotal: assignments.length, assignAvg,
      quizzesTaken: myAttempts.length, quizzesTotal: quizzes.length, quizAvg,
      overall, lastActivity: e.lastActivity, enrolledAt: e.createdAt, status,
    };
  });
}

router.get('/progress/course/:id', role('teacher'), ah(async (req, res) => {
  const course = await ownCourse(req.params.id, req.user);
  const rows = await courseProgress(course);
  rows.sort((a, b) => a.student.name.localeCompare(b.student.name));
  const withAvg = rows.filter((r) => r.overall !== null);
  res.json({
    course: { _id: course._id, title: course.title, level: course.level, color: course.color },
    rows,
    summary: {
      students: rows.length,
      classAverage: avg(withAvg.map((r) => r.overall)),
      avgProgress: avg(rows.map((r) => r.progress)),
      atRisk: rows.filter((r) => r.status === 'risk').length,
    },
  });
}));

// Teacher: full report for one student in one course
router.get('/progress/course/:id/student/:sid', role('teacher'), ah(async (req, res) => {
  const course = await ownCourse(req.params.id, req.user);
  const student = await User.findById(req.params.sid).select('name email level city school').lean().catch(() => null);
  if (!student) throw new HttpError(404, 'Student not found');
  const [row] = await courseProgress(course, [student._id]);
  if (!row) throw new HttpError(404, 'This student is not in this course');
  const [assignments, quizzes, lessons, enr] = await Promise.all([
    Assignment.find({ course: course._id }).sort({ dueDate: 1 }).lean(),
    Quiz.find({ course: course._id }).select('title questions.points').lean(),
    Lesson.find({ course: course._id, status: 'published' }).select('title order').sort({ order: 1 }).lean(),
    Enrollment.findOne({ course: course._id, student: student._id }).lean(),
  ]);
  const [subs, attempts] = await Promise.all([
    Submission.find({ student: student._id, assignment: { $in: assignments.map((a) => a._id) } }).lean(),
    QuizAttempt.find({ student: student._id, quiz: { $in: quizzes.map((q) => q._id) } }).lean(),
  ]);
  const done = new Set(enr.completedLessons.map(String));
  res.json({
    course: { _id: course._id, title: course.title }, student, summary: row,
    lessons: lessons.map((l) => ({ ...l, completed: done.has(String(l._id)) })),
    assignments: assignments.map((a) => ({ _id: a._id, title: a.title, dueDate: a.dueDate, maxPoints: a.maxPoints, submission: subs.find((s) => String(s.assignment) === String(a._id)) || null })),
    quizzes: quizzes.map((q) => ({ _id: q._id, title: q.title, attempt: attempts.find((t) => String(t.quiz) === String(q._id)) || null })),
  });
}));

// Student: own progress in every course
router.get('/progress/me', role('student'), ah(async (req, res) => {
  const enrolls = await Enrollment.find({ student: req.user._id }).populate('course').lean();
  const out = [];
  for (const e of enrolls.filter((x) => x.course)) {
    const [row] = await courseProgress(e.course, [req.user._id]);
    const [subs, attempts] = await Promise.all([
      Submission.find({ student: req.user._id, status: 'graded' }).populate({ path: 'assignment', select: 'title maxPoints course' }).lean(),
      QuizAttempt.find({ student: req.user._id }).populate({ path: 'quiz', select: 'title course' }).select('-answers').lean(),
    ]);
    const grades = [
      ...subs.filter((s) => s.assignment && String(s.assignment.course) === String(e.course._id)).map((s) => ({ type: 'Assignment', title: s.assignment.title, score: s.grade, max: s.assignment.maxPoints, on20: Math.round(on20(s.grade, s.assignment.maxPoints) * 10) / 10, date: s.gradedAt, feedback: s.feedback })),
      ...attempts.filter((a) => a.quiz && String(a.quiz.course) === String(e.course._id)).map((a) => ({ type: 'Quiz', title: a.quiz.title, score: a.score, max: a.total, on20: Math.round(on20(a.score, a.total) * 10) / 10, date: a.submittedAt })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    out.push({ course: { _id: e.course._id, title: e.course.title, subject: e.course.subject, level: e.course.level, color: e.course.color }, ...row, student: undefined, grades });
  }
  const withAvg = out.filter((r) => r.overall !== null);
  res.json({ courses: out, generalAverage: avg(withAvg.map((r) => r.overall)) });
}));

router.get('/dashboard', ah(async (req, res) => {
  const now = new Date();
  if (req.user.role === 'teacher') {
    const courses = await Course.find({ teacher: req.user._id }).lean();
    const ids = courses.map((c) => c._id);
    const [students, lessons, assignments, quizzes, questions] = await Promise.all([
      Enrollment.distinct('student', { course: { $in: ids } }),
      Lesson.countDocuments({ course: { $in: ids } }),
      Assignment.find({ course: { $in: ids } }).lean(),
      Quiz.find({ course: { $in: ids } }).select('_id').lean(),
      Question.countDocuments({ course: { $in: ids }, answer: { $in: [null, ''] } }),
    ]);
    const aIds = assignments.map((a) => a._id);
    const [toGrade, recent, attempts, graded] = await Promise.all([
      Submission.countDocuments({ assignment: { $in: aIds }, status: 'submitted' }),
      Submission.find({ assignment: { $in: aIds } }).sort({ submittedAt: -1 }).limit(6).populate('student', 'name').populate('assignment', 'title course maxPoints').lean(),
      QuizAttempt.find({ quiz: { $in: quizzes.map((q) => q._id) } }).select('score total').lean(),
      Submission.find({ assignment: { $in: aIds }, status: 'graded' }).populate('assignment', 'maxPoints').select('grade assignment').lean(),
    ]);
    const scores = [...attempts.map((a) => on20(a.score, a.total)), ...graded.filter((s) => s.assignment).map((s) => on20(s.grade, s.assignment.maxPoints))];
    const courseName = Object.fromEntries(courses.map((c) => [String(c._id), c.title]));
    return res.json({
      stats: { courses: courses.length, students: students.length, lessons, toGrade, questions, classAverage: avg(scores) },
      recentSubmissions: recent.filter((s) => s.student && s.assignment).map((s) => ({ ...s, courseTitle: courseName[String(s.assignment.course)] })),
      upcoming: assignments.filter((a) => new Date(a.dueDate) >= now).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 5).map((a) => ({ ...a, courseTitle: courseName[String(a.course)] })),
    });
  }
  const enrolls = await Enrollment.find({ student: req.user._id }).populate('course', 'title color').sort({ lastActivity: -1 }).lean();
  const courses = enrolls.map((e) => e.course).filter(Boolean);
  const ids = courses.map((c) => c._id);
  const [assignments, subs, quizzes, attempts, announcements, lessons] = await Promise.all([
    Assignment.find({ course: { $in: ids } }).lean(),
    Submission.find({ student: req.user._id }).populate('assignment', 'title maxPoints course').lean(),
    Quiz.find({ course: { $in: ids }, published: true }).select('title course dueDate').lean(),
    QuizAttempt.find({ student: req.user._id }).select('quiz score total').lean(),
    Announcement.find({ course: { $in: ids } }).sort({ createdAt: -1 }).limit(5).populate('author', 'name').lean(),
    Lesson.find({ course: { $in: ids }, status: 'published' }).select('title course order').sort({ order: 1 }).lean(),
  ]);
  const courseName = Object.fromEntries(courses.map((c) => [String(c._id), c.title]));
  const submittedIds = new Set(subs.map((s) => String(s.assignment?._id)));
  const attemptedIds = new Set(attempts.map((a) => String(a.quiz)));
  const todo = [
    ...assignments.filter((a) => !submittedIds.has(String(a._id))).map((a) => ({ kind: 'assignment', _id: a._id, title: a.title, dueDate: a.dueDate, courseTitle: courseName[String(a.course)] })),
    ...quizzes.filter((q) => !attemptedIds.has(String(q._id))).map((q) => ({ kind: 'quiz', _id: q._id, title: q.title, dueDate: q.dueDate, courseTitle: courseName[String(q.course)] })),
  ].sort((a, b) => new Date(a.dueDate || '2100-01-01') - new Date(b.dueDate || '2100-01-01'));
  const scores = [...subs.filter((s) => s.status === 'graded' && s.assignment).map((s) => on20(s.grade, s.assignment.maxPoints)), ...attempts.map((a) => on20(a.score, a.total))];
  // "Continue learning": first unfinished lesson of each course
  const cont = enrolls.filter((e) => e.course).map((e) => {
    const done = new Set(e.completedLessons.map(String));
    const cl = lessons.filter((l) => String(l.course) === String(e.course._id));
    const next = cl.find((l) => !done.has(String(l._id)));
    return { course: e.course, next, progress: cl.length ? Math.round((cl.filter((l) => done.has(String(l._id))).length / cl.length) * 100) : 0 };
  }).slice(0, 4);
  res.json({
    stats: { courses: courses.length, todo: todo.length, average: avg(scores), lessonsDone: enrolls.reduce((n, e) => n + e.completedLessons.length, 0) },
    todo: todo.slice(0, 6),
    continue: cont,
    recentGrades: subs.filter((s) => s.status === 'graded' && s.assignment).sort((a, b) => new Date(b.gradedAt) - new Date(a.gradedAt)).slice(0, 4)
      .map((s) => ({ title: s.assignment.title, grade: s.grade, max: s.assignment.maxPoints, courseTitle: courseName[String(s.assignment.course)] })),
    announcements: announcements.map((a) => ({ ...a, courseTitle: courseName[String(a.course)] })),
  });
}));

// ---- Announcements ----
router.get('/announcements', ah(async (req, res) => {
  const ids = req.user.role === 'teacher'
    ? (await Course.find({ teacher: req.user._id }).select('_id')).map((c) => c._id)
    : await Enrollment.distinct('course', { student: req.user._id });
  const list = await Announcement.find({ course: { $in: ids } }).populate('course', 'title color').populate('author', 'name').sort({ createdAt: -1 }).lean();
  res.json(list);
}));

router.delete('/announcements/:id', role('teacher'), ah(async (req, res) => {
  const a = await Announcement.findById(req.params.id).catch(() => null);
  if (!a) throw new HttpError(404, 'Announcement not found');
  await ownCourse(a.course, req.user);
  await a.deleteOne();
  res.json({ ok: true });
}));

// ---- Check a message before sending (length + disrespectful words) ----
router.post('/moderation/check', ah(async (req, res) => {
  res.json(checkMessage(req.body.text));
}));

// ---- Student personal notes (all lessons) ----
router.get('/notes', role('student'), ah(async (req, res) => {
  const notes = await Note.find({ student: req.user._id, text: { $nin: [null, ''] } })
    .populate({ path: 'lesson', select: 'title course', populate: { path: 'course', select: 'title color' } })
    .sort({ updatedAt: -1 }).lean();
  res.json(notes.filter((n) => n.lesson && n.lesson.course));
}));

// ---- Questions to the teacher ----
router.get('/questions', ah(async (req, res) => {
  const filter = req.user.role === 'teacher'
    ? { course: { $in: (await Course.find({ teacher: req.user._id }).select('_id')).map((c) => c._id) } }
    : { student: req.user._id };
  const list = await Question.find(filter).populate('course', 'title color').populate('student', 'name').sort({ createdAt: -1 }).lean();
  res.json(list);
}));

router.put('/questions/:id/answer', role('teacher'), ah(async (req, res) => {
  const q = await Question.findById(req.params.id).catch(() => null);
  if (!q) throw new HttpError(404, 'Question not found');
  await ownCourse(q.course, req.user);
  if (!req.body.answer || !req.body.answer.trim()) throw new HttpError(400, 'Write an answer');
  q.answer = req.body.answer.trim();
  q.answeredAt = new Date();
  await q.save();
  res.json(q);
}));

router.delete('/questions/:id', ah(async (req, res) => {
  const q = await Question.findById(req.params.id).catch(() => null);
  if (!q) throw new HttpError(404, 'Question not found');
  if (req.user.role === 'student' ? String(q.student) !== String(req.user._id) : !(await Course.exists({ _id: q.course, teacher: req.user._id }))) {
    throw new HttpError(403, 'Not allowed');
  }
  await q.deleteOne();
  res.json({ ok: true });
}));

module.exports = router;
