// ===== Teacher space =====
const ME = requireRole('teacher');
// init() is called at the end of the file, after all variables exist

function init() {
  buildShell(ME, [
    { sec: 'Teaching' },
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'courses', icon: '📚', label: 'My courses' },
    { id: 'assignments', icon: '📝', label: 'Assignments' },
    { id: 'quizzes', icon: '✅', label: 'Quizzes & tests' },
    { sec: 'Students' },
    { id: 'progress', icon: '📈', label: 'Student progress' },
    { id: 'questions', icon: '💬', label: 'Questions' },
    { id: 'announcements', icon: '📣', label: 'Announcements' },
    { sec: 'Account' },
    { id: 'profile', icon: '👤', label: 'My profile' },
  ]);
  const routes = {
    dashboard: viewDashboard, courses: viewCourses, course: viewCourse, lesson: viewLesson,
    assignments: viewAssignments, assignment: viewAssignment, quizzes: viewQuizzes, quiz: viewQuizResults,
    progress: viewProgress, report: viewStudentReport, questions: viewQuestions, announcements: viewAnnouncements, profile: viewProfile,
  };
  viewCourse.parent = 'courses'; viewLesson.parent = 'courses'; viewAssignment.parent = 'assignments';
  viewQuizResults.parent = 'quizzes'; viewStudentReport.parent = 'progress';
  startRouter(routes, 'dashboard');
  refreshCounts();
}

let myCourses = null;
async function getCourses(force) {
  if (!myCourses || force) myCourses = await api('/courses/mine');
  return myCourses;
}
async function refreshCounts() {
  try {
    const d = await api('/dashboard');
    setCount('assignments', d.stats.toGrade);
    setCount('questions', d.stats.questions);
  } catch {}
}

// ---------- Dashboard ----------
async function viewDashboard(v) {
  const d = await api('/dashboard');
  const s = d.stats;
  const hour = new Date().getHours();
  v.innerHTML = `
    <div class="hero-banner zellige">
      <div><h1>${hour < 12 ? 'Sbah lkhir' : hour < 18 ? 'Good afternoon' : 'Msa lkhir'}, Prof. ${esc(ME.name.split(' ')[0])} 👋</h1>
      <p>${s.toGrade ? `You have ${s.toGrade} work${s.toGrade > 1 ? 's' : ''} to grade.` : 'Everything is graded. Great job!'} ${s.questions ? `${s.questions} question${s.questions > 1 ? 's' : ''} waiting for an answer.` : ''}</p></div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn accent" id="qLesson">+ New lesson</button><button class="btn secondary" id="qAssign" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.3)">+ New assignment</button></div>
    </div>
    <div class="grid cols-4">
      ${statCard('📚', s.courses, 'Courses')}${statCard('👥', s.students, 'Students')}
      ${statCard('📝', s.toGrade, 'To grade', s.toGrade ? 'var(--accent-soft)' : '')}${statCard('📊', s.classAverage ?? '—', 'Class average /20')}
    </div>
    <div class="grid cols-2" style="margin-top:1rem">
      <div class="card"><div class="card-head"><h3>Latest submissions</h3><a href="#assignments" class="small">See all</a></div>
        ${d.recentSubmissions.length ? `<ul class="list">${d.recentSubmissions.map((x) => `
          <li><div class="avatar">${esc(initials(x.student.name))}</div>
          <div class="grow"><div class="title">${esc(x.student.name)}</div><div class="small muted">${esc(x.assignment.title)} · ${timeAgo(x.submittedAt)}</div></div>
          ${x.status === 'graded' ? gradeHtml(x.grade, x.assignment.maxPoints) : `<a class="btn sm" href="#assignment/${x.assignment._id}">Grade</a>`}</li>`).join('')}</ul>`
          : '<div class="empty">No submissions yet</div>'}
      </div>
      <div class="card"><div class="card-head"><h3>Upcoming deadlines</h3><a href="#assignments" class="small">Manage</a></div>
        ${d.upcoming.length ? `<ul class="list">${d.upcoming.map((a) => `
          <li><div class="grow"><a class="title" href="#assignment/${a._id}">${esc(a.title)}</a><div class="small muted">${esc(a.courseTitle)}</div></div>${dueLabel(a.dueDate)}</li>`).join('')}</ul>`
          : '<div class="empty">No upcoming deadlines</div>'}
      </div>
    </div>
    <div class="card" style="margin-top:1rem"><div class="card-head"><h3>My courses</h3><a href="#courses" class="small">All courses</a></div>
      <div class="grid auto" id="dashCourses"></div></div>`;
  const courses = await getCourses(true);
  document.getElementById('dashCourses').innerHTML = courses.length ? courses.slice(0, 3).map(courseCard).join('') : emptyCourses();
  bindEmptyCourses(v);
  document.getElementById('qLesson').onclick = () => pickCourse((c) => lessonForm(c._id));
  document.getElementById('qAssign').onclick = () => pickCourse((c) => assignmentForm(c._id));
}

const statCard = (icon, num, label, bg) => `<div class="card stat"><div class="ico" ${bg ? `style="background:${bg}"` : ''}>${icon}</div><div><div class="num">${esc(num)}</div><div class="lbl">${esc(label)}</div></div></div>`;

const emptyCourses = () => `<div class="empty" style="grid-column:1/-1"><div class="big">📚</div><p>You have no course yet.</p><button class="btn" data-newcourse>Create my first course</button></div>`;
function bindEmptyCourses(root) { root.querySelectorAll('[data-newcourse]').forEach((b) => b.onclick = () => courseForm()); }

function courseCard(c) {
  return `<div class="card course-card">
    <div class="cover" style="background:${esc(c.color)}"><span class="subject">${esc(c.subject)}</span></div>
    <div class="body"><h3>${esc(c.title)}</h3>
      <div class="meta"><span>🎓 ${esc(c.level)}</span><span>📖 ${c.lessonCount} lessons${c.draftCount ? ` (${c.draftCount} draft)` : ''}</span><span>👥 ${c.studentCount} students</span></div>
      <div class="actions"><a class="btn sm" href="#course/${c._id}">Open</a><a class="btn secondary sm" href="#progress/${c._id}">Progress</a></div>
    </div></div>`;
}

