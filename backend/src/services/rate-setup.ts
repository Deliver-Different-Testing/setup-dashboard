/**
 * Rate Setup Service
 *
 * Orchestrates: rate card → break groups → breaks → zone rates → fuel surcharge
 * API endpoints: /api/rateCard, /api/breakGroup, /api/break, /api/zoneRate, /API/fuel
 */

import { IApiClient } from '../api-client.js';
import { ApiError } from '../middleware/error-handler.js';

export interface RateInput {
  baseRate: number;
  perKmRate: number;
  minCharge: number;
  fuelSurcharge: number;
  waitTime: number;
  afterHours: number;
  zones: Array<{ name: string; id: number }>;
  weightBreaks: Array<{ min: number; max: number; surcharge: number }>;
  zoneGroupId: number;
  serviceTypeIds?: number[]; // from /api/speed
}

export interface RateSetupResult {
  rateCardId: number;
  breakGroupIds: number[];
  zoneRateCount: number;
  fuelSurchargeId?: number;
}

export async function setupRates(
  client: IApiClient,
  input: RateInput,
  rateCardName: string
): Promise<RateSetupResult> {
  // 1. Create rate card
  const rcResp = await client.post('/api/rateCard', {
    name: rateCardName,
    active: true
  });
  if (!rcResp.success) throw new ApiError(500, `Failed to create rate card: ${rcResp.error}`);
  const rateCardId = extractId(rcResp.data);
  if (!rateCardId) throw new ApiError(500, 'Rate card created but no ID returned');

  // 2. Create break groups (one per service type, default to [1] if not specified)
  const serviceTypes = input.serviceTypeIds?.length ? input.serviceTypeIds : [1];
  const breakGroupIds: number[] = [];

  for (const stId of serviceTypes) {
    const bgResp = await client.post('/api/breakGroup', {
      name: `${rateCardName} - Service ${stId}`,
      rateCardId,
      serviceTypeId: stId
    });
    if (!bgResp.success) throw new ApiError(500, `Failed to create break group: ${bgResp.error}`);
    const bgId = extractId(bgResp.data);
    if (!bgId) throw new ApiError(500, 'Break group created but no ID returned');
    breakGroupIds.push(bgId);

    // 3. Create weight breaks for each break group
    if (input.weightBreaks.length > 0) {
      const breakItems = input.weightBreaks.map(wb => ({
        breakGroupId: bgId,
        minWeight: wb.min,
        maxWeight: wb.max,
        rate: wb.surcharge
      }));
      await client.bulkCreate('/api/break', breakItems, { delayMs: 50 });
    }
  }

  // 4. Create zone rates (each zone pair × each break group)
  let zoneRateCount = 0;
  if (input.zones.length > 0 && breakGroupIds.length > 0) {
    const zoneRateItems: unknown[] = [];
    for (const zone of input.zones) {
      for (const bgId of breakGroupIds) {
        zoneRateItems.push({
          zoneNameId: zone.id,
          originZone: 1,
          destinationZone: 1,
          breakGroupId: bgId
        });
      }
    }
    const zrResult = await client.bulkCreate('/api/zoneRate', zoneRateItems, { delayMs: 50 });
    zoneRateCount = zrResult.success;
  }

  // 5. Create fuel surcharge
  let fuelSurchargeId: number | undefined;
  if (input.fuelSurcharge > 0) {
    const fuelResp = await client.post('/API/fuel', {
      start: new Date().toISOString().split('T')[0],
      rate: input.fuelSurcharge / 100, // Convert percentage to decimal
      active: true
    });
    if (fuelResp.success) {
      fuelSurchargeId = extractId(fuelResp.data);
    }
  }

  return { rateCardId, breakGroupIds, zoneRateCount, fuelSurchargeId };
}

function extractId(data: unknown): number | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  if ('id' in obj && typeof obj.id === 'number') return obj.id;
  if ('Id' in obj && typeof obj.Id === 'number') return obj.Id;
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      if ('id' in nested && typeof nested.id === 'number') return nested.id;
    }
  }
  return undefined;
}
