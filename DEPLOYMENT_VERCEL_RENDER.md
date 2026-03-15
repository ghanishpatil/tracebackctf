# CTF Platform: Deploy Frontend on Vercel + Backend on Render

This guide walks through deploying the CTF platform with the **React frontend on Vercel** and the **Node.js backend on Render**.

---

## Architecture

```
┌─────────────────────────┐         ┌─────────────────────────────┐
│  Vercel                 │  API    │  Render                     │
│  https://ctf-platform   │ ──────► │  https://ctf-platform-api   │
│  .vercel.app            │         │  .onrender.com              │
│  (React SPA)            │         │  (Express API)              │
└─────────────────────────┘         └─────────────────────────────┘
         │                                        │
         └────────────────┬───────────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  Firebase       │
                 │  (Auth, Firestore, Storage) │
                 └─────────────────┘
```

---

## Prerequisites

- GitHub account with your `ctf-platform` repo pushed
- Vercel account (free tier works)
- Render account (free tier works)
- Firebase project with Firestore, Auth, and Storage enabled
- Firebase service account key (JSON file)

---

# Part 1: Deploy Backend on Render (Do This First)

You deploy the backend first so you have the API URL to use when configuring the frontend.

---

## Step 1.1: Sign in to Render

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Sign in with GitHub (recommended for easy repo connection)

---

## Step 1.2: Create a New Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub account if not already
3. Find and select your repository: `ctf-platform` (or your repo name)
4. Click **Connect**

---

## Step 1.3: Configure the Web Service

Fill in these values exactly:

| Field | Value |
|-------|-------|
| **Name** | `ctf-platform-api` |
| **Region** | `Frankfurt (EU Central)` or `Oregon (US West)` – choose closest to your users |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install --prefix server && npm run build --workspace=server` |
| **Start Command** | `node server/server.js` |
| **Instance Type** | `Free` (or `Starter` if you need more uptime) |

> **Note:** On the free tier, the service spins down after 15 minutes of inactivity. First request after that may take 30–60 seconds.

---

## Step 1.4: Root Directory and Node Settings

1. Scroll to **Root Directory**
2. Leave it **empty** (repo root) – your `server` folder is at the root
3. If you need Node 18, add under **Environment Variables** (optional):
   - Key: `NODE_VERSION`
   - Value: `18`

---

## Step 1.5: Environment Variables (Critical)

Click **Advanced** → **Add Environment Variable** and add these one by one:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `4000` | Render sets this automatically; you can leave it or set explicitly |
| `FRONTEND_URL` | `https://ctf-platform-xyz.vercel.app` | Replace `ctf-platform-xyz` with your actual Vercel URL after deploying (see Part 2) |
| `FIREBASE_PROJECT_ID` | `your-firebase-project-id` | From Firebase Console → Project Settings → General |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com` | From your service account JSON |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n` | Paste the full `private_key` from the JSON. Keep the `\n` as literal `\n` or paste with real newlines – Render accepts both |

---

## Step 1.6: Firebase Admin via Environment Variables (Required for Render)

Render does not persist uploaded files, so you must use environment variables instead of `serviceAccountKey.json`.

Add support for env-based credentials in your Firebase config. Create or update `server/config/firebase.js` to support both file and env:

```javascript
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let serviceAccount;

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };
} else {
  const keyPath = path.resolve(__dirname, 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    console.error('Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY or provide serviceAccountKey.json');
    process.exit(1);
  }
  serviceAccount = require(keyPath);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
});

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

module.exports = { admin, db, auth, bucket };
```

Commit and push this change before deploying.

---

## Step 1.7: Deploy

1. Click **Create Web Service**
2. Wait for the build to complete (about 2–5 minutes)
3. Once live, your API URL will be: `https://ctf-platform-api.onrender.com` (or your custom name)

---

## Step 1.8: Verify Backend

1. Open: `https://ctf-platform-api.onrender.com/api/health`
2. You should see: `{"status":"ok","timestamp":"..."}`

If you see a 502 or timeout, check the **Logs** tab for errors (e.g. missing env vars, Firebase config).

---

## Step 1.9: Update FRONTEND_URL After Vercel Deploy

After deploying the frontend (Part 2), come back to Render:

1. Open your service → **Environment**
2. Set `FRONTEND_URL` to your actual Vercel URL, e.g. `https://ctf-platform.vercel.app`
3. Save (choose **Save and deploy** to redeploy with the new CORS origin)

