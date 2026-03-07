import { Router } from 'express';
import { z } from 'zod';
import { getSession, updateSession, completeStep } from '../services/setup-orchestrator.js';
import { ApiError } from '../middleware/error-handler.js';

const router = Router();

const BusinessSchema = z.object({
  sessionId: z.string(),
  companyName: z.string().min(1),
  geography: z.array(z.string()),
  verticals: z.array(z.string()),
  currentSystem: z.string(),
  deliveriesPerMonth: z.string(),
  // Expanded fields
  legalName: z.string().optional(),
  registrationNumber: z.string().optional(),
  countryOfRegistration: z.string().optional(),
  stateOfIncorporation: z.string().optional(),
  businessType: z.string().optional(),
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvc: z.string().optional(),
  cardholderName: z.string().optional(),
  billingAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
  }).optional(),
  primaryContact: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    title: z.string(),
  }).optional(),
});

router.post('/setup/business', async (req, res, next) => {
  try {
    const input = BusinessSchema.parse(req.body);
    const session = getSession(input.sessionId);
    if (!session) throw new ApiError(404, 'Session not found');

    const { sessionId, ...businessData } = input;
    updateSession(session.id, {
      business: businessData as any,
    });
    completeStep(session.id, 0);

    res.json({ success: true, message: 'Business profile saved', step: 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
