# 10-Minute Deploy: TracebackCTF

## 1. Render (Backend) – 5 min

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**
2. Connect repo → select `ctf-platform`
3. Settings:
   - **Name:** `tracebackctf`
   - **Root Directory:** *(leave empty)*
   - **Build Command:** `npm install`
   - **Start Command:** `node server/server.js`
4. **Environment** → Add:
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = `https://tracebackctf.vercel.app`
   - `FIREBASE_PROJECT_ID` = `traceback-ctf-201a3`
   - `FIREBASE_CLIENT_EMAIL` = `firebase-adminsdk-fbsvc@traceback-ctf-201a3.iam.gserviceaccount.com`
   - `FIREBASE_PRIVATE_KEY` = *(paste full private_key from serviceAccountKey.json)*
5. **Create Web Service** → wait for deploy
6. Test: `https://tracebackctf.onrender.com/api/health` returns `{"status":"ok"}`

---

## 2. Vercel (Frontend) – 5 min

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import `ctf-platform` repo
3. Settings:
   - **Root Directory:** `client` (or leave empty if using monorepo root)
   - **Framework:** Vite
4. **Environment Variables** → Add (all `VITE_*` from Firebase + API):

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://tracebackctf.onrender.com/api` |
   | `VITE_FIREBASE_API_KEY` | *(from Firebase Console)* |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `traceback-ctf-201a3.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `traceback-ctf-201a3` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `traceback-ctf-201a3.firebasestorage.app` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | *(from Firebase)* |
   | `VITE_FIREBASE_APP_ID` | *(from Firebase)* |

5. **Deploy**
6. Firebase Console → **Authentication** → **Authorized domains** → add `tracebackctf.vercel.app`

---

## 3. Final

- Frontend: `https://tracebackctf.vercel.app`
- API: `https://tracebackctf.onrender.com/api`

**Note:** `VITE_API_URL` is optional; the app defaults to `https://tracebackctf.onrender.com/api` when on Vercel. Set it only if using a different API URL.
