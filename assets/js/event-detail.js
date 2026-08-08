import { db } from './firebase-config.js';
import { doc, getDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ensureUser, eventStartDate, formatDate, getUser, toast } from './common.js';

document.getElementById('year').textContent = new Date().getFullYear();
const area = document.getElementById('event-detail');
const id = new URLSearchParams(location.search).get('id');
if (!id) area.innerHTML = '<div class="empty">This event link is incomplete.</div>'; else load();

async function load() {
  try { const snap = await getDoc(doc(db, 'events', id)); if (!snap.exists()) { area.innerHTML = '<div class="empty">This event no longer exists or is not published.</div>'; return; } render(snap.data()); }
  catch (err) { console.error('Event detail query failed:', { code: err.code, message: err.message }); area.innerHTML = '<div class="empty">Could not load this event. Please try again later.</div>'; }
}
function render(event) {
  const image = event.imageUrl ? `style="background-image:url('${safe(event.imageUrl)}')"` : '';
  const start = eventStartDate(event); const left = event.capacity > 0 ? Math.max(0, event.capacity - (event.registrationCount || 0)) : null;
  const deadline = event.registrationDeadline?.toDate ? event.registrationDeadline.toDate() : null;
  area.innerHTML = `<section class="detail-hero"><div class="detail-image" ${image}></div><div class="detail-copy"><p class="eyebrow">EVENT</p><h1>${safe(event.title || 'Untitled event')}</h1><div class="event-meta"><span>◷ ${start ? formatDate(start) : 'Date to be confirmed'}</span>${event.endAt ? `<span>Ends ${formatDate(event.endAt)}</span>` : ''}<span>⌖ ${safe(event.location || 'Location TBC')}</span></div></div></section><section class="detail-body"><article class="description">${safe(event.description || 'More details will be announced soon.')}</article><aside class="registration-panel"><h2>Join this event</h2><p>${left === null ? 'Spaces are unlimited.' : left > 0 ? `${left} of ${event.capacity} spaces remaining.` : 'This event is currently full.'}</p>${deadline && deadline < new Date() ? '<p>Registration has closed.</p>' : `<button class="button" id="register" ${left === 0 ? 'disabled' : ''}>Register now <b>→</b></button>`}</aside></section>`;
  document.getElementById('register')?.addEventListener('click', () => register());
}
async function register() {
  const user = await getUser(); if (!user) { location.href = '/account/?return=' + encodeURIComponent(location.pathname + location.search); return; }
  try {
    await ensureUser(user);
    await runTransaction(db, async tx => {
      const eventRef = doc(db, 'events', id), regRef = doc(db, 'registrations', `${user.uid}_${id}`);
      const [eventSnap, regSnap] = await Promise.all([tx.get(eventRef), tx.get(regRef)]);
      if (regSnap.exists()) throw Error('You are already registered.'); if (!eventSnap.exists()) throw Error('This event is not available.');
      const event = eventSnap.data(); if (event.published !== true) throw Error('This event is not available.');
      if (event.registrationDeadline?.toDate && event.registrationDeadline.toDate() < new Date()) throw Error('Registration has closed.');
      if (event.capacity > 0 && (event.registrationCount || 0) >= event.capacity) throw Error('Sorry, this event is full.');
      tx.set(regRef, { userId: user.uid, eventId: id, eventTitle: event.title || 'Event', eventStartAt: event.startAt || null, createdAt: serverTimestamp() });
      tx.update(eventRef, { registrationCount: (event.registrationCount || 0) + 1, updatedAt: serverTimestamp() });
    });
    toast('You are registered — see you there!'); load();
  } catch (err) { console.error('Registration failed:', { code: err.code, message: err.message }); toast(err.message || 'Registration could not be completed.'); }
}
function safe(value) { return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
