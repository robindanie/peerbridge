import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

// Replace with your Firebase project config before deployment.
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const usersRef = collection(db, 'users');
const sessionsRef = collection(db, 'sessions');
const ratingsRef = collection(db, 'ratings');

export async function registerUser(payload) {
  const created = await addDoc(usersRef, {
    ...payload,
    rating: 5,
    createdAt: serverTimestamp()
  });
  return created.id;
}

function intersects(a = [], b = []) {
  return a.some((item) => b.includes(item));
}

export async function loadTutorsForStudent(student) {
  const snapshots = await getDocs(usersRef);
  return snapshots.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((candidate) => candidate.id !== student.id)
    .filter((candidate) => intersects(candidate.strongSubjects, student.weakSubjects))
    .filter((candidate) => intersects(candidate.availabilityDays, student.availabilityDays))
    .filter((candidate) => intersects(candidate.availabilityTime, student.availabilityTime))
    .filter((candidate) =>
      (candidate.region || '').trim().toLowerCase() === (student.region || '').trim().toLowerCase()
    );
}

export async function loadStudentsForTutor(tutor) {
  const snapshots = await getDocs(usersRef);
  return snapshots.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((candidate) => candidate.id !== tutor.id)
    .filter((candidate) => intersects(tutor.strongSubjects, candidate.weakSubjects))
    .filter((candidate) => intersects(candidate.availabilityDays, tutor.availabilityDays))
    .filter((candidate) => intersects(candidate.availabilityTime, tutor.availabilityTime))
    .filter((candidate) =>
      (candidate.region || '').trim().toLowerCase() === (tutor.region || '').trim().toLowerCase()
    );
}

export async function createSessionRequest(studentID, tutorID, subject, date, time) {
  return addDoc(sessionsRef, {
    studentID,
    tutorID,
    subject,
    date,
    time,
    status: 'Pending',
    createdAt: serverTimestamp()
  });
}

export async function acceptSessionRequest(sessionID) {
  const sessionRef = doc(db, 'sessions', sessionID);
  await updateDoc(sessionRef, { status: 'Accepted' });
}

export async function completeSession(sessionID) {
  const sessionRef = doc(db, 'sessions', sessionID);
  await updateDoc(sessionRef, { status: 'Completed' });
}

export async function submitRating(sessionID, studentRating, tutorRating) {
  await addDoc(ratingsRef, {
    sessionID,
    studentRating,
    tutorRating,
    createdAt: serverTimestamp()
  });
}

export async function getUserByEmail(email) {
  const q = query(usersRef, where('email', '==', email));
  const result = await getDocs(q);
  if (result.empty) return null;
  const first = result.docs[0];
  return { id: first.id, ...first.data() };
}

export async function getSessionsForUser(userId) {
  const byStudent = await getDocs(query(sessionsRef, where('studentID', '==', userId)));
  const byTutor = await getDocs(query(sessionsRef, where('tutorID', '==', userId)));
  const map = new Map();
  [...byStudent.docs, ...byTutor.docs].forEach((docSnap) => {
    map.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
  });
  return [...map.values()];
}

export async function getAllSessions() {
  const snapshots = await getDocs(sessionsRef);
  return snapshots.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}
