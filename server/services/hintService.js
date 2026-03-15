const { db } = require('../config/firebase');
const { COLLECTIONS } = require('shared');

const hintRef = db.collection(COLLECTIONS.HINT_USAGE);

function docId(teamId, challengeId) {
  return `${teamId}_${challengeId}`;
}

async function getHintUsage(teamId, challengeId) {
  const doc = await hintRef.doc(docId(teamId, challengeId)).get();
  if (!doc.exists) return null;
  return doc.data();
}

async function revealNextHint(teamId, challengeId, userId, totalHints) {
  const id = docId(teamId, challengeId);
  const doc = await hintRef.doc(id).get();

  if (!doc.exists) {
    await hintRef.doc(id).set({
      teamId,
      challengeId,
      requestedBy: userId,
      hintsRevealed: 1,
      timestamp: new Date().toISOString(),
    });
    return { revealed: 1, isFirst: true };
  }

  const current = doc.data().hintsRevealed || 1;
  if (current >= totalHints) {
    return { revealed: current, isFirst: false };
  }

  await hintRef.doc(id).update({ hintsRevealed: current + 1 });
  return { revealed: current + 1, isFirst: false };
}

async function hasUsedHint(teamId, challengeId) {
  const doc = await hintRef.doc(docId(teamId, challengeId)).get();
  return doc.exists;
}

module.exports = { getHintUsage, revealNextHint, hasUsedHint };
