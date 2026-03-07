import { Router } from 'express';
import { getApiClient } from '../index.js';
import { DfrntDualClient } from '../api-client.js';
import { extractArray } from '../types/api.js';

const router = Router();

// Validate username uniqueness
router.get('/setup/validate/username', async (req, res, next) => {
  try {
    const username = req.query.username as string;
    if (!username) return res.json({ success: true, available: false, error: 'No username provided' });
    
    const client = getApiClient();
    const adminClient = client instanceof DfrntDualClient ? client.adminClient : client;
    const resp = await adminClient.get('/api/user');
    const users = extractArray<any>(resp.data, 'users');
    const exists = users.some((u: any) => 
      (u.userName || u.username || u.email || '').toLowerCase() === username.toLowerCase()
    );
    res.json({ success: true, available: !exists, field: 'username', value: username });
  } catch (err) {
    // If API fails, don't block the user
    res.json({ success: true, available: true, field: 'username', value: req.query.username, unchecked: true });
  }
});

// Validate client code uniqueness
router.get('/setup/validate/client-code', async (req, res, next) => {
  try {
    const code = req.query.code as string;
    if (!code) return res.json({ success: true, available: false, error: 'No code provided' });
    
    const client = getApiClient();
    const adminClient = client instanceof DfrntDualClient ? client.adminClient : client;
    const resp = await adminClient.get('/api/client');
    const clients = extractArray<any>(resp.data, 'clients');
    const exists = clients.some((c: any) => 
      (c.code || c.clientCode || '').toLowerCase() === code.toLowerCase()
    );
    res.json({ success: true, available: !exists, field: 'clientCode', value: code });
  } catch (err) {
    res.json({ success: true, available: true, field: 'clientCode', value: req.query.code, unchecked: true });
  }
});

// Validate courier code uniqueness
router.get('/setup/validate/courier-code', async (req, res, next) => {
  try {
    const code = req.query.code as string;
    if (!code) return res.json({ success: true, available: false, error: 'No code provided' });
    
    const client = getApiClient();
    const adminClient = client instanceof DfrntDualClient ? client.adminClient : client;
    const resp = await adminClient.get('/api/courier');
    const couriers = extractArray<any>(resp.data, 'couriers');
    const exists = couriers.some((c: any) => 
      (c.code || c.courierCode || '').toLowerCase() === code.toLowerCase()
    );
    res.json({ success: true, available: !exists, field: 'courierCode', value: code });
  } catch (err) {
    res.json({ success: true, available: true, field: 'courierCode', value: req.query.code, unchecked: true });
  }
});

export default router;
