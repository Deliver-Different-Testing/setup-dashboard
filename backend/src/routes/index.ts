import { Router } from 'express';
import { z } from 'zod';
import { createSession, getSession } from '../services/setup-orchestrator.js';
import { listEnvironments } from '../types/api.js';
import { ApiError } from '../middleware/error-handler.js';

import healthRouter from './health.js';
import businessRouter from './business.js';
import teamRouter from './team.js';
import clientsRouter from './clients.js';
import ratesRouter from './rates.js';
import couriersRouter from './couriers.js';
import automationsRouter from './automations.js';
import integrationsRouter from './integrations.js';
import appConfigRouter from './app-config.js';
import partnersRouter from './partners.js';
import importRouter from './import.js';

const router = Router();

// Session management
const CreateSessionSchema = z.object({
  environment: z.string().optional()
});

router.post('/setup/session', (req, res, next) => {
  try {
    const input = CreateSessionSchema.parse(req.body);
    const env = input.environment || process.env.DFRNT_ENVIRONMENT || 'medical-staging';
    if (!listEnvironments().includes(env)) {
      throw new ApiError(400, `Invalid environment: ${env}. Available: ${listEnvironments().join(', ')}`);
    }
    const session = createSession(env);
    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

router.get('/setup/session/:id', (req, res, next) => {
  try {
    const session = getSession(req.params.id);
    if (!session) throw new ApiError(404, 'Session not found');
    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

// Mount all step routes
router.use(healthRouter);
router.use(businessRouter);
router.use(teamRouter);
router.use(clientsRouter);
router.use(ratesRouter);
router.use(couriersRouter);
router.use(automationsRouter);
router.use(integrationsRouter);
router.use(appConfigRouter);
router.use(partnersRouter);
router.use(importRouter);

export default router;
