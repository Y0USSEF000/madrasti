const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name });
const fileSchema = new Schema({ name: String, path: String, size: Number }, { _id: false });

const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['teacher', 'student'], required: true },
  level: String,     // students: school level
  subject: String,   // teachers: main subject
  school: String,
  city: String,
  // Email verification
  verified: { type: Boolean, default: false },
  verifyCodeHash: String,
  verifyExpires: Date,
  verifyAttempts: { type: Number, default: 0 },
  verifySentAt: Date,
}, { timestamps: true }));

// Moroccan schools by city (loaded from seed-data/schools.json, source: OpenStreetMap)
const School = model('School', new Schema({
  city: { type: String, required: true, index: true },
  cityAr: String,
  name: { type: String, required: true },
}));

const Course = model('Course', new Schema({
  title: { type: String, required: true, trim: true },
  subject: { type: String, required: true },
  level: { type: String, required: true },
  description: String,
  color: { type: String, default: '#0f766e' },
  teacher: { ...ref('User'), required: true },
}, { timestamps: true }));

const Lesson = model('Lesson', new Schema({
  course: { ...ref('Course'), required: true },
  title: { type: String, required: true, trim: true },
  objectives: [String],
  content: String,
  videoUrl: String,
  duration: { type: Number, default: 45 },
  order: { type: Number, default: 1 },
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  attachments: [fileSchema],
}, { timestamps: true }));

const Enrollment = model('Enrollment', new Schema({
  student: { ...ref('User'), required: true },
  course: { ...ref('Course'), required: true },
  completedLessons: [ref('Lesson')],
  lastActivity: { type: Date, default: Date.now },
}, { timestamps: true }).index({ student: 1, course: 1 }, { unique: true }));

const Assignment = model('Assignment', new Schema({
  course: { ...ref('Course'), required: true },
  title: { type: String, required: true, trim: true },
  instructions: String,
  dueDate: { type: Date, required: true },
  maxPoints: { type: Number, default: 20 },
  attachments: [fileSchema],
}, { timestamps: true }));

const Submission = model('Submission', new Schema({
  assignment: { ...ref('Assignment'), required: true },
  student: { ...ref('User'), required: true },
  text: String,
  files: [fileSchema],
  status: { type: String, enum: ['submitted', 'graded'], default: 'submitted' },
  late: { type: Boolean, default: false },
  grade: Number,
  feedback: String,
  submittedAt: { type: Date, default: Date.now },
  gradedAt: Date,
}).index({ assignment: 1, student: 1 }, { unique: true }));

const Quiz = model('Quiz', new Schema({
  course: { ...ref('Course'), required: true },
  title: { type: String, required: true, trim: true },
  description: String,
  timeLimit: { type: Number, default: 20 },
  dueDate: Date,
  published: { type: Boolean, default: true },
  questions: [{
    text: { type: String, required: true },
    options: [String],
    correct: Number,
    points: { type: Number, default: 1 },
  }],
}, { timestamps: true }));

const QuizAttempt = model('QuizAttempt', new Schema({
  quiz: { ...ref('Quiz'), required: true },
  student: { ...ref('User'), required: true },
  answers: [Number],
  score: Number,
  total: Number,
  submittedAt: { type: Date, default: Date.now },
}).index({ quiz: 1, student: 1 }, { unique: true }));

const Announcement = model('Announcement', new Schema({
  course: { ...ref('Course'), required: true },
  author: ref('User'),
  title: { type: String, required: true },
  body: String,
}, { timestamps: true }));

const Question = model('Question', new Schema({
  course: { ...ref('Course'), required: true },
  student: { ...ref('User'), required: true },
  text: { type: String, required: true },
  answer: String,
  answeredAt: Date,
}, { timestamps: true }));

const Note = model('Note', new Schema({
  student: { ...ref('User'), required: true },
  lesson: { ...ref('Lesson'), required: true },
  text: String,
}, { timestamps: true }).index({ student: 1, lesson: 1 }, { unique: true }));

module.exports = { User, School, Course, Lesson, Enrollment, Assignment, Submission, Quiz, QuizAttempt, Announcement, Question, Note };
