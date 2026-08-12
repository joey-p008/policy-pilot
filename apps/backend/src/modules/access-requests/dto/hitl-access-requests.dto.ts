import { z } from 'zod';

export const createHitlAccessRequestSchema = z.object({
  title: z.string().min(1),
  department: z.string().min(1),
  costCenter: z.string().min(1),
  systemName: z.string().min(1),
  entitlementKey: z.string().min(1),
  justification: z.string().min(1),
});

export type CreateHitlAccessRequestDto = z.infer<typeof createHitlAccessRequestSchema>;
