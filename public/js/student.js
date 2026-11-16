// ===== Student space =====
const ME = requireRole('student');

function init() {
  buildShell(ME, [
    { sec: 'Learn' },
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'catalog', icon: '🔎', label: 'All courses' },
    { id: 'courses', icon: '📚', label: 'My courses' },
    { sec: 'Work' },
    { id: 'assignments', icon: '📝', label: 'Assignments' },
    { id: 'quizzes', icon: '✅', label: 'Quizzes' },
    { id: 'progress', icon: '📈', label: 'My grades & progress' },
    { id: 'calendar', icon: '📅', label: 'Calendar' },
    { sec: 'Tools' },
    { id: 'questions', icon: '💬', label: 'Ask the teacher' },
    { id: 'notes', icon: '🗒️', label: 'My notes' },
    { id: 'timer', icon: '⏱️', label: 'Study timer' },
    { id: 'profile', icon: '👤', label: 'My profile' },
  ]);
  const routes = {
    dashboard: viewDashboard, catalog: viewCatalog, courses: viewMyCourses, course: viewCourse, lesson: viewLesson,
    assignments: viewAssignments, assignment: viewAssignment, quizzes: viewQuizzes, quiz: viewQuiz,
    progress: viewProgress, calendar: viewCalendar, questions: viewQuestions, notes: viewNotes, timer: viewTimer, profile: viewProfile,
  };
  viewCourse.parent = 'courses'; viewLesson.parent = 'courses'; viewAssignment.parent = 'assignments'; viewQuiz.parent = 'quizzes';
  startRouter(routes, 'dashboard');
  refreshCounts();
}

async function refreshCounts() {
  try { const d = await api('/dashboard'); setCount('assignments', d.todo.filter((t) => t.kind === 'assignment').length); setCount('quizzes', d.todo.filter((t) => t.kind === 'quiz').length); } catch {}
}
const statCard = (icon, num, label, bg) => `<div class="card stat"><div class="ico" ${bg ? `style="background:${bg}"` : ''}>${icon}</div><div><div class="num">${esc(num)}</div><div class="lbl">${esc(label)}</div></div></div>`;

// ---------- Dashboard ----------
async function viewDashboard(v) {
  const d = await api('/dashboard');
  const s = d.stats;
  const hour = new Date().getHours();
  v.innerHTML = `
    <div class="hero-banner zellige">
      <div><h1>${hour < 12 ? 'Sbah lkhir' : hour < 18 ? 'Salam' : 'Msa lkhir'}, ${esc(ME.name.split(' ')[0])} 👋</h1>
      <p>${s.todo ? `You have ${s.todo} thing${s.todo > 1 ? 's' : ''} to do. Keep going!` : 'Nothing to do right now — revise a lesson or explore new courses.'}</p></div>
      <a class="btn accent" href="#catalog">Explore courses</a>
    </div>
    <div class="grid cols-4">${statCard('📚', s.courses, 'My courses')}${statCard('📝', s.todo, 'To do', s.todo ? 'var(--accent-soft)' : '')}${statCard('📖', s.lessonsDone, 'Lessons done')}${statCard('📊', s.average ?? '—', 'My average /20')}</div>
    ${d.continue.length ? `<div class="card" style="margin-top:1rem"><div class="card-head"><h3>Continue learning</h3><a class="small" href="#courses">My courses</a></div>
      <div class="grid cols-2">${d.continue.map((c) => `<div style="display:flex;gap:.8rem;align-items:center;padding:.6rem;border:1px solid var(--line);border-radius:12px">
        <div class="dot" style="width:42px;height:42px;border-radius:10px;background:${esc(c.course.color)}"></div>
        <div style="flex:1;min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.course.title)}</div>
        <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.next ? 'Next: ' + esc(c.next.title) : 'All lessons done 🎉'}</div>${bar(c.progress, c.course.color)}</div>
        <a class="btn sm" href="${c.next ? '#lesson/' + c.next._id : '#course/' + c.course._id}">${c.next ? 'Go' : 'Open'}</a></div>`).join('')}</div></div>` : ''}
    <div class="grid cols-2" style="margin-top:1rem">
      <div class="card"><div class="card-head"><h3>To do</h3><a class="small" href="#calendar">Calendar</a></div>
        ${d.todo.length ? `<ul class="list">${d.todo.map((t) => `<li><span style="font-size:1.2rem">${t.kind === 'quiz' ? '✅' : '📝'}</span><div class="grow"><a class="title" href="#${t.kind}/${t._id}">${esc(t.title)}</a><div class="small muted">${esc(t.courseTitle)}</div></div>${t.dueDate ? dueLabel(t.dueDate) : ''}</li>`).join('')}</ul>`
          : '<div class="empty"><div class="big">🎉</div>All done!</div>'}</div>
      <div class="card"><div class="card-head"><h3>Latest grades</h3><a class="small" href="#progress">All grades</a></div>
        ${d.recentGrades.length ? `<ul class="list">${d.recentGrades.map((g) => `<li><div class="grow"><div class="title">${esc(g.title)}</div><div class="small muted">${esc(g.courseTitle)}</div></div>${gradeHtml(g.grade, g.max)}</li>`).join('')}</ul>`
          : '<div class="empty">No grade yet.</div>'}</div>
    </div>
    <div class="card" style="margin-top:1rem"><h3>Announcements</h3>
      ${d.announcements.length ? d.announcements.map((a) => `<div class="qa"><b>📣 ${esc(a.title)}</b><div class="small muted">${esc(a.courseTitle)} · ${esc(a.author?.name || '')} · ${timeAgo(a.createdAt)}</div>${a.body ? `<p style="margin:.4rem 0 0">${esc(a.body)}</p>` : ''}</div>`).join('')
        : '<div class="empty">No announcement.</div>'}</div>
    ${s.courses ? '' : `<div class="card empty" style="margin-top:1rem"><div class="big">🔎</div><p>You are not in any course yet.</p><a class="btn" href="#catalog">Find my courses</a></div>`}`;
}

