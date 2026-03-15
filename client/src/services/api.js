import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function getToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken(forceRefresh);
}

async function handleSessionExpired() {
  await signOut(auth);
  const url = new URL('/login', window.location.origin);
  url.searchParams.set('reason', 'session_expired');
  window.location.href = url.toString();
}

async function request(endpoint, options = {}, retried = false) {
  const token = await getToken(retried);
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 401 && !retried) {
    try {
      const newToken = await getToken(true);
      return request(endpoint, options, true);
    } catch {
      await handleSessionExpired();
      throw new Error('Session expired');
    }
  }
  if (res.status === 401) {
    await handleSessionExpired();
    throw new Error('Session expired');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function uploadFiles(files) {
  const token = await getToken();
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const res = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (res.status === 401) {
    await handleSessionExpired();
    throw new Error('Session expired');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export const api = {
  getChallenges: () => request('/challenges'),
  getChallenge: (id) => request(`/challenges/${id}`),
  submitFlag: (challengeId, flag) =>
    request('/submit-flag', {
      method: 'POST',
      body: JSON.stringify({ challengeId, flag }),
    }),
  requestHint: (challengeId) =>
    request(`/challenges/${challengeId}/hint`, { method: 'POST' }),
  getLeaderboard: () => request('/leaderboard'),
  getTimeline: () => request('/leaderboard/timeline'),
  getProfile: () => request('/auth/profile'),
  register: (uid, username, email) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ uid, username, email }),
    }),
  getAnnouncements: () => request('/announcements'),
  getTimer: () => request('/timer'),
  getMyTeam: () => request('/teams/mine'),
  createTeam: (teamName) =>
    request('/teams/create', { method: 'POST', body: JSON.stringify({ teamName }) }),
  joinTeam: (inviteCode) =>
    request('/teams/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
  leaveTeam: () =>
    request('/teams/leave', { method: 'POST' }),
};

export const adminApi = {
  uploadFiles,
  getStats: () => request('/admin/stats'),

  listChallenges: () => request('/admin/challenges'),
  getChallenge: (id) => request(`/admin/challenges/${id}`),
  createChallenge: (data) =>
    request('/admin/challenges', { method: 'POST', body: JSON.stringify(data) }),
  updateChallenge: (id, data) =>
    request(`/admin/challenges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleChallenge: (id, isActive) =>
    request(`/admin/challenges/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  deleteChallenge: (id) =>
    request(`/admin/challenges/${id}`, { method: 'DELETE' }),
  duplicateChallenge: (id) =>
    request(`/admin/challenges/${id}/duplicate`, { method: 'POST' }),

  listUsers: () => request('/admin/users'),
  updateUser: (uid, data) =>
    request(`/admin/users/${uid}`, { method: 'PUT', body: JSON.stringify(data) }),

  listTeams: () => request('/admin/teams'),
  updateTeam: (id, data) =>
    request(`/admin/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTeam: (id) =>
    request(`/admin/teams/${id}`, { method: 'DELETE' }),
  kickMember: (teamId, uid) =>
    request(`/admin/teams/${teamId}/kick`, { method: 'POST', body: JSON.stringify({ uid }) }),

  listSubmissions: (limit = 50) => request(`/admin/submissions?limit=${limit}`),

  getEvent: () => request('/admin/event'),
  timerAction: (data) =>
    request('/admin/event', { method: 'PUT', body: JSON.stringify(data) }),

  listAnnouncements: () => request('/admin/announcements'),
  createAnnouncement: (data) =>
    request('/admin/announcements', { method: 'POST', body: JSON.stringify(data) }),
  updateAnnouncement: (id, data) =>
    request(`/admin/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAnnouncement: (id) =>
    request(`/admin/announcements/${id}`, { method: 'DELETE' }),

  getSettings: () => request('/admin/settings'),
  updateSettings: (data) =>
    request('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
};
