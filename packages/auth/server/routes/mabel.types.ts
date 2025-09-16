import { z } from 'zod';

export const ZMabelAuthRequestSchema = z.object({
  token: z.string().min(1),
});
