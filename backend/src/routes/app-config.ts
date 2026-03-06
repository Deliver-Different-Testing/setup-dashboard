import { Router } from 'express';
const router = Router();

router.post('/setup/app-config', async (_req, res) => {
  res.json({ success: true, message: 'Coming soon', step: 7 });
});

export default router;
