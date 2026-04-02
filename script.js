import {
  registerUser,
  loadTutorsForStudent,
  loadStudentsForTutor,
  createSessionRequest,
  acceptSessionRequest,
  completeSession,
  submitRating,
  getUserByEmail,
  getSessionsForUser,
  getAllSessions
} from './firebase.js';

const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'OOPS with C++',
  'Java',
  'Python',
  'Data Structures',
  'Database Systems'
];

const page = document.body.dataset.page;

function getSelectedOptions(select) {
  return [...select.selectedOptions].map((opt) => opt.value);
}

function setActiveNav() {
  document.querySelectorAll('nav a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href && location.pathname.endsWith(href)) a.classList.add('active');
  });
}

function logout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    localStorage.removeItem('peerbridgeCurrentEmail');
  });
}

async function getCurrentUser() {
  const email = localStorage.getItem('peerbridgeCurrentEmail');
  if (!email) return null;
  return getUserByEmail(email);
}

function personCard(person, actions = '') {
  return `
    <article class="person-card">
      <h3>${person.name}</h3>
      <p class="meta"><strong>Strong subjects:</strong> ${(person.strongSubjects || []).join(', ') || '-'}</p>
      <p class="meta"><strong>Weak subjects:</strong> ${(person.weakSubjects || []).join(', ') || '-'}</p>
      <p class="meta"><strong>Rating:</strong> ${person.rating ?? 'N/A'}</p>
      <p class="meta"><strong>Region:</strong> ${person.region || '-'}</p>
      <p class="meta"><strong>Availability:</strong> ${(person.availabilityDays || []).join(', ')} | ${(person.availabilityTime || []).join(', ')}</p>
      <div class="action-row">${actions}</div>
    </article>
  `;
}

function sessionCard(session, actions = '') {
  const statusClass = session.status.toLowerCase();
  return `
    <article class="session-card">
      <h3>${session.subject}</h3>
      <p class="meta"><strong>Date:</strong> ${session.date || 'TBD'}</p>
      <p class="meta"><strong>Time:</strong> ${session.time || 'TBD'}</p>
      <p class="meta"><strong>Student ID:</strong> ${session.studentID}</p>
      <p class="meta"><strong>Tutor ID:</strong> ${session.tutorID}</p>
      <span class="status ${statusClass}">${session.status}</span>
      <div class="action-row">${actions}</div>
    </article>
  `;
}

function requireUserOrPrompt(user) {
  if (user) return true;
  alert('Please register first.');
  location.href = 'register.html';
  return false;
}

async function initRegisterPage() {
  const form = document.getElementById('registrationForm');
  if (!form) return;

  ['strongSubjects', 'weakSubjects'].forEach((fieldName) => {
    const select = form.elements[fieldName];
    SUBJECTS.forEach((subject) => {
      const option = document.createElement('option');
      option.value = subject;
      option.textContent = subject;
      select.appendChild(option);
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);

    const payload = {
      name: data.get('name').trim(),
      dob: data.get('dob'),
      gender: data.get('gender'),
      email: data.get('email').trim(),
      phone: data.get('phone').trim(),
      address: {
        doorNumber: data.get('doorNumber').trim(),
        street: data.get('street').trim(),
        city: data.get('city').trim(),
        state: data.get('state').trim(),
        postalCode: data.get('postalCode').trim()
      },
      strongSubjects: getSelectedOptions(form.elements.strongSubjects),
      weakSubjects: getSelectedOptions(form.elements.weakSubjects),
      availabilityDays: getSelectedOptions(form.elements.availabilityDays),
      availabilityTime: getSelectedOptions(form.elements.availabilityTime),
      region: data.get('region').trim(),
      bio: data.get('bio').trim()
    };

    await registerUser(payload);
    localStorage.setItem('peerbridgeCurrentEmail', payload.email);

    const msg = document.getElementById('registerMessage');
    msg.textContent = 'Account created successfully.';
    setTimeout(() => {
      location.href = 'index.html';
    }, 1200);
  });
}

async function initStudentPage() {
  const user = await getCurrentUser();
  if (!requireUserOrPrompt(user)) return;

  const tutors = await loadTutorsForStudent(user);
  const tutorsList = document.getElementById('tutorsList');
  tutorsList.innerHTML = tutors.length
    ? tutors
        .map(
          (tutor) =>
            personCard(
              tutor,
              `<button class="btn secondary view-profile" data-id="${tutor.id}">View Profile</button>
              <button class="btn request-session" data-id="${tutor.id}">Request Session</button>`
            )
        )
        .join('')
    : '<p>No matching tutors found right now.</p>';

  tutorsList.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const tutorID = target.dataset.id;
    if (target.classList.contains('view-profile')) {
      localStorage.setItem('peerbridgeViewProfile', tutorID);
      location.href = 'profile.html';
      return;
    }

    if (target.classList.contains('request-session')) {
      const subject = prompt(`Enter subject to request (e.g. ${user.weakSubjects[0] || 'Mathematics'}):`);
      if (!subject) return;
      const date = prompt('Enter session date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
      if (!date) return;
      const time = prompt('Enter session time (e.g. 16:00):', '16:00');
      if (!time) return;

      await createSessionRequest(user.id, tutorID, subject, date, time);
      alert('Session request sent.');
      location.reload();
    }
  });

  const sessions = await getSessionsForUser(user.id);
  document.getElementById('studentPendingSessions').innerHTML = sessions
    .filter((s) => s.status !== 'Completed')
    .map((s) => sessionCard(s, s.status === 'Accepted' ? `<button class="btn complete-btn" data-id="${s.id}">Mark Completed</button>` : ''))
    .join('') || '<p>No active sessions.</p>';

  document.getElementById('studentCompletedSessions').innerHTML = sessions
    .filter((s) => s.status === 'Completed')
    .map((s) => sessionCard(s, `<button class="btn rate-btn" data-id="${s.id}">Rate Tutor</button>`))
    .join('') || '<p>No completed sessions yet.</p>';

  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    if (target.classList.contains('complete-btn')) {
      await completeSession(target.dataset.id);
      location.reload();
    }

    if (target.classList.contains('rate-btn')) {
      const tutorRating = Number(prompt('Rate tutor (1-5):', '5'));
      if (!tutorRating || tutorRating < 1 || tutorRating > 5) return;
      await submitRating(target.dataset.id, null, tutorRating);
      alert('Rating submitted.');
    }
  });
}