// ---------- Catalog ----------
let catalogFilter = null;
async function viewCatalog(v) {
  if (!catalogFilter) catalogFilter = { level: ME.level || '', subject: '', q: '' };
  v.innerHTML = `<div class="page-head"><div><h1>All courses</h1><p>Every course of the Moroccan curriculum, open any time. Join a course to start.</p></div></div>
    <div class="toolbar">
      <input type="text" id="cq" placeholder="Search a course…" value="${esc(catalogFilter.q)}">
      <select id="cl"><option value="">All levels</option>${options(LEVELS, catalogFilter.level)}</select>
      <select id="cs"><option value="">All subjects</option>${options(SUBJECTS, catalogFilter.subject)}</select>
    </div><div id="clist"><div class="loader"></div></div>`;
  const load = async () => {
    const qs = new URLSearchParams(Object.entries(catalogFilter).filter(([, val]) => val)).toString();
    const list = await api('/courses' + (qs ? '?' + qs : ''));
    const box = v.querySelector('#clist');
    if (!box) return;
    box.innerHTML = list.length ? `<div class="grid auto">${list.map((c) => `<div class="card course-card">
      <div class="cover" style="background:${esc(c.color)}"><span class="subject">${esc(c.subject)}</span></div>
      <div class="body"><h3>${esc(c.title)}</h3><div class="clamp">${esc(c.description || '')}</div>
        <div class="meta"><span>🎓 ${esc(c.level)}</span><span>👩‍🏫 ${esc(c.teacher?.name || '')}</span><span>📖 ${c.lessonCount} lessons</span><span>👥 ${c.studentCount}</span></div>
        <div class="actions">${c.enrolled ? `<a class="btn sm" href="#course/${c._id}">Open</a><span class="badge ok">Joined</span>` : `<button class="btn sm" data-join="${c._id}">Join course</button><a class="btn secondary sm" href="#course/${c._id}">Preview</a>`}</div>
      </div></div>`).join('')}</div>`
      : `<div class="card empty"><div class="big">🔎</div>No course found. Try another level or subject.</div>`;
    box.querySelectorAll('[data-join]').forEach((b) => b.onclick = () => busy(b, async () => { await api(`/courses/${b.dataset.join}/enroll`, { method: 'POST' }); toast('You joined the course!'); location.hash = 'course/' + b.dataset.join; refreshCounts(); }));
  };
  let t;
  v.querySelector('#cq').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { catalogFilter.q = e.target.value.trim(); load().catch((x) => toast(x.message, 'error')); }, 250); };
  v.querySelector('#cl').onchange = (e) => { catalogFilter.level = e.target.value; load().catch((x) => toast(x.message, 'error')); };
  v.querySelector('#cs').onchange = (e) => { catalogFilter.subject = e.target.value; load().catch((x) => toast(x.message, 'error')); };
  await load();
}

// ---------- My courses ----------
async function viewMyCourses(v) {
  const list = await api('/courses/mine');
  v.innerHTML = `<div class="page-head"><div><h1>My courses</h1><p>Your lessons are available 24/7.</p></div><a class="btn" href="#catalog">+ Join a course</a></div>
    ${list.length ? `<div class="grid auto">${list.map((c) => `<div class="card course-card">
      <div class="cover" style="background:${esc(c.color)}"><span class="subject">${esc(c.subject)}</span></div>
      <div class="body"><h3>${esc(c.title)}</h3><div class="meta"><span>👩‍🏫 ${esc(c.teacher?.name || '')}</span><span>📖 ${c.completed}/${c.lessonCount} lessons</span></div>
        <div style="display:flex;align-items:center;gap:.6rem"><div style="flex:1">${bar(c.progress, c.color)}</div><b class="small">${c.progress}%</b></div>
        <div class="actions"><a class="btn sm" href="#course/${c._id}">Continue</a></div></div></div>`).join('')}</div>`
      : `<div class="card empty"><div class="big">📚</div><p>You have not joined any course yet.</p><a class="btn" href="#catalog">Browse all courses</a></div>`}`;
}

