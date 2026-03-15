const { db } = require('../config/firebase');
const { COLLECTIONS, ROLES } = require('shared');

async function register(req, res, next) {
  try {
    const { uid, username, email } = req.body;

    if (!uid || !username || !email) {
      return res.status(400).json({ error: 'uid, username, and email are required' });
    }

    const existing = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    if (existing.exists) {
      return res.status(409).json({ error: 'User already registered' });
    }

    await db.collection(COLLECTIONS.USERS).doc(uid).set({
      uid,
      username,
      email,
      teamId: null,
      role: ROLES.PLAYER,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const uid = req.user.uid;
    const doc = await db.collection(COLLECTIONS.USERS).doc(uid).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ profile: { id: doc.id, ...doc.data() } });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, getProfile };