async function pickCourse(cb) {
  const courses = await getCourses();
  if (!courses.length) { toast('Create a course first', 'error'); return courseForm(); }
  if (courses.length === 1) return cb(courses[0]);
  const { el, close } = modal({
    title: 'Choose a course',
    body: `<ul class="list">${courses.map((c) => `<li><span class="dot" style="background:${esc(c.color)}"></span><div class="grow"><div class="title">${esc(c.title)}</div><div class="small muted">${esc(c.level)}</div></div><button class="btn sm" data-id="${c._id}">Choose</button></li>`).join('')}</ul>`,
  });
  el.querySelectorAll('[data-id]').forEach((b) => b.onclick = () => { close(); cb(courses.find((c) => c._id === b.dataset.id)); });
}

// ---------- Courses ----------
async function viewCourses(v) {
  const courses = await getCourses(true);
  v.innerHTML = `<div class="page-head"><div><h1>My courses</h1><p>Prepare your lessons and organise your classes.</p></div><button class="btn" data-newcourse>+ New course</button></div>
    <div class="grid auto">${courses.length ? courses.map(courseCard).join('') : emptyCourses()}</div>`;
  bindEmptyCourses(v);
}

function courseForm(course) {
  const c = course || { color: COLORS[0], level: '2ème Année Bac', subject: ME.subject || 'Mathématiques' };
  const { el, close } = modal({
    title: course ? 'Edit course' : 'New course',
    body: `<form id="cf">
      <div class="field"><label>Course title</label><input name="title" required value="${esc(c.title || '')}" placeholder="Mathématiques — 2ème Bac Sciences Physiques"></div>
      <div class="row"><div class="field"><label>Subject</label><select name="subject">${options(SUBJECTS, c.subject)}</select></div>
      <div class="field"><label>Level</label><select name="level">${options(LEVELS, c.level)}</select></div></div>
      <div class="field"><label>Description</label><textarea name="description" placeholder="What will students learn?">${esc(c.description || '')}</textarea></div>
      <div class="field"><label>Colour</label><div style="display:flex;gap:.5rem;flex-wrap:wrap">${COLORS.map((col) => `<label style="margin:0;cursor:pointer"><input type="radio" name="color" value="${col}" ${col === c.color ? 'checked' : ''} style="display:none"><span class="dot" style="width:30px;height:30px;display:block;background:${col};outline:${col === c.color ? '3px solid var(--ink)' : 'none'};outline-offset:2px"></span></label>`).join('')}</div></div>
    </form>`,
    foot: `<button class="btn secondary" data-close>Cancel</button><button class="btn" id="cfSave">${course ? 'Save' : 'Create course'}</button>`,
  });
  el.querySelectorAll('input[name=color]').forEach((r) => r.onchange = () => el.querySelectorAll('input[name=color]').forEach((x) => { x.nextElementSibling.style.outline = x.checked ? '3px solid var(--ink)' : 'none'; }));
  el.querySelector('#cfSave').onclick = (e) => busy(e.target, async () => {
    const d = formData(el.querySelector('#cf'));
    if (!d.title.trim()) throw new Error('Write a course title');
    const saved = course ? await api('/courses/' + course._id, { method: 'PUT', body: d }) : await api('/courses', { method: 'POST', body: d });
    close();
    toast(course ? 'Course saved' : 'Course created');
    myCourses = null;
    if (course) refresh(); else location.hash = 'course/' + saved._id;
  });
}

// ---------- One course ----------
let courseTab = 'lessons';
async function viewCourse(v, id, tab) {
  if (tab) courseTab = tab;
  const c = await api('/courses/' + id);
  if (!c.isOwner) throw new Error('This is not your course');
  v.innerHTML = `
    <div class="crumbs"><a href="#courses">My courses</a> › ${esc(c.title)}</div>
    <div class="hero-banner" style="background:${esc(c.color)}">
      <div><h1>${esc(c.title)}</h1><p>${esc(c.subject)} · ${esc(c.level)} · ${c.studentCount} students</p></div>
      <div style="display:flex;gap:.5rem"><button class="btn secondary sm" id="editC">Edit</button><button class="btn danger sm" id="delC">Delete</button></div>
    </div>
    ${c.description ? `<p class="muted">${esc(c.description)}</p>` : ''}
    <div class="tabs" id="ctabs">
      ${[['lessons', `Lessons (${c.lessons.length})`], ['assignments', `Assignments (${c.assignments.length})`], ['quizzes', `Quizzes (${c.quizzes.length})`], ['students', 'Students & progress'], ['news', `Announcements (${c.announcements.length})`]]
        .map(([k, l]) => `<button data-tab="${k}" class="${courseTab === k ? 'active' : ''}">${l}</button>`).join('')}
    </div>
    <div id="tabBody"></div>`;
  v.querySelector('#editC').onclick = () => courseForm(c);
  v.querySelector('#delC').onclick = async () => {
    if (!(await confirmBox(`Delete "${c.title}" with all its lessons, assignments, quizzes and grades? This cannot be undone.`))) return;
    await busy(null, async () => { await api('/courses/' + c._id, { method: 'DELETE' }); myCourses = null; toast('Course deleted'); location.hash = 'courses'; });
  };
  v.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { courseTab = b.dataset.tab; v.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b)); renderTab(); });
  const body = v.querySelector('#tabBody');

  function renderTab() {
    if (courseTab === 'lessons') {
      body.innerHTML = `<div class="card"><div class="card-head"><h3>Lessons</h3><button class="btn sm" id="addL">+ Prepare a lesson</button></div>
        ${c.lessons.length ? c.lessons.map((l, i) => `<div class="lesson-item">
          <div class="num">${i + 1}</div>
          <div class="grow" style="flex:1;min-width:0"><a class="title" href="#lesson/${l._id}" style="font-weight:600">${esc(l.title)}</a>
          <div class="small muted">${l.duration} min · ${(l.attachments || []).length} file(s) ${l.videoUrl ? '· 🎬 video' : ''}</div></div>
          ${l.status === 'draft' ? '<span class="badge warn">Draft</span>' : '<span class="badge ok">Published</span>'}
          <button class="btn ghost sm" data-edit="${l._id}">Edit</button></div>`).join('')
          : '<div class="empty"><div class="big">📖</div>No lesson yet. Prepare your first lesson.</div>'}</div>`;
      body.querySelector('#addL').onclick = () => lessonForm(c._id);
      body.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => lessonForm(c._id, c.lessons.find((l) => l._id === b.dataset.edit)));
    } else if (courseTab === 'assignments') {
      body.innerHTML = `<div class="card"><div class="card-head"><h3>Assignments</h3><button class="btn sm" id="addA">+ New assignment</button></div>
        ${c.assignments.length ? `<ul class="list">${c.assignments.map((a) => `<li><div class="grow"><a class="title" href="#assignment/${a._id}">${esc(a.title)}</a><div class="small muted">On ${a.maxPoints} points · due ${fmtDateTime(a.dueDate)}</div></div>${dueLabel(a.dueDate)}<a class="btn secondary sm" href="#assignment/${a._id}">Submissions</a></li>`).join('')}</ul>`
          : '<div class="empty"><div class="big">📝</div>No assignment yet.</div>'}</div>`;
      body.querySelector('#addA').onclick = () => assignmentForm(c._id);
    } else if (courseTab === 'quizzes') {
      body.innerHTML = `<div class="card"><div class="card-head"><h3>Quizzes & tests</h3><button class="btn sm" id="addQ">+ New quiz</button></div>
        ${c.quizzes.length ? `<ul class="list">${c.quizzes.map((q) => `<li><div class="grow"><a class="title" href="#quiz/${q._id}">${esc(q.title)}</a><div class="small muted">${q.questionCount} questions · ${q.timeLimit} min</div></div>${q.published ? '<span class="badge ok">Open</span>' : '<span class="badge">Hidden</span>'}<a class="btn secondary sm" href="#quiz/${q._id}">Results</a></li>`).join('')}</ul>`
          : '<div class="empty"><div class="big">✅</div>No quiz yet.</div>'}</div>`;
      body.querySelector('#addQ').onclick = () => quizForm(c._id);
    } else if (courseTab === 'students') {
      body.innerHTML = '<div class="loader"></div>';
      api('/progress/course/' + c._id).then((p) => { body.innerHTML = progressTable(p); bindProgressTable(body, p); }).catch((e) => { body.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; });
    } else {
      body.innerHTML = `<div class="card"><div class="card-head"><h3>Announcements</h3><button class="btn sm" id="addN">+ New announcement</button></div>
        ${c.announcements.length ? c.announcements.map((a) => announcementHtml(a, true)).join('') : '<div class="empty">No announcement yet.</div>'}</div>`;
      body.querySelector('#addN').onclick = () => announcementForm(c._id);
      bindAnnouncementDelete(body);
    }
  }
  renderTab();
}