// ---------- One course ----------
let courseTab = 'lessons';
async function viewCourse(v, id) {
  const c = await api('/courses/' + id);
  if (!c.enrolled) {
    v.innerHTML = `<div class="crumbs"><a href="#catalog">All courses</a> › ${esc(c.title)}</div>
      <div class="hero-banner" style="background:${esc(c.color)}"><div><h1>${esc(c.title)}</h1><p>${esc(c.subject)} · ${esc(c.level)} · 👩‍🏫 ${esc(c.teacher?.name || '')}</p></div><button class="btn accent" id="join">Join this course</button></div>
      <div class="card"><h3>About this course</h3><p>${esc(c.description || '')}</p><h3 style="margin-top:1rem">Programme (${c.lessons.length} lessons)</h3>
      ${c.lessons.map((l, i) => `<div class="lesson-item"><div class="num">${i + 1}</div><div style="flex:1"><b>${esc(l.title)}</b><div class="small muted">${l.duration} min</div></div><span>🔒</span></div>`).join('')}</div>`;
    v.querySelector('#join').onclick = (e) => busy(e.target, async () => { await api(`/courses/${c._id}/enroll`, { method: 'POST' }); toast('You joined the course!'); refresh(); refreshCounts(); });
    return;
  }
  const todoA = c.assignments.filter((a) => !a.submission).length;
  const todoQ = c.quizzes.filter((q) => !q.attempt).length;
  v.innerHTML = `<div class="crumbs"><a href="#courses">My courses</a> › ${esc(c.title)}</div>
    <div class="hero-banner" style="background:${esc(c.color)}">
      <div><h1>${esc(c.title)}</h1><p>${esc(c.level)} · 👩‍🏫 ${esc(c.teacher?.name || '')}${c.teacher?.school ? ' — ' + esc(c.teacher.school) : ''}</p></div>
      <div style="min-width:200px"><div class="small" style="opacity:.9;margin-bottom:.3rem">Progress ${c.progress}%</div><div class="progress lg" style="background:rgba(255,255,255,.25)"><span style="width:${c.progress}%;background:#fff"></span></div></div>
    </div>
    <div class="tabs">${[['lessons', `Lessons (${c.lessons.length})`], ['assignments', `Assignments${todoA ? ` (${todoA} to do)` : ''}`], ['quizzes', `Quizzes${todoQ ? ` (${todoQ} new)` : ''}`], ['news', 'Announcements'], ['ask', 'Ask the teacher'], ['about', 'About']]
      .map(([k, l]) => `<button data-tab="${k}" class="${courseTab === k ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div id="tabBody"></div>`;
  const body = v.querySelector('#tabBody');
  v.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { courseTab = b.dataset.tab; v.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b)); draw(); });
  function draw() {
    if (courseTab === 'lessons') {
      body.innerHTML = `<div class="card">${c.lessons.length ? c.lessons.map((l, i) => `<div class="lesson-item ${l.completed ? 'done' : ''}">
        <div class="num">${l.completed ? '✓' : i + 1}</div><div style="flex:1;min-width:0"><a href="#lesson/${l._id}" style="font-weight:600">${esc(l.title)}</a>
        <div class="small muted">${l.duration} min${(l.attachments || []).length ? ` · 📎 ${l.attachments.length}` : ''}${l.videoUrl ? ' · 🎬 video' : ''}</div></div>
        <a class="btn ${l.completed ? 'secondary' : ''} sm" href="#lesson/${l._id}">${l.completed ? 'Review' : 'Start'}</a></div>`).join('') : '<div class="empty">The teacher has not published lessons yet.</div>'}</div>`;
    } else if (courseTab === 'assignments') {
      body.innerHTML = `<div class="card">${c.assignments.length ? `<ul class="list">${c.assignments.map((a) => `<li><div class="grow"><a class="title" href="#assignment/${a._id}">${esc(a.title)}</a><div class="small muted">due ${fmtDateTime(a.dueDate)}</div></div>${assignStatus(a)}</li>`).join('')}</ul>` : '<div class="empty">No assignment.</div>'}</div>`;
    } else if (courseTab === 'quizzes') {
      body.innerHTML = `<div class="card">${c.quizzes.length ? `<ul class="list">${c.quizzes.map((q) => `<li><div class="grow"><a class="title" href="#quiz/${q._id}">${esc(q.title)}</a><div class="small muted">${q.questionCount} questions · ${q.timeLimit} min</div></div>${q.attempt ? gradeHtml((q.attempt.score / q.attempt.total) * 20) : `<a class="btn sm" href="#quiz/${q._id}">Start</a>`}</li>`).join('')}</ul>` : '<div class="empty">No quiz.</div>'}</div>`;
    } else if (courseTab === 'news') {
      body.innerHTML = c.announcements.length ? c.announcements.map((a) => `<div class="qa"><b>📣 ${esc(a.title)}</b><div class="small muted">${esc(a.author?.name || '')} · ${timeAgo(a.createdAt)}</div>${a.body ? `<p style="margin:.4rem 0 0;white-space:pre-wrap">${esc(a.body)}</p>` : ''}</div>`).join('') : '<div class="card empty">No announcement.</div>';
    } else if (courseTab === 'ask') {
      body.innerHTML = `<div class="card"><h3>Ask ${esc(c.teacher?.name || 'the teacher')} a question</h3><form id="askf">${askBoxHtml('I did not understand…')}<button class="btn" style="margin-top:.6rem">Check and send</button></form>
        <p class="small muted" style="margin-top:.8rem">See all your questions and answers in <a href="#questions">Ask the teacher</a>.</p></div>`;
      const af = body.querySelector('#askf');
      bindAskBox(af);
      af.onsubmit = (e) => { e.preventDefault(); busy(af.querySelector('button'), async () => {
        if (await sendQuestion(c._id, af.text.value)) { af.reset(); af.text.dispatchEvent(new Event('input')); }
      }); };
    } else {
      body.innerHTML = `<div class="card"><p>${esc(c.description || '')}</p><p class="small muted">${c.studentCount} students in this course.</p><button class="btn danger sm" id="leave">Leave this course</button></div>`;
      body.querySelector('#leave').onclick = async () => {
        if (!(await confirmBox('Leave this course? Your lesson progress in this course will be removed.', { okText: 'Leave' }))) return;
        busy(null, async () => { await api(`/courses/${c._id}/enroll`, { method: 'DELETE' }); toast('You left the course'); courseTab = 'lessons'; location.hash = 'courses'; refreshCounts(); });
      };
    }
  }
  draw();
}

function assignStatus(a) {
  const s = a.submission;
  if (!s) return new Date(a.dueDate) < new Date() ? '<span class="badge bad">Missing</span>' : dueLabel(a.dueDate);
  if (s.status === 'graded') return gradeHtml(s.grade, a.maxPoints);
  return `<span class="badge brand">Submitted${s.late ? ' (late)' : ''}</span>`;
}

