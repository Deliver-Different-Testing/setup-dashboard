import { Router } from 'express';
import { z } from 'zod';
import { getApiClient } from '../index.js';
import { getSession, completeStep } from '../services/setup-orchestrator.js';
import { trackEntity, trackEntities } from '../services/database.js';
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
    trackEntity(session.id, { entityType: 'zone_group', entityId: zoneResult.zoneGroupId, entityName: `${companyName} Zones`, stepNumber: 3 });
    trackEntities(session.id, zoneResult.zones.map((z: any) => ({ entityType: 'zone', entityId: z.id, entityName: z.name, stepNumber: 3 })));

    // Step 4-8: Create rates, breaks, zone rates, fuel
    const rateResult = await setupRates(client, {
      ...input,
      zones: zoneResult.zones.map((z: any) => ({ name: z.name, id: z.id })),
      zoneGroupId: zoneResult.zoneGroupId
    }, `${companyName} Rate Card`);

    trackEntity(session.id, { entityType: 'rate_card', entityId: rateResult.rateCardId, entityName: `${companyName} Rate Card`, stepNumber: 3 });
    trackEntities(session.id, rateResult.breakGroupIds.map((id: number) => ({ entityType: 'break_group', entityId: id, stepNumber: 3 })));
    if (rateResult.fuelSurchargeId) trackEntity(session.id, { entityType: 'fuel_surcharge', entityId: rateResult.fuelSurchargeId, stepNumber: 3 });
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
