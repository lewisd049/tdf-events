import { db } from './firebase-config.js';

import {
  collection,
  getDocs,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  eventStartDate,
  formatDate
} from './common.js';


document.getElementById('year').textContent =
  new Date().getFullYear();


const list =
  document.getElementById(
    'past-event-list'
  );


try {

  const snap =
    await getDocs(
      query(
        collection(
          db,
          'events'
        ),
        where(
          'published',
          '==',
          true
        )
      )
    );


  const now =
    new Date();


  const events =
    snap.docs
      .map(
        (x) => ({
          id: x.id,
          ...x.data(),
          _start:
            eventStartDate(
              x.data()
            ),
          _end:
            eventEndDate(
              x.data()
            )
        })
      )
      .filter(
        (e) =>
          e._end &&
          e._end < now
      )
      .sort(
        (a, b) =>
          b._end - a._end
      );


  list.innerHTML =
    events.length
      ? events
          .map(
            (e) =>
              card(
                e.id,
                e
              )
          )
          .join('')
      : `
        <div class="empty">
          There are no past events yet.
        </div>
      `;


} catch (e) {

  console.error(
    'Past events query failed:',
    e
  );


  list.innerHTML = `
    <div class="empty">
      Past events could not be loaded.
      Please try again later.
    </div>
  `;

}


/*
 * Get an event's end time.
 *
 * Supports:
 *   endAt
 *   endDate + endTime
 *   date + endTime
 *   date
 */
function eventEndDate(event) {

  const raw =
    event?.endAt;


  if (
    raw?.toDate
  ) {
    return raw.toDate();
  }


  if (
    raw instanceof Date
  ) {
    return raw;
  }


  if (
    typeof raw === 'string'
  ) {

    const date =
      new Date(raw);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;

  }


  const endDate =
    event?.endDate ||
    event?.date;


  const endTime =
    event?.endTime ||
    event?.time;


  if (
    endDate
  ) {

    const date =
      new Date(
        endTime
          ? `${endDate}T${endTime}`
          : endDate
      );


    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;

  }


  return null;
}


/*
 * Past event card.
 */
function card(
  id,
  event
) {

  const image =
    event.imageUrl
      ? `style="background-image:url('${safe(
          event.imageUrl
        )}')"`
      : '';


  return `
    <a
      class="event-card"
      href="/event/?id=${encodeURIComponent(id)}"
    >

      <div
        class="event-image"
        ${image}
      >
        <span>PAST EVENT</span>
      </div>


      <div class="event-card-content">

        <h2>
          ${safe(
            event.title ||
            'Untitled event'
          )}
        </h2>


        <div class="event-meta">

          ${
            event._start
              ? `
                <span>
                  ◷ ${formatDate(
                    event._start
                  )}
                </span>
              `
              : ''
          }


          ${
            event._end
              ? `
                <span>
                  Finished ${formatDate(
                    event._end
                  )}
                </span>
              `
              : ''
          }


          <span>
            ⌖ ${safe(
              event.location ||
              'Location TBC'
            )}
          </span>

        </div>


        <div style="margin-top: 1rem;">

          <span class="small-button">
            View event →
          </span>

        </div>

      </div>

    </a>
  `;

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