// ---------- Lesson ----------
async function viewLesson(v, id) {
  const l = await api('/lessons/' + id);
  v.innerHTML = `<div class="crumbs"><a href="#courses">My courses</a> › <a href="#course/${l.course._id}">${esc(l.course.title)}</a> › ${esc(l.title)}</div>
    <div class="page-head"><div><h1>${esc(l.title)}</h1><p>⏱ ${l.duration} min</p></div>
      <button class="btn ${l.completed ? 'secondary' : ''}" id="done">${l.completed ? '✓ Completed' : 'Mark as done'}</button></div>
    <div class="grid" style="grid-template-columns:minmax(0,1fr)">
      <div class="card">
        ${l.objectives.length ? `<div class="objectives"><b>🎯 What you will learn</b><ul>${l.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}
        ${videoEmbed(l.videoUrl)}
        <div class="lesson-body">${renderRich(l.content) || '<p class="muted">No content.</p>'}</div>
        ${l.attachments.length ? `<h3 style="margin-top:1.4rem">📎 Files</h3>${filesHtml(l.attachments)}` : ''}
      </div>
      <div class="card"><div class="card-head"><h3>🗒️ My notes</h3><span class="small muted" id="noteState"></span></div>
        <textarea id="note" placeholder="Write your own notes for this lesson. They are saved automatically and only you can see them.">${esc(l.note)}</textarea></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:1rem;gap:.5rem;flex-wrap:wrap">
      ${l.prev ? `<a class="btn secondary" href="#lesson/${l.prev._id}">← Previous</a>` : '<span></span>'}
      ${l.next ? `<a class="btn" href="#lesson/${l.next._id}">Next lesson →</a>` : `<a class="btn" href="#course/${l.course._id}">Back to course</a>`}
    </div>`;
  let completed = l.completed;
  const btn = v.querySelector('#done');
  btn.onclick = () => busy(btn, async () => {
    await api(`/lessons/${l._id}/complete`, { method: 'POST', body: { done: !completed } });
    completed = !completed;
    btn.textContent = completed ? '✓ Completed' : 'Mark as done';
    btn.classList.toggle('secondary', completed);
    toast(completed ? 'Lesson completed! 🎉' : 'Marked as not done');
  });
  const note = v.querySelector('#note'), state = v.querySelector('#noteState');
  let t;
  note.oninput = () => {
    state.textContent = 'Typing…'; clearTimeout(t);
    t = setTimeout(async () => { try { await api(`/lessons/${l._id}/note`, { method: 'PUT', body: { text: note.value } }); state.textContent = 'Saved ✓'; } catch (e) { state.textContent = 'Not saved'; toast(e.message, 'error'); } }, 700);
  };
}

// ---------- Assignments ----------
async function viewAssignments(v) {
  const list = await api('/assignments');
  const groups = {
    todo: list.filter((a) => !a.submission),
    sent: list.filter((a) => a.submission && a.submission.status !== 'graded'),
    graded: list.filter((a) => a.submission?.status === 'graded'),
  };
  v.innerHTML = `<div class="page-head"><div><h1>Assignments</h1><p>Hand in your work before the due date.</p></div></div>
    <div class="tabs">${[['todo', 'To do'], ['sent', 'Submitted'], ['graded', 'Graded']].map(([k, l], i) => `<button data-g="${k}" class="${i === 0 ? 'active' : ''}">${l} (${groups[k].length})</button>`).join('')}</div>
    <div class="card" id="alist"></div>`;
  const draw = (g) => {
    const items = groups[g];
    v.querySelector('#alist').innerHTML = items.length ? `<ul class="list">${items.map((a) => `<li><span class="dot" style="background:${esc(a.course?.color)}"></span>
      <div class="grow"><a class="title" href="#assignment/${a._id}">${esc(a.title)}</a><div class="small muted">${esc(a.course?.title)} · due ${fmtDateTime(a.dueDate)}</div></div>
      ${assignStatus(a)}<a class="btn sm ${g === 'todo' ? '' : 'secondary'}" href="#assignment/${a._id}">${g === 'todo' ? 'Submit' : 'View'}</a></li>`).join('')}</ul>`
      : `<div class="empty"><div class="big">${g === 'todo' ? '🎉' : '📭'}</div>${g === 'todo' ? 'Nothing to hand in.' : 'Nothing here yet.'}</div>`;
  };
  v.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { v.querySelectorAll('[data-g]').forEach((x) => x.classList.toggle('active', x === b)); draw(b.dataset.g); });
  draw('todo');
}

async function viewAssignment(v, id) {
  const a = await api('/assignments/' + id);
  const s = a.submission;
  const graded = s?.status === 'graded';
  v.innerHTML = `<div class="crumbs"><a href="#assignments">Assignments</a> › ${esc(a.title)}</div>
    <div class="page-head"><div><h1>${esc(a.title)}</h1><p><a href="#course/${a.course._id}">${esc(a.course.title)}</a> · due ${fmtDateTime(a.dueDate)} · on ${a.maxPoints} points</p></div>${assignStatus(a)}</div>
    <div class="card"><h3>Instructions</h3><p style="white-space:pre-wrap">${esc(a.instructions || 'No instructions.')}</p>${filesHtml(a.attachments)}</div>
    ${graded ? `<div class="card" style="border-color:var(--ok)"><div class="card-head"><h3>Your grade</h3><div style="font-size:1.6rem">${gradeHtml(s.grade, a.maxPoints)}</div></div>
      ${s.feedback ? `<div class="answer" style="margin:0"><b>Teacher feedback</b><div style="white-space:pre-wrap">${esc(s.feedback)}</div></div>` : ''}</div>` : ''}
    ${s ? `<div class="card"><h3>Your work</h3><p class="small muted">Sent ${fmtDateTime(s.submittedAt)} ${s.late ? '<span class="badge bad">Late</span>' : ''}</p>${s.text ? `<p style="white-space:pre-wrap">${esc(s.text)}</p>` : ''}${filesHtml(s.files)}</div>` : ''}
    ${graded ? '' : `<div class="card"><h3>${s ? 'Change my work' : 'Hand in my work'}</h3>
      ${new Date(a.dueDate) < new Date() ? '<p class="small" style="color:var(--bad)">The due date has passed. You can still send, but it will be marked late.</p>' : ''}
      <form id="sf"><div class="field"><label>Your answer</label><textarea name="text" placeholder="Write your answer here (optional if you attach a file)">${esc(s?.text || '')}</textarea></div>
      <div class="field"><label>Files (photo of your copy, PDF, Word…) — max 5 files, 15 MB each</label><input type="file" name="files" multiple>${s?.files.length ? '<div class="hint">Choosing new files replaces the old ones.</div>' : ''}</div>
      <button class="btn">${s ? 'Send again' : 'Submit'}</button></form></div>`}`;
  const f = v.querySelector('#sf');
  if (f) f.onsubmit = (e) => { e.preventDefault(); busy(f.querySelector('button'), async () => {
    if (!f.text.value.trim() && !f.files.files.length && !(s && s.files.length)) throw new Error('Write an answer or attach a file');
    await api(`/assignments/${a._id}/submit`, { method: 'POST', form: new FormData(f) });
    toast('Work submitted! ✅'); refresh(); refreshCounts();
  }); };
}

// ---------- Quizzes ----------
async function viewQuizzes(v) {
  const list = await api('/quizzes');
  const todo = list.filter((q) => !q.attempt), done = list.filter((q) => q.attempt);
  const row = (q) => `<li><span class="dot" style="background:${esc(q.course?.color)}"></span><div class="grow"><a class="title" href="#quiz/${q._id}">${esc(q.title)}</a><div class="small muted">${esc(q.course?.title)} · ${q.questionCount} questions · ${q.timeLimit} min</div></div>
    ${q.attempt ? `${gradeHtml((q.attempt.score / q.attempt.total) * 20)} <a class="btn secondary sm" href="#quiz/${q._id}">Correction</a>` : `${q.dueDate ? dueLabel(q.dueDate) : ''}<a class="btn sm" href="#quiz/${q._id}">Start</a>`}</li>`;
  v.innerHTML = `<div class="page-head"><div><h1>Quizzes</h1><p>Test yourself. You get your score and the correction right away.</p></div></div>
    <div class="card"><h3>To take (${todo.length})</h3>${todo.length ? `<ul class="list">${todo.map(row).join('')}</ul>` : '<div class="empty">No new quiz. 🎉</div>'}</div>
    <div class="card"><h3>Done (${done.length})</h3>${done.length ? `<ul class="list">${done.map(row).join('')}</ul>` : '<div class="empty">You have not taken a quiz yet.</div>'}</div>`;
}

let quizTimer = null;
window.addEventListener('hashchange', () => { if (quizTimer) { clearInterval(quizTimer); quizTimer = null; } });

async function viewQuiz(v, id) {
  const q = await api('/quizzes/' + id);
  if (q.attempt) return showCorrection(v, q);
  v.innerHTML = `<div class="crumbs"><a href="#quizzes">Quizzes</a> › ${esc(q.title)}</div>
    <div class="card" style="max-width:640px;margin:2rem auto;text-align:center"><div style="font-size:2.6rem">✅</div><h1>${esc(q.title)}</h1>
      <p class="muted">${esc(q.description || '')}</p>
      <p><b>${q.questions.length}</b> questions · <b>${q.timeLimit}</b> minutes · one try only</p>
      <button class="btn accent" id="startQ">Start the quiz</button></div>`;
  v.querySelector('#startQ').onclick = () => takeQuiz(v, q);
}

function takeQuiz(v, q) {
  let left = q.timeLimit * 60;
  v.innerHTML = `<div class="page-head" style="position:sticky;top:0;background:var(--bg);padding:.6rem 0;z-index:5;margin-bottom:.6rem"><div><h1 style="font-size:1.25rem">${esc(q.title)}</h1><p><span id="answered">0</span>/${q.questions.length} answered</p></div>
    <div style="display:flex;gap:.8rem;align-items:center"><span class="timer" id="tm"></span><button class="btn accent" id="finish">Finish</button></div></div>
    <form id="qform">${q.questions.map((qq, i) => `<div class="q-card"><div class="q-text">${i + 1}. ${esc(qq.text)} <span class="small muted">(${qq.points} pt)</span></div>
      ${qq.options.map((o, j) => `<label class="option"><input type="radio" name="q${i}" value="${j}"> ${esc(o)}</label>`).join('')}</div>`).join('')}</form>`;
  const tm = v.querySelector('#tm');
  const tick = () => { tm.textContent = `⏱ ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; tm.style.color = left < 60 ? 'var(--bad)' : ''; };
  tick();
  let sent = false;
  const submit = async (auto) => {
    if (sent) return;
    const answers = q.questions.map((_, i) => { const r = v.querySelector(`input[name=q${i}]:checked`); return r ? Number(r.value) : null; });
    if (!auto && answers.includes(null) && !(await confirmBox(`You did not answer ${answers.filter((a) => a === null).length} question(s). Finish anyway?`, { okText: 'Finish', danger: false }))) return;
    sent = true;
    clearInterval(quizTimer); quizTimer = null;
    try {
      const attempt = await api(`/quizzes/${q._id}/attempt`, { method: 'POST', body: { answers } });
      toast(`Your score: ${attempt.score}/${attempt.total}`);
      refreshCounts();
      refresh();
    } catch (e) { sent = false; toast(e.message, 'error'); }
  };
  quizTimer = setInterval(() => { left--; tick(); if (left <= 0) { toast('Time is up!'); submit(true); } }, 1000);
  v.querySelector('#qform').onchange = () => { v.querySelector('#answered').textContent = v.querySelectorAll('#qform input:checked').length; };
  v.querySelector('#finish').onclick = () => submit(false);
}