async function initTutorPage() {
  const user = await getCurrentUser();
  if (!requireUserOrPrompt(user)) return;

  const students = await loadStudentsForTutor(user);
  const requestsEl = document.getElementById('studentRequests');

  requestsEl.innerHTML = students.length
    ? students
        .map(
          (student) =>
            personCard(
              student,
              `<button class="btn secondary view-profile" data-id="${student.id}">View Profile</button>
              <button class="btn accept-request" data-id="${student.id}">Accept Request</button>`
            )
        )
        .join('')
    : '<p>No matching students found right now.</p>';

  const sessions = await getSessionsForUser(user.id);
  document.getElementById('teachingSessions').innerHTML = sessions
    .filter((s) => s.status === 'Pending' || s.status === 'Accepted')
    .map((s) => sessionCard(s, s.status === 'Pending' ? `<button class="btn accept-session" data-id="${s.id}">Accept Request</button>` : ''))
    .join('') || '<p>No teaching sessions.</p>';

  document.getElementById('tutorCompletedSessions').innerHTML = sessions
    .filter((s) => s.status === 'Completed')
    .map((s) => sessionCard(s, `<button class="btn rate-student" data-id="${s.id}">Rate Student</button>`))
    .join('') || '<p>No completed sessions yet.</p>';

  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    if (target.classList.contains('view-profile')) {
      localStorage.setItem('peerbridgeViewProfile', target.dataset.id);
      location.href = 'profile.html';
    }

    if (target.classList.contains('accept-session')) {
      await acceptSessionRequest(target.dataset.id);
      location.reload();
    }

    if (target.classList.contains('rate-student')) {
      const studentRating = Number(prompt('Rate student (1-5):', '5'));
      if (!studentRating || studentRating < 1 || studentRating > 5) return;
      await submitRating(target.dataset.id, studentRating, null);
      alert('Rating submitted.');
    }
  });
}

async function initProfilePage() {
  const current = await getCurrentUser();
  if (!requireUserOrPrompt(current)) return;

  const viewId = localStorage.getItem('peerbridgeViewProfile');
  localStorage.removeItem('peerbridgeViewProfile');

  let userToShow = current;
  if (viewId && viewId !== current.id) {
    const results = await loadTutorsForStudent(current);
    const inTutors = results.find((item) => item.id === viewId);
    const inStudents = (await loadStudentsForTutor(current)).find((item) => item.id === viewId);
    userToShow = inTutors || inStudents || current;
  }

  document.getElementById('profileContent').innerHTML = `
    <div class="person-card">
      <h3>${userToShow.name}</h3>
      <p class="meta"><strong>Email:</strong> ${userToShow.email}</p>
      <p class="meta"><strong>Phone:</strong> ${userToShow.phone}</p>
      <p class="meta"><strong>Region:</strong> ${userToShow.region}</p>
      <p class="meta"><strong>Address:</strong> ${userToShow.address?.doorNumber || ''}, ${userToShow.address?.street || ''}, ${userToShow.address?.city || ''}, ${userToShow.address?.state || ''} - ${userToShow.address?.postalCode || ''}</p>
      <p class="meta"><strong>Strong Subjects:</strong> ${(userToShow.strongSubjects || []).join(', ') || '-'}</p>
      <p class="meta"><strong>Weak Subjects:</strong> ${(userToShow.weakSubjects || []).join(', ') || '-'}</p>
      <p class="meta"><strong>Availability:</strong> ${(userToShow.availabilityDays || []).join(', ')} | ${(userToShow.availabilityTime || []).join(', ')}</p>
      <p class="meta"><strong>Bio:</strong> ${userToShow.bio || 'No bio added.'}</p>
      <p class="meta"><strong>Rating:</strong> ${userToShow.rating ?? 'N/A'}</p>
    </div>
  `;
}

async function initSessionsPage() {
  const user = await getCurrentUser();
  if (!requireUserOrPrompt(user)) return;

  const sessions = await getAllSessions();
  document.getElementById('allSessions').innerHTML = sessions.length
    ? sessions.map((s) => sessionCard(s)).join('')
    : '<p>No sessions created yet.</p>';
}

setActiveNav();
logout();

if (page === 'register') initRegisterPage();
if (page === 'student') initStudentPage();
if (page === 'tutor') initTutorPage();
if (page === 'profile') initProfilePage();
if (page === 'sessions') initSessionsPage();
