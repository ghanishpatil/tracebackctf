require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const challengeRoutes = require('./routes/challenges');
const submissionRoutes = require('./routes/submissions');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');
const teamRoutes = require('./routes/teams');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 4000;

// Configure CORS for production
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('combined'));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const { authenticate } = require('./middleware/authMiddleware');
const announcementService = require('./services/announcementService');
const eventService = require('./services/eventService');

app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api', submissionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/announcements', authenticate, async (_req, res, next) => {
  try {
    const announcements = await announcementService.getActive();
    res.json({ announcements });
  } catch (err) {
    next(err);
  }
});

app.get('/api/timer', authenticate, async (_req, res, next) => {
  try {
    const event = await eventService.getActiveEvent();
    const timer = eventService.computeTimerState(event);
    res.json({ title: event?.title || '', status: timer.status, remaining: timer.remaining, duration: event?.duration || 0 });
  } catch (err) {
    next(err);
  }
});

// Remove static file serving for API-only deployment
// const path = require('path');
// const clientDist = path.resolve(__dirname, '../client/dist');
// app.use(express.static(clientDist));
// app.get('*', (_req, res, next) => {
//   if (_req.path.startsWith('/api')) return next();
//   res.sendFile(path.join(clientDist, 'index.html'));
// });

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
