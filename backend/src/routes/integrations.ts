import { Router } from 'express';
const router = Router();

router.post('/setup/integrations', async (_req, res) => {
  res.json({ success: true, message: 'Coming soon', step: 6 });
});

export default router;
