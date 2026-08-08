import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, Timestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ensureUser, eventEndDate, eventStartDate, eventStatus, formatDate, toast } from './common.js';

document.getElementById('year').textContent = new Date().getFullYear();
const area = document.getElementById('admin-area');
onAuthStateChanged(auth, async user => {
  if (!user) { area.innerHTML = '<div class="empty">Please <a href="/account/?return=/admin/">sign in</a> with an administrator account.</div>'; return; }
  const profile = await ensureUser(user);
  if (profile.role !== 'admin') { area.innerHTML = '<div class="empty">This account is not an administrator. If you believe you have access please contact support at support@tdf1.uk.</div>'; return; }
  render();
});

async function render() {
  area.innerHTML = `<div class="admin-head"><div><p class="eyebrow">EVENT MANAGEMENT</p><h1>Make plans<br><em>happen.</em></h1></div><button class="button" id="new-event">New event <b>+</b></button></div><div class="admin-layout"><section class="admin-form hidden" id="form-card"></section><section class="admin-events"><h2>All events</h2><div id="events-admin" class="loading">Loading events…</div></section></div>`;
  document.getElementById('new-event').onclick = () => showForm();
  await loadEvents();
}

async function loadEvents() {
  const target = document.getElementById('events-admin');
  try {
    const snap = await getDocs(query(collection(db, 'events')));
    const events = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (eventStartDate(b)?.getTime()||0)-(eventStartDate(a)?.getTime()||0));
    target.className = '';
    target.innerHTML = events.length ? events.map(eventRow).join('') : '<p>No events yet. Create your first one.</p>';
    target.querySelectorAll('.edit').forEach(b => b.onclick = async () => { const s = await getDoc(doc(db, 'events', b.dataset.id)); showForm(b.dataset.id, s.data()); });
    target.querySelectorAll('.remove').forEach(b => b.onclick = () => removeEvent(b.dataset.id));
    target.querySelectorAll('.attendees-button').forEach(b => b.onclick = () => attendees(b.dataset.id));
    target.querySelectorAll('.add-attendee-button').forEach(b => b.onclick = () => showManualAdd(b.dataset.id));
  } catch (e) { console.error('Admin events query failed:', { code: e.code, message: e.message }); target.innerHTML = '<p>Could not load events. Check your administrator role and Firestore Rules.</p>'; }
}

function eventRow(e) {
  const status = eventStatus(e);
  const statusText = status === 'live' ? '<span class="live-badge inline">LIVE</span>' : status === 'past' ? '<span class="past-badge">PAST</span>' : e.published === true ? 'Published' : 'Draft';
  return `<article class="admin-event"><h3>${safe(e.title || 'Untitled event')} ${statusText}</h3><p>${eventStartDate(e) ? formatDate(eventStartDate(e)) : 'Date missing'}${eventEndDate(e) ? ` – ${formatDate(eventEndDate(e))}` : ''} · ${safe(e.location || 'Location TBC')} · ${e.registrationCount || 0}${e.capacity > 0 ? '/' + e.capacity : ''} registered · ${e.published === true ? 'Published' : 'Draft'}</p><div class="admin-actions"><button class="small-button edit" data-id="${e.id}">Edit</button><button class="small-button attendees-button" data-id="${e.id}">Attendees</button><button class="small-button add-attendee-button" data-id="${e.id}">Add attendee</button><button class="small-button remove" data-id="${e.id}">Delete</button></div><div class="attendees hidden" id="attendees-${e.id}"></div><div class="manual-add hidden" id="manual-${e.id}"></div></article>`;
}

function showForm(id = '', e = {}) {
  const f = document.getElementById('form-card'); f.classList.remove('hidden');
  f.innerHTML = `<h2>${id ? 'Edit event' : 'New event'}</h2><form id="event-form"><label>Event title<input name="title" required value="${safe(e.title || '')}"></label><label>Description<textarea name="description" required>${safe(e.description || '')}</textarea></label><label>Image URL (optional)<input name="imageUrl" type="url" value="${safe(e.imageUrl || '')}"></label><div class="form-row"><label>Start date and time<input name="startAt" type="datetime-local" required value="${inputDate(e.startAt || e.date)}"></label><label>End date and time<input name="endAt" type="datetime-local" required value="${inputDate(e.endAt)}"></label></div><div class="form-row"><label>Location<input name="location" required value="${safe(e.location || '')}"></label><label>Capacity (0 = unlimited)<input name="capacity" type="number" min="0" required value="${e.capacity ?? 0}"></label></div><label>Registration deadline<input name="registrationDeadline" type="datetime-local" value="${inputDate(e.registrationDeadline)}"></label><label class="publish-toggle"><input name="published" type="checkbox" ${e.published === true ? 'checked' : ''}><span>Published</span><small>Published events are visible on the public events page.</small></label><div class="admin-actions"><button class="button">${id ? 'Save changes' : 'Create event'} <b>→</b></button><button class="small-button" type="button" id="close-form">Cancel</button></div></form>`;
  document.getElementById('close-form').onclick = () => f.classList.add('hidden');
  document.getElementById('event-form').onsubmit = async ev => {
    ev.preventDefault(); const x = new FormData(ev.target);
    const start = new Date(x.get('startAt')), endValue = x.get('endAt');
    if (endValue && new Date(endValue) <= start) { toast('The end time must be after the start time.'); return; }
    const data = { title:x.get('title'), description:x.get('description'), imageUrl:x.get('imageUrl'), location:x.get('location'), capacity:Number(x.get('capacity')), published:x.get('published') === 'on', startAt:Timestamp.fromDate(start), endAt:endValue?Timestamp.fromDate(new Date(endValue)):null, registrationDeadline:x.get('registrationDeadline')?Timestamp.fromDate(new Date(x.get('registrationDeadline'))):null, updatedAt:serverTimestamp() };
    try { if (id) await updateDoc(doc(db,'events',id),data); else await addDoc(collection(db,'events'),{...data,registrationCount:0,createdAt:serverTimestamp()}); toast(id?'Event updated.':'Event created.'); f.classList.add('hidden'); loadEvents(); } catch(err) { console.error('Saving event failed:',{code:err.code,message:err.message}); toast(err.message||'Could not save event.'); }
  };
}

