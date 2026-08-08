import { auth, db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { eventStartDate, eventStatus, formatDate } from './common.js';

document.getElementById('year').textContent = new Date().getFullYear();
const list = document.getElementById('event-list');

const adminPastEventsSection = document.getElementById('admin-past-events-section');

// The Past Events button is only shown to administrators.
if (adminPastEventsSection) {
  onAuthStateChanged(auth, async user => {
    adminPastEventsSection.classList.add('hidden');
    if (!user) return;
    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists() && userSnap.data().role === 'admin') {
        adminPastEventsSection.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Could not check administrator status:', error);
    }
  });
}

try {
  const snap = await getDocs(query(collection(db, 'events'), where('published', '==', true)));
  const now = new Date();
  const events = snap.docs
    .map(x => ({ id: x.id, ...x.data(), _start: eventStartDate(x.data()), _status: eventStatus(x.data(), now) }))
    .filter(e => e._status === 'upcoming' || e._status === 'live')
    .sort((a, b) => a._start - b._start);
  list.innerHTML = events.length ? events.map(e => card(e.id, e)).join('') : '<div class="empty">No upcoming events just yet. Check back soon.</div>';
} catch (e) {
  console.error('Public events query failed:', { code: e.code, message: e.message });
  const message = e.code === 'permission-denied' ? 'Events are temporarily unavailable. Please try again later.' : e.code === 'unavailable' ? 'We could not reach the events service. Please check your connection and try again.' : 'Events could not be loaded. Please try again later.';
  list.innerHTML = `<div class="empty">${message}</div>`;
}

function card(id, e) {
  const image = e.imageUrl ? `style="background-image:url('${safe(e.imageUrl)}')"` : '';
  const cap = e.capacity > 0 ? `${Math.max(0, e.capacity - (e.registrationCount || 0))} spaces left` : 'Unlimited spaces';
  const live = e._status === 'live' ? '<span class="live-badge">LIVE</span>' : '';
  return `<a class="event-card" href="/event/?id=${encodeURIComponent(id)}"><div class="event-image" ${image}><span>EVENT</span>${live}</div><div class="event-card-content"><h2>${safe(e.title || 'Untitled event')}</h2><div class="event-meta"><span>◷ ${formatDate(e._start)}</span><span>⌖ ${safe(e.location || 'Location TBC')}</span><span>${cap}</span></div>${live ? '<span class="live-button">LIVE <b>→</b></span>' : ''}</div></a>`;
}
function safe(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