function showCorrection(v, q) {
  const a = q.attempt;
  const on20 = Math.round((a.score / a.total) * 200) / 10;
  v.innerHTML = `<div class="crumbs"><a href="#quizzes">Quizzes</a> › ${esc(q.title)}</div>
    <div class="hero-banner" style="background:${on20 >= 10 ? '#15803d' : '#b91c1c'}"><div><h1>${on20 >= 16 ? 'Excellent! 🌟' : on20 >= 10 ? 'Well done! 👍' : 'Keep practising 💪'}</h1><p>${esc(q.title)} · ${fmtDateTime(a.submittedAt)}</p></div>
      <div style="text-align:right"><div style="font-size:2.2rem;font-weight:800">${on20}/20</div><div>${a.score}/${a.total} points</div></div></div>
    <h2>Correction</h2>
    ${q.questions.map((qq, i) => { const mine = a.answers[i]; const ok = mine === qq.correct;
      return `<div class="q-card"><div class="q-text">${ok ? '✅' : '❌'} ${i + 1}. ${esc(qq.text)}</div>
        ${qq.options.map((o, j) => `<div class="option ${j === qq.correct ? 'right' : j === mine ? 'wrong' : ''}" style="cursor:default">${j === qq.correct ? '✓' : j === mine ? '✗' : '•'} ${esc(o)}${j === mine ? ' <span class="small muted">(your answer)</span>' : ''}</div>`).join('')}
        ${mine === -1 ? '<div class="small muted">No answer</div>' : ''}</div>`; }).join('')}`;
}

