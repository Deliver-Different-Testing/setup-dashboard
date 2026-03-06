/**
 * Zone Setup Service
 *
 * Orchestrates zone group → zones → zip mappings creation.
 * API endpoints from MCP server: /api/zoneGroup, /api/zoneName, /api/zoneZip
 */

import { DfrntApiClient } from '../api-client.js';
import { extractArray } from '../types/api.js';
import { ApiError } from '../middleware/error-handler.js';

export interface ZoneInput {
  name: string;
  ranges: string[]; // zip codes or zip ranges
}

export interface ZoneSetupResult {
  zoneGroupId: number;
  zones: Array<{ name: string; id: number; zipCount: number }>;
}

export async function setupZones(
  client: DfrntApiClient,
  groupName: string,
  zones: ZoneInput[]
): Promise<ZoneSetupResult> {
  // 1. Create zone group
  const groupResp = await client.post('/api/zoneGroup', { name: groupName });
  if (!groupResp.success) {
    throw new ApiError(500, `Failed to create zone group: ${groupResp.error}`);
  }
  const zoneGroupId = extractId(groupResp.data);
  if (!zoneGroupId) throw new ApiError(500, 'Zone group created but no ID returned');

  const createdZones: ZoneSetupResult['zones'] = [];

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];

    // 2. Create zone name
    const zoneResp = await client.post('/api/zoneName', { name: zone.name });
    if (!zoneResp.success) {
      throw new ApiError(500, `Failed to create zone "${zone.name}": ${zoneResp.error}`);
    }
    const zoneId = extractId(zoneResp.data);
    if (!zoneId) throw new ApiError(500, `Zone "${zone.name}" created but no ID returned`);

    // 3. Create zip mappings for this zone
    const zipItems = zone.ranges.map(zip => ({
      zip,
      zoneNumber: i + 1,
      zoneNameId: zoneId
    }));

    if (zipItems.length > 0) {
      const bulkResult = await client.bulkCreate('/api/zoneZip', zipItems, {
        delayMs: 50,
        retryAttempts: 1
      });

      createdZones.push({
        name: zone.name,
        id: zoneId,
        zipCount: bulkResult.success
      });
    } else {
      createdZones.push({ name: zone.name, id: zoneId, zipCount: 0 });
    }
  }

  return { zoneGroupId, zones: createdZones };
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
