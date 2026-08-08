import {
  auth,
  db
} from './firebase-config.js';

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  runTransaction,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  ensureUser,
  formatDate,
  toast
} from './common.js';


document.getElementById('year').textContent =
  new Date().getFullYear();

const area =
  document.getElementById('auth-area');

const adminPastEventsLink =
  document.getElementById('admin-past-events-link');


/*
 * Authentication state.
 */
onAuthStateChanged(
  auth,
  async (user) => {

    if (user) {

      const profile =
        await ensureUser(user);

      updateAdminPastEventsButton(
        profile
      );

      showAccount(
        user,
        profile
      );

    } else {

      hideAdminPastEventsButton();

      showAuth();

    }

  }
);


/*
 * Show the Past Events navigation link
 * only when the user's Firestore role
 * is admin.
 */
function updateAdminPastEventsButton(profile) {

  if (!adminPastEventsLink) {
    return;
  }

  adminPastEventsLink.classList.add(
    'hidden'
  );

  if (
    profile &&
    profile.role === 'admin'
  ) {
    adminPastEventsLink.classList.remove(
      'hidden'
    );
  }
}


/*
 * Hide the admin Past Events button.
 */
function hideAdminPastEventsButton() {

  if (!adminPastEventsLink) {
    return;
  }

  adminPastEventsLink.classList.add(
    'hidden'
  );
}


/*
 * Login / signup interface.
 */
function showAuth() {

  area.innerHTML = `
    <section class="auth-card">

      <p class="eyebrow">
        YOUR TDF EVENTS ACCOUNT
      </p>

      <h1>
        Let's get you<br>
        <em>in the room.</em>
      </h1>

      <div class="auth-tabs">

        <button
          class="active"
          data-mode="signin"
        >
          Sign in
        </button>

        <button
          data-mode="signup"
        >
          Create account
        </button>

      </div>


      <form id="auth-form">

        <label
          id="name-wrap"
          class="hidden"
        >
          Name

          <input
            name="name"
            autocomplete="name"
          >
        </label>


        <label>
          Email

          <input
            name="email"
            type="email"
            required
            autocomplete="email"
          >
        </label>


        <label>
          Password

          <input
            name="password"
            type="password"
            required
            minlength="6"
            autocomplete="current-password"
          >
        </label>


        <p
          class="error"
          id="auth-error"
        ></p>


        <button
          class="button"
          id="submit"
        >
          Sign in <b>→</b>
        </button>


        <button
          class="small-button"
          type="button"
          id="google"
        >
          Continue with Google
        </button>

      </form>

    </section>
  `;


  let mode = 'signin';


  area
    .querySelectorAll('[data-mode]')
    .forEach(
      (b) => {

        b.onclick = () => {

          mode = b.dataset.mode;

          area
            .querySelectorAll('[data-mode]')
            .forEach(
              (x) =>
                x.classList.toggle(
                  'active',
                  x === b
                )
            );


          document
            .getElementById('name-wrap')
            .classList.toggle(
              'hidden',
              mode === 'signin'
            );


          document
            .getElementById('submit')
            .innerHTML =
              (
                mode === 'signin'
                  ? 'Sign in'
                  : 'Create account'
              ) +
              ' <b>→</b>';

        };

      }
    );


  document
    .getElementById('auth-form')
    .onsubmit =
      async (ev) => {

        ev.preventDefault();

        const f =
          new FormData(ev.target);

        const error =
          document.getElementById(
            'auth-error'
          );


        try {

          if (mode === 'signup') {

            const c =
              await createUserWithEmailAndPassword(
                auth,
                f.get('email'),
                f.get('password')
              );


            await updateProfile(
              c.user,
              {
                displayName:
                  f.get('name')
              }
            );


            await ensureUser(
              c.user
            );

          } else {

            await signInWithEmailAndPassword(
              auth,
              f.get('email'),
              f.get('password')
            );

          }


          const next =
            new URLSearchParams(
              location.search
            ).get('return');


          if (next) {
            location.href = next;
          }


        } catch (e) {

          error.textContent =
            e.message.replace(
              'Firebase: ',
              ''
            );

        }

      };


  document
    .getElementById('google')
    .onclick =
      async () => {

        try {

          await signInWithPopup(
            auth,
            new GoogleAuthProvider()
          );

        } catch (e) {

          document.getElementById(
            'auth-error'
          ).textContent =
            e.message.replace(
              'Firebase: ',
              ''
            );

        }

      };

}