// ---------- Progress ----------
async function viewProgress(v) {
  const p = await api('/progress/me');
  v.innerHTML = `<div class="page-head"><div><h1>My grades & progress</h1><p>All your marks on 20, by subject.</p></div>
    <div class="card stat" style="padding:.8rem 1.2rem"><div class="ico">🎓</div><div><div class="num">${p.generalAverage === null ? '—' : gradeHtml(p.generalAverage)}</div><div class="lbl">General average</div></div></div></div>
    ${p.courses.length ? p.courses.map((c) => `<div class="card">
      <div class="card-head"><div style="display:flex;gap:.7rem;align-items:center"><span class="dot" style="width:14px;height:14px;background:${esc(c.course.color)}"></span><div><h3 style="margin:0">${esc(c.course.title)}</h3><div class="small muted">${esc(c.course.level)}</div></div></div>
        <div style="font-size:1.3rem">${gradeHtml(c.overall)}</div></div>
      <div class="grid cols-3" style="margin-bottom:1rem">
        <div><div class="small muted">Lessons ${c.lessonsDone}/${c.lessonsTotal}</div>${bar(c.progress, c.course.color)}</div>
        <div><div class="small muted">Assignments sent</div><b>${c.submitted}/${c.assignmentsTotal}</b> · avg ${gradeHtml(c.assignAvg)}</div>
        <div><div class="small muted">Quizzes taken</div><b>${c.quizzesTaken}/${c.quizzesTotal}</b> · avg ${gradeHtml(c.quizAvg)}</div>
      </div>
      ${c.grades.length ? `<div class="table-wrap"><table><thead><tr><th>Work</th><th>Type</th><th>Date</th><th>Mark</th><th>/20</th></tr></thead><tbody>
        ${c.grades.map((g) => `<tr><td><b>${esc(g.title)}</b>${g.feedback ? `<div class="small muted">💬 ${esc(g.feedback)}</div>` : ''}</td><td><span class="badge ${g.type === 'Quiz' ? 'brand' : 'accent'}">${g.type}</span></td><td class="small">${fmtDate(g.date)}</td><td>${g.score}/${g.max}</td><td>${gradeHtml(g.on20)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted small">No grade yet in this course.</p>'}
    </div>`).join('') : '<div class="card empty"><div class="big">📈</div>Join a course to see your progress.</div>'}`;
}

// ---------- Calendar ----------
let calMonth = null;
async function viewCalendar(v) {
  const [assignments, quizzes] = await Promise.all([api('/assignments'), api('/quizzes')]);
  const events = [
    ...assignments.map((a) => ({ date: new Date(a.dueDate), title: a.title, href: '#assignment/' + a._id, color: a.course?.color, done: !!a.submission, kind: '📝' })),
    ...quizzes.filter((q) => q.dueDate).map((q) => ({ date: new Date(q.dueDate), title: q.title, href: '#quiz/' + q._id, color: q.course?.color, done: !!q.attempt, kind: '✅' })),
  ];
  if (!calMonth) { const n = new Date(); calMonth = new Date(n.getFullYear(), n.getMonth(), 1); }
  const draw = () => {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const start = new Date(y, m, 1 - ((new Date(y, m, 1).getDay() + 6) % 7));
    const today = new Date().toDateString();
    const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const upcoming = events.filter((e) => e.date >= new Date() && !e.done).sort((a, b) => a.date - b.date).slice(0, 8);
    v.innerHTML = `<div class="page-head"><div><h1>Calendar</h1><p>All your deadlines in one place.</p></div>
      <div style="display:flex;gap:.4rem;align-items:center"><button class="btn secondary sm" id="prevM">‹</button><b style="min-width:150px;text-align:center;text-transform:capitalize">${calMonth.toLocaleDateString('fr-MA', { month: 'long', year: 'numeric' })}</b><button class="btn secondary sm" id="nextM">›</button></div></div>
      <div class="card"><div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="dow">${d}</div>`).join('')}
        ${days.map((d) => { const ev = events.filter((e) => e.date.toDateString() === d.toDateString());
          return `<div class="day ${d.getMonth() !== m ? 'other' : ''} ${d.toDateString() === today ? 'today' : ''}"><div class="d">${d.getDate()}</div>${ev.map((e) => `<a class="ev" href="${e.href}" style="background:${esc(e.color || 'var(--brand)')};${e.done ? 'opacity:.5;text-decoration:line-through' : ''}" title="${esc(e.title)}">${e.kind} ${esc(e.title)}</a>`).join('')}</div>`; }).join('')}
      </div></div>
      <div class="card"><h3>Coming next</h3>${upcoming.length ? `<ul class="list">${upcoming.map((e) => `<li><span>${e.kind}</span><div class="grow"><a class="title" href="${e.href}">${esc(e.title)}</a><div class="small muted">${fmtDateTime(e.date)}</div></div>${dueLabel(e.date)}</li>`).join('')}</ul>` : '<div class="empty">Nothing coming. 🎉</div>'}</div>`;
    v.querySelector('#prevM').onclick = () => { calMonth = new Date(y, m - 1, 1); draw(); };
    v.querySelector('#nextM').onclick = () => { calMonth = new Date(y, m + 1, 1); draw(); };
  };
  draw();
}

// ---------- Questions ----------
const MAX_QUESTION = 1000;
const askBoxHtml = (placeholder) => `<textarea name="text" maxlength="${MAX_QUESTION + 200}" placeholder="${esc(placeholder)}"></textarea>
  <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap"><div class="hint">🤝 Stay polite. Your message is checked before sending and disrespectful words are replaced with ****.</div><div class="char-count" data-count-for="text">0/${MAX_QUESTION}</div></div>`;
function bindAskBox(form) {
  const ta = form.text, counter = form.querySelector('.char-count');
  const draw = () => { const n = ta.value.trim().length; counter.textContent = `${n}/${MAX_QUESTION}`; counter.classList.toggle('over', n > MAX_QUESTION); };
  ta.addEventListener('input', draw);
  draw();
}

// Shows the student how the message will look after the check. Resolves true to send, false to edit.
function previewCensored(check) {
  return new Promise((resolve) => {
    let done = false;
    const shown = esc(check.text).replace(/\*{4}/g, '<mark>****</mark>');
    const { el, close } = modal({
      title: 'Please stay respectful',
      body: `<div class="notice warn">We found <b>${check.count}</b> disrespectful word${check.count > 1 ? 's' : ''} in your message. ${check.count > 1 ? 'They were' : 'It was'} replaced with <b>****</b>.</div>
        <label>Your teacher will receive this:</label><div class="msg-preview">${shown}</div>
        <p class="small muted" style="margin:.8rem 0 0">A polite question gets a better answer. You can edit your message before sending.</p>`,
      foot: `<button class="btn" data-close>✏️ Edit my message</button><button class="btn secondary" data-ok>Send like this</button>`,
    });
    el.querySelector('[data-ok]').addEventListener('click', () => { done = true; close(); resolve(true); });
    const obs = new MutationObserver(() => { if (!document.body.contains(el)) { obs.disconnect(); if (!done) resolve(false); } });
    obs.observe(document.body, { childList: true });
  });
}

// Checks the message (length + bad words), then sends it. Returns true when it was sent.
async function sendQuestion(courseId, value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('Write your question');
  if (text.length < 5) throw new Error('Your message is too short. Explain your question.');
  if (text.length > MAX_QUESTION) throw new Error(`Your message is too long (max ${MAX_QUESTION} characters).`);
  const check = await api('/moderation/check', { method: 'POST', body: { text } });
  if (check.error) throw new Error(check.error);
  if (!check.clean && !(await previewCensored(check))) return false;
  const saved = await api(`/courses/${courseId}/questions`, { method: 'POST', body: { text } });
  toast(saved.censored ? 'Question sent — disrespectful words were hidden' : 'Question sent to the teacher ✅');
  return true;
}

async function viewQuestions(v) {
  const [list, courses] = await Promise.all([api('/questions'), api('/courses/mine')]);
  v.innerHTML = `<div class="page-head"><div><h1>Ask the teacher</h1><p>Did not understand something? Ask your teacher here.</p></div></div>
    ${courses.length ? `<div class="card"><form id="askf"><div class="field"><label>Course</label><select name="course">${courses.map((c) => `<option value="${c._id}">${esc(c.title)}</option>`).join('')}</select></div>
      <div class="field"><label>Your question</label>${askBoxHtml("Professeur, je n'ai pas compris…")}</div><button class="btn">Check and send</button></form></div>` : '<div class="card empty">Join a course first to ask questions.</div>'}
    <h2 style="margin-top:1.5rem">My questions</h2>
    ${list.length ? list.map((q) => `<div class="qa"><div style="display:flex;justify-content:space-between;gap:1rem"><span class="small muted">${esc(q.course?.title)} · ${timeAgo(q.createdAt)}</span>
      ${q.answer ? '<span class="badge ok">Answered</span>' : '<span class="badge warn">Waiting</span>'}</div>
      <p style="margin:.4rem 0 0">${esc(q.text)}</p>
      ${q.answer ? `<div class="answer"><b>Teacher's answer</b><div style="white-space:pre-wrap">${esc(q.answer)}</div></div>` : `<button class="btn ghost sm" data-del="${q._id}" style="margin-top:.4rem">Delete</button>`}</div>`).join('')
      : '<div class="card empty">No question yet.</div>'}`;
  const f = v.querySelector('#askf');
  if (f) {
    bindAskBox(f);
    f.onsubmit = (e) => { e.preventDefault(); busy(f.querySelector('button'), async () => {
      if (await sendQuestion(f.course.value, f.text.value)) refresh();
    }); };
  }
  v.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (await confirmBox('Delete this question?')) busy(null, async () => { await api('/questions/' + b.dataset.del, { method: 'DELETE' }); refresh(); }); });
}

