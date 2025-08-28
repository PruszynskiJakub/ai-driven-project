import { z } from 'zod';

export const CreateSparkSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title is required')
    .max(255, 'Title must be 255 characters or less'),
  initialThoughts: z.string()
    .max(500, 'Initial thoughts must be 500 characters or less')
    .optional(),
});

export const SparkResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  initialThoughts: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateSparkRequest = z.infer<typeof CreateSparkSchema>;
export type SparkResponse = z.infer<typeof SparkResponseSchema>;