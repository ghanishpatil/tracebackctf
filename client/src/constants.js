/**
 * Shared constants for the CTF platform (client).
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  PLAYER: 'player',
});

export const DIFFICULTY = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  INSANE: 'insane',
});

export const CATEGORIES = Object.freeze([
  'web', 'pwn', 'crypto', 'reversing', 'forensics', 'misc', 'osint', 'steganography',
]);

export const COLLECTIONS = Object.freeze({
  USERS: 'users',
  TEAMS: 'teams',
  CHALLENGES: 'challenges',
  CHALLENGE_FLAGS: 'challenge_flags',
  SUBMISSIONS: 'submissions',
  EVENTS: 'events',
  ANNOUNCEMENTS: 'announcements',
  SETTINGS: 'settings',
  HINT_USAGE: 'hint_usage',
});

export const HINT_PENALTY = Object.freeze({
  [DIFFICULTY.EASY]: 0.5,
  [DIFFICULTY.MEDIUM]: 0.3,
  [DIFFICULTY.HARD]: 0.2,
  [DIFFICULTY.INSANE]: 0.1,
});

export const POINTS_MAP = Object.freeze({
  [DIFFICULTY.EASY]: 100,
  [DIFFICULTY.MEDIUM]: 250,
  [DIFFICULTY.HARD]: 500,
  [DIFFICULTY.INSANE]: 1000,
});
