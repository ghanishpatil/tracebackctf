const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const keyPath = path.resolve(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(keyPath)) {
  console.error(
    '\n❌  Missing service account key file!\n' +
    `   Expected at: ${keyPath}\n\n` +
    '   Download it from Firebase Console:\n' +
    '   Project Settings → Service Accounts → Generate New Private Key\n' +
    '   Save the file as server/config/serviceAccountKey.json\n'
  );
  process.exit(1);
}

const serviceAccount = require(keyPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
});

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

module.exports = { admin, db, auth, bucket };
