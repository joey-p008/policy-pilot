import { z } from 'zod';

export const idempotencyLookupSchema = z.object({
  requestId: z.string().min(1),
  endpoint: z.string().min(1),
});

export const idempotencyStoreSchema = idempotencyLookupSchema.extend({
  responsePayload: z.record(z.unknown()),
});

export type IdempotencyLookupInput = z.infer<typeof idempotencyLookupSchema>;
export type IdempotencyStoreInput = z.infer<typeof idempotencyStoreSchema>;
