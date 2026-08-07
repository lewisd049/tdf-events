# Event Portal — Google Sites + Firebase

A complete events-and-users portal. There are **no course features** in this project.

## What it includes

- Public event list and individual event pages
- Email/password and Google sign-in
- User profile and "My registrations" page
- Event registration, cancellation and capacity checking
- Admin event creator/editor, attendee lists and registration management
- Folder-style URLs: `/events/`, `/event/`, `/account/`, and `/admin/`
- A design that works as a standalone site or from links/embeds in Google Sites

## 1. Create your Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) and choose **Add project**.
2. Name it (for example, `tdf-events`) and finish the wizard. Google Analytics is optional.
3. In **Project overview**, choose the **Web** icon (`</>`) to add a web app.
4. Give the app a name, such as `Event Portal`. Do not enable Firebase Hosting in this screen yet.
5. Copy the `firebaseConfig` object Firebase shows you.
6. Open `assets/js/firebase-config.js` and replace every `YOUR_...` value with the matching value from your config.

Never put a Firebase service-account key or admin SDK key in this website. The public web config is expected to be visible; Firestore Rules protect your data.

## 2. Turn on Authentication

1. Firebase Console → **Build** → **Authentication** → **Get started**.
2. In **Sign-in method**, enable **Email/Password**.
3. Enable **Google**, choose a support email and save.
4. Authentication → **Settings** → **Authorized domains**: add the domain that will show the portal. Add your custom domain too if you use one. `localhost` is already available for testing.

## 3. Create Firestore and apply the rules

1. Firebase Console → **Build** → **Firestore Database** → **Create database**.
2. Pick your preferred location (choose carefully; it cannot later be changed). Start in **production mode**.
3. Open the **Rules** tab, replace the whole contents with the rules below, then click **Publish**.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isAdmin() {
      return signedIn()
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /events/{eventId} {
      allow read: if resource.data.visibility == 'public' || isAdmin();
      allow create, delete: if isAdmin();
      // Members may only adjust the count by one during their registration transaction.
      allow update: if isAdmin() || (signedIn()
        && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['registrationCount', 'updatedAt'])
        && (request.resource.data.registrationCount == resource.data.registrationCount + 1
          || request.resource.data.registrationCount == resource.data.registrationCount - 1));
    }

    match /users/{userId} {
      allow create: if signedIn() && request.auth.uid == userId;
      allow read: if signedIn() && (request.auth.uid == userId || isAdmin());
      allow update: if signedIn() && request.auth.uid == userId
        && request.resource.data.role == resource.data.role;
      allow delete: if false;
    }

    match /registrations/{registrationId} {
      allow create: if signedIn()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.eventId is string;
      allow read: if signedIn()
        && (resource.data.userId == request.auth.uid || isAdmin());
      allow delete: if signedIn()
        && (resource.data.userId == request.auth.uid || isAdmin());
      allow update: if false;
    }
  }
}
```

The portal uses a Firestore transaction to verify capacity before creating a registration. For very large or paid events, upgrade this with a Cloud Function so capacity enforcement happens fully on the server.

### Create the events index (only if Firebase asks)

On its first load, Firebase may show an error with a **Create index** link for the public event list. Open that link, leave Firebase's suggested fields in place (`visibility`, `status`, and `startAt`), and click **Create index**. Wait until the index status says **Enabled**, then refresh `/events/`.

## 4. Make yourself an admin

1. Deploy the site (or run it locally), create your account, then sign in once. This creates your user document.
2. Firebase Console → Firestore Database → `users` collection → open your document (its ID is your Auth user UID).
3. Add a field named `role`, type **string**, with value `admin`.
4. Refresh `/admin/`. You can now create and manage events.

Do this manually only for people you trust. The published rules mean ordinary users cannot give themselves admin access.

## Firestore data structure

### `events/{eventId}`

| Field | Type | Notes |
|---|---|---|
| `title`, `description`, `location`, `imageUrl` | string | Public event content |
| `startAt`, `endAt`, `registrationDeadline` | timestamp | Dates and times |
| `capacity`, `registrationCount` | number | Capacity is 0 for unlimited |
| `visibility` | string | `public` or `private` |
| `status` | string | `published`, `draft`, or `cancelled` |
| `createdAt`, `updatedAt` | timestamp | Automatic timestamps |

### `users/{uid}`

`displayName`, `email`, `photoURL`, `role` (`member` or `admin`), `createdAt`, `updatedAt`.

### `registrations/{uid_eventId}`

`userId`, `eventId`, `eventTitle`, `eventStartAt`, `createdAt`.

The predictable document ID means each person can register only once per event.

## 5. Deploy to Firebase Hosting

Install [Node.js LTS](https://nodejs.org/) if it is not already installed, then open a terminal in the folder containing this README:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

During setup:

1. Select the Firebase project you created.
2. For the public directory, enter `.` (a single dot).
3. Answer **Yes** to configuring as a single-page app only if you want root URL rewrites; this project does not rely on them.
4. Answer **No** to GitHub deploys unless you want that feature.

Then deploy:

```bash
firebase deploy --only hosting
```

Firebase gives you a URL like `https://your-project.web.app`. Visit it and test registration before sharing it.

## 6. Add it to Google Sites

### Recommended: use links

In Google Sites, add buttons or navigation links to your Firebase Hosting URLs:

- Events: `https://your-project.web.app/events/`
- My account: `https://your-project.web.app/account/`
- Admin: `https://your-project.web.app/admin/` (keep this link private)

This is the most reliable choice for Google sign-in, mobile devices and full-screen pages.

### Optional: embed the public event list

Google Sites → **Insert** → **Embed** → **By URL**, then use:

`https://your-project.web.app/events/`

Give the embed enough height (about 900 px). Do not embed the account or admin pages: users should open those in a new tab so sign-in and navigation work naturally.

## Local testing

You cannot test Firebase modules by double-clicking HTML files. From this folder, run:

```bash
firebase emulators:start --only hosting
```

or serve it using any local web server and use the Firebase project directly. For a production-quality local test, initialize the Firebase Auth and Firestore emulators too.

## Main folders

```
index.html                 Home
events/index.html          Public event listing
event/index.html           Individual event detail (`?id=EVENT_ID`)
account/index.html         Sign in, profile and registrations
admin/index.html           Admin dashboard
assets/css/style.css       Design
assets/js/*.js             Firebase and page behaviour
```
