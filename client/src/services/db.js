/**
 * Frontend-only data layer: Firestore + Auth + Storage + Callable (submitFlag).
 * No backend server required.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, firestore, storage, appInstance } from '../config/firebase';
import { COLLECTIONS, ROLES, HINT_PENALTY } from '../constants';

const EVENTS_DOC_ID = 'current';
const SETTINGS_DOC_ID = 'platform';

function safeChallenge(data) {
  if (!data) return null;
  const { flag, ...rest } = data;
  return rest;
}

// ---- Profile & Auth ----
export async function getProfile(uid = auth.currentUser?.uid) {
  if (!uid) throw new Error('Not authenticated');
  const snap = await getDoc(doc(firestore, COLLECTIONS.USERS, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function registerUser(uid, username, email) {
  const ref = doc(firestore, COLLECTIONS.USERS, uid);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error('User already registered');
  await setDoc(ref, {
    uid,
    username,
    email,
    teamId: null,
    role: ROLES.PLAYER,
    createdAt: new Date().toISOString(),
  });
}

// ---- Challenges (no flag exposed) ----
export async function getChallenges() {
  const q = query(
    collection(firestore, COLLECTIONS.CHALLENGES),
    where('isActive', '==', true)
  );
  const snap = await getDocs(q);
  const teamId = auth.currentUser ? (await getProfile())?.teamId : null;
  const challenges = snap.docs.map((d) => ({ id: d.id, ...safeChallenge(d.data()) }));

  const usageMap = {};
  if (teamId) {
    await Promise.all(
      challenges.map(async (c) => {
        const u = await getHintUsage(teamId, c.id);
        usageMap[c.id] = u;
      })
    );
  }

  return challenges.map((c) => {
    const usage = usageMap[c.id];
    const totalHints = Array.isArray(c.hints) ? c.hints.length : 0;
    const revealed = usage?.hintsRevealed ?? 0;
    return {
      ...c,
      hints: undefined,
      hintUsed: revealed > 0,
      hintsRevealed: revealed,
      totalHints,
      hasHints: totalHints > 0,
      hintPenalty: HINT_PENALTY[c.difficulty] ?? 0.5,
    };
  });
}

export async function getChallenge(id) {
  const snap = await getDoc(doc(firestore, COLLECTIONS.CHALLENGES, id));
  if (!snap.exists()) return null;
  const c = { id: snap.id, ...safeChallenge(snap.data()) };
  const teamId = auth.currentUser ? (await getProfile())?.teamId : null;
  const allHints = c.hints || [];
  let revealed = 0;
  if (teamId) {
    const usage = await getHintUsage(teamId, id);
    revealed = usage?.hintsRevealed ?? 0;
  }
  return {
    ...c,
    hints: allHints.slice(0, revealed),
    hintsRevealed: revealed,
    totalHints: allHints.length,
    hintUsed: revealed > 0,
    hasHints: allHints.length > 0,
    hintPenalty: HINT_PENALTY[c.difficulty] ?? 0.5,
  };
}

// ---- Hint ----
function hintDocId(teamId, challengeId) {
  return `${teamId}_${challengeId}`;
}

export async function getHintUsage(teamId, challengeId) {
  const snap = await getDoc(
    doc(firestore, COLLECTIONS.HINT_USAGE, hintDocId(teamId, challengeId))
  );
  return snap.exists() ? snap.data() : null;
}

export async function requestHint(challengeId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  const profile = await getProfile();
  const teamId = profile?.teamId;
  if (!teamId) throw new Error('You must be on a team to request hints');

  const challengeSnap = await getDoc(doc(firestore, COLLECTIONS.CHALLENGES, challengeId));
  if (!challengeSnap.exists()) throw new Error('Challenge not found');
  const challenge = challengeSnap.data();
  const allHints = challenge.hints || [];
  if (allHints.length === 0) throw new Error('No hints available');

  const hintRef = doc(firestore, COLLECTIONS.HINT_USAGE, hintDocId(teamId, challengeId));
  const usageSnap = await getDoc(hintRef);
  const currentRevealed = usageSnap.exists() ? usageSnap.data().hintsRevealed ?? 0 : 0;

  if (currentRevealed >= allHints.length) {
    return {
      hints: allHints,
      hintsRevealed: currentRevealed,
      totalHints: allHints.length,
      allRevealed: true,
    };
  }

  const nextRevealed = currentRevealed + 1;
  if (usageSnap.exists()) {
    await updateDoc(hintRef, { hintsRevealed: nextRevealed });
  } else {
    await setDoc(hintRef, {
      teamId,
      challengeId,
      requestedBy: uid,
      hintsRevealed: 1,
      timestamp: new Date().toISOString(),
    });
  }

  const penalty = HINT_PENALTY[challenge.difficulty] ?? 0.5;
  const visibleHints = allHints.slice(0, nextRevealed);
  const res = {
    hints: visibleHints,
    hintsRevealed: nextRevealed,
    totalHints: allHints.length,
    isFirst: currentRevealed === 0,
  };
  if (res.isFirst) {
    res.penalty = Math.floor((challenge.points || 0) * penalty);
    res.effectivePoints = (challenge.points || 0) - res.penalty;
  }
  return res;
}

// ---- Submit flag (HTTP Cloud Function with CORS - avoids callable preflight issues)
export async function submitFlag(challengeId, flag) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const projectId = appInstance.options?.projectId;
  if (!projectId) throw new Error('Firebase project not configured');
  const url = `https://us-central1-${projectId}.cloudfunctions.net/submitFlagHttp`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: { challengeId, flag: flag?.trim?.() || flag } }),
  });
  const json = await res.json();
  if (json.error) {
    const e = new Error(json.error.message || 'Submission failed');
    e.code = json.error.status;
    throw e;
  }
  return json.result;
}

// ---- Leaderboard ----
export async function getLeaderboard() {
  const [teamsSnap, challengesSnap, correctSnap] = await Promise.all([
    getDocs(
      query(collection(firestore, COLLECTIONS.TEAMS), orderBy('score', 'desc'))
    ),
    getDocs(collection(firestore, COLLECTIONS.CHALLENGES)),
    getDocs(
      query(
        collection(firestore, COLLECTIONS.SUBMISSIONS),
        where('correct', '==', true),
        orderBy('timestamp', 'asc')
      )
    ),
  ]);

  const allChallenges = challengesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const totalPoints = allChallenges.reduce((s, c) => s + (c.points || 0), 0);
  const totalChallenges = allChallenges.length;

  const solveCounts = {};
  correctSnap.docs.forEach((d) => {
    const { teamId } = d.data();
    solveCounts[teamId] = (solveCounts[teamId] || 0) + 1;
  });

  const sorted = [...teamsSnap.docs].sort((a, b) => {
    const sa = a.data().score ?? 0;
    const sb = b.data().score ?? 0;
    if (sb !== sa) return sb - sa;
    const ta = a.data().lastSolveTime || '';
    const tb = b.data().lastSolveTime || '';
    return ta.localeCompare(tb);
  });
  const leaderboard = sorted.map((d, i) => ({
    rank: i + 1,
    id: d.id,
    ...d.data(),
    solveCount: solveCounts[d.id] || 0,
    totalPoints,
    totalChallenges,
  }));

  return { leaderboard, totalPoints, totalChallenges };
}

export async function getTimeline() {
  const [teamsSnap, correctSnap, challengesSnap] = await Promise.all([
    getDocs(
      query(
        collection(firestore, COLLECTIONS.TEAMS),
        orderBy('score', 'desc'),
        limit(10)
      )
    ),
    getDocs(
      query(
        collection(firestore, COLLECTIONS.SUBMISSIONS),
        where('correct', '==', true),
        orderBy('timestamp', 'asc')
      )
    ),
    getDocs(collection(firestore, COLLECTIONS.CHALLENGES)),
  ]);

  const top10 = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const top10Ids = new Set(top10.map((t) => t.id));
  const challengeMap = {};
  challengesSnap.docs.forEach((d) => {
    challengeMap[d.id] = d.data();
  });
  const teamNames = {};
  top10.forEach((t) => { teamNames[t.id] = t.teamName; });

  const teamScores = {};
  const timeline = [];
  const hintUsedCache = {};

  for (const d of correctSnap.docs) {
    const sub = d.data();
    if (!top10Ids.has(sub.teamId)) continue;
    const challenge = challengeMap[sub.challengeId];
    if (!challenge) continue;

    const key = `${sub.teamId}_${sub.challengeId}`;
    if (hintUsedCache[key] === undefined) {
      const u = await getHintUsage(sub.teamId, sub.challengeId);
      hintUsedCache[key] = !!u;
    }
    let points = challenge.points || 0;
    if (hintUsedCache[key]) {
      const penalty = HINT_PENALTY[challenge.difficulty] ?? 0.5;
      points = Math.floor(points * (1 - penalty));
    }
    teamScores[sub.teamId] = (teamScores[sub.teamId] || 0) + points;
    timeline.push({
      teamId: sub.teamId,
      teamName: teamNames[sub.teamId],
      score: teamScores[sub.teamId],
      timestamp: sub.timestamp,
    });
  }

  return {
    timeline,
    teams: top10.map((t) => ({ id: t.id, teamName: t.teamName, score: t.score })),
  };
}

// ---- Announcements ----
export async function getAnnouncements() {
  const q = query(
    collection(firestore, COLLECTIONS.ANNOUNCEMENTS),
    where('active', '==', true),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---- Timer / Event ----
export function computeTimerState(event) {
  if (!event) return { status: 'idle', remaining: 0, title: '', duration: 0 };
  const { status, duration, startedAt, elapsed } = event;
  const dur = duration || 0;
  const prev = elapsed || 0;
  if (status === 'running' && startedAt) {
    const runningFor = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const totalElapsed = prev + runningFor;
    const remaining = Math.max(0, dur - totalElapsed);
    return {
      status: remaining <= 0 ? 'ended' : 'running',
      remaining: Math.max(0, remaining),
      title: event.title || '',
      duration: dur,
    };
  }
  if (status === 'paused') {
    return { status: 'paused', remaining: Math.max(0, dur - prev), title: event.title || '', duration: dur };
  }
  if (status === 'ended') return { status: 'ended', remaining: 0, title: event.title || '', duration: dur };
  return { status: 'idle', remaining: dur, title: event.title || '', duration: dur };
}

export async function getTimer() {
  const snap = await getDoc(doc(firestore, COLLECTIONS.EVENTS, EVENTS_DOC_ID));
  const event = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  return computeTimerState(event);
}

// ---- Teams ----
export async function getMyTeam() {
  const profile = await getProfile();
  const teamId = profile?.teamId;
  if (!teamId) return { team: null };
  const snap = await getDoc(doc(firestore, COLLECTIONS.TEAMS, teamId));
  if (!snap.exists()) return { team: null };
  return { team: { id: snap.id, ...snap.data() } };
}

function randomInviteCode() {
  const hex = '0123456789ABCDEF';
  let s = '';
  for (let i = 0; i < 8; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

export async function createTeam(teamName) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  const profile = await getProfile();
  if (!profile) throw new Error('User not found');
  if (profile.teamId) throw new Error('You are already on a team');

  const inviteCode = randomInviteCode();
  const teamRef = doc(collection(firestore, COLLECTIONS.TEAMS));
  const teamId = teamRef.id;

  await runTransaction(firestore, async (txn) => {
    const userSnap = await txn.get(doc(firestore, COLLECTIONS.USERS, uid));
    if (!userSnap.exists()) throw new Error('User not found');
    if (userSnap.data().teamId) throw new Error('You are already on a team');
    txn.set(teamRef, {
      teamName: teamName.trim(),
      captainId: uid,
      members: [{ uid, username: profile.username || 'Unknown' }],
      inviteCode,
      score: 0,
      lastSolveTime: null,
      createdAt: new Date().toISOString(),
    });
    txn.update(doc(firestore, COLLECTIONS.USERS, uid), { teamId });
  });

  return { teamId, message: 'Team created' };
}

export async function joinTeam(inviteCode) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  const profile = await getProfile();
  if (!profile) throw new Error('User not found');
  if (profile.teamId) throw new Error('You are already on a team');

  const teamsSnap = await getDocs(
    query(
      collection(firestore, COLLECTIONS.TEAMS),
      where('inviteCode', '==', String(inviteCode).trim().toUpperCase()),
      limit(1)
    )
  );
  if (teamsSnap.empty) throw new Error('Invalid invite code');

  const teamDoc = teamsSnap.docs[0];
  const teamId = teamDoc.id;
  const team = teamDoc.data();
  const settings = await getSettings();
  const maxSize = settings.maxTeamSize ?? 2;
  if (team.members.length >= maxSize) throw new Error(`Team is full (max ${maxSize})`);
  if (team.members.some((m) => m.uid === uid)) throw new Error('Already a member');

  await runTransaction(firestore, async (txn) => {
    txn.update(doc(firestore, COLLECTIONS.TEAMS, teamId), {
      members: arrayUnion({ uid, username: profile.username || 'Unknown' }),
    });
    txn.update(doc(firestore, COLLECTIONS.USERS, uid), { teamId });
  });

  return { teamId, message: 'Joined team successfully' };
}

export async function leaveTeam() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  const profile = await getProfile();
  const teamId = profile?.teamId;
  if (!teamId) throw new Error('You are not on a team');

  const teamSnap = await getDoc(doc(firestore, COLLECTIONS.TEAMS, teamId));
  if (!teamSnap.exists()) throw new Error('Team not found');
  const team = teamSnap.data();
  const member = team.members.find((m) => m.uid === uid);
  if (!member) throw new Error('Not a member of this team');

  const remaining = team.members.filter((m) => m.uid !== uid);

  await runTransaction(firestore, async (txn) => {
    if (remaining.length === 0) {
      txn.delete(doc(firestore, COLLECTIONS.TEAMS, teamId));
    } else {
      const updates = { members: remaining };
      if (team.captainId === uid) updates.captainId = remaining[0].uid;
      txn.update(doc(firestore, COLLECTIONS.TEAMS, teamId), updates);
    }
    txn.update(doc(firestore, COLLECTIONS.USERS, uid), { teamId: null });
  });

  return { message: 'Left team' };
}

// ---- Settings ----
const SETTINGS_DEFAULTS = {
  registrationOpen: true,
  maxTeamSize: 2,
  flagFormat: 'flag{...}',
  platformName: 'TracebackCTF',
  allowLateJoins: true,
};

export async function getSettings() {
  const snap = await getDoc(doc(firestore, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID));
  return snap.exists() ? { ...SETTINGS_DEFAULTS, ...snap.data() } : { ...SETTINGS_DEFAULTS };
}

// ---- Admin: challenges (with flag in separate doc for new writes) ----
export async function adminListChallenges() {
  const snap = await getDocs(
    query(
      collection(firestore, COLLECTIONS.CHALLENGES),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function adminGetChallenge(id) {
  const [chSnap, flagSnap] = await Promise.all([
    getDoc(doc(firestore, COLLECTIONS.CHALLENGES, id)),
    getDoc(doc(firestore, COLLECTIONS.CHALLENGE_FLAGS, id)),
  ]);
  if (!chSnap.exists()) return null;
  const data = { id: chSnap.id, ...chSnap.data() };
  if (flagSnap.exists()) data.flag = flagSnap.data().flag;
  return data;
}

export async function adminCreateChallenge(data) {
  const { flag, ...rest } = data;
  const chRef = doc(collection(firestore, COLLECTIONS.CHALLENGES));
  const now = new Date().toISOString();
  await setDoc(chRef, {
    ...rest,
    solveCount: 0,
    isActive: rest.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  });
  if (flag != null && String(flag).trim()) {
    await setDoc(doc(firestore, COLLECTIONS.CHALLENGE_FLAGS, chRef.id), { flag: String(flag).trim() });
  }
  return chRef.id;
}

export async function adminUpdateChallenge(id, data) {
  const { flag, ...rest } = data;
  const ref = doc(firestore, COLLECTIONS.CHALLENGES, id);
  await updateDoc(ref, { ...rest, updatedAt: new Date().toISOString() });
  if (data.hasOwnProperty('flag')) {
    const flagRef = doc(firestore, COLLECTIONS.CHALLENGE_FLAGS, id);
    if (data.flag == null || String(data.flag).trim() === '') {
      await deleteDoc(flagRef).catch(() => {});
    } else {
      await setDoc(flagRef, { flag: String(data.flag).trim() }, { merge: true });
    }
  }
}

export async function adminToggleChallenge(id, isActive) {
  await updateDoc(doc(firestore, COLLECTIONS.CHALLENGES, id), {
    isActive,
    updatedAt: new Date().toISOString(),
  });
}

export async function adminDeleteChallenge(id) {
  await deleteDoc(doc(firestore, COLLECTIONS.CHALLENGES, id));
  await deleteDoc(doc(firestore, COLLECTIONS.CHALLENGE_FLAGS, id)).catch(() => {});
}

export async function adminDuplicateChallenge(id) {
  const ch = await adminGetChallenge(id);
  if (!ch) throw new Error('Challenge not found');
  const { id: _id, createdAt, updatedAt, solveCount, ...rest } = ch;
  return adminCreateChallenge(rest);
}

// ---- Admin: users, teams, submissions, event, announcements, settings ----
export async function adminListUsers() {
  const snap = await getDocs(collection(firestore, COLLECTIONS.USERS));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function adminUpdateUser(uid, data) {
  await updateDoc(doc(firestore, COLLECTIONS.USERS, uid), data);
}

export async function adminListTeams() {
  const snap = await getDocs(
    query(collection(firestore, COLLECTIONS.TEAMS), orderBy('score', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function adminUpdateTeam(id, data) {
  await updateDoc(doc(firestore, COLLECTIONS.TEAMS, id), data);
}

export async function adminDeleteTeam(id) {
  const teamSnap = await getDoc(doc(firestore, COLLECTIONS.TEAMS, id));
  if (!teamSnap.exists()) throw new Error('Team not found');
  const team = teamSnap.data();
  await runTransaction(firestore, async (txn) => {
    for (const m of team.members || []) {
      txn.update(doc(firestore, COLLECTIONS.USERS, m.uid), { teamId: null });
    }
    txn.delete(doc(firestore, COLLECTIONS.TEAMS, id));
  });
}

export async function adminKickMember(teamId, uid) {
  return leaveTeamForMember(teamId, uid);
}

async function leaveTeamForMember(teamId, uid) {
  const teamSnap = await getDoc(doc(firestore, COLLECTIONS.TEAMS, teamId));
  if (!teamSnap.exists()) throw new Error('Team not found');
  const team = teamSnap.data();
  const remaining = (team.members || []).filter((m) => m.uid !== uid);
  if (remaining.length === (team.members || []).length) throw new Error('Not a member');

  await runTransaction(firestore, async (txn) => {
    if (remaining.length === 0) {
      txn.delete(doc(firestore, COLLECTIONS.TEAMS, teamId));
    } else {
      const updates = { members: remaining };
      if (team.captainId === uid) updates.captainId = remaining[0].uid;
      txn.update(doc(firestore, COLLECTIONS.TEAMS, teamId), updates);
    }
    txn.update(doc(firestore, COLLECTIONS.USERS, uid), { teamId: null });
  });
}

export async function adminListSubmissions(limitCount = 50) {
  const q = query(
    collection(firestore, COLLECTIONS.SUBMISSIONS),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function adminGetEvent() {
  const snap = await getDoc(doc(firestore, COLLECTIONS.EVENTS, EVENTS_DOC_ID));
  const event = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  if (!event) return null;
  return { ...event, ...computeTimerState(event) };
}

export async function adminUpdateEvent(data) {
  await setDoc(doc(firestore, COLLECTIONS.EVENTS, EVENTS_DOC_ID), data, { merge: true });
}

export async function adminListAnnouncements() {
  const snap = await getDocs(
    query(
      collection(firestore, COLLECTIONS.ANNOUNCEMENTS),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function adminCreateAnnouncement(data) {
  const ref = doc(collection(firestore, COLLECTIONS.ANNOUNCEMENTS));
  await setDoc(ref, {
    title: data.title,
    body: data.body || '',
    type: data.type || 'info',
    active: data.active !== false,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function adminUpdateAnnouncement(id, data) {
  await updateDoc(doc(firestore, COLLECTIONS.ANNOUNCEMENTS, id), data);
}

export async function adminDeleteAnnouncement(id) {
  await deleteDoc(doc(firestore, COLLECTIONS.ANNOUNCEMENTS, id));
}

export async function adminGetSettings() {
  return getSettings();
}

export async function adminUpdateSettings(data) {
  await setDoc(doc(firestore, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID), data, { merge: true });
}

// ---- Admin stats ----
export async function adminGetStats() {
  const [usersSnap, teamsSnap, challengesSnap, submissionsSnap, correctSnap, eventSnap] = await Promise.all([
    getDocs(collection(firestore, COLLECTIONS.USERS)),
    getDocs(collection(firestore, COLLECTIONS.TEAMS)),
    getDocs(collection(firestore, COLLECTIONS.CHALLENGES)),
    getDocs(collection(firestore, COLLECTIONS.SUBMISSIONS)),
    getDocs(query(collection(firestore, COLLECTIONS.SUBMISSIONS), where('correct', '==', true))),
    getDoc(doc(firestore, COLLECTIONS.EVENTS, EVENTS_DOC_ID)),
  ]);

  const event = eventSnap.exists() ? { id: eventSnap.id, ...eventSnap.data() } : null;
  const timerState = computeTimerState(event);
  const eventActive = (timerState.status === 'running' && timerState.remaining > 0) || timerState.status === 'paused';

  const activeChallenges = challengesSnap.docs.filter((d) => d.data().isActive === true).length;
  const recentSubs = submissionsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const t = (x) => (x?.toMillis ? x.toMillis() : typeof x === 'number' ? x : new Date(x || 0).getTime());
      return t(b.timestamp) - t(a.timestamp);
    })
    .slice(0, 10);

  return {
    stats: {
      challenges: challengesSnap.size,
      activeChallenges,
      teams: teamsSnap.size,
      users: usersSnap.size,
      submissions: submissionsSnap.size,
      correctSolves: correctSnap.size,
      eventActive,
    },
    recentActivity: recentSubs,
  };
}

// ---- Upload (Storage) ----
export async function uploadFiles(files) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const uploaded = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `challenges/${crypto.randomUUID().replace(/-/g, '')}_${safeName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);
    uploaded.push({ name: file.name, url, size: file.size });
  }
  return { files: uploaded };
}
