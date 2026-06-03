import { z } from "zod";

export const categoryWriteSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
});

export const attributeDefinitionSchema = z.object({
  id: z.number().optional(),
  key: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1),
  dataType: z.enum(["text", "number", "boolean", "date"]),
  unit: z.string().trim().optional().nullable(),
  groupName: z.string().trim().optional().nullable(),
  isSearchable: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

export const categoryListHeaderSchema = z.object({
  id: z.number().optional(),
  attributeDefinitionId: z.number().optional().nullable(),
  fieldKey: z.enum(["modelNumber", "name", "description", "manufacturer", "categoryName", "status", "location", "stockQuantity", "archived", "actions"]).optional().nullable(),
  label: z.string().trim().min(1),
  sortOrder: z.number().default(0),
  isVisible: z.boolean().default(true),
});

export type CategoryWriteInput = z.infer<typeof categoryWriteSchema>;
export type AttributeDefinitionInput = z.infer<typeof attributeDefinitionSchema>;
export type CategoryListHeaderInput = z.infer<typeof categoryListHeaderSchema>;
