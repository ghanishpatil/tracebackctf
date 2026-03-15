import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AnnouncementBanner from './components/AnnouncementBanner';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Challenges from './pages/Challenges';
import ChallengeDetail from './pages/ChallengeDetail';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

export default function App() {
  return (
    <>
      <Navbar />
      <AnnouncementBanner />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
          />
          <Route
            path="/challenges"
            element={<ProtectedRoute><Challenges /></ProtectedRoute>}
          />
          <Route
            path="/challenges/:id"
            element={<ProtectedRoute><ChallengeDetail /></ProtectedRoute>}
          />
          <Route
            path="/leaderboard"
            element={<ProtectedRoute><Leaderboard /></ProtectedRoute>}
          />
          <Route
            path="/profile"
            element={<ProtectedRoute><Profile /></ProtectedRoute>}
          />
          <Route
            path="/admin"
            element={<ProtectedRoute><Admin /></ProtectedRoute>}
          />
        </Routes>
      </main>
    </>
  );
}
