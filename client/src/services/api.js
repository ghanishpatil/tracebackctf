/**
 * API layer: uses Firestore + Auth + Storage + Callable (no backend server).
 * All methods delegate to client/src/services/db.js.
 */
import * as db from './db';

export const api = {
  getChallenges: () => db.getChallenges().then((challenges) => ({ challenges })),

  getChallenge: (id) =>
    db.getChallenge(id).then((challenge) => {
      if (!challenge) throw new Error('Challenge not found');
      return { challenge };
    }),

  submitFlag: (challengeId, flag) => db.submitFlag(challengeId, flag),

  requestHint: (challengeId) => db.requestHint(challengeId),

  getLeaderboard: () => db.getLeaderboard(),

  getTimeline: () => db.getTimeline(),

  getProfile: (opts = {}) =>
    db.getProfile().then((profile) => {
      if (!profile) throw new Error('Profile not found');
      return { profile };
    }),

  register: (uid, username, email) =>
    db.registerUser(uid, username, email).then(() => ({ message: 'User registered successfully' })),

  getAnnouncements: (opts = {}) =>
    db.getAnnouncements().then((announcements) => ({ announcements })),

  getTimer: (opts = {}) => db.getTimer(),

  getMyTeam: (opts = {}) => db.getMyTeam(),

  createTeam: (teamName) => db.createTeam(teamName),

  joinTeam: (inviteCode) => db.joinTeam(inviteCode),

  leaveTeam: () => db.leaveTeam(),
};

export const adminApi = {
  uploadFiles: (files) => db.uploadFiles(files),

  getStats: () => db.adminGetStats(),

  listChallenges: () => db.adminListChallenges().then((challenges) => ({ challenges })),

  getChallenge: (id) =>
    db.adminGetChallenge(id).then((challenge) => {
      if (!challenge) throw new Error('Challenge not found');
      return { challenge };
    }),

  createChallenge: (data) =>
    db.adminCreateChallenge(data).then((id) => ({ id })),

  updateChallenge: (id, data) => db.adminUpdateChallenge(id, data),

  toggleChallenge: (id, isActive) => db.adminToggleChallenge(id, isActive),

  deleteChallenge: (id) => db.adminDeleteChallenge(id),

  duplicateChallenge: (id) =>
    db.adminDuplicateChallenge(id).then((newId) => ({ id: newId })),

  listUsers: () => db.adminListUsers().then((users) => ({ users })),

  updateUser: (uid, data) => db.adminUpdateUser(uid, data),

  listTeams: () => db.adminListTeams().then((teams) => ({ teams })),

  updateTeam: (id, data) => db.adminUpdateTeam(id, data),

  deleteTeam: (id) => db.adminDeleteTeam(id),

  kickMember: (teamId, uid) => db.adminKickMember(teamId, uid),

  listSubmissions: (limitCount = 50) =>
    db.adminListSubmissions(limitCount).then((submissions) => ({ submissions })),

  getEvent: () => db.adminGetEvent().then((event) => ({ event })),

  timerAction: (data) => db.adminUpdateEvent(data),

  listAnnouncements: () =>
    db.adminListAnnouncements().then((announcements) => ({ announcements })),

  createAnnouncement: (data) =>
    db.adminCreateAnnouncement(data).then((id) => ({ id })),

  updateAnnouncement: (id, data) => db.adminUpdateAnnouncement(id, data),

  deleteAnnouncement: (id) => db.adminDeleteAnnouncement(id),

  getSettings: () => db.adminGetSettings().then((settings) => ({ settings })),

  updateSettings: (data) => db.adminUpdateSettings(data),
};
