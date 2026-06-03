import { z } from "zod";

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "色は #RRGGBB 形式で指定してください");

export const statusWriteSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  color: hexColorSchema.optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export type StatusWriteInput = z.infer<typeof statusWriteSchema>;
