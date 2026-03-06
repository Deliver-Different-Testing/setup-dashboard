import { Router } from 'express';
const router = Router();

router.post('/setup/partners', async (_req, res) => {
  res.json({ success: true, message: 'Coming soon', step: 8 });
});

export default router;
