const challengeService = require('../services/challengeService');
const submissionService = require('../services/submissionService');
const teamService = require('../services/teamService');
const eventService = require('../services/eventService');
const hintService = require('../services/hintService');
const { HINT_PENALTY } = require('../shared/constants');

async function submitFlag(req, res, next) {
  try {
    const { challengeId, flag } = req.body;
    const userId = req.user.uid;
    const teamId = req.userProfile?.teamId;

    if (!challengeId || !flag) {
      return res.status(400).json({ error: 'challengeId and flag are required' });
    }

    if (req.userProfile?.banned) {
      return res.status(403).json({ error: 'Your account has been suspended' });
    }

    if (!teamId) {
      return res.status(400).json({ error: 'You must be on a team to submit flags' });
    }

    const event = await eventService.getActiveEvent();
    const timer = eventService.computeTimerState(event);
    if (timer.status !== 'running') {
      return res.status(403).json({ error: 'Competition timer is not running. Flag submissions are closed.' });
    }

    const alreadySolved = await submissionService.hasTeamSolved(teamId, challengeId);
    if (alreadySolved) {
      return res.status(409).json({ error: 'Your team has already solved this challenge' });
    }

    const challenge = await challengeService.getByIdWithFlag(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    if (!challenge.isActive) {
      return res.status(403).json({ error: 'Challenge is not active' });
    }

    const correct = flag.trim() === challenge.flag;

    await submissionService.create({ userId, teamId, challengeId, flag: flag.trim(), correct });

    if (correct) {
      const usedHint = await hintService.hasUsedHint(teamId, challengeId);
      let awarded = challenge.points;
      if (usedHint) {
        const penalty = HINT_PENALTY[challenge.difficulty] || 0.5;
        awarded = Math.floor(challenge.points * (1 - penalty));
      }
      await teamService.addScore(teamId, awarded);
      await challengeService.incrementSolveCount(challengeId);

      res.json({
        correct,
        pointsAwarded: awarded,
        hintPenalty: usedHint,
        message: usedHint
          ? `Correct! ${awarded} points awarded (hint penalty applied).`
          : `Correct flag! ${awarded} points awarded.`,
      });
    } else {
      res.json({
        correct,
        message: 'Incorrect flag. Try again.',
      });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { submitFlag };
