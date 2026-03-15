import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          await firebaseUser.getIdToken(true);
          const { profile: p } = await api.getProfile({ noSignOutOn401: true });
          setProfile(p);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function login(email, password) {
    const e = (email || '').trim();
    const p = typeof password === 'string' ? password : '';
    if (!e || !p) throw new Error('Email and password are required');
    try {
      const cred = await signInWithEmailAndPassword(auth, e, p);
      return cred.user;
    } catch (err) {
      const code = err.code || '';
      if (code === 'auth/operation-not-allowed') {
        throw new Error('Email/password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.');
      }
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        throw new Error('Invalid email or password.');
      }
      if (code === 'auth/invalid-email') throw new Error('Invalid email address.');
      if (code === 'auth/user-disabled') throw new Error('This account has been disabled.');
      if (code === 'auth/too-many-requests') throw new Error('Too many attempts. Try again later.');
      throw new Error(err.message || 'Login failed.');
    }
  }

  async function register(email, password, username) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await api.register(cred.user.uid, username, email);
    const { profile: p } = await api.getProfile();
    setProfile(p);
    return cred.user;
  }

  async function logout() {
    await signOut(auth);
    setProfile(null);
  }

  async function refreshProfile() {
    try {
      const { profile: p } = await api.getProfile({ noSignOutOn401: true });
      setProfile(p);
    } catch { /* ignore */ }
  }

  const value = { user, profile, loading, login, register, logout, refreshProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
