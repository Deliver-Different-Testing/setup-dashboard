import { Router } from 'express';
import { getApiClient } from '../index.js';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    const client = getApiClient();
    const env = client.getEnvironment();
    const sessionValid = await client.isSessionValid();

    res.json({
      success: true,
      environment: { name: env.name, key: client.getEnvKey(), description: env.description },
      session: { valid: sessionValid },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
