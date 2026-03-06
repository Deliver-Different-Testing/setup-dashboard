import { Router } from 'express';
import { z } from 'zod';
import { getApiClient } from '../index.js';
import { getSession, completeStep } from '../services/setup-orchestrator.js';
import { setupCouriers } from '../services/courier-setup.js';
import { ApiError } from '../middleware/error-handler.js';

const router = Router();

const CouriersSchema = z.object({
  sessionId: z.string(),
  couriers: z.array(z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().optional(),
    vehicle: z.string().optional(),
    zone: z.string().optional()
  }))
});

router.post('/setup/couriers', async (req, res, next) => {
  try {
    const input = CouriersSchema.parse(req.body);
    const session = getSession(input.sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    const client = getApiClient();
    const result = await setupCouriers(client, input.couriers);

    session.entityIds.couriers = result.couriers.filter(c => c.courierId).map(c => c.courierId!);
    session.entityIds.agents = result.couriers.filter(c => c.agentId).map(c => c.agentId!);
    completeStep(session.id, 4);

    res.json({
      success: true,
      step: 4,
      totalCreated: result.totalCreated,
      couriers: result.couriers
    });
  } catch (err) {
    next(err);
  }
});

export default router;