/*
 * Account page.
 */
async function showAccount(
  user,
  profile
) {

  const q =
    query(
      collection(
        db,
        'registrations'
      ),
      where(
        'userId',
        '==',
        user.uid
      )
    );


  const snap =
    await getDocs(q);


  const regs =
    snap.docs
      .map(
        (x) => ({
          id: x.id,
          ...x.data()
        })
      )
      .sort(
        (a, b) =>
          (a.eventStartAt?.seconds || 0) -
          (b.eventStartAt?.seconds || 0)
      );


  area.innerHTML = `
    <section class="profile-card">

      <div class="profile-head">

        <div class="profile-ident">

          <div class="avatar">
            ${(user.displayName || user.email)[0].toUpperCase()}
          </div>

          <div>

            <p class="eyebrow">
              MY ACCOUNT
            </p>

            <h1>
              ${safe(
                user.displayName ||
                'Welcome'
              )}
            </h1>

            <small>
              ${safe(user.email)}
            </small>

          </div>

        </div>


        <button
          class="small-button"
          id="logout"
        >
          Sign out
        </button>

      </div>


      <form id="profile-form">

        <label>
          Name

          <input
            name="name"
            value="${safe(
              user.displayName || ''
            )}"
          >
        </label>

        <button
          class="small-button"
          type="submit"
        >
          Save profile
        </button>

      </form>


      <h2>
        Your registrations
      </h2>


      <div class="registration-list">

        ${
          regs.length
            ? regs
                .map(
                  (r) => `
                    <div class="registration-row">

                      <div>

                        <h3>
                          ${safe(
                            r.eventTitle
                          )}
                        </h3>

                        <p>
                          ${
                            r.eventStartAt
                              ? formatDate(
                                  r.eventStartAt
                                )
                              : 'Date to be confirmed'
                          }
                        </p>

                      </div>


                      <button
                        class="small-button cancel"
                        data-id="${r.id}"
                        data-event="${r.eventId}"
                      >
                        Cancel
                      </button>

                    </div>
                  `
                )
                .join('')
            : `
              <p>
                You have no event registrations yet.
                <a href="/events/">
                  Explore events.
                </a>
              </p>
            `
        }

      </div>

    </section>
  `;


  document.getElementById(
    'logout'
  ).onclick =
    () => signOut(auth);


  document.getElementById(
    'profile-form'
  ).onsubmit =
    async (e) => {

      e.preventDefault();

      const name =
        new FormData(
          e.target
        ).get('name');


      await updateProfile(
        user,
        {
          displayName: name
        }
      );


      await setDoc(
        doc(
          db,
          'users',
          user.uid
        ),
        {
          displayName: name,
          updatedAt: serverTimestamp()
        },
        {
          merge: true
        }
      );


      toast(
        'Profile saved.'
      );


      showAccount(
        user,
        {
          ...profile,
          displayName: name
        }
      );

    };


  area
    .querySelectorAll('.cancel')
    .forEach(
      (b) =>
        b.onclick =
          () =>
            cancelRegistration(
              user,
              b.dataset.id,
              b.dataset.event
            )
    );

}


/*
 * Cancel registration.
 */
async function cancelRegistration(
  user,
  regId,
  eventId
) {

  if (
    !confirm(
      'Cancel this registration?'
    )
  ) {
    return;
  }


  try {

    await runTransaction(
      db,
      async (tx) => {

        const r =
          doc(
            db,
            'registrations',
            regId
          );

        const e =
          doc(
            db,
            'events',
            eventId
          );


        const [
          rs,
          es
        ] =
          await Promise.all([
            tx.get(r),
            tx.get(e)
          ]);


        if (!rs.exists()) {
          throw Error(
            'Registration not found.'
          );
        }


        tx.delete(r);


        if (es.exists()) {

          tx.update(
            e,
            {
              registrationCount:
                Math.max(
                  0,
                  (es.data().registrationCount || 0) - 1
                ),

              updatedAt:
                serverTimestamp()
            }
          );

        }

      }
    );


    toast(
      'Registration cancelled.'
    );


    showAccount(
      user,
      await ensureUser(user)
    );


  } catch (e) {

    toast(
      e.message
    );

  }

}


/*
 * Escape HTML.
 */
function safe(v) {

  return String(v || '')
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /</g,
      '&lt;'
    );

}
