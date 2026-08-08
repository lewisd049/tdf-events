import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { eventEndDate, eventStartDate, eventStatus, formatDate } from './common.js';

document.getElementById('year').textContent = new Date().getFullYear();
const list = document.getElementById('past-event-list');
try {
  const snap = await getDocs(query(collection(db, 'events'), where('published', '==', true)));
  const now = new Date();
  const events = snap.docs.map(d => ({ id: d.id, ...d.data(), _start: eventStartDate(d.data()), _end: eventEndDate(d.data()), _status: eventStatus(d.data(), now) }))
    .filter(e => e._status === 'past')
    .sort((a, b) => (b._end || b._start || 0) - (a._end || a._start || 0));
  list.innerHTML = events.length ? events.map(card).join('') : '<div class="empty">There are no past events yet.</div>';
} catch (e) {
  console.error('Past events query failed:', { code: e.code, message: e.message });
  list.innerHTML = '<div class="empty">Past events could not be loaded. Please try again later.</div>';
}
function card(e) {
  const image = e.imageUrl ? `style="background-image:url('${safe(e.imageUrl)}')"` : '';
  const when = e._end || e._start;
  return `<article class="event-card past-card"><div class="event-image" ${image}><span>PAST EVENT</span></div><div class="event-card-content"><h2>${safe(e.title || 'Untitled event')}</h2><div class="event-meta"><span>◷ ${formatDate(when)}</span><span>⌖ ${safe(e.location || 'Location TBC')}</span></div><a class="small-button view-button" href="/event/?id=${encodeURIComponent(e.id)}">View event →</a></div></article>`;
}
function safe(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