// ---------- Lessons ----------
function lessonForm(courseId, lesson) {
  const l = lesson || { status: 'published', duration: 45, objectives: [] };
  const { el, close } = modal({
    title: lesson ? 'Edit lesson' : 'Prepare a lesson', wide: true,
    body: `<form id="lf">
      <div class="field"><label>Lesson title</label><input name="title" required value="${esc(l.title || '')}" placeholder="Ex: Limites et continuité"></div>
      <div class="field"><label>Learning objectives <span class="muted">(one per line)</span></label><textarea name="objectives" style="min-height:80px" placeholder="Comprendre…&#10;Savoir calculer…">${esc((l.objectives || []).join('\n'))}</textarea></div>
      <div class="field"><label>Lesson content</label><textarea name="content" style="min-height:240px" placeholder="## Introduction&#10;Write the lesson here.&#10;&#10;## Part 1&#10;- point one&#10;- point two">${esc(l.content || '')}</textarea>
        <div class="hint">Tips: start a line with ## for a title, - for a list, and use **text** for bold.</div></div>
      <div class="row">
        <div class="field"><label>Video link (YouTube…)</label><input type="url" name="videoUrl" value="${esc(l.videoUrl || '')}" placeholder="https://youtube.com/watch?v=…"></div>
        <div class="field"><label>Duration (minutes)</label><input type="number" name="duration" min="5" value="${esc(l.duration)}"></div>
      </div>
      <div class="row">
        <div class="field"><label>Status</label><select name="status"><option value="published" ${l.status === 'published' ? 'selected' : ''}>Published — students can see it</option><option value="draft" ${l.status === 'draft' ? 'selected' : ''}>Draft — only me</option></select></div>
        <div class="field"><label>Files (PDF, images, docs)</label><input type="file" name="files" multiple></div>
      </div>
      ${lesson && l.attachments?.length ? `<div class="field"><label>Current files <span class="muted">(untick to remove)</span></label>${l.attachments.map((f) => `<label style="font-weight:500"><input type="checkbox" class="keep" value="${esc(f.path)}" checked style="width:auto"> ${esc(f.name)}</label>`).join('')}</div>` : ''}
    </form>`,
    foot: `${lesson ? '<button class="btn danger" id="lfDel" style="margin-right:auto">Delete</button>' : ''}<button class="btn secondary" data-close>Cancel</button><button class="btn" id="lfSave">${lesson ? 'Save lesson' : 'Create lesson'}</button>`,
  });
  el.querySelector('#lfSave').onclick = (e) => busy(e.target, async () => {
    const form = el.querySelector('#lf');
    if (!form.title.value.trim()) throw new Error('Write a lesson title');
    const fd = new FormData(form);
    el.querySelectorAll('.keep').forEach((k) => { if (!k.checked) fd.append('removeFiles', k.value); });
    if (lesson) await api('/lessons/' + lesson._id, { method: 'PUT', form: fd });
    else await api(`/courses/${courseId}/lessons`, { method: 'POST', form: fd });
    close(); toast(lesson ? 'Lesson saved' : 'Lesson created'); myCourses = null; courseTab = 'lessons'; refresh();
  });
  const del = el.querySelector('#lfDel');
  if (del) del.onclick = async () => {
    if (!(await confirmBox(`Delete the lesson "${lesson.title}"?`))) return;
    await busy(null, async () => { await api('/lessons/' + lesson._id, { method: 'DELETE' }); close(); toast('Lesson deleted'); myCourses = null; location.hash = 'course/' + courseId; refresh(); });
  };
}

