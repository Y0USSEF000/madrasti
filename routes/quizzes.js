const router = require('express').Router();
const { Course, Quiz, QuizAttempt, Enrollment } = require('../models');
const { ah, auth, role, HttpError, ownCourse, canAccessCourse } = require('../middleware/auth');

router.use(auth);

async function loadQuiz(id) {
  const q = await Quiz.findById(id).catch(() => null);
  if (!q) throw new HttpError(404, 'Quiz not found');
  return q;
}

function cleanQuestions(questions) {
  if (!Array.isArray(questions) || !questions.length) throw new HttpError(400, 'Add at least one question');
  return questions.map((q, i) => {
    const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
    if (!q.text || !String(q.text).trim()) throw new HttpError(400, `Question ${i + 1} has no text`);
    if (options.length < 2) throw new HttpError(400, `Question ${i + 1} needs at least 2 choices`);
    const correct = Number(q.correct);
    if (!(correct >= 0 && correct < options.length)) throw new HttpError(400, `Choose the correct answer for question ${i + 1}`);
    return { text: String(q.text).trim(), options, correct, points: Number(q.points) > 0 ? Number(q.points) : 1 };
  });
}

router.get('/', ah(async (req, res) => {
  if (req.user.role === 'teacher') {
    const courses = await Course.find({ teacher: req.user._id }).select('title color').lean();
    const quizzes = await Quiz.find({ course: { $in: courses.map((c) => c._id) } }).sort({ createdAt: -1 }).lean();
    const stats = await QuizAttempt.aggregate([{ $match: { quiz: { $in: quizzes.map((q) => q._id) } } },
      { $group: { _id: '$quiz', n: { $sum: 1 }, avg: { $avg: { $multiply: [{ $divide: ['$score', { $max: ['$total', 1] }] }, 20] } } } }]);
    const sm = Object.fromEntries(stats.map((s) => [String(s._id), s]));
    return res.json(quizzes.map((q) => ({
      ...q, questions: undefined, questionCount: q.questions.length,
      course: courses.find((c) => String(c._id) === String(q.course)),
      attempts: sm[String(q._id)]?.n || 0, average: sm[String(q._id)] ? Math.round(sm[String(q._id)].avg * 10) / 10 : null,
    })));
  }
  const enrolls = await Enrollment.find({ student: req.user._id }).populate('course', 'title color').lean();
  const courses = enrolls.map((e) => e.course).filter(Boolean);
  const quizzes = await Quiz.find({ course: { $in: courses.map((c) => c._id) }, published: true }).sort({ createdAt: -1 }).lean();
  const attempts = await QuizAttempt.find({ student: req.user._id, quiz: { $in: quizzes.map((q) => q._id) } }).select('-answers').lean();
  res.json(quizzes.map((q) => ({
    ...q, questions: undefined, questionCount: q.questions.length,
    course: courses.find((c) => String(c._id) === String(q.course)),
    attempt: attempts.find((a) => String(a.quiz) === String(q._id)) || null,
  })));
}));

router.post('/', role('teacher'), ah(async (req, res) => {
  const course = await ownCourse(req.body.course, req.user);
  if (!req.body.title) throw new HttpError(400, 'Quiz title is required');
  const quiz = await Quiz.create({
    course: course._id, title: req.body.title, description: req.body.description,
    timeLimit: Number(req.body.timeLimit) || 20, dueDate: req.body.dueDate || undefined,
    published: req.body.published !== false, questions: cleanQuestions(req.body.questions),
  });
  res.status(201).json(quiz);
}));

router.get('/:id', ah(async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  const course = await canAccessCourse(quiz.course, req.user);
  const out = { ...quiz.toObject(), course: { _id: course._id, title: course.title, color: course.color } };
  if (req.user.role === 'student') {
    if (!quiz.published) throw new HttpError(404, 'Quiz not found');
    const attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id }).lean();
    out.attempt = attempt;
    // Hide correct answers until the student has finished the quiz
    if (!attempt) out.questions = out.questions.map(({ correct, ...q }) => q);
  }
  res.json(out);
}));

router.put('/:id', role('teacher'), ah(async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  await ownCourse(quiz.course, req.user);
  for (const k of ['title', 'description']) if (req.body[k] !== undefined) quiz[k] = req.body[k];
  if (req.body.timeLimit !== undefined) quiz.timeLimit = Number(req.body.timeLimit) || 20;
  if (req.body.dueDate !== undefined) quiz.dueDate = req.body.dueDate || undefined;
  if (req.body.published !== undefined) quiz.published = !!req.body.published;
  if (req.body.questions) quiz.questions = cleanQuestions(req.body.questions);
  await quiz.save();
  res.json(quiz);
}));

router.delete('/:id', role('teacher'), ah(async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  await ownCourse(quiz.course, req.user);
  await QuizAttempt.deleteMany({ quiz: quiz._id });
  await quiz.deleteOne();
  res.json({ ok: true });
}));

// Student takes the quiz once; auto-graded
router.post('/:id/attempt', role('student'), ah(async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  await canAccessCourse(quiz.course, req.user);
  if (!quiz.published) throw new HttpError(404, 'Quiz not found');
  if (await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id })) throw new HttpError(400, 'You already took this quiz');
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  let score = 0, total = 0;
  const clean = quiz.questions.map((q, i) => {
    total += q.points;
    const a = answers[i] === null || answers[i] === undefined || answers[i] === '' ? -1 : Number(answers[i]);
    if (a === q.correct) score += q.points;
    return Number.isInteger(a) ? a : -1;
  });
  const attempt = await QuizAttempt.create({ quiz: quiz._id, student: req.user._id, answers: clean, score, total });
  await Enrollment.updateOne({ student: req.user._id, course: quiz.course }, { lastActivity: new Date() });
  res.json(attempt);
}));

router.get('/:id/attempts', role('teacher'), ah(async (req, res) => {
  const quiz = await loadQuiz(req.params.id);
  await ownCourse(quiz.course, req.user);
  const attempts = await QuizAttempt.find({ quiz: quiz._id }).populate('student', 'name email').sort({ score: -1 }).lean();
  // Per-question success rate, to see which parts students did not understand
  const questionStats = quiz.questions.map((q, i) => {
    const right = attempts.filter((a) => a.answers[i] === q.correct).length;
    return { text: q.text, rate: attempts.length ? Math.round((right / attempts.length) * 100) : null };
  });
  res.json({ quiz: { _id: quiz._id, title: quiz.title, questionCount: quiz.questions.length }, attempts: attempts.filter((a) => a.student), questionStats });
}));

module.exports = router;