// ---------- Notes ----------
async function viewNotes(v) {
  const notes = await api('/notes');
  v.innerHTML = `<div class="page-head"><div><h1>My notes</h1><p>Your personal notes from every lesson. Write them on each lesson page.</p></div></div>
    ${notes.length ? `<div class="grid cols-2">${notes.map((n) => `<div class="card"><div class="small" style="display:flex;gap:.4rem;align-items:center"><span class="dot" style="background:${esc(n.lesson.course.color)}"></span>${esc(n.lesson.course.title)}</div>
      <h3 style="margin:.3rem 0 .5rem"><a href="#lesson/${n.lesson._id}">${esc(n.lesson.title)}</a></h3><p style="white-space:pre-wrap;margin:0">${esc(n.text)}</p><div class="small muted" style="margin-top:.6rem">Updated ${timeAgo(n.updatedAt)}</div></div>`).join('')}</div>`
      : '<div class="card empty"><div class="big">🗒️</div>No notes yet. Open a lesson and write in "My notes".</div>'}`;
}

// ---------- Study timer (Pomodoro) ----------
const pomo = { mode: 'focus', left: 25 * 60, running: false, timer: null, sessions: 0 };
const POMO = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
try { pomo.sessions = Number(localStorage.getItem('madrasti_pomo_' + new Date().toDateString()) || 0); } catch {}
function viewTimer(v) {
  v.innerHTML = `<div class="page-head"><div><h1>Study timer</h1><p>Pomodoro method: 25 minutes of focus, then a short break.</p></div></div>
    <div class="card pomo" style="max-width:560px;margin:0 auto">
      <div class="modes">${[['focus', 'Focus'], ['short', 'Short break'], ['long', 'Long break']].map(([k, l]) => `<button data-m="${k}" class="${pomo.mode === k ? 'active' : ''}">${l}</button>`).join('')}</div>
      <div class="clock" id="clock"></div>
      <div style="display:flex;gap:.6rem;justify-content:center"><button class="btn accent" id="go"></button><button class="btn secondary" id="reset">Reset</button></div>
      <p class="muted" style="margin-top:1.4rem">Focus sessions today: <b id="sess">${pomo.sessions}</b> ${'🍅'.repeat(Math.min(pomo.sessions, 12))}</p>
    </div>`;
  const clock = v.querySelector('#clock'), go = v.querySelector('#go');
  const draw = () => {
    if (!document.body.contains(clock)) return;
    clock.textContent = `${String(Math.floor(pomo.left / 60)).padStart(2, '0')}:${String(pomo.left % 60).padStart(2, '0')}`;
    go.textContent = pomo.running ? 'Pause' : 'Start';
    clock.style.color = pomo.mode === 'focus' ? 'var(--brand)' : 'var(--accent)';
  };
  pomo.draw = draw;
  go.onclick = () => {
    if (pomo.running) { clearInterval(pomo.timer); pomo.running = false; }
    else {
      pomo.running = true;
      pomo.timer = setInterval(() => {
        pomo.left--;
        if (pomo.left <= 0) {
          clearInterval(pomo.timer); pomo.running = false;
          if (pomo.mode === 'focus') { pomo.sessions++; try { localStorage.setItem('madrasti_pomo_' + new Date().toDateString(), pomo.sessions); } catch {} toast('Great focus! Take a break ☕'); pomo.mode = pomo.sessions % 4 === 0 ? 'long' : 'short'; }
          else { toast('Break is over. Back to work! 📚'); pomo.mode = 'focus'; }
          pomo.left = POMO[pomo.mode];
          if (location.hash === '#timer') refresh();
        }
        if (location.hash === '#timer' && pomo.draw) pomo.draw();
        document.title = pomo.running ? `${String(Math.floor(pomo.left / 60)).padStart(2, '0')}:${String(pomo.left % 60).padStart(2, '0')} — Madrasti` : 'Student space — Madrasti';
      }, 1000);
    }
    draw();
  };
  v.querySelector('#reset').onclick = () => { clearInterval(pomo.timer); pomo.running = false; pomo.left = POMO[pomo.mode]; document.title = 'Student space — Madrasti'; draw(); };
  v.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { clearInterval(pomo.timer); pomo.running = false; pomo.mode = b.dataset.m; pomo.left = POMO[pomo.mode]; document.title = 'Student space — Madrasti'; refresh(); });
  draw();
}

