import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';

// Production: use Render API. Local: use proxy /api. Override with VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD && typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
    ? 'https://tracebackctf.onrender.com/api'
    : '/api');

async function getToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken(forceRefresh);
}

async function request(endpoint, options = {}, retried = false) {
  let token;
  try {
    token = await getToken(retried);
  } catch {
    await signOut(auth).catch(() => {});
    throw new Error('Not authenticated');
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 401 && !retried) {
    return request(endpoint, options, true);
  }
  if (res.status === 401) {
    await signOut(auth).catch(() => {});
    throw new Error('Session expired. Please sign in again.');
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (res.status === 404) throw new Error('API not found. Check that the backend is running.');
    throw new Error('Could not reach the server. Try again in a moment.');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function uploadFiles(files) {
  let token;
  try {
    token = await getToken();
  } catch {
    await signOut(auth).catch(() => {});
    throw new Error('Not authenticated');
  }

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
    await signOut(auth).catch(() => {});
    throw new Error('Session expired. Please sign in again.');
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
