const teamService = require('../services/teamService');
const submissionService = require('../services/submissionService');
const challengeService = require('../services/challengeService');
const hintService = require('../services/hintService');
const { HINT_PENALTY } = require('../shared/constants');

async function getLeaderboard(req, res, next) {
  try {
    const [leaderboard, allChallenges, correctSubs] = await Promise.all([
      teamService.getLeaderboard(),
      challengeService.getAll(),
      submissionService.getCorrectSubmissions(),
    ]);

    const totalPoints = allChallenges.reduce((sum, c) => sum + (c.points || 0), 0);
    const totalChallenges = allChallenges.length;

    const solveCounts = {};
    for (const s of correctSubs) {
      solveCounts[s.teamId] = (solveCounts[s.teamId] || 0) + 1;
    }

    const enriched = leaderboard.map((t) => ({
      ...t,
      solveCount: solveCounts[t.id] || 0,
      totalPoints,
      totalChallenges,
    }));

    res.json({ leaderboard: enriched, totalPoints, totalChallenges });
  } catch (err) {
    next(err);
  }
}

async function getTimeline(_req, res, next) {
  try {
    const leaderboard = await teamService.getLeaderboard();
    const top10 = leaderboard.slice(0, 10);
    const top10Ids = new Set(top10.map((t) => t.id));

    const correctSubs = await submissionService.getCorrectSubmissions();
    const challenges = await challengeService.getAll();
    const challengeMap = {};
    for (const c of challenges) { challengeMap[c.id] = c; }

    const teamNames = {};
    for (const t of top10) { teamNames[t.id] = t.teamName; }

    const teamScores = {};
    const timeline = [];

    for (const sub of correctSubs) {
      if (!top10Ids.has(sub.teamId)) continue;

      const challenge = challengeMap[sub.challengeId];
      if (!challenge) continue;

      let points = challenge.points || 0;
      const usedHint = await hintService.hasUsedHint(sub.teamId, sub.challengeId);
      if (usedHint) {
        const penalty = HINT_PENALTY[challenge.difficulty] || 0.5;
        points = Math.floor(points * (1 - penalty));
      }

      if (!teamScores[sub.teamId]) teamScores[sub.teamId] = 0;
      teamScores[sub.teamId] += points;

      timeline.push({
        teamId: sub.teamId,
        teamName: teamNames[sub.teamId],
        score: teamScores[sub.teamId],
        timestamp: sub.timestamp,
      });
    }

    res.json({
      timeline,
      teams: top10.map((t) => ({ id: t.id, teamName: t.teamName, score: t.score })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLeaderboard, getTimeline };
