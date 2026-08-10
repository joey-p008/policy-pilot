import { z } from 'zod';

export const createHitlAccessRequestSchema = z.object({
  targetEntitlement: z.string().min(1),
  justification: z.string().min(1),
});

export type CreateHitlAccessRequestDto = z.infer<typeof createHitlAccessRequestSchema>;

export const hitlDecisionBodySchema = z.object({
  admin_id: z.string().min(1),
});

export type HitlDecisionBodyDto = z.infer<typeof hitlDecisionBodySchema>;