async function attendees(id) {
  const box=document.getElementById('attendees-'+id); box.classList.toggle('hidden'); if(box.dataset.loaded||box.classList.contains('hidden'))return;
  box.innerHTML='Loading attendees…';
  try { const snap=await getDocs(query(collection(db,'registrations'))); const regs=snap.docs.map(x=>({id:x.id,...x.data()})).filter(r=>r.eventId===id); const people=await Promise.all(regs.map(async r=>{const p=await getDoc(doc(db,'users',r.userId));return p.exists()?p.data():{email:r.userId};})); box.dataset.loaded='yes'; box.innerHTML=regs.length?`<strong>${regs.length} attendee${regs.length===1?'':'s'}</strong><ul>${people.map(p=>`<li>${safe(p.displayName||'Unnamed attendee')} — ${safe(p.email||'')}</li>`).join('')}</ul>`:'No registrations yet.'; } catch(e){console.error('Attendee query failed:',e);box.innerHTML='Could not load attendees.';}
}

async function showManualAdd(eventId) {
  const box=document.getElementById('manual-'+eventId); box.classList.toggle('hidden'); if(box.classList.contains('hidden'))return;
  box.innerHTML='Loading users…';
  try {
    const [usersSnap, eventSnap] = await Promise.all([getDocs(collection(db,'users')), getDoc(doc(db,'events',eventId))]);
    if(!eventSnap.exists()){box.innerHTML='Event not found.';return;}
    const event=eventSnap.data(), regs=await getDocs(query(collection(db,'registrations'))), registered=new Set(regs.docs.filter(r=>r.data().eventId===eventId).map(r=>r.data().userId));
    const users=usersSnap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>!registered.has(u.id)).sort((a,b)=>(a.displayName||a.email||'').localeCompare(b.displayName||b.email||''));
    const status=eventStatus(event), late=(event.registrationDeadline?.toDate&&event.registrationDeadline.toDate()<new Date())||status==='live';
    box.innerHTML=`<div class="manual-add-head"><strong>Manually add an attendee</strong><small>${late?'Admin override: deadline/event status does not block this registration.':'Admin registration.'}</small></div>${users.length?`<label>User<select id="user-select-${eventId}"><option value="">Choose a user…</option>${users.map(u=>`<option value="${u.id}">${safe(u.displayName||'Unnamed')} — ${safe(u.email||'')}</option>`).join('')}</select></label><button class="small-button" id="confirm-add-${eventId}">Add attendee</button>`:'<p>All existing users are already registered for this event.</p>'}`;
    document.getElementById('confirm-add-'+eventId)?.addEventListener('click',()=>manualRegister(eventId));
  } catch(e){console.error('Manual attendee form failed:',e);box.innerHTML='Could not load users.';}
}

async function manualRegister(eventId) {
  const select=document.getElementById('user-select-'+eventId), userId=select?.value; if(!userId){toast('Choose a user first.');return;}
  try {
    await runTransaction(db, async tx => {
      const eventRef=doc(db,'events',eventId), regRef=doc(db,'registrations',`${userId}_${eventId}`), [es,rs]=await Promise.all([tx.get(eventRef),tx.get(regRef)]);
      if(!es.exists()) throw Error('Event not found.'); if(rs.exists()) throw Error('That user is already registered.');
      const e=es.data(); if(e.capacity>0 && (e.registrationCount||0)>=e.capacity) throw Error('This event is full.');
      tx.set(regRef,{userId,eventId,eventTitle:e.title||'Event',eventStartAt:e.startAt||null,createdAt:serverTimestamp(),addedByAdmin:auth.currentUser.uid,adminOverride:true});
      tx.update(eventRef,{registrationCount:(e.registrationCount||0)+1,updatedAt:serverTimestamp()});
    });
    toast('Attendee added.'); loadEvents();
  } catch(e){console.error('Manual registration failed:',{code:e.code,message:e.message});toast(e.message||'Could not add attendee.');}
}

async function removeEvent(id){if(!confirm('Delete this event? Existing registration records will remain, but the event will not be shown.'))return;try{await deleteDoc(doc(db,'events',id));toast('Event deleted.');loadEvents();}catch(e){toast(e.message);}}
function inputDate(value){if(!value)return '';const d=value.toDate?value.toDate():new Date(value);if(Number.isNaN(d.getTime()))return '';const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
function safe(value){return String(value??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
