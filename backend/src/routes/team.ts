import { Router } from 'express';
import { z } from 'zod';
import { getApiClient } from '../index.js';
import { getSession, completeStep } from '../services/setup-orchestrator.js';
import { trackEntities } from '../services/database.js';
import { ApiError } from '../middleware/error-handler.js';
import { extractArray } from '../types/api.js';

const router = Router();

const TeamSchema = z.object({
  sessionId: z.string(),
  members: z.array(z.object({
    name: z.string(),
    email: z.string().email(),
    role: z.string()
  }))
});

router.post('/setup/team', async (req, res, next) => {
  try {
    const input = TeamSchema.parse(req.body);
    const session = getSession(input.sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    const client = getApiClient();
    const createdIds: number[] = [];
    const errors: string[] = [];

    for (const member of input.members) {
      // TMS user creation endpoint — uses /api/user
      const resp = await client.post('/api/user', {
        name: member.name,
        email: member.email,
        role: member.role,
        active: true
      });

      if (resp.success && resp.data) {
        const data = resp.data as Record<string, unknown>;
        const id = (data.id || data.Id) as number | undefined;
        if (id) createdIds.push(id);
      } else {
        errors.push(`Failed to create user ${member.email}: ${resp.error}`);
      }
    }

    trackEntities(session.id, createdIds.map(id => ({ entityType: 'user', entityId: id, stepNumber: 1 })));
    completeStep(session.id, 1);

    res.json({
      success: true,
      step: 1,
      created: createdIds.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
});

export default router;
