import { Router } from 'express';
import { z } from 'zod';
import { getSession, updateSession, completeStep } from '../services/setup-orchestrator.js';
import { ApiError } from '../middleware/error-handler.js';

const router = Router();

const BusinessSchema = z.object({
  sessionId: z.string(),
  companyName: z.string().min(1),
  geography: z.array(z.string()),
  verticals: z.array(z.string()),
  currentSystem: z.string(),
  deliveriesPerMonth: z.string()
});

router.post('/setup/business', async (req, res, next) => {
  try {
    const input = BusinessSchema.parse(req.body);
    const session = getSession(input.sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    updateSession(session.id, {
      business: {
        companyName: input.companyName,
        geography: input.geography,
        verticals: input.verticals,
        currentSystem: input.currentSystem,
        deliveriesPerMonth: input.deliveriesPerMonth
      }
    });
    completeStep(session.id, 0);

    res.json({ success: true, message: 'Business profile saved', step: 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
