# Deploy TracebackCTF (Frontend + Firebase Only)

There is **no backend server**. The app uses:

- **Firebase Auth** – login/register
- **Firestore** – users, teams, challenges, submissions, events, announcements, settings, hint_usage
- **Firebase Storage** – challenge file uploads
- **Firebase Callable Function** – `submitFlag` (validates flags server-side)

## 1. Firebase setup

1. Create a Firebase project (or use existing).
2. Enable **Authentication** (Email/Password), **Firestore**, **Storage**.
3. In **Firestore**, create the `challenge_flags` collection (optional; used to store flags separately from challenge docs so clients never see them).
4. Deploy rules and the Callable function:

```bash
npm install -g firebase-tools
firebase login
firebase use your-project-id

firebase deploy --only firestore:rules
firebase deploy --only storage
firebase deploy --only functions
```

5. In **Firebase Console → Authentication → Authorized domains**, add your frontend domain (e.g. `tracebackctf.vercel.app`) and `localhost` for local dev.
6. In **Authentication → Sign-in method**, enable **Email/Password** (and optionally Email link). Without this, login returns 400.

## 2. Frontend (Vercel)

1. Import the repo and set **Root Directory** to `client` (or leave empty if using monorepo root).
2. Add **Environment variables** (all `VITE_*` from Firebase):

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

3. Deploy. No `VITE_API_URL` or backend URL is needed.

## 3. Optional: hide flags from client

To avoid sending flags to the client at all, store them only in `challenge_flags`:

- **New challenges**: the admin UI already writes flags to `challenge_flags` and does not put `flag` on the challenge document.
- **Existing challenges**: run a one-time migration (e.g. from Firebase Console or a script) to copy `challenges/{id}.flag` into `challenge_flags/{id}` with field `flag`, then remove the `flag` field from each challenge document.

## 4. Local development

```bash
npm install
npm run dev
```

Only the client runs; no backend process. Use a `.env` in the repo root (or `client/.env`) with `VITE_FIREBASE_*` from your Firebase project.

- **Login 400:** Enable Email/Password in Firebase Console → Authentication → Sign-in method, and add `localhost` to Authorized domains.
- **submitFlag CORS:** The `submitFlag` Cloud Function is deployed with CORS enabled (v2 `onCall({ cors: true })`). Redeploy with `firebase deploy --only functions` if you still see CORS errors from localhost.

## 5. Full Firestore and Storage rules

Deploy from the repo with `firebase deploy --only firestore:rules,storage` or copy below into Firebase Console.

### Firestore rules (`firestore.rules`)

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuth() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /users/{userId} {
      allow read, write: if isAuth() && (request.auth.uid == userId || isAdmin());
    }

    match /teams/{teamId} {
      allow read: if isAuth();
      allow create: if isAuth();
      allow update: if isAuth();
      allow delete: if isAuth();
    }

    match /challenges/{challengeId} {
      allow read: if isAuth() && (resource.data.isActive == true || isAdmin());
      allow create, update, delete: if isAdmin();
    }

    match /challenge_flags/{challengeId} {
      allow read, write: if isAdmin();
    }

    match /submissions/{subId} {
      allow read: if isAuth();
      allow create, update, delete: if false;
    }

    match /events/{docId} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }

    match /announcements/{announcementId} {
      allow read: if isAuth();
      allow create, update, delete: if isAdmin();
    }

    match /settings/{docId} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }

    match /hint_usage/{usageId} {
      allow read, write: if isAuth();
    }
  }
}
```

### Storage rules (`storage.rules`)

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    match /challenges/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 6. What was removed

- **Render** (and any other Node/Express backend) is no longer used.
- **server/** is kept in the repo for reference but is not part of the build or deploy.
- **VITE_API_URL** and **FRONTEND_URL** are not used; all logic is in the frontend and Firebase.
