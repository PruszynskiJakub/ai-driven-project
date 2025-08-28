import { z } from 'zod';

export const CreateStorySchema = z.object({
  sparkId: z.string().uuid(),
  content: z.string().optional(),
});

export const UpdateStorySchema = z.object({
  content: z.string().max(50000, 'Content must be 50,000 characters or less'),
  isAutoSave: z.boolean().optional(),
});

export const StoryResponseSchema = z.object({
  id: z.string().uuid(),
  sparkId: z.string().uuid(),
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastAutoSavedAt: z.string().datetime(),
});

export type CreateStoryRequest = z.infer<typeof CreateStorySchema>;
export type UpdateStoryRequest = z.infer<typeof UpdateStorySchema>;
export type StoryResponse = z.infer<typeof StoryResponseSchema>;