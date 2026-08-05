import { z } from 'zod';

export const accessRequestSchema = z.object({
  requestId: z.string().min(1),
  employeeId: z.string().min(1),
  targetEntitlement: z.string().min(1),
});

export type AccessRequestDto = z.infer<typeof accessRequestSchema>;
