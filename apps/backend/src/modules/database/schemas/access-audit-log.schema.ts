import { z } from 'zod';

export const createAccessAuditLogSchema = z.object({
  requestId: z.string().min(1),
  actorId: z.string().uuid(),
  action: z.string().min(1),
  previousState: z.record(z.unknown()),
  newState: z.record(z.unknown()),
  id: z.string().uuid().optional(),
});

export type CreateAccessAuditLogInput = z.infer<typeof createAccessAuditLogSchema>;
