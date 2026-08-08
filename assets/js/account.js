import { auth, db } from './firebase-config.js';
import { GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ensureUser, eventStartDate, eventEndDate, eventStatus, formatDate, toast } from './common.js';

document.getElementById('year').textContent = new Date().getFullYear();
const area = document.getElementById('auth-area');
onAuthStateChanged(auth, async user => { if (user) { const profile = await ensureUser(user); showAccount(user, profile); } else showAuth(); });

function showAuth() {
  area.innerHTML = `<section class="auth-card"><p class="eyebrow">YOUR TDF EVENTS ACCOUNT</p><h1>Let's get you<br><em>in the room.</em></h1><div class="auth-tabs"><button class="active" data-mode="signin">Sign in</button><button data-mode="signup">Create account</button></div><form id="auth-form"><label id="name-wrap" class="hidden">Name<input name="name" autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" required minlength="6" autocomplete="current-password"></label><p class="error" id="auth-error"></p><button class="button" id="submit">Sign in <b>→</b></button><button class="small-button" type="button" id="google">Continue with Google</button></form></section>`;
  let mode = 'signin';
  area.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; area.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('active', x === b)); document.getElementById('name-wrap').classList.toggle('hidden', mode === 'signin'); document.getElementById('submit').innerHTML = (mode === 'signin' ? 'Sign in' : 'Create account') + ' <b>→</b>'; });
  document.getElementById('auth-form').onsubmit = async ev => { ev.preventDefault(); const f = new FormData(ev.target), error = document.getElementById('auth-error'); try { if (mode === 'signup') { const c = await createUserWithEmailAndPassword(auth, f.get('email'), f.get('password')); await updateProfile(c.user, { displayName: f.get('name') }); await ensureUser(c.user); } else await signInWithEmailAndPassword(auth, f.get('email'), f.get('password')); const next = new URLSearchParams(location.search).get('return'); if (next) location.href = next; } catch (e) { error.textContent = e.message.replace('Firebase: ', ''); } };
  document.getElementById('google').onclick = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { document.getElementById('auth-error').textContent = e.message.replace('Firebase: ', ''); } };
}

async function showAccount(user, profile) {
  const snap = await getDocs(query(collection(db, 'registrations'), where('userId', '==', user.uid)));
  const regs = snap.docs.map(x => ({ id: x.id, ...x.data() }));
  const enriched = await Promise.all(regs.map(async r => { try { const s = await getDoc(doc(db, 'events', r.eventId)); return { ...r, event: s.exists() ? { id: s.id, ...s.data() } : null }; } catch { return { ...r, event: null }; } }));
  const now = new Date();
  const upcoming = enriched.filter(r => r.event && eventStatus(r.event, now) !== 'past').sort((a,b) => (eventStartDate(a.event)?.getTime()||0)-(eventStartDate(b.event)?.getTime()||0));
  const past = enriched.filter(r => r.event && eventStatus(r.event, now) === 'past').sort((a,b) => (eventEndDate(b.event)?.getTime()||eventStartDate(b.event)?.getTime()||0)-(eventEndDate(a.event)?.getTime()||eventStartDate(a.event)?.getTime()||0));
  area.innerHTML = `<section class="profile-card"><div class="profile-head"><div class="profile-ident"><div class="avatar">${(user.displayName || user.email)[0].toUpperCase()}</div><div><p class="eyebrow">MY ACCOUNT</p><h1>${safe(user.displayName || 'Welcome')}</h1><small>${safe(user.email)}</small></div></div><button class="small-button" id="logout">Sign out</button></div><form id="profile-form"><label>Name<input name="name" value="${safe(user.displayName || '')}"></label><button class="small-button" type="submit">Save profile</button></form><h2>Your registrations</h2><div class="registration-list">${upcoming.length ? upcoming.map(r => registrationRow(r, true)).join('') : '<p>You have no upcoming event registrations. <a href="/events/">Explore events.</a></p>'}</div>${profile?.role === 'admin' ? `<div class="account-section-head"><h2>Past Events</h2><a class="small-button" href="/events/past/">Browse all past events →</a></div>` : ''}<div class="registration-list">${past.length ? past.map(r => registrationRow(r, false)).join('') : '<p>You have no past event registrations yet.</p>'}</div></section>`;
  document.getElementById('logout').onclick = () => signOut(auth);
  document.getElementById('profile-form').onsubmit = async e => { e.preventDefault(); const name = new FormData(e.target).get('name'); await updateProfile(user, { displayName: name }); await setDoc(doc(db, 'users', user.uid), { displayName: name, updatedAt: serverTimestamp() }, { merge: true }); toast('Profile saved.'); showAccount(user, { ...profile, displayName: name }); };
  area.querySelectorAll('.cancel').forEach(b => b.onclick = () => cancelRegistration(user, b.dataset.id, b.dataset.event));
}

function registrationRow(r, cancellable) {
  const e = r.event;
  const status = eventStatus(e);
  const statusBadge = status === 'live' ? '<span class="live-badge inline">LIVE</span>' : '';
  const date = eventEndDate(e) || eventStartDate(e);
  return `<div class="registration-row"><div><h3>${safe(e.title || r.eventTitle || 'Event')} ${statusBadge}</h3><p>${date ? formatDate(date) : 'Date to be confirmed'} · ${safe(e.location || 'Location TBC')}</p></div><div class="registration-actions"><a class="small-button" href="/event/?id=${encodeURIComponent(r.eventId)}">View</a>${cancellable ? `<button class="small-button cancel" data-id="${r.id}" data-event="${r.eventId}">Cancel</button>` : ''}</div></div>`;
}

async function cancelRegistration(user, regId, eventId) {
  if (!confirm('Cancel this registration?')) return;
  try {
    await runTransaction(db, async tx => {
      const r = doc(db, 'registrations', regId), e = doc(db, 'events', eventId), [rs, es] = await Promise.all([tx.get(r), tx.get(e)]);
      if (!rs.exists()) throw Error('Registration not found.');
      tx.delete(r);
      if (es.exists()) tx.update(e, { registrationCount: Math.max(0, (es.data().registrationCount || 0) - 1), updatedAt: serverTimestamp() });
    });
    toast('Registration cancelled.'); showAccount(user, await ensureUser(user));
  } catch (e) { toast(e.message); }
}
function safe(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
