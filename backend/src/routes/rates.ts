import { Router } from 'express';
import { z } from 'zod';
import { getApiClient } from '../index.js';
import { getSession, completeStep } from '../services/setup-orchestrator.js';
import { setupZones, ZoneInput } from '../services/zone-setup.js';
import { setupRates, RateInput } from '../services/rate-setup.js';
import { ApiError } from '../middleware/error-handler.js';

const router = Router();

const RatesSchema = z.object({
  sessionId: z.string(),
  baseRate: z.number(),
  perKmRate: z.number(),
  minCharge: z.number(),
  fuelSurcharge: z.number(),
  waitTime: z.number(),
  afterHours: z.number(),
  zones: z.array(z.object({
    name: z.string(),
    ranges: z.array(z.string())
  })),
  weightBreaks: z.array(z.object({
    min: z.number(),
    max: z.number(),
    surcharge: z.number()
  }))
});

router.post('/setup/rates', async (req, res, next) => {
  try {
    const input = RatesSchema.parse(req.body);
    const session = getSession(input.sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    const client = getApiClient();
    const companyName = session.business?.companyName || 'Setup';

    // Step 1-3: Create zones
    const zoneResult = await setupZones(client, `${companyName} Zones`, input.zones);
    session.entityIds.zoneGroupId = zoneResult.zoneGroupId;
    session.entityIds.zoneIds = zoneResult.zones.map(z => z.id);

    // Step 4-8: Create rates, breaks, zone rates, fuel
    const rateResult = await setupRates(client, {
      ...input,
      zones: zoneResult.zones.map(z => ({ name: z.name, id: z.id })),
      zoneGroupId: zoneResult.zoneGroupId
    }, `${companyName} Rate Card`);

    session.entityIds.rateCardId = rateResult.rateCardId;
    session.entityIds.breakGroupIds = rateResult.breakGroupIds;
    session.entityIds.fuelSurchargeId = rateResult.fuelSurchargeId;
    completeStep(session.id, 3);

    res.json({
      success: true,
      step: 3,
      zones: zoneResult,
      rates: rateResult
    });
  } catch (err) {
    next(err);
  }
});

export default router;
