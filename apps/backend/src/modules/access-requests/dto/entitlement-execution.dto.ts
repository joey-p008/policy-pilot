import { z } from 'zod';

export const entitlementExecutionInputSchema = z.object({
  requestId: z.string().min(1),
  employeeId: z.string().min(1),
  actorUserId: z.string().uuid(),
  systemName: z.string().min(1),
  targetEntitlement: z.string().min(1),
});

export type EntitlementExecutionInput = z.infer<typeof entitlementExecutionInputSchema>;
