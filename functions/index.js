const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();

const db = admin.firestore();
const HINT_PENALTY = { easy: 0.5, medium: 0.3, hard: 0.2, insane: 0.1 };
const COLLECTIONS = {
  USERS: "users",
  TEAMS: "teams",
  CHALLENGES: "challenges",
  CHALLENGE_FLAGS: "challenge_flags",
  SUBMISSIONS: "submissions",
  EVENTS: "events",
  HINT_USAGE: "hint_usage",
};
const EVENTS_DOC = "current";

function computeTimerStatus(event) {
  if (!event) return "idle";
  const { status, duration, startedAt, elapsed } = event;
  const dur = duration || 0;
  const prev = elapsed || 0;
  if (status === "running" && startedAt) {
    const runningFor = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const total = prev + runningFor;
    return total >= dur ? "ended" : "running";
  }
  return status || "idle";
}

async function runSubmitFlag(userId, data) {
  const { challengeId, flag } = data || {};
  const trimmedFlag = typeof flag === "string" ? flag.trim() : "";

  if (!challengeId || trimmedFlag === "") {
    throw new HttpsError("invalid-argument", "challengeId and flag are required");
  }

  const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
  if (!userDoc.exists) {
    throw new HttpsError("failed-precondition", "User not found");
  }
  const user = userDoc.data();
  if (user.banned) {
    throw new HttpsError("permission-denied", "Your account has been suspended");
  }

  const teamId = user.teamId;
  if (!teamId) {
    throw new HttpsError("failed-precondition", "You must be on a team to submit flags");
  }

  const eventDoc = await db.collection(COLLECTIONS.EVENTS).doc(EVENTS_DOC).get();
  const event = eventDoc.exists ? eventDoc.data() : null;
  if (computeTimerStatus(event) !== "running") {
    throw new HttpsError(
      "failed-precondition",
      "Competition timer is not running. Flag submissions are closed."
    );
  }

  const chDoc = await db.collection(COLLECTIONS.CHALLENGES).doc(challengeId).get();
  if (!chDoc.exists) {
    throw new HttpsError("not-found", "Challenge not found");
  }
  const challenge = { id: chDoc.id, ...chDoc.data() };
  if (!challenge.isActive) {
    throw new HttpsError("permission-denied", "Challenge is not active");
  }

  let correctFlag = challenge.flag;
  if (correctFlag === undefined) {
    const flagDoc = await db.collection(COLLECTIONS.CHALLENGE_FLAGS).doc(challengeId).get();
    correctFlag = flagDoc.exists ? flagDoc.data().flag : null;
  }
  const correct = correctFlag != null && trimmedFlag === String(correctFlag).trim();

  const result = await db.runTransaction(async (txn) => {
    const solvedSnap = await txn.get(
      db
        .collection(COLLECTIONS.SUBMISSIONS)
        .where("teamId", "==", teamId)
        .where("challengeId", "==", challengeId)
        .where("correct", "==", true)
        .limit(1)
    );
    if (!solvedSnap.empty) {
      throw new HttpsError("already-exists", "Your team has already solved this challenge");
    }

    const submissionRef = db.collection(COLLECTIONS.SUBMISSIONS).doc();
    txn.set(submissionRef, {
      userId,
      teamId,
      challengeId,
      flag: trimmedFlag,
      correct,
      timestamp: new Date().toISOString(),
    });

    if (correct) {
      const hintDoc = await txn.get(
        db.collection(COLLECTIONS.HINT_USAGE).doc(`${teamId}_${challengeId}`)
      );
      const usedHint = hintDoc.exists;
      const penalty = HINT_PENALTY[challenge.difficulty] || 0.5;
      const awarded = usedHint
        ? Math.floor((challenge.points || 0) * (1 - penalty))
        : challenge.points || 0;

      txn.update(db.collection(COLLECTIONS.TEAMS).doc(teamId), {
        score: admin.firestore.FieldValue.increment(awarded),
        lastSolveTime: new Date().toISOString(),
      });
      txn.update(db.collection(COLLECTIONS.CHALLENGES).doc(challengeId), {
        solveCount: admin.firestore.FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });

      return {
        correct: true,
        pointsAwarded: awarded,
        hintPenalty: usedHint,
        message: usedHint
          ? `Correct! ${awarded} points awarded (hint penalty applied).`
          : `Correct flag! ${awarded} points awarded.`,
      };
    }

    return { correct: false, message: "Incorrect flag. Try again." };
  });

  return result;
}

exports.submitFlag = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }
  return runSubmitFlag(request.auth.uid, request.data || {});
});

const submitFlagApp = express();
submitFlagApp.use(cors({ origin: true }));
submitFlagApp.use(express.json());

submitFlagApp.post("/", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: { status: "UNAUTHENTICATED", message: "Must be logged in" } });
  }
  const token = authHeader.slice(7);
  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: { status: "UNAUTHENTICATED", message: "Invalid or expired token" } });
  }
  const body = req.body || {};
  const data = body.data != null ? body.data : body;
  try {
    const result = await runSubmitFlag(uid, data);
    return res.status(200).json({ result });
  } catch (err) {
    const code = (err.code || "internal").replace(/-/g, "_").toUpperCase();
    const statusMap = { UNAUTHENTICATED: 401, INVALID_ARGUMENT: 400, NOT_FOUND: 404, PERMISSION_DENIED: 403, FAILED_PRECONDITION: 400, ALREADY_EXISTS: 409 };
    const status = err.httpStatus || statusMap[code] || 500;
    return res.status(status).json({ error: { status: code, message: err.message || "Error" } });
  }
});

exports.submitFlagHttp = onRequest(submitFlagApp);
