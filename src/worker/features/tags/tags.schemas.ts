import { z } from "zod";

export const tagWriteSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
});

export type TagWriteInput = z.infer<typeof tagWriteSchema>;
