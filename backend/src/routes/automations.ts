import { Router } from 'express';
import { z } from 'zod';
import { getApiClient } from '../index.js';
import { getSession, completeStep } from '../services/setup-orchestrator.js';
import { ApiError } from '../middleware/error-handler.js';

const router = Router();

const AutomationsSchema = z.object({
  sessionId: z.string(),
  rules: z.array(z.object({
    type: z.string(),
    enabled: z.boolean(),
    name: z.string().optional(),
    description: z.string().optional(),
    conditions: z.array(z.object({
      type: z.string(),
      jobTypeFilter: z.string().optional(),
      timeThreshold: z.number().optional(),
      statusFilter: z.string().optional()
    })).optional(),
    actions: z.array(z.object({
      type: z.string(),
      targetValue: z.string().optional(),
      eventMessage: z.string().optional(),
      smsMessage: z.string().optional(),
      emailSubject: z.string().optional()
    })).optional()
  }))
});

router.post('/setup/automations', async (req, res, next) => {
  try {
    const input = AutomationsSchema.parse(req.body);
    const session = getSession(input.sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    const client = getApiClient();
    const createdIds: number[] = [];
    const errors: string[] = [];

    for (const rule of input.rules) {
      // Create the automation rule
      const resp = await client.post('/api/automationRules', {
        name: rule.name || `${rule.type} Rule`,
        description: rule.description || '',
        conditions: rule.conditions || [{ type: rule.type, jobTypeFilter: 'ALL' }],
        actions: rule.actions || [{ type: 'CREATE_EVENT', eventMessage: `${rule.type} triggered` }]
      });

      if (resp.success && resp.data) {
        const data = resp.data as Record<string, unknown>;
        const id = (data.id || data.Id) as number | undefined;
        if (id) {
          createdIds.push(id);

          // Toggle active state if needed
          if (!rule.enabled) {
            await client.post(`/api/automationRules/${id}/toggle`, {});
          }
        }
      } else {
        errors.push(`Failed to create rule "${rule.type}": ${resp.error}`);
      }
    }

    session.entityIds.automationRuleIds = createdIds;
    completeStep(session.id, 5);

    res.json({
      success: true,
      step: 5,
      created: createdIds.length,
      ruleIds: createdIds,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
});

export default router;
