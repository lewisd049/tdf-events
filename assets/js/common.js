import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export function formatDate(value, withTime = true) {
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date to be confirmed';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(d);
}

export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 3200);
}

export function eventStartDate(event) {
  const raw = event?.startAt || event?.date;
  if (raw?.toDate) return raw.toDate();
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string') {
    const date = new Date(event?.time ? `${raw}T${event.time}` : raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function eventEndDate(event) {
  const raw = event?.endAt;
  if (raw?.toDate) return raw.toDate();
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string') {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function eventStatus(event, now = new Date()) {
  const start = eventStartDate(event);
  const end = eventEndDate(event);
  if (!start) return 'unknown';
  if (end && now >= end) return 'past';
  if (now >= start && (!end || now < end)) return 'live';
  return 'upcoming';
}

export async function ensureUser(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      role: 'user',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  return (await getDoc(ref)).data();
}

export function getUser() {
  return new Promise(resolve => onAuthStateChanged(auth, resolve));
}
