/**
 * Courier Setup Service
 *
 * Creates couriers via /api/courier, agents via /api/agent,
 * and agent vehicles via /api/agentVehicle
 */

import { DfrntApiClient } from '../api-client.js';
import { ApiError } from '../middleware/error-handler.js';

export interface CourierInput {
  name: string;
  phone?: string;
  email?: string;
  vehicle?: string;
  zone?: string;
  firstName?: string;
  surName?: string;
  password?: string;
}

export interface CourierSetupResult {
  couriers: Array<{ name: string; courierId?: number; agentId?: number; error?: string }>;
  totalCreated: number;
}

export async function setupCouriers(
  client: DfrntApiClient,
  couriers: CourierInput[]
): Promise<CourierSetupResult> {
  const results: CourierSetupResult['couriers'] = [];
  let totalCreated = 0;

  for (const c of couriers) {
    try {
      // 1. Create courier
      const nameParts = c.name.split(' ');
      const firstName = c.firstName || nameParts[0] || c.name;
      const surName = c.surName || nameParts.slice(1).join(' ') || 'Driver';

      const courierResp = await client.post('/api/courier', {
        name: c.name,
        code: c.name.substring(0, 10).toUpperCase().replace(/\s+/g, ''),
        firstName,
        surName,
        personalMobile: c.phone || '',
        email: c.email || `${firstName.toLowerCase()}@driver.local`,
        password: c.password || 'Driver123!',
        courierType: 1,
        active: true
      });

      let courierId: number | undefined;
      if (courierResp.success) {
        courierId = extractId(courierResp.data);
      }

      // 2. Create agent (for dispatch assignment)
      const agentResp = await client.post('/api/agent', {
        name: c.name,
        code: c.name.substring(0, 10).toUpperCase().replace(/\s+/g, ''),
        phone: c.phone || ''
      });

      let agentId: number | undefined;
      if (agentResp.success) {
        agentId = extractId(agentResp.data);
      }

      results.push({ name: c.name, courierId, agentId });
      if (courierId) totalCreated++;
    } catch (err) {
      results.push({
        name: c.name,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return { couriers: results, totalCreated };
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
