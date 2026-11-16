const router = require('express').Router();
const { Lesson, Enrollment, Note } = require('../models');
const { ah, auth, role, HttpError, ownCourse, canAccessCourse, upload, toFiles } = require('../middleware/auth');

router.use(auth);

async function loadLesson(id) {
  const lesson = await Lesson.findById(id).catch(() => null);
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  return lesson;
}

router.get('/:id', ah(async (req, res) => {
  const lesson = await loadLesson(req.params.id);
  const course = await canAccessCourse(lesson.course, req.user);
  if (req.user.role === 'student' && lesson.status !== 'published') throw new HttpError(404, 'Lesson not found');
  const out = { ...lesson.toObject(), course: { _id: course._id, title: course.title, color: course.color } };
  const siblings = await Lesson.find(req.user.role === 'student' ? { course: course._id, status: 'published' } : { course: course._id }).select('_id title').sort({ order: 1, createdAt: 1 }).lean();
  const i = siblings.findIndex((s) => String(s._id) === String(lesson._id));
  out.prev = siblings[i - 1] || null;
  out.next = siblings[i + 1] || null;
  if (req.user.role === 'student') {
    const enr = await Enrollment.findOneAndUpdate({ student: req.user._id, course: course._id }, { lastActivity: new Date() }, { new: true });
    out.completed = enr.completedLessons.some((x) => String(x) === String(lesson._id));
    const note = await Note.findOne({ student: req.user._id, lesson: lesson._id });
    out.note = note ? note.text : '';
  }
  res.json(out);
}));

router.put('/:id', role('teacher'), upload.array('files', 5), ah(async (req, res) => {
  const lesson = await loadLesson(req.params.id);
  await ownCourse(lesson.course, req.user);
  for (const k of ['title', 'content', 'videoUrl']) if (req.body[k] !== undefined) lesson[k] = req.body[k];
  if (req.body.duration !== undefined) lesson.duration = Number(req.body.duration) || 45;
  if (req.body.order !== undefined && req.body.order !== '') lesson.order = Number(req.body.order) || lesson.order;
  if (req.body.status) lesson.status = req.body.status === 'draft' ? 'draft' : 'published';
  if (req.body.objectives !== undefined) lesson.objectives = String(req.body.objectives).split('\n').map((s) => s.trim()).filter(Boolean);
  if (req.body.removeFiles) {
    const remove = [].concat(req.body.removeFiles);
    lesson.attachments = lesson.attachments.filter((a) => !remove.includes(a.path));
  }
  lesson.attachments.push(...toFiles(req.files));
  await lesson.save();
  res.json(lesson);
}));

router.delete('/:id', role('teacher'), ah(async (req, res) => {
  const lesson = await loadLesson(req.params.id);
  await ownCourse(lesson.course, req.user);
  await Promise.all([
    Note.deleteMany({ lesson: lesson._id }),
    Enrollment.updateMany({ course: lesson.course }, { $pull: { completedLessons: lesson._id } }),
    lesson.deleteOne(),
  ]);
  res.json({ ok: true });
}));

// Student marks lesson done / not done
router.post('/:id/complete', role('student'), ah(async (req, res) => {
  const lesson = await loadLesson(req.params.id);
  await canAccessCourse(lesson.course, req.user);
  const done = req.body.done !== false;
  await Enrollment.updateOne(
    { student: req.user._id, course: lesson.course },
    { [done ? '$addToSet' : '$pull']: { completedLessons: lesson._id }, $set: { lastActivity: new Date() } }
  );
  res.json({ completed: done });
}));

// Student personal notes
router.put('/:id/note', role('student'), ah(async (req, res) => {
  const lesson = await loadLesson(req.params.id);
  await canAccessCourse(lesson.course, req.user);
  await Note.updateOne({ student: req.user._id, lesson: lesson._id }, { text: String(req.body.text || '') }, { upsert: true });
  res.json({ ok: true });
}));

module.exports = router;
