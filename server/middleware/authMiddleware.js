const { auth, db } = require('../config/firebase');
const { COLLECTIONS, ROLES } = require('shared');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed authorization header' });
  }

  try {
    const token = header.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded;

    const userDoc = await db.collection(COLLECTIONS.USERS).doc(decoded.uid).get();
    if (userDoc.exists) {
      req.userProfile = { id: userDoc.id, ...userDoc.data() };
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.userProfile?.role !== ROLES.ADMIN) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
