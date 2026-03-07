import { Router } from 'express';
import { z } from 'zod';
import { upsertTrainingProgress, getTrainingProgress, getLeaderboard } from '../services/database.js';
import { ApiError } from '../middleware/error-handler.js';

const router = Router();

const TrainingProgressSchema = z.object({
  sessionId: z.string(),
  members: z.array(z.object({
    userEmail: z.string(),
    userName: z.string(),
    role: z.string(),
    xp: z.number().optional(),
    completedChallenges: z.array(z.string()).optional(),
    currentStreak: z.number().optional(),
    lastActive: z.string().optional(),
  })),
});

const CompleteChallengeSchema = z.object({
  sessionId: z.string(),
  userEmail: z.string(),
  challengeId: z.string(),
  xpEarned: z.number(),
});

// GET training progress for a session
router.get('/setup/training/progress', (req, res, next) => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) throw new ApiError(400, 'sessionId query param required');
    const progress = getTrainingProgress(sessionId);
    res.json({ success: true, progress });
  } catch (err) { next(err); }
});

// POST bulk upsert training progress
router.post('/setup/training/progress', (req, res, next) => {
  try {
    const input = TrainingProgressSchema.parse(req.body);
    for (const m of input.members) {
      upsertTrainingProgress(input.sessionId, m);
    }
    const progress = getTrainingProgress(input.sessionId);
    res.json({ success: true, progress });
  } catch (err) { next(err); }
});

// POST complete a challenge
router.post('/setup/training/complete-challenge', (req, res, next) => {
  try {
    const input = CompleteChallengeSchema.parse(req.body);
    const existing = getTrainingProgress(input.sessionId);
    const member = existing.find(p => p.userEmail === input.userEmail);
    if (!member) throw new ApiError(404, `No training record for ${input.userEmail}`);
    if (member.completedChallenges.includes(input.challengeId)) {
      return res.json({ success: true, alreadyCompleted: true, progress: member });
    }
    upsertTrainingProgress(input.sessionId, {
      userEmail: input.userEmail,
      userName: member.userName,
      role: member.role,
      xp: member.xp + input.xpEarned,
      completedChallenges: [...member.completedChallenges, input.challengeId],
      currentStreak: member.currentStreak,
      lastActive: new Date().toISOString(),
    });
    const updated = getTrainingProgress(input.sessionId).find(p => p.userEmail === input.userEmail);
    res.json({ success: true, progress: updated });
  } catch (err) { next(err); }
});

// GET leaderboard
router.get('/setup/training/leaderboard', (req, res, next) => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) throw new ApiError(400, 'sessionId query param required');
    const leaderboard = getLeaderboard(sessionId);
    res.json({ success: true, leaderboard });
  } catch (err) { next(err); }
});

export default router;
