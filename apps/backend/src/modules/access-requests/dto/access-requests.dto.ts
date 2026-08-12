import { z } from 'zod';

export const accessRequestSchema = z.object({
  request_id: z.string().min(1),
  employee_id: z.string().min(1),
  request_type: z.literal('GRANT_ENTITLEMENT'),
  timestamp: z.string().min(1),
  requester: z.object({
    title: z.string().min(1),
    department: z.string().min(1),
    cost_center: z.string().min(1),
  }),
  target: z.object({
    system_name: z.string().min(1),
    entitlement_key: z.string().min(1),
    justification: z.string().min(1),
  }),
});

export type AccessRequestDto = z.infer<typeof accessRequestSchema>;