async function viewLesson(v, id) {
  const l = await api('/lessons/' + id);
  v.innerHTML = `<div class="crumbs"><a href="#courses">My courses</a> › <a href="#course/${l.course._id}">${esc(l.course.title)}</a> › ${esc(l.title)}</div>
    <div class="page-head"><div><h1>${esc(l.title)}</h1><p>${l.duration} min · ${l.status === 'draft' ? '<span class="badge warn">Draft</span>' : '<span class="badge ok">Published</span>'}</p></div>
    <button class="btn" id="editL">Edit lesson</button></div>
    <div class="card">
      ${l.objectives.length ? `<div class="objectives"><b>🎯 Objectives</b><ul>${l.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}
      ${videoEmbed(l.videoUrl)}
      <div class="lesson-body">${renderRich(l.content) || '<p class="muted">No content yet.</p>'}</div>
      ${l.attachments.length ? `<h3 style="margin-top:1.4rem">Files</h3>${filesHtml(l.attachments)}` : ''}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:1rem;gap:.5rem">
      ${l.prev ? `<a class="btn secondary" href="#lesson/${l.prev._id}">← ${esc(l.prev.title)}</a>` : '<span></span>'}
      ${l.next ? `<a class="btn secondary" href="#lesson/${l.next._id}">${esc(l.next.title)} →</a>` : ''}
    </div>`;
  v.querySelector('#editL').onclick = () => lessonForm(l.course._id, l);
}

// ---------- Assignments ----------
function assignmentForm(courseId, a) {
  const due = a ? toLocalInput(a.dueDate) : toLocalInput(Date.now() + 7 * 86400000).slice(0, 11) + '23:59';
  const { el, close } = modal({
    title: a ? 'Edit assignment' : 'New assignment',
    body: `<form id="af">
      <div class="field"><label>Title</label><input name="title" required value="${esc(a?.title || '')}" placeholder="Devoir maison n°1"></div>
      <div class="field"><label>Instructions</label><textarea name="instructions" placeholder="What should students do?">${esc(a?.instructions || '')}</textarea></div>
      <div class="row"><div class="field"><label>Due date</label><input type="datetime-local" name="dueDate" required value="${due}"></div>
      <div class="field"><label>Graded on</label><input type="number" name="maxPoints" min="1" value="${a?.maxPoints || 20}"></div></div>
      <div class="field"><label>Files for students (optional)</label><input type="file" name="files" multiple></div>
    </form>`,
    foot: `${a ? '<button class="btn danger" id="afDel" style="margin-right:auto">Delete</button>' : ''}<button class="btn secondary" data-close>Cancel</button><button class="btn" id="afSave">${a ? 'Save' : 'Create assignment'}</button>`,
  });
  el.querySelector('#afSave').onclick = (e) => busy(e.target, async () => {
    const form = el.querySelector('#af');
    if (!form.title.value.trim() || !form.dueDate.value) throw new Error('Title and due date are required');
    const fd = new FormData(form);
    fd.set('dueDate', new Date(form.dueDate.value).toISOString());
    if (a) await api('/assignments/' + a._id, { method: 'PUT', form: fd });
    else await api(`/courses/${courseId}/assignments`, { method: 'POST', form: fd });
    close(); toast(a ? 'Assignment saved' : 'Assignment created — students can see it now'); courseTab = 'assignments'; refresh();
  });
  const del = el.querySelector('#afDel');
  if (del) del.onclick = async () => {
    if (!(await confirmBox(`Delete "${a.title}" and all its submissions?`))) return;
    await busy(null, async () => { await api('/assignments/' + a._id, { method: 'DELETE' }); close(); toast('Assignment deleted'); location.hash = 'assignments'; refreshCounts(); });
  };
}

async function viewAssignments(v) {
  const list = await api('/assignments');
  const pending = list.reduce((n, a) => n + (a.submitted - a.graded), 0);
  v.innerHTML = `<div class="page-head"><div><h1>Assignments</h1><p>${pending} submission${pending === 1 ? '' : 's'} waiting to be graded.</p></div><button class="btn" id="newA">+ New assignment</button></div>
    <div class="card">${list.length ? `<div class="table-wrap"><table><thead><tr><th>Assignment</th><th>Course</th><th>Due</th><th>Submitted</th><th>To grade</th><th></th></tr></thead><tbody>
      ${list.map((a) => `<tr><td><a href="#assignment/${a._id}"><b>${esc(a.title)}</b></a><div class="small muted">on ${a.maxPoints}</div></td>
        <td><span class="dot" style="display:inline-block;background:${esc(a.course?.color)}"></span> ${esc(a.course?.title)}</td>
        <td>${dueLabel(a.dueDate)}</td><td>${a.submitted}/${a.students}</td>
        <td>${a.submitted - a.graded ? `<span class="badge accent">${a.submitted - a.graded}</span>` : '<span class="badge ok">✓</span>'}</td>
        <td><a class="btn sm" href="#assignment/${a._id}">Open</a></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><div class="big">📝</div>No assignment yet.</div>'}</div>`;
  v.querySelector('#newA').onclick = () => pickCourse((c) => assignmentForm(c._id));
}

async function viewAssignment(v, id) {
  const { assignment: a, submissions, missing } = await api(`/assignments/${id}/submissions`);
  const graded = submissions.filter((s) => s.status === 'graded');
  const avgG = graded.length ? graded.reduce((n, s) => n + s.grade, 0) / graded.length : null;
  v.innerHTML = `<div class="crumbs"><a href="#assignments">Assignments</a> › ${esc(a.title)}</div>
    <div class="page-head"><div><h1>${esc(a.title)}</h1><p><a href="#course/${a.course._id}">${esc(a.course.title)}</a> · due ${fmtDateTime(a.dueDate)} ${dueLabel(a.dueDate)}</p></div>
    <button class="btn secondary" id="editA">Edit</button></div>
    <div class="grid cols-4">${statCard('📥', submissions.length, 'Submitted')}${statCard('⏳', submissions.length - graded.length, 'To grade')}${statCard('🚫', missing.length, 'Not submitted')}${statCard('📊', avgG === null ? '—' : Math.round(avgG * 10) / 10, `Average /${a.maxPoints}`)}</div>
    ${a.instructions ? `<div class="card" style="margin-top:1rem"><h3>Instructions</h3><p style="white-space:pre-wrap">${esc(a.instructions)}</p>${filesHtml(a.attachments)}</div>` : ''}
    <div class="card" style="margin-top:1rem"><div class="card-head"><h3>Submissions</h3></div>
      ${submissions.length ? `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Sent</th><th>Work</th><th>Grade</th><th></th></tr></thead><tbody>
      ${submissions.map((s) => `<tr><td><b>${esc(s.student.name)}</b><div class="small muted">${esc(s.student.email)}</div></td>
        <td>${fmtDateTime(s.submittedAt)} ${s.late ? '<span class="badge bad">Late</span>' : ''}</td>
        <td>${s.files.length ? `📎 ${s.files.length} file(s)` : ''} ${s.text ? '✍️ text' : ''}</td>
        <td>${s.status === 'graded' ? gradeHtml(s.grade, a.maxPoints) : '<span class="badge accent">To grade</span>'}</td>
        <td><button class="btn sm ${s.status === 'graded' ? 'secondary' : ''}" data-grade="${s._id}">${s.status === 'graded' ? 'Edit grade' : 'Grade'}</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No submission yet.</div>'}
    </div>
    ${missing.length ? `<div class="card"><h3>Not submitted yet (${missing.length})</h3><div class="files" style="margin-top:.6rem">${missing.map((m) => `<span class="file-chip">${esc(m.name)}</span>`).join('')}</div></div>` : ''}`;
  v.querySelector('#editA').onclick = () => assignmentForm(a.course._id, a);
  v.querySelectorAll('[data-grade]').forEach((b) => b.onclick = () => gradeForm(a, submissions.find((s) => s._id === b.dataset.grade)));
}

function gradeForm(a, s) {
  const { el, close } = modal({
    title: `Grade — ${s.student.name}`, wide: true,
    body: `<p class="small muted">Sent ${fmtDateTime(s.submittedAt)} ${s.late ? '<span class="badge bad">Late</span>' : ''}</p>
      ${s.text ? `<div class="card" style="box-shadow:none;background:var(--surface-2);white-space:pre-wrap;margin-bottom:1rem">${esc(s.text)}</div>` : ''}
      ${s.files.length ? `<div class="field"><label>Files</label>${filesHtml(s.files)}</div>` : ''}
      <form id="gf"><div class="row"><div class="field"><label>Grade (out of ${a.maxPoints})</label><input type="number" name="grade" min="0" max="${a.maxPoints}" step="0.25" required value="${s.grade ?? ''}"></div><div></div></div>
      <div class="field"><label>Feedback for the student</label><textarea name="feedback" placeholder="Good work! Be careful with…">${esc(s.feedback || '')}</textarea></div></form>`,
    foot: `<button class="btn secondary" data-close>Cancel</button><button class="btn" id="gfSave">Save grade</button>`,
  });
  el.querySelector('#gfSave').onclick = (e) => busy(e.target, async () => {
    const d = formData(el.querySelector('#gf'));
    if (d.grade === '') throw new Error('Enter a grade');
    await api(`/assignments/submissions/${s._id}/grade`, { method: 'PUT', body: d });
    close(); toast('Grade saved'); refresh(); refreshCounts();
  });
}

// ---------- Quizzes ----------
async function viewQuizzes(v) {
  const list = await api('/quizzes');
  v.innerHTML = `<div class="page-head"><div><h1>Quizzes & tests</h1><p>Multiple-choice tests, corrected automatically.</p></div><button class="btn" id="newQ">+ New quiz</button></div>
    <div class="card">${list.length ? `<div class="table-wrap"><table><thead><tr><th>Quiz</th><th>Course</th><th>Questions</th><th>Taken</th><th>Average</th><th></th></tr></thead><tbody>
      ${list.map((q) => `<tr><td><a href="#quiz/${q._id}"><b>${esc(q.title)}</b></a> ${q.published ? '' : '<span class="badge">Hidden</span>'}</td>
      <td><span class="dot" style="display:inline-block;background:${esc(q.course?.color)}"></span> ${esc(q.course?.title)}</td>
      <td>${q.questionCount}</td><td>${q.attempts}</td><td>${gradeHtml(q.average)}</td>
      <td style="white-space:nowrap"><a class="btn sm" href="#quiz/${q._id}">Results</a> <button class="btn ghost sm" data-edit="${q._id}">Edit</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><div class="big">✅</div>No quiz yet. Create one to assess your students.</div>'}</div>`;
  v.querySelector('#newQ').onclick = () => pickCourse((c) => quizForm(c._id));
  v.querySelectorAll('[data-edit]').forEach((b) => b.onclick = async () => { const q = await api('/quizzes/' + b.dataset.edit); quizForm(q.course._id, q); });
}

function quizForm(courseId, quiz) {
  let questions = quiz ? quiz.questions.map((q) => ({ text: q.text, options: [...q.options], correct: q.correct, points: q.points }))
    : [{ text: '', options: ['', '', '', ''], correct: 0, points: 1 }];
  const { el, close } = modal({
    title: quiz ? 'Edit quiz' : 'New quiz', wide: true,
    body: `<form id="qf" onsubmit="return false">
      <div class="row"><div class="field"><label>Quiz title</label><input name="title" value="${esc(quiz?.title || '')}" placeholder="Quiz : Les suites"></div>
      <div class="field"><label>Time limit (minutes)</label><input type="number" name="timeLimit" min="1" value="${quiz?.timeLimit || 20}"></div></div>
      <div class="row"><div class="field"><label>Description</label><input name="description" value="${esc(quiz?.description || '')}"></div>
      <div class="field"><label>Visible to students</label><select name="published"><option value="1">Yes</option><option value="0" ${quiz && !quiz.published ? 'selected' : ''}>No (hidden)</option></select></div></div>
      <div id="qb"></div>
      <button type="button" class="btn secondary" id="addQq">+ Add a question</button>
      ${quiz ? '<p class="hint">Changing questions does not change grades already given.</p>' : ''}
    </form>`,
    foot: `${quiz ? '<button class="btn danger" id="qfDel" style="margin-right:auto">Delete</button>' : ''}<button class="btn secondary" data-close>Cancel</button><button class="btn" id="qfSave">${quiz ? 'Save quiz' : 'Create quiz'}</button>`,
  });
  const qb = el.querySelector('#qb');
  function sync() {
    qb.querySelectorAll('.qb-question').forEach((box, i) => {
      questions[i].text = box.querySelector('.qt').value;
      questions[i].points = Number(box.querySelector('.qp').value) || 1;
      questions[i].options = [...box.querySelectorAll('.qo')].map((o) => o.value);
      const r = box.querySelector('input[type=radio]:checked');
      questions[i].correct = r ? Number(r.value) : 0;
    });
  }
  function draw() {
    qb.innerHTML = questions.map((q, i) => `<div class="qb-question">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem"><b>Question ${i + 1}</b>
      <span style="display:flex;gap:.4rem;align-items:center"><span class="small muted">Points</span><input type="number" class="qp" min="1" value="${q.points}" style="width:70px"><button type="button" class="btn ghost sm" data-rm="${i}" ${questions.length === 1 ? 'disabled' : ''}>Remove</button></span></div>
      <div class="field"><input class="qt" placeholder="Write the question" value="${esc(q.text)}"></div>
      <div class="small muted" style="margin-bottom:.3rem">Choices — select the correct answer</div>
      ${q.options.map((o, j) => `<div class="qb-option"><input type="radio" name="c${i}" value="${j}" ${q.correct === j ? 'checked' : ''} title="Correct answer"><input class="qo" placeholder="Choice ${j + 1}" value="${esc(o)}">${q.options.length > 2 ? `<button type="button" class="btn ghost sm" data-rmo="${i}-${j}">×</button>` : ''}</div>`).join('')}
      ${q.options.length < 6 ? `<button type="button" class="btn ghost sm" data-addo="${i}">+ choice</button>` : ''}
    </div>`).join('');
    qb.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { sync(); questions.splice(Number(b.dataset.rm), 1); draw(); });
    qb.querySelectorAll('[data-addo]').forEach((b) => b.onclick = () => { sync(); questions[Number(b.dataset.addo)].options.push(''); draw(); });
    qb.querySelectorAll('[data-rmo]').forEach((b) => b.onclick = () => {
      sync(); const [i, j] = b.dataset.rmo.split('-').map(Number); const q = questions[i];
      q.options.splice(j, 1); if (q.correct === j) q.correct = 0; else if (q.correct > j) q.correct--; draw();
    });
  }
  draw();
  el.querySelector('#addQq').onclick = () => { sync(); questions.push({ text: '', options: ['', '', '', ''], correct: 0, points: 1 }); draw(); qb.lastElementChild.scrollIntoView({ behavior: 'smooth' }); };
  el.querySelector('#qfSave').onclick = (e) => busy(e.target, async () => {
    sync();
    const f = el.querySelector('#qf');
    if (!f.title.value.trim()) throw new Error('Write a quiz title');
    // drop empty choices but keep the right answer index aligned
    const clean = questions.map((q) => {
      const kept = q.options.map((o, j) => ({ o: o.trim(), j })).filter((x) => x.o);
      return { text: q.text, points: q.points, options: kept.map((x) => x.o), correct: kept.findIndex((x) => x.j === q.correct) };
    });
    const body = { course: courseId, title: f.title.value, description: f.description.value, timeLimit: f.timeLimit.value, published: f.published.value === '1', questions: clean };
    if (quiz) await api('/quizzes/' + quiz._id, { method: 'PUT', body });
    else await api('/quizzes', { method: 'POST', body });
    close(); toast(quiz ? 'Quiz saved' : 'Quiz created'); courseTab = 'quizzes'; refresh();
  });
  const del = el.querySelector('#qfDel');
  if (del) del.onclick = async () => {
    if (!(await confirmBox(`Delete "${quiz.title}" and all results?`))) return;
    await busy(null, async () => { await api('/quizzes/' + quiz._id, { method: 'DELETE' }); close(); toast('Quiz deleted'); location.hash = 'quizzes'; refresh(); });
  };
}

async function viewQuizResults(v, id) {
  const [{ quiz, attempts, questionStats }, full] = await Promise.all([api(`/quizzes/${id}/attempts`), api('/quizzes/' + id)]);
  const avg = attempts.length ? attempts.reduce((n, a) => n + (a.score / a.total) * 20, 0) / attempts.length : null;
  v.innerHTML = `<div class="crumbs"><a href="#quizzes">Quizzes</a> › ${esc(quiz.title)}</div>
    <div class="page-head"><div><h1>${esc(quiz.title)}</h1><p><a href="#course/${full.course._id}">${esc(full.course.title)}</a> · ${quiz.questionCount} questions</p></div><button class="btn secondary" id="editQ">Edit quiz</button></div>
    <div class="grid cols-3">${statCard('🧑‍🎓', attempts.length, 'Students who took it')}${statCard('📊', avg === null ? '—' : Math.round(avg * 10) / 10, 'Average /20')}${statCard('🏆', attempts[0] ? Math.round((attempts[0].score / attempts[0].total) * 200) / 10 : '—', 'Best /20')}</div>
    <div class="grid cols-2" style="margin-top:1rem">
      <div class="card"><h3>Results</h3>${attempts.length ? `<ul class="list">${attempts.map((a) => `<li><div class="avatar">${esc(initials(a.student.name))}</div><div class="grow"><div class="title">${esc(a.student.name)}</div><div class="small muted">${fmtDateTime(a.submittedAt)} · ${a.score}/${a.total} correct</div></div>${gradeHtml((a.score / a.total) * 20)}</li>`).join('')}</ul>` : '<div class="empty">Nobody took this quiz yet.</div>'}</div>
      <div class="card"><h3>Success per question</h3><p class="small muted">Low % = students did not understand this part well.</p>
        ${questionStats.map((q, i) => `<div style="margin-bottom:.8rem"><div class="small" style="display:flex;justify-content:space-between;gap:1rem"><span><b>Q${i + 1}.</b> ${esc(q.text)}</span><b>${q.rate === null ? '—' : q.rate + '%'}</b></div>${bar(q.rate, q.rate !== null && q.rate < 50 ? 'var(--bad)' : q.rate !== null && q.rate < 70 ? 'var(--warn)' : '')}</div>`).join('')}</div>
    </div>`;
  v.querySelector('#editQ').onclick = () => quizForm(full.course._id, full);
}

// ---------- Progress ----------
async function viewProgress(v, courseId) {
  const courses = await getCourses(true);
  if (!courses.length) { v.innerHTML = `<div class="page-head"><h1>Student progress</h1></div><div class="grid auto">${emptyCourses()}</div>`; bindEmptyCourses(v); return; }
  const cid = courseId && courses.some((c) => c._id === courseId) ? courseId : courses[0]._id;
  v.innerHTML = `<div class="page-head"><div><h1>Student progress</h1><p>Follow each student: lessons, assignments, quizzes and averages.</p></div></div>
    <div class="toolbar"><select id="pc">${courses.map((c) => `<option value="${c._id}" ${c._id === cid ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select></div>
    <div id="pbody"><div class="loader"></div></div>`;
  v.querySelector('#pc').onchange = (e) => { location.hash = 'progress/' + e.target.value; };
  const p = await api('/progress/course/' + cid);
  const body = v.querySelector('#pbody');
  body.innerHTML = progressTable(p);
  bindProgressTable(body, p);
}

function progressTable(p) {
  const s = p.summary;
  return `<div class="grid cols-4" style="margin-bottom:1rem">${statCard('👥', s.students, 'Students')}${statCard('📊', s.classAverage ?? '—', 'Class average /20')}${statCard('📖', (s.avgProgress ?? 0) + '%', 'Average progress')}${statCard('⚠️', s.atRisk, 'Need help', s.atRisk ? 'var(--bad-soft)' : '')}</div>
  <div class="card"><div class="card-head"><h3>Students</h3><input type="text" id="psearch" placeholder="Search a student…" style="max-width:240px"></div>
  ${p.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Lessons</th><th>Assignments</th><th>Quizzes</th><th>Average</th><th>Last active</th><th>Status</th><th></th></tr></thead><tbody>
  ${p.rows.map((r) => `<tr data-name="${esc(r.student.name.toLowerCase())}"><td><div style="display:flex;gap:.6rem;align-items:center"><div class="avatar">${esc(initials(r.student.name))}</div><div><b>${esc(r.student.name)}</b><div class="small muted">${esc(r.student.city || r.student.email)}</div></div></div></td>
    <td style="min-width:120px"><div class="small">${r.lessonsDone}/${r.lessonsTotal}</div>${bar(r.progress)}</td>
    <td>${r.submitted}/${r.assignmentsTotal}<div class="small">${gradeHtml(r.assignAvg)}</div></td>
    <td>${r.quizzesTaken}/${r.quizzesTotal}<div class="small">${gradeHtml(r.quizAvg)}</div></td>
    <td>${gradeHtml(r.overall)}</td><td class="small">${timeAgo(r.lastActivity)}</td>
    <td>${r.status === 'risk' ? '<span class="badge bad">Needs help</span>' : r.status === 'watch' ? '<span class="badge warn">To watch</span>' : '<span class="badge ok">Good</span>'}</td>
    <td><a class="btn secondary sm" href="#report/${p.course._id}/${r.student._id}">Report</a></td></tr>`).join('')}
  </tbody></table></div>` : '<div class="empty"><div class="big">👥</div>No student enrolled yet. Students join from the course catalogue.</div>'}</div>`;
}
function bindProgressTable(root) {
  const s = root.querySelector('#psearch');
  if (s) s.oninput = () => root.querySelectorAll('tr[data-name]').forEach((tr) => { tr.style.display = tr.dataset.name.includes(s.value.toLowerCase()) ? '' : 'none'; });
}

async function viewStudentReport(v, courseId, studentId) {
  const r = await api(`/progress/course/${courseId}/student/${studentId}`);
  const s = r.summary;
  v.innerHTML = `<div class="crumbs"><a href="#progress/${courseId}">Student progress</a> › ${esc(r.student.name)}</div>
    <div class="page-head"><div style="display:flex;gap:1rem;align-items:center"><div class="avatar" style="width:56px;height:56px;font-size:1.1rem">${esc(initials(r.student.name))}</div>
      <div><h1>${esc(r.student.name)}</h1><p>${esc(r.course.title)} · ${esc(r.student.email)}${r.student.city ? ' · ' + esc(r.student.city) : ''}</p></div></div>
      <button class="btn secondary" onclick="window.print()">🖨 Print report</button></div>
    <div class="grid cols-4">${statCard('📖', s.progress + '%', 'Lessons done')}${statCard('📝', `${s.submitted}/${s.assignmentsTotal}`, 'Assignments sent')}${statCard('✅', `${s.quizzesTaken}/${s.quizzesTotal}`, 'Quizzes taken')}${statCard('📊', s.overall ?? '—', 'Average /20')}</div>
    <div class="grid cols-2" style="margin-top:1rem">
      <div class="card"><h3>Assignments</h3><ul class="list">${r.assignments.map((a) => `<li><div class="grow"><div class="title">${esc(a.title)}</div><div class="small muted">due ${fmtDate(a.dueDate)}${a.submission?.late ? ' · <span class="badge bad">Late</span>' : ''}</div>${a.submission?.feedback ? `<div class="small">💬 ${esc(a.submission.feedback)}</div>` : ''}</div>
        ${!a.submission ? (new Date(a.dueDate) < new Date() ? '<span class="badge bad">Missing</span>' : '<span class="badge">Not yet</span>') : a.submission.status === 'graded' ? gradeHtml(a.submission.grade, a.maxPoints) : '<span class="badge accent">To grade</span>'}</li>`).join('') || '<li class="muted">No assignment</li>'}</ul></div>
      <div class="card"><h3>Quizzes</h3><ul class="list">${r.quizzes.map((q) => `<li><div class="grow title">${esc(q.title)}</div>${q.attempt ? gradeHtml((q.attempt.score / q.attempt.total) * 20) : '<span class="badge">Not taken</span>'}</li>`).join('') || '<li class="muted">No quiz</li>'}</ul>
        <h3 style="margin-top:1.2rem">Lessons</h3><ul class="list">${r.lessons.map((l) => `<li><span>${l.completed ? '✅' : '⬜'}</span><div class="grow">${esc(l.title)}</div></li>`).join('')}</ul></div>
    </div>`;
}

// ---------- Questions ----------
async function viewQuestions(v) {
  const list = await api('/questions');
  const open = list.filter((q) => !q.answer);
  v.innerHTML = `<div class="page-head"><div><h1>Student questions</h1><p>${open.length} waiting for your answer.</p></div></div>
    <div class="tabs"><button class="active" data-f="open">Waiting (${open.length})</button><button data-f="all">All (${list.length})</button></div><div id="qlist"></div>`;
  const draw = (f) => {
    const items = f === 'open' ? open : list;
    v.querySelector('#qlist').innerHTML = items.length ? items.map((q) => `<div class="qa">
      <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap"><div><b>${esc(q.student?.name || 'Student')}</b> <span class="small muted">· ${esc(q.course?.title)} · ${timeAgo(q.createdAt)}</span></div>
      <button class="btn ghost sm" data-del="${q._id}">Delete</button></div>
      <p style="margin:.5rem 0 0">${esc(q.text)}</p>
      ${q.answer ? `<div class="answer"><b>Your answer</b> <span class="small muted">· ${timeAgo(q.answeredAt)}</span><div style="white-space:pre-wrap">${esc(q.answer)}</div></div>`
        : `<form class="ansf" data-id="${q._id}" style="margin-top:.7rem"><textarea name="answer" placeholder="Write your answer…" style="min-height:70px"></textarea><button class="btn sm" style="margin-top:.5rem">Send answer</button></form>`}
    </div>`).join('') : `<div class="card empty"><div class="big">💬</div>${f === 'open' ? 'No question waiting. 🎉' : 'No question yet.'}</div>`;
    v.querySelectorAll('.ansf').forEach((f2) => f2.onsubmit = (e) => { e.preventDefault(); busy(f2.querySelector('button'), async () => {
      if (!f2.answer.value.trim()) throw new Error('Write an answer');
      await api(`/questions/${f2.dataset.id}/answer`, { method: 'PUT', body: { answer: f2.answer.value } }); toast('Answer sent'); refresh(); refreshCounts();
    }); });
    v.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (await confirmBox('Delete this question?')) busy(null, async () => { await api('/questions/' + b.dataset.del, { method: 'DELETE' }); toast('Deleted'); refresh(); refreshCounts(); }); });
  };
  v.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { v.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('active', x === b)); draw(b.dataset.f); });
  draw('open');
}

// ---------- Announcements ----------
function announcementHtml(a, canDelete) {
  return `<div class="qa"><div style="display:flex;justify-content:space-between;gap:1rem"><div><b>📣 ${esc(a.title)}</b>
    <div class="small muted">${a.course?.title ? esc(a.course.title) + ' · ' : ''}${timeAgo(a.createdAt)}</div></div>
    ${canDelete ? `<button class="btn ghost sm" data-delann="${a._id}">Delete</button>` : ''}</div>
    ${a.body ? `<p style="margin:.5rem 0 0;white-space:pre-wrap">${esc(a.body)}</p>` : ''}</div>`;
}
function bindAnnouncementDelete(root) {
  root.querySelectorAll('[data-delann]').forEach((b) => b.onclick = async () => {
    if (await confirmBox('Delete this announcement?')) busy(null, async () => { await api('/announcements/' + b.dataset.delann, { method: 'DELETE' }); toast('Deleted'); refresh(); });
  });
}
function announcementForm(courseId) {
  const { el, close } = modal({
    title: 'New announcement',
    body: `<form id="nf"><div class="field"><label>Title</label><input name="title" placeholder="Contrôle n°2 lundi prochain"></div><div class="field"><label>Message</label><textarea name="body"></textarea></div></form>`,
    foot: `<button class="btn secondary" data-close>Cancel</button><button class="btn" id="nfSave">Publish</button>`,
  });
  el.querySelector('#nfSave').onclick = (e) => busy(e.target, async () => {
    const d = formData(el.querySelector('#nf'));
    if (!d.title.trim()) throw new Error('Write a title');
    await api(`/courses/${courseId}/announcements`, { method: 'POST', body: d });
    close(); toast('Announcement published'); courseTab = 'news'; refresh();
  });
}
async function viewAnnouncements(v) {
  const list = await api('/announcements');
  v.innerHTML = `<div class="page-head"><div><h1>Announcements</h1><p>Messages for all students of a course.</p></div><button class="btn" id="newN">+ New announcement</button></div>
    ${list.length ? list.map((a) => announcementHtml(a, true)).join('') : '<div class="card empty"><div class="big">📣</div>No announcement yet.</div>'}`;
  v.querySelector('#newN').onclick = () => pickCourse((c) => announcementForm(c._id));
  bindAnnouncementDelete(v);
}

// ---------- Profile ----------
async function viewProfile(v) {
  const u = await api('/auth/me');
  v.innerHTML = `<div class="page-head"><h1>My profile</h1></div>
    <div class="card" style="max-width:640px"><form id="pf">
      <div class="field"><label>Full name</label><input name="name" value="${esc(u.name)}"></div>
      <div class="field"><label>Email <span class="badge ok">✓ Confirmed</span></label><input value="${esc(u.email)}" disabled></div>
      <div class="field"><label>Main subject</label><select name="subject">${options(SUBJECTS, u.subject)}</select></div>
      ${placeFieldsHtml()}
      <div class="field"><label>New password <span class="muted">(leave empty to keep)</span></label><input type="password" name="password" autocomplete="new-password"></div>
      <button class="btn">Save profile</button></form></div>`;
  const getPlace = await mountPlaceFields(v, u);
  v.querySelector('#pf').onsubmit = (e) => { e.preventDefault(); busy(e.target.querySelector('button'), async () => {
    const d = { ...formData(e.target), ...getPlace() }; if (!d.password) delete d.password;
    const nu = await api('/auth/me', { method: 'PUT', body: d }); store.setUser(nu); toast('Profile saved');
    document.querySelector('.sidebar .who b').textContent = nu.name;
  }); };
}

if (ME) init();