---

# Part 2: Deploy Frontend on Vercel

---

## Step 2.1: Sign in to Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Sign in with GitHub

---

## Step 2.2: Import the Project

1. Click **Add New…** → **Project**
2. Import your `ctf-platform` repository
3. Click **Import**

---

## Step 2.3: Configure the Project

Two valid setups:

### Option A: Root Directory = `client` (recommended)

| Field | Value |
|-------|-------|
| **Root Directory** | `client` |
| **Framework Preset** | `Vite` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### Option B: Root Directory = empty (monorepo root)

Use the repo root. The project includes `vercel.json` that builds the client:

| Field | Value |
|-------|-------|
| **Root Directory** | (leave empty) |
| **Build Command** | (uses vercel.json – builds from `client/`) |
| **Output Directory** | `client/dist` |

---

## Step 2.4: Environment Variables (Critical for API and Firebase)

Click **Environment Variables** and add:

### API URL (required)

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_API_URL` | `https://ctf-platform-api.onrender.com/api` | Production, Preview, Development |

Replace `ctf-platform-api` with your real Render service name if different.

### Firebase (client SDK)

| Key | Value |
|-----|-------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyB...` (your Firebase Web API Key) |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789012` |
| `VITE_FIREBASE_APP_ID` | `1:123456789012:web:abc123...` |

All values come from Firebase Console → Project Settings → General → Your apps → Web app config.

---

## Step 2.5: Deploy

1. Click **Deploy**
2. Wait 1–3 minutes
3. Your frontend will be live at `https://ctf-platform-xxxxx.vercel.app` (Vercel assigns the URL)

---

## Step 2.6: Update Firebase Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → **Authentication** → **Settings** → **Authorized domains**
3. Add:
   - `ctf-platform-xxxxx.vercel.app` (your actual Vercel URL)
   - `ctf-platform-api.onrender.com` (your Render API URL, if needed for redirects)

---

## Step 2.7: Update Render FRONTEND_URL

1. In Render: Your Web Service → **Environment**
2. Set: `FRONTEND_URL` = `https://ctf-platform-xxxxx.vercel.app` (your Vercel URL)
3. Save and redeploy if needed

---

# Verification Checklist

- [ ] `https://ctf-platform-api.onrender.com/api/health` returns `{"status":"ok"}`
- [ ] `https://ctf-platform-xxxxx.vercel.app` loads the app
- [ ] You can sign in with Firebase Auth
- [ ] Challenges and leaderboard load from the API
- [ ] No CORS errors in the browser console (F12 → Network)

---

# Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS errors in browser | Ensure `FRONTEND_URL` on Render exactly matches your Vercel URL (including `https://`, no trailing slash) |
| 502 Bad Gateway on Render | Check Logs tab; often missing `FIREBASE_*` env vars or malformed `FIREBASE_PRIVATE_KEY` |
| API calls go to wrong URL | Rebuild frontend with correct `VITE_API_URL`; hard refresh (Ctrl+Shift+R) |
| Firebase Auth "unauthorized domain" | Add Vercel and Render domains to Firebase → Authentication → Authorized domains |
| Blank page on Vercel | Check build logs; often missing `VITE_*` env vars; ensure Root Directory is `client` |
| Private key format error | In `FIREBASE_PRIVATE_KEY`, use literal `\n` for newlines, or paste the key with real newlines; ensure full `-----BEGIN...-----END-----` block |

---

# Custom Domains (Optional)

### Vercel

1. Project → **Settings** → **Domains**
2. Add your domain (e.g. `ctf.yourdomain.com`)
3. Add the DNS records Vercel shows
4. Update `FRONTEND_URL` on Render to the new domain

### Render

1. Service → **Settings** → **Custom Domain**
2. Add domain (e.g. `api.yourdomain.com`)
3. Add the CNAME record Render provides
4. Update `VITE_API_URL` on Vercel to the new API URL and redeploy

---

# Summary of URLs to Replace

| Placeholder | Replace with |
|-------------|--------------|
| `ctf-platform-api` | Your Render service name |
| `ctf-platform-xxxxx.vercel.app` | Your actual Vercel deployment URL |
| `your-project` | Your Firebase project ID |
| `your-project-id` | Same as above |
| `AIzaSyB...` | Your Firebase Web API key |
| `123456789012` | Your Firebase sender ID |
| `1:123456789012:web:abc123...` | Your Firebase app ID |