// ---------- Profile ----------
async function viewProfile(v) {
  const u = await api('/auth/me');
  v.innerHTML = `<div class="page-head"><h1>My profile</h1></div>
    <div class="card" style="max-width:640px"><form id="pf">
      <div class="field"><label>Full name</label><input name="name" value="${esc(u.name)}"></div>
      <div class="field"><label>Email <span class="badge ok">✓ Confirmed</span></label><input value="${esc(u.email)}" disabled></div>
      <div class="field"><label>My level</label><select name="level">${options(LEVELS, u.level)}</select></div>
      ${placeFieldsHtml()}
      <div class="field"><label>New password <span class="muted">(leave empty to keep)</span></label><input type="password" name="password" autocomplete="new-password"></div>
      <button class="btn">Save profile</button></form></div>`;
  const getPlace = await mountPlaceFields(v, u);
  v.querySelector('#pf').onsubmit = (e) => { e.preventDefault(); busy(e.target.querySelector('button'), async () => {
    const d = { ...formData(e.target), ...getPlace() }; if (!d.password) delete d.password;
    const nu = await api('/auth/me', { method: 'PUT', body: d }); store.setUser(nu); Object.assign(ME, nu); catalogFilter = null; toast('Profile saved');
    document.querySelector('.sidebar .who b').textContent = nu.name;
    document.querySelector('.sidebar .who span').textContent = nu.level || 'Student';
  }); };
}

if (ME) init();
