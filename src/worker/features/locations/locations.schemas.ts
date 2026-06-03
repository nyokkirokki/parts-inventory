import { z } from "zod";

export const locationWriteSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
});

export type LocationWriteInput = z.infer<typeof locationWriteSchema>;
