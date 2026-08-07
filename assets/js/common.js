import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
export function formatDate(value,withTime=true){const d=value?.toDate?value.toDate():new Date(value);return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(d)}
export function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),3200)}
export async function ensureUser(user){const ref=doc(db,'users',user.uid), snap=await getDoc(ref);if(!snap.exists())await setDoc(ref,{displayName:user.displayName||'',email:user.email||'',photoURL:user.photoURL||'',role:'member',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});return (await getDoc(ref)).data()}
export function getUser(){return new Promise(resolve=>onAuthStateChanged(auth,resolve));}
