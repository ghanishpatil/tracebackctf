const challengeService = require('../services/challengeService');
const hintService = require('../services/hintService');
const { HINT_PENALTY } = require('../shared/constants');

async function getAll(req, res, next) {
  try {
    const challenges = await challengeService.getAllActive();

    const teamId = req.userProfile?.teamId;
    let usageMap = {};
    if (teamId) {
      const checks = await Promise.all(
        challenges.map((c) =>
          hintService.getHintUsage(teamId, c.id).then((u) => [c.id, u])
        )
      );
      for (const [cid, usage] of checks) { usageMap[cid] = usage; }
    }

    const enriched = challenges.map((c) => {
      const usage = usageMap[c.id];
      const totalHints = Array.isArray(c.hints) ? c.hints.length : 0;
      const revealed = usage ? usage.hintsRevealed : 0;
      return {
        ...c,
        hints: undefined,
        hintUsed: revealed > 0,
        hintsRevealed: revealed,
        totalHints,
        hasHints: totalHints > 0,
        hintPenalty: HINT_PENALTY[c.difficulty] || 0.5,
      };
    });

    res.json({ challenges: enriched });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const challenge = await challengeService.getById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const teamId = req.userProfile?.teamId;
    const allHints = challenge.hints || [];
    const totalHints = allHints.length;
    let revealed = 0;

    if (teamId) {
      const usage = await hintService.getHintUsage(teamId, challenge.id);
      if (usage) revealed = usage.hintsRevealed || 0;
    }

    const visibleHints = allHints.slice(0, revealed);

    res.json({
      challenge: {
        ...challenge,
        hints: visibleHints,
        hintsRevealed: revealed,
        totalHints,
        hintUsed: revealed > 0,
        hasHints: totalHints > 0,
        hintPenalty: HINT_PENALTY[challenge.difficulty] || 0.5,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function requestHint(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const teamId = req.userProfile?.teamId;

    if (!teamId) {
      return res.status(400).json({ error: 'You must be on a team to request hints' });
    }

    const challenge = await challengeService.getById(id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const allHints = challenge.hints || [];
    if (allHints.length === 0) {
      return res.status(400).json({ error: 'No hints available for this challenge' });
    }

    const usage = await hintService.getHintUsage(teamId, id);
    const currentRevealed = usage ? (usage.hintsRevealed || 0) : 0;

    if (currentRevealed >= allHints.length) {
      return res.json({
        hints: allHints,
        hintsRevealed: currentRevealed,
        totalHints: allHints.length,
        allRevealed: true,
      });
    }

    const result = await hintService.revealNextHint(teamId, id, userId, allHints.length);
    const visibleHints = allHints.slice(0, result.revealed);

    const penalty = HINT_PENALTY[challenge.difficulty] || 0.5;
    const response = {
      hints: visibleHints,
      hintsRevealed: result.revealed,
      totalHints: allHints.length,
      isFirst: result.isFirst,
    };

    if (result.isFirst) {
      const pointsLost = Math.floor(challenge.points * penalty);
      response.penalty = pointsLost;
      response.effectivePoints = challenge.points - pointsLost;
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, requestHint };
